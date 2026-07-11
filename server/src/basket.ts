/*
 * GROCERY REVERSE-SCAN — the starter basket (the iOS deliverable, same discipline
 * as cook-state / receipts). Server-side, account-keyed; the web client is its first
 * consumer, a native app hits the same three endpoints.
 *
 *   PUT    /api/basket   upsert the ONE active basket (week id, items+checked, dedupe)
 *   GET    /api/basket   fetch the active basket, or none
 *   DELETE /api/basket   clear it
 *
 * The basket is a CHECKLIST, not commerce — no prices are stored here (the client
 * computes "about $X" from the authored draft, round-up). Ships behind
 * BASKET_ENABLED: while false nothing writes and GET reports disabled. Per-item
 * `checked` state persists so an in-aisle tap survives navigation + reload.
 */
import { Router } from "express";
import { db } from "./db.js";
import { requireAuth, type AuthedRequest } from "./auth.js";
import { BASKET_ENABLED } from "./limits.js";

export const basketRouter = Router();

const SCHEMA_VERSION = 1;

function safeParse<T>(s: string | null | undefined, fallback: T): T {
  try { return s ? (JSON.parse(s) as T) : fallback; } catch { return fallback; }
}

// PUT — upsert the one active basket for this account (checked state included).
basketRouter.put("/basket", requireAuth, async (req: AuthedRequest, res) => {
  if (!BASKET_ENABLED) return res.json({ ok: false, disabled: true });
  const b = req.body || {};
  const weekId = String(b.weekId || "").slice(0, 60);
  const items = Array.isArray(b.items) ? b.items : null;
  if (!weekId || !items) return res.status(400).json({ error: "bad-basket" });
  const dedupe = Array.isArray(b.dedupe) ? b.dedupe.filter((x: any) => typeof x === "string").slice(0, 60) : [];
  const version = typeof b.schema_version === "number" ? b.schema_version : SCHEMA_VERSION;
  const now = new Date().toISOString();
  const generatedAt = b.generatedAt ? new Date(b.generatedAt).toISOString() : now;
  await db.run(
    `INSERT INTO basket (user_id, week_id, schema_version, items_json, dedupe_json, generated_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       week_id = excluded.week_id, schema_version = excluded.schema_version,
       items_json = excluded.items_json, dedupe_json = excluded.dedupe_json,
       generated_at = excluded.generated_at, updated_at = excluded.updated_at`,
    [req.userId, weekId, version, JSON.stringify(items), JSON.stringify(dedupe), generatedAt, now]
  );
  res.json({ ok: true, updatedAt: now });
});

// GET — the active basket, or none.
basketRouter.get("/basket", requireAuth, async (req: AuthedRequest, res) => {
  if (!BASKET_ENABLED) return res.json({ enabled: false });
  const row = (await db.get("SELECT * FROM basket WHERE user_id = ?", [req.userId])) as any;
  if (!row) return res.json({ enabled: true, basket: null });
  res.json({
    enabled: true,
    basket: {
      weekId: row.week_id,
      schema_version: row.schema_version,
      items: safeParse(row.items_json, []),
      dedupe: safeParse(row.dedupe_json, []),
      generatedAt: row.generated_at,
      updatedAt: row.updated_at,
    },
  });
});

// DELETE — clear the active basket.
basketRouter.delete("/basket", requireAuth, async (req: AuthedRequest, res) => {
  await db.run("DELETE FROM basket WHERE user_id = ?", [req.userId]);
  res.json({ ok: true });
});
