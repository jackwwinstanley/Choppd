/*
 * Passwordless email OTP → JWT. Self-contained so the web testing launch needs
 * no external auth service. PLAN.md keeps AWS Cognito as the managed option for
 * the native app; this same /api/auth contract can be backed by Cognito later
 * without changing the client.
 */
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { db } from "./db.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-only-change-me";
const CODE_TTL_MS = 10 * 60 * 1000; // 10 min
const DEV_AUTH = (process.env.DEV_AUTH || "true") === "true";

export interface AuthedRequest extends Request {
  userId?: string;
}

export function issueCode(email: string): { code: string; devReturned: boolean } {
  const code = String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
  const expires = Date.now() + CODE_TTL_MS;
  db.prepare("DELETE FROM auth_codes WHERE email = ?").run(email);
  db.prepare("INSERT INTO auth_codes (email, code, expires_at) VALUES (?, ?, ?)").run(email, code, expires);
  // In production this is emailed (see .env RESEND_API_KEY); for the testing
  // launch DEV_AUTH returns it so anyone can sign in without an email provider.
  if (!DEV_AUTH) console.log(`[auth] code for ${email}: ${code}`);
  return { code, devReturned: DEV_AUTH };
}

export function verifyCode(email: string, code: string): boolean {
  const row = db.prepare("SELECT code, expires_at FROM auth_codes WHERE email = ?").get(email) as
    | { code: string; expires_at: number }
    | undefined;
  if (!row) return false;
  const ok = row.code === String(code).trim() && Date.now() < row.expires_at;
  if (ok) db.prepare("DELETE FROM auth_codes WHERE email = ?").run(email);
  return ok;
}

export function getOrCreateUser(email: string) {
  const now = new Date().toISOString();
  const existing = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (existing) return existing as any;
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, ?, ?)`
  ).run(id, email, now, now);
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as any;
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "30d" });
}

// Require a valid token. Sets req.userId.
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!token) return res.status(401).json({ error: "no-token" });
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string };
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: "bad-token" });
  }
}
