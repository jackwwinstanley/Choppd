/*
 * Auth. Two paths, one JWT:
 *   - Google OAuth (production): the client gets a Google ID token and POSTs it;
 *     we verify it against Google's keys, then upsert the user and issue our JWT.
 *   - Passwordless email OTP (local dev): self-contained, no external provider.
 *     With DEV_AUTH=true the code is returned in the response so testers can sign
 *     in without an email sender. Disabled automatically once GOOGLE_CLIENT_ID is
 *     set unless DEV_AUTH is explicitly forced on.
 *
 * Either path lands on the same /api contract, so the native app reuses it as-is.
 */
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import type { Request, Response, NextFunction } from "express";
import { db } from "./db.js";
import { seedExemptFromLedger } from "./limits.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-only-change-me";
const CODE_TTL_MS = 10 * 60 * 1000; // 10 min — MUST match the "10 minutes" in the email copy (mailer.ts)
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
// DEV_AUTH STRUCTURAL LOCKOUT (otp-plan §1): dev OTP-in-response can ONLY exist off
// production AND with an explicit opt-in flag. In prod (NODE_ENV=production) it is
// structurally false regardless of any env — a misconfigured DEV_AUTH/ALLOW_DEV_AUTH
// fails CLOSED. ALLOW_DEV_AUTH is never set in prod.
export const DEV_AUTH = process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_AUTH === "true";

// OTP hardening: codes are stored HMAC-hashed (never plaintext), peppered with a
// server secret. Pepper from its own env or derived from JWT_SECRET (never logged).
const OTP_PEPPER = process.env.OTP_PEPPER || JWT_SECRET + ":otp-pepper";
const MAX_VERIFY_ATTEMPTS = 5;               // ≥5 wrong tries → code invalidated
const RESEND_MIN_MS = 60 * 1000;             // 1 request / minute / email
const RESEND_HOUR_MAX = 5;                    // 5 requests / hour / email
function hashCode(code: string): string {
  return crypto.createHmac("sha256", OTP_PEPPER).update(String(code)).digest("hex");
}
function timingSafeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(String(a), "utf8"), bb = Buffer.from(String(b), "utf8");
  if (ba.length !== bb.length) { try { crypto.timingSafeEqual(ba, ba); } catch { /* burn */ } return false; }
  try { return crypto.timingSafeEqual(ba, bb); } catch { return false; }
}

if (JWT_SECRET === "dev-only-change-me" && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET must be set to a real secret in production");
}

const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

export interface AuthedRequest extends Request {
  userId?: string;
}

// ---- Google OAuth ----
export interface GoogleProfile { sub: string; email: string; name?: string; picture?: string; }

/** Verify a Google ID token (from Google Identity Services on the client). */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile | null> {
  if (!googleClient) return null;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID });
    const p = ticket.getPayload();
    if (!p || !p.sub || !p.email || p.email_verified === false) return null;
    return { sub: p.sub, email: p.email.toLowerCase(), name: p.name, picture: p.picture };
  } catch {
    return null;
  }
}

/** Find/create a user from a verified Google profile, linking by google_sub or email. */
export async function upsertGoogleUser(g: GoogleProfile) {
  const now = new Date().toISOString();
  let user =
    (await db.get("SELECT * FROM users WHERE google_sub = ?", [g.sub])) ||
    (await db.get("SELECT * FROM users WHERE email = ?", [g.email]));
  if (user) {
    await db.run(
      "UPDATE users SET google_sub = ?, name = COALESCE(?, name), avatar_url = COALESCE(?, avatar_url), updated_at = ? WHERE id = ?",
      [g.sub, g.name ?? null, g.picture ?? null, now, user.id]
    );
    return db.get("SELECT * FROM users WHERE id = ?", [user.id]);
  }
  const id = crypto.randomUUID();
  await db.run(
    `INSERT INTO users (id, email, google_sub, name, avatar_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, g.email, g.sub, g.name ?? null, g.picture ?? null, now, now]
  );
  // usage limits: a returning identity inherits its exempt flag from the ledger
  await db.run("UPDATE users SET limits_exempt = ? WHERE id = ?", [await seedExemptFromLedger(g.email, g.sub), id]);
  return db.get("SELECT * FROM users WHERE id = ?", [id]);
}

// ---- Email OTP (hashed, attempt-capped, throttled — otp-plan §2) ----
// Resend throttle (per-email): append every request to otp_requests, then read the
// window. Separate from auth_codes (single-active-code deletes issue history).
export async function otpRequestThrottle(email: string): Promise<{ ok: true } | { ok: false; retryAfterSec: number }> {
  const now = Date.now();
  const rows = (await db.all(
    "SELECT created_at FROM otp_requests WHERE email = ? AND created_at >= ?",
    [email, new Date(now - 60 * 60 * 1000).toISOString()]
  )) as { created_at: string }[];
  const times = rows.map((r) => Date.parse(r.created_at)).filter((n) => !isNaN(n)).sort((a, b) => b - a);
  if (times.length && now - times[0] < RESEND_MIN_MS) return { ok: false, retryAfterSec: Math.ceil((RESEND_MIN_MS - (now - times[0])) / 1000) };
  if (times.length >= RESEND_HOUR_MAX) return { ok: false, retryAfterSec: Math.ceil((times[times.length - 1] + 60 * 60 * 1000 - now) / 1000) };
  return { ok: true };
}
export async function logOtpRequest(email: string): Promise<void> {
  await db.run("INSERT INTO otp_requests (email, created_at) VALUES (?, ?)", [email, new Date().toISOString()]);
  try { await db.run("DELETE FROM otp_requests WHERE created_at < ?", [new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()]); } catch { /* opportunistic prune */ }
}
// Single-active code, stored HASHED (attempts=0). NEVER logs the plaintext (the removed
// leak); DEV_AUTH returns it in the response instead. `code` column kept '' for the box's
// legacy NOT NULL — the hash lives in code_hash.
export async function issueCode(email: string): Promise<{ code: string; devReturned: boolean }> {
  const code = String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
  const expires = Date.now() + CODE_TTL_MS;
  await db.run("DELETE FROM auth_codes WHERE email = ?", [email]);
  await db.run(
    "INSERT INTO auth_codes (email, code, code_hash, expires_at, attempts, created_at) VALUES (?, '', ?, ?, 0, ?)",
    [email, hashCode(code), expires, new Date().toISOString()]
  );
  return { code, devReturned: DEV_AUTH };
}
export type VerifyStatus = "ok" | "bad" | "expired" | "attempts";
// A no-row email still does a dummy compare, so a known-code email and an unknown one
// are indistinguishable by response shape/timing (no user enumeration).
export async function verifyCode(email: string, code: string): Promise<VerifyStatus> {
  const row = (await db.get("SELECT code_hash, expires_at, attempts FROM auth_codes WHERE email = ?", [email])) as
    | { code_hash: string; expires_at: number | string; attempts: number } | undefined;
  const attempt = hashCode(String(code).trim());   // always compute (constant-time posture)
  if (!row) { timingSafeEqualHex(attempt, attempt); return "bad"; }
  if (Number(row.attempts) >= MAX_VERIFY_ATTEMPTS) { await db.run("DELETE FROM auth_codes WHERE email = ?", [email]); return "attempts"; }
  if (Date.now() >= Number(row.expires_at)) { await db.run("DELETE FROM auth_codes WHERE email = ?", [email]); return "expired"; }
  if (!timingSafeEqualHex(row.code_hash, attempt)) { await db.run("UPDATE auth_codes SET attempts = attempts + 1 WHERE email = ?", [email]); return "bad"; }
  await db.run("DELETE FROM auth_codes WHERE email = ?", [email]);
  return "ok";
}

export async function getOrCreateUser(email: string) {
  const now = new Date().toISOString();
  const existing = await db.get("SELECT * FROM users WHERE email = ?", [email]);
  if (existing) return existing;
  const id = crypto.randomUUID();
  await db.run("INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, ?, ?)", [id, email, now, now]);
  await db.run("UPDATE users SET limits_exempt = ? WHERE id = ?", [await seedExemptFromLedger(email, null), id]);   // ledger carryover (usage limits)
  return db.get("SELECT * FROM users WHERE id = ?", [id]);
}

/**
 * Append a login event (powers the /admin "This month" dashboard). Best-effort:
 * a row per successful sign-in, never blocks or fails the auth response.
 */
export async function recordLogin(userId: string, method: "google" | "email"): Promise<void> {
  try {
    await db.run(
      "INSERT INTO logins (id, user_id, method, created_at) VALUES (?, ?, ?, ?)",
      [crypto.randomUUID(), userId, method, new Date().toISOString()]
    );
  } catch { /* analytics-only; swallow so sign-in still succeeds */ }
}

// Token-version claim: bumping TOKEN_VERSION in the env invalidates every
// outstanding token on the next restart — the cheapest possible "log everyone
// out" lever (no denylist, no DB). Tokens signed without/with an older `v`
// are rejected by decodeToken below.
// FUTURE WORK: a proper refresh-token flow (short-lived access + rotating
// refresh) — deliberately skipped pre-launch; 7d + version bump covers us.
const TOKEN_VERSION = String(process.env.TOKEN_VERSION || "1");

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId, v: TOKEN_VERSION }, JWT_SECRET, { expiresIn: "7d" });
}

// Verify signature + expiry + version. Single choke point for token checks.
function decodeToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string; v?: string };
    if (payload.v !== TOKEN_VERSION) return null;   // pre-versioning or stale-version token
    return payload.sub;
  } catch { return null; }
}

// Decode the bearer token if present, returning the userId or null (no rejection).
export function optionalUserId(req: Request): string | null {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!token) return null;
  return decodeToken(token);
}

// Require a valid token. Sets req.userId.
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!token) return res.status(401).json({ error: "no-token" });
  const userId = decodeToken(token);
  if (!userId) return res.status(401).json({ error: "bad-token" });
  req.userId = userId;
  next();
}
