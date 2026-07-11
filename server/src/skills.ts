/*
 * SKILL GRAPH — dark instrumentation endpoints (graduation system, Phase 1).
 * Design: docs/design/skill-graduation.md (§5 data model, §6 ships-now, §10 as-built).
 *
 *   POST /api/skills/complete   derive + append skill_events for a COMPLETED cook
 *   GET  /api/skills            raw per-skill evidence (founder + demand-analyst read)
 *
 * DARK BY DESIGN: the WRITE is intentionally NOT gated by SKILLS_ENABLED — like
 * scan_miss, evidence must accumulate the day testers arrive so the calibration
 * data (design §3) exists when Phase 2 is built. SKILLS_ENABLED gates the unbuilt
 * user-facing SURFACES (panel/offer/freestyle/graduation), nothing here.
 *
 * ANTI-TAMPER: the client sends only { recipeId, gatesConfirmed }. The server owns
 * which skills that recipe evidences (skills-map.ts) — no client-writable skillIds.
 * APPEND-ONLY: rows are never updated; states are recomputed at read, so thresholds
 * can calibrate later without rewriting history (the receipts forward-only rule).
 */
import crypto from "node:crypto";
import { Router } from "express";
import { db } from "./db.js";
import { requireAuth, type AuthedRequest } from "./auth.js";
import { creditRows } from "./skills-map.js";

export const skillsRouter = Router();

// POST — a completed cook. Server derives the rows from its own map; abandoned
// cooks never call this. Unknown recipe → writes nothing (honest no-op).
skillsRouter.post("/skills/complete", requireAuth, async (req: AuthedRequest, res) => {
  const b = req.body || {};
  const recipeId = String(b.recipeId || "").slice(0, 80);
  const gatesConfirmed = b.gatesConfirmed !== false;   // default true (a genuine finish confirms every gate)
  if (!recipeId) return res.status(400).json({ error: "no-recipe" });
  const rows = creditRows(recipeId, gatesConfirmed);
  if (!rows.length) return res.json({ ok: true, written: 0, unknownRecipe: true });
  const now = new Date().toISOString();
  for (const r of rows) {
    await db.run(
      `INSERT INTO skill_events (id, user_id, recipe_id, skill_id, gate_confirmed, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), req.userId, recipeId, r.skillId, r.gateConfirmed ? 1 : 0, now]
    );
  }
  res.json({ ok: true, written: rows.length });
});

// GET — raw per-skill evidence for this account. Credit-rule 2 is applied HERE
// (gate-bearing skills count only where gate_confirmed = 1); no thresholds, no
// states, no offers — Phase 1 renders nothing, this is a read for the founder.
skillsRouter.get("/skills", requireAuth, async (req: AuthedRequest, res) => {
  const uid = req.userId;
  // credited reps + total rows + last-seen, per skill
  const agg = (await db.all(
    `SELECT skill_id,
            SUM(CASE WHEN gate_confirmed = 1 THEN 1 ELSE 0 END) AS reps,
            COUNT(*) AS total,
            MAX(created_at) AS last_at
     FROM skill_events WHERE user_id = ? GROUP BY skill_id`,
    [uid]
  )) as { skill_id: string; reps: number; total: number; last_at: string }[];
  // distinct recipes among CREDITED rows (the "across M recipes" evidence unit)
  const distinct = (await db.all(
    `SELECT skill_id, COUNT(DISTINCT recipe_id) AS recipes
     FROM skill_events WHERE user_id = ? AND gate_confirmed = 1 GROUP BY skill_id`,
    [uid]
  )) as { skill_id: string; recipes: number }[];
  const recipesBySkill = new Map(distinct.map((d) => [d.skill_id, Number(d.recipes || 0)]));
  const skills = agg
    .map((a) => ({
      skillId: a.skill_id,
      reps: Number(a.reps || 0),
      recipes: recipesBySkill.get(a.skill_id) || 0,
      total: Number(a.total || 0),   // includes uncredited (gate-unconfirmed) rows
      lastAt: a.last_at,
    }))
    .sort((x, y) => y.reps - x.reps || y.total - x.total);
  res.json({ skills });
});
