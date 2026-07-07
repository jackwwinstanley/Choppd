/*
 * USAGE LIMITS (flag-gated — everyone exempt until launch; see LIMITS_DEFAULT_EXEMPT).
 * Server-authoritative: the client mirrors state for UX but every enforcement
 * decision happens here. Counting runs even while exempt (walls never show).
 *
 * ANTI-ABUSE: limit_ledger survives account deletion, keyed by one-way sha256
 * identity hashes — the deliberate exception to delete-everything, disclosed
 * in the delete-modal copy. Re-registering the same email/google_sub restores
 * counters; a different email = a fresh identity = fresh limits (accepted gap).
 */
import { Router, type Response } from "express";
import crypto from "node:crypto";
import { db } from "./db.js";
import { requireAuth, type AuthedRequest } from "./auth.js";

// ---- the launch-day switchboard -------------------------------------------------
export const LIMITS_DEFAULT_EXEMPT = true;      // flip to false at launch (new accounts)
export const SCAN_LIMIT_PER_WINDOW = 3;         // photo scans per rolling window
export const SCAN_WINDOW_DAYS = 7;              // the rolling window
export const PREMIUM_UNLOCKS = 3;               // lifetime premium-recipe unlocks
export const CORE_FREE_IDS = new Set([          // free forever — the 4 authored cooks
  "scrambled-eggs", "freebird-medium-rare-steak", "one-pot-garlic-parmesan-pasta", "crispy-chicken-thighs",
]);

export const idHash = (v: string) => crypto.createHash("sha256").update(String(v).trim().toLowerCase()).digest("hex");
const windowStart = () => new Date(Date.now() - SCAN_WINDOW_DAYS * 24 * 3600 * 1000).toISOString();

async function userRow(userId: string): Promise<any | null> {
  const r = (await db.all("SELECT id, email, google_sub, limits_exempt FROM users WHERE id = ?", [userId])) as any[];
  return r[0] || null;
}
async function ledgerFor(u: any): Promise<any | null> {
  const hashes = [u.email ? idHash(u.email) : null, u.google_sub ? idHash(u.google_sub) : null].filter(Boolean);
  if (!hashes.length) return null;
  const rows = (await db.all(`SELECT * FROM limit_ledger WHERE identity_hash IN (${hashes.map(() => "?").join(",")})`, hashes)) as any[];
  return rows[0] || null;
}

// The full limit state for an account — table-derived + ledger-carryover (a
// ledger row only exists after a deletion, so live originals never double-count).
export async function getLimitState(userId: string) {
  const u = await userRow(userId);
  if (!u) return null;
  const exempt = Number(u.limits_exempt ?? 1) === 1;
  const ws = windowStart();
  const own = (await db.all("SELECT count(*) AS n FROM scans WHERE user_id = ? AND created_at >= ? AND detected_ids <> '[]'", [userId, ws])) as any[];
  const led = await ledgerFor(u);
  let ledgerScans = 0, ledgerUnlocks = 0;
  if (led) {
    try { ledgerScans = (JSON.parse(led.scan_times || "[]") as string[]).filter((t) => t >= ws).length; } catch { /* ignore */ }
    ledgerUnlocks = Number(led.unlocks_used || 0);
  }
  const unlockRows = (await db.all("SELECT recipe_id FROM premium_unlocks WHERE user_id = ?", [userId])) as any[];
  return {
    exempt,
    scansUsed: Number(own[0]?.n || 0) + ledgerScans,
    scansLimit: SCAN_LIMIT_PER_WINDOW, windowDays: SCAN_WINDOW_DAYS,
    unlockedIds: unlockRows.map((r) => r.recipe_id),
    unlocksUsed: unlockRows.length + ledgerUnlocks,
    unlocksLimit: PREMIUM_UNLOCKS,
    coreFree: [...CORE_FREE_IDS],
  };
}

// Deletion-time ledger upsert — called INSIDE the delete transaction, before
// the user row dies. Stores only hashes + counters (no email, no name).
export async function upsertLedgerOnDelete(u: { id: string; email?: string; google_sub?: string }) {
  const ws = windowStart();
  const scanRows = (await db.all("SELECT created_at FROM scans WHERE user_id = ? AND created_at >= ? AND detected_ids <> '[]'", [u.id, ws])) as any[];
  const led0 = await ledgerFor(u);
  let priorTimes: string[] = [];
  try { priorTimes = led0 ? (JSON.parse(led0.scan_times || "[]") as string[]).filter((t) => t >= ws) : []; } catch { /* ignore */ }
  const times = [...priorTimes, ...scanRows.map((r) => r.created_at)].slice(-SCAN_LIMIT_PER_WINDOW * 2);
  const unlocks = (await db.all("SELECT count(*) AS n FROM premium_unlocks WHERE user_id = ?", [u.id])) as any[];
  const unlocksUsed = Number(unlocks[0]?.n || 0) + Number(led0?.unlocks_used || 0);
  const exempt = Number(((await db.all("SELECT limits_exempt FROM users WHERE id = ?", [u.id])) as any[])[0]?.limits_exempt ?? 1);
  const now = new Date().toISOString();
  for (const h of [u.email ? idHash(u.email) : null, u.google_sub ? idHash(u.google_sub) : null]) {
    if (!h) continue;
    await db.run(
      `INSERT INTO limit_ledger (identity_hash, scan_times, unlocks_used, exempt, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(identity_hash) DO UPDATE SET scan_times = excluded.scan_times, unlocks_used = excluded.unlocks_used, exempt = excluded.exempt, updated_at = excluded.updated_at`,
      [h, JSON.stringify(times), unlocksUsed, exempt, now]
    );
  }
  await db.run("DELETE FROM premium_unlocks WHERE user_id = ?", [u.id]);   // unlock rows die with the account; the COUNT survives in the ledger
  await db.run("DELETE FROM premium_waitlist WHERE user_id = ?", [u.id]);
}

// Signup seeding: a returning identity inherits its exempt flag from the ledger.
export async function seedExemptFromLedger(email: string | null, googleSub: string | null): Promise<number> {
  const hashes = [email ? idHash(email) : null, googleSub ? idHash(googleSub) : null].filter(Boolean);
  if (hashes.length) {
    const rows = (await db.all(`SELECT exempt FROM limit_ledger WHERE identity_hash IN (${hashes.map(() => "?").join(",")})`, hashes)) as any[];
    if (rows.length) return Number(rows[0].exempt);
  }
  return LIMITS_DEFAULT_EXEMPT ? 1 : 0;
}

export const limitsRouter = Router();

// client mirror (display only — never authority)
limitsRouter.get("/limits", requireAuth, async (req: AuthedRequest, res: Response) => {
  const st = await getLimitState(req.userId!);
  if (!st) return res.status(404).json({ error: "no-user" });
  res.json(st);
});

// THE ENFORCEMENT POINT for premium recipes: first cook start (the client calls
// this when a cook actually mounts, past the pan/stove gate). Idempotent per
// recipe: INSERT OR IGNORE — a double-tap can never burn two unlocks.
limitsRouter.post("/cook/start", requireAuth, async (req: AuthedRequest, res: Response) => {
  const recipeId = String(req.body?.recipeId || "").slice(0, 80);
  if (!recipeId) return res.status(400).json({ error: "no-recipe" });
  const st = await getLimitState(req.userId!);
  if (!st) return res.status(404).json({ error: "no-user" });
  if (CORE_FREE_IDS.has(recipeId)) return res.json({ allowed: true, reason: "core-free" });
  if (st.unlockedIds.includes(recipeId)) return res.json({ allowed: true, reason: "unlocked" });
  if (st.exempt) {
    // counting-but-not-enforcing: exempt accounts still consume unlock slots
    // silently so the counters are real when the flag flips? NO — deliberate:
    // exempt cooks do NOT burn unlocks (testers would drain slots pre-launch).
    // Exempt = allowed, nothing written.
    return res.json({ allowed: true, reason: "exempt" });
  }
  if (st.unlocksUsed >= st.unlocksLimit) return res.status(402).json({ error: "recipe-limit" });
  await db.run("INSERT INTO premium_unlocks (user_id, recipe_id, unlocked_at) VALUES (?, ?, ?) ON CONFLICT(user_id, recipe_id) DO NOTHING", [req.userId!, recipeId, new Date().toISOString()]);
  res.json({ allowed: true, reason: "consumed", remaining: st.unlocksLimit - st.unlocksUsed - 1 });
});

// waitlist: idempotent by user (second tap → already: true)
limitsRouter.post("/waitlist", requireAuth, async (req: AuthedRequest, res: Response) => {
  const trigger = ["scan", "recipe"].includes(req.body?.trigger) ? req.body.trigger : "unknown";
  const u = await userRow(req.userId!);
  const had = (await db.all("SELECT 1 FROM premium_waitlist WHERE user_id = ?", [req.userId!])) as any[];
  if (!had.length) {
    await db.run("INSERT INTO premium_waitlist (user_id, email, trigger_kind, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO NOTHING",
      [req.userId!, u?.email || null, trigger, new Date().toISOString()]);
  }
  res.json({ joined: true, already: !!had.length });
});
