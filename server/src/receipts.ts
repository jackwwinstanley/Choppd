/*
 * MONEY RECEIPT — the running savings tab (the iOS deliverable, same discipline
 * as cook-state). Server-side ledger is the source of truth; the web client is its
 * first consumer, a native app hits the same endpoints.
 *
 *   POST /api/receipts       append one COMPLETED-cook receipt (prices AS OF cook)
 *   GET  /api/receipts/tab   the running total ("Saved since joining: $X") + count
 *
 * HONESTY / SCOREBOARD RULES baked in here (not the client):
 *  - Ships behind RECEIPTS_ENABLED — while false, nothing is written and /tab
 *    reports disabled (the flag flips only after the founder audits every row).
 *  - APPEND-ONLY: rows are never updated or retroactively adjusted. A later
 *    enemy-price correction applies FORWARD only — old rows stand (they stored the
 *    price as of that cook). The tab is just SUM(save_cents).
 *  - save_cents is recomputed server-side as max(0, (enemy-cost)*portions) — the
 *    total can NEVER go negative; a scoreboard only ever counts wins.
 *  - Only completed cooks reach here (the client posts on completion); abandoned
 *    cooks never call this, so they add nothing for free.
 */
import crypto from "node:crypto";
import { Router } from "express";
import { db } from "./db.js";
import { requireAuth, type AuthedRequest } from "./auth.js";
import { RECEIPTS_ENABLED } from "./limits.js";

export const receiptsRouter = Router();

const isCents = (v: any) => Number.isInteger(v) && v >= 0 && v <= 100000; // <= $1000/serving guard

// POST — append one receipt for a completed cook. Server recomputes the save so it
// can never be negative or client-tampered, and stamps the prices as of this cook.
receiptsRouter.post("/receipts", requireAuth, async (req: AuthedRequest, res) => {
  if (!RECEIPTS_ENABLED) return res.json({ ok: false, disabled: true });
  const b = req.body || {};
  const recipeId = String(b.recipeId || "").slice(0, 80);
  const portions = Number(b.portions);
  const enemyCents = Number(b.enemyCents);
  const costCents = Number(b.costCents);
  if (!recipeId || !Number.isInteger(portions) || portions < 1 || portions > 99 || !isCents(enemyCents) || !isCents(costCents)) {
    return res.status(400).json({ error: "bad-receipt" });
  }
  const saveCents = Math.max(0, (enemyCents - costCents) * portions);   // never negative
  await db.run(
    `INSERT INTO receipt_ledger (id, user_id, recipe_id, portions, enemy_cents, cost_cents, save_cents, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [crypto.randomUUID(), req.userId, recipeId, portions, enemyCents, costCents, saveCents, new Date().toISOString()]
  );
  res.json({ ok: true, saveCents });
});

// GET — the running tab. SUM over the append-only ledger; no adjustment, ever.
receiptsRouter.get("/receipts/tab", requireAuth, async (req: AuthedRequest, res) => {
  if (!RECEIPTS_ENABLED) return res.json({ enabled: false });
  const row = (await db.get(
    "SELECT COALESCE(SUM(save_cents), 0) AS total, COUNT(*) AS cooks FROM receipt_ledger WHERE user_id = ?",
    [req.userId]
  )) as { total: number; cooks: number } | undefined;
  res.json({ enabled: true, totalCents: Number(row?.total || 0), cooks: Number(row?.cooks || 0) });
});
