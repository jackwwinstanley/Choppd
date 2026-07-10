/*
 * COOK RESUME — server-side cook state (the iOS deliverable).
 *
 * Server-side state is the SOURCE OF TRUTH; the web client is merely its first
 * consumer. A native iOS app hits these exact three endpoints and inherits
 * resume — including cross-device — with zero rework.
 *
 *   PUT    /api/cook-state   upsert the active snapshot (one active cook / account)
 *   GET    /api/cook-state   fetch the active snapshot, or none (lazily expires at 6h)
 *   DELETE /api/cook-state   clear it (finish / quit / start-over)
 *
 * Rules baked in here (not the client): ONE row per account (PK = user_id, so the
 * upsert is the concurrency guard — no client-generated ids); SERVER timestamps
 * are authoritative; the snapshot is versioned (schema_version) so iOS can parse
 * old rows; a malformed snapshot is rejected. The 6h window + cook_abandoned
 * retention event live in GET so every client inherits them identically.
 */
import crypto from "node:crypto";
import { Router } from "express";
import { db } from "./db.js";
import { requireAuth, type AuthedRequest } from "./auth.js";

export const cookStateRouter = Router();

// Bump when the snapshot shape changes in a way a reader must branch on. The
// server stamps the row's schema_version from the CLIENT's value so a mixed
// fleet (older web + newer iOS) is legible; readers gate on it.
const SCHEMA_VERSION = 1;
const RESUME_WINDOW_MS = 6 * 60 * 60 * 1000; // 6h from last-saved-at

function safeParse<T>(s: string | null | undefined, fallback: T): T {
  try { return s ? (JSON.parse(s) as T) : fallback; } catch { return fallback; }
}

// A snapshot must fully + safely identify a resumable position. Anything short of
// that is rejected (400) rather than silently stored — a corrupt row would strand
// the user's resume card. Deliberately permissive about the OPTIONAL fields
// (method/portion/prep/confirmedGates/paused): those vary by engine + recipe.
function validSnapshot(s: any): boolean {
  if (!s || typeof s !== "object") return false;
  if (typeof s.recipeId !== "string" || !s.recipeId) return false;
  if (s.engine !== "flagship" && s.engine !== "library") return false;
  if (typeof s.cueIdx !== "number" || !Number.isFinite(s.cueIdx) || s.cueIdx < 0) return false;
  if (typeof s.startedAt !== "number" || !Number.isFinite(s.startedAt) || s.startedAt <= 0) return false;
  return true;
}

// PUT — upsert the one active snapshot for this account.
cookStateRouter.put("/cook-state", requireAuth, async (req: AuthedRequest, res) => {
  const s = (req.body && (req.body.snapshot ?? req.body)) as any;
  if (!validSnapshot(s)) return res.status(400).json({ error: "bad-snapshot" });
  const now = new Date().toISOString();
  const startedAt = new Date(s.startedAt).toISOString();
  // Store the client's schema_version so a reader knows how to parse the row.
  const version = typeof s.schema_version === "number" ? s.schema_version : SCHEMA_VERSION;
  await db.run(
    `INSERT INTO cook_state (user_id, recipe_id, engine, schema_version, snapshot_json, started_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       recipe_id = excluded.recipe_id, engine = excluded.engine,
       schema_version = excluded.schema_version, snapshot_json = excluded.snapshot_json,
       started_at = excluded.started_at, updated_at = excluded.updated_at`,
    [req.userId, s.recipeId, s.engine, version, JSON.stringify(s), startedAt, now]
  );
  res.json({ ok: true, updatedAt: now, schema_version: version });
});

// GET — fetch the active snapshot. Lazily expires past the 6h window: logs a
// cook_abandoned retention event (recipe, step index, elapsed) and clears the
// row before answering "none, but you had one" so the client routes to start-over.
cookStateRouter.get("/cook-state", requireAuth, async (req: AuthedRequest, res) => {
  const row = (await db.get("SELECT * FROM cook_state WHERE user_id = ?", [req.userId])) as any;
  if (!row) return res.json({ state: null });

  const ageMs = Date.now() - new Date(row.updated_at).getTime();
  if (ageMs > RESUME_WINDOW_MS) {
    const snap = safeParse<any>(row.snapshot_json, {});
    const elapsedSec = Math.max(0, Math.round((Date.now() - new Date(row.started_at).getTime()) / 1000));
    const stepIdx = typeof snap.cueIdx === "number" ? snap.cueIdx : null;
    // Retention data: where cooks die. Emitted alongside the other cook events so
    // the demand-analyst reads it with them; detail carries the step + elapsed.
    try {
      await db.run(
        "INSERT INTO events (id, type, recipe, user_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        [crypto.randomUUID(), "cook_abandoned", row.recipe_id, req.userId,
         JSON.stringify({ stepIdx, elapsedSec, engine: row.engine }), new Date().toISOString()]
      );
    } catch { /* analytics best-effort; never blocks the clear */ }
    await db.run("DELETE FROM cook_state WHERE user_id = ?", [req.userId]);
    return res.json({ state: null, expired: { recipeId: row.recipe_id, engine: row.engine, title: snap.title || null, emoji: snap.emoji || null, stepIdx, elapsedSec } });
  }

  const snap = safeParse<any>(row.snapshot_json, {});
  res.json({
    state: {
      ...snap,
      schema_version: row.schema_version,
      startedAt: new Date(row.started_at).getTime(),
      updatedAt: row.updated_at,   // server-authoritative last-saved-at (drives "left X ago")
    },
  });
});

// DELETE — clear the active snapshot (finish, explicit quit, or start-over).
cookStateRouter.delete("/cook-state", requireAuth, async (req: AuthedRequest, res) => {
  await db.run("DELETE FROM cook_state WHERE user_id = ?", [req.userId]);
  res.json({ ok: true });
});
