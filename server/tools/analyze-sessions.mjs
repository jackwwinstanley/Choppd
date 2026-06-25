#!/usr/bin/env node
/*
 * Sizle session analytics — mine cook_sessions for product insights.
 *
 *   cd ~/sizle/server && node tools/analyze-sessions.mjs            # dashboard
 *   node tools/analyze-sessions.mjs --feedback                      # ALL written comments
 *   node tools/analyze-sessions.mjs --export sizle-sessions.json    # dump everything to JSON
 *
 * Reads DATABASE_URL (+ optional PG_CA_CERT) from server/.env. Mirrors the
 * server's SSL handling so it connects to RDS the same way the app does.
 */
import "dotenv/config";
import { Pool } from "pg";
import { readFileSync, writeFileSync } from "node:fs";

const url = process.env.DATABASE_URL;
if (!url) { console.error("No DATABASE_URL set (local SQLite has no such tooling) — run this on the server."); process.exit(1); }

// same SSL approach as server/src/db.ts: strip sslmode so our ssl config wins
let conn = url;
try { const u = new URL(url); u.searchParams.delete("sslmode"); u.searchParams.delete("ssl"); conn = u.toString(); } catch {}
let ssl = { rejectUnauthorized: false };
if (process.env.PGSSL_DISABLE === "true") ssl = false;
else if (process.env.PG_CA_CERT) ssl = { ca: readFileSync(process.env.PG_CA_CERT, "utf8"), rejectUnauthorized: true };

const pool = new Pool({ connectionString: conn, ssl, max: 4 });
const q = (sql, p = []) => pool.query(sql, p).then((r) => r.rows);
const hr = (t) => console.log("\n" + "─".repeat(66) + "\n" + t + "\n" + "─".repeat(66));
const pad = (v, n) => String(v ?? "").padEnd(n);
const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 + "%" : "—");
const args = process.argv.slice(2);
// COALESCE missing/non-array steps to [] so jsonb_array_elements never errors
const STEPS = "jsonb_array_elements(COALESCE((cs.payload_json)::jsonb->'steps','[]'::jsonb)) s";
const RATIO = "(s->>'actualSec')::numeric / nullif((s->>'authoredSec')::numeric,0)";
const VALID_STEP = "(s->>'authoredSec')::numeric > 5 AND (s->>'actualSec')::numeric > 0";

try {
  // ── export mode ──
  const exi = args.indexOf("--export");
  if (exi >= 0) {
    const file = args[exi + 1] || "sizle-sessions-export.json";
    const rows = await q("SELECT id,user_id,recipe,mode,rating,heat_source,pan,completed,created_at,payload_json FROM cook_sessions ORDER BY created_at");
    const out = rows.map((r) => { const { payload_json, ...rest } = r; let payload = null; try { payload = JSON.parse(payload_json); } catch {} return { ...rest, payload }; });
    writeFileSync(file, JSON.stringify(out, null, 2));
    console.log(`Exported ${rows.length} sessions → ${file}`);
    await pool.end(); process.exit(0);
  }

  // ── overview ──
  const [ov] = await q(`SELECT count(*)::int total, COALESCE(sum(completed),0)::int completed,
    count(DISTINCT user_id)::int users, min(created_at) first, max(created_at) last FROM cook_sessions`);
  hr("OVERVIEW");
  console.log(`sessions logged:        ${ov.total}`);
  console.log(`completed:              ${ov.completed}   (completion rate ${pct(ov.completed, ov.total)})`);
  console.log(`distinct cooks' users:  ${ov.users}`);
  console.log(`date range:             ${ov.first || "—"}  →  ${ov.last || "—"}`);
  if (ov.total === 0) { console.log("\n(no sessions yet — finish a cook while logged in to populate this)"); await pool.end(); process.exit(0); }

  // ── avg rating per recipe ──
  hr("AVG RATING PER RECIPE");
  for (const r of await q(`SELECT recipe, count(*)::int n, round(avg(rating)::numeric,2) avg_rating
    FROM cook_sessions WHERE rating IS NOT NULL GROUP BY recipe ORDER BY n DESC, avg_rating DESC`))
    console.log(`  ${pad(r.recipe, 36)} n=${pad(r.n, 4)} ⭐ ${r.avg_rating}`);

  // ── rating distribution ──
  hr("RATING DISTRIBUTION");
  for (const r of await q(`SELECT rating, count(*)::int n FROM cook_sessions WHERE rating IS NOT NULL GROUP BY rating ORDER BY rating DESC`))
    console.log(`  ${r.rating}★  ${"█".repeat(Math.min(r.n, 40))} ${r.n}`);

  // ── equipment breakdown ──
  hr("EQUIPMENT BREAKDOWN");
  console.log("heat source:");
  for (const r of await q(`SELECT COALESCE(heat_source,'(unknown)') k, count(*)::int n FROM cook_sessions GROUP BY 1 ORDER BY n DESC`)) console.log(`  ${pad(r.k, 18)} ${r.n}`);
  console.log("pan:");
  for (const r of await q(`SELECT COALESCE(pan,'(unknown)') k, count(*)::int n FROM cook_sessions GROUP BY 1 ORDER BY n DESC`)) console.log(`  ${pad(r.k, 18)} ${r.n}`);

  // ── pace per recipe ──
  hr("PACE — MEDIAN ACTUAL vs PLANNED  (×>1.0 = people are SLOWER than authored)");
  for (const r of await q(`SELECT cs.recipe, count(*)::int steps,
      round(percentile_cont(0.5) WITHIN GROUP (ORDER BY ${RATIO})::numeric,2) median_ratio
    FROM cook_sessions cs, ${STEPS} WHERE ${VALID_STEP}
    GROUP BY cs.recipe ORDER BY median_ratio DESC NULLS LAST`))
    console.log(`  ${pad(r.recipe, 36)} steps=${pad(r.steps, 5)} median ×${r.median_ratio}`);

  // ── slowest individual steps ──
  hr("SLOWEST STEPS — retune these cues first (top 12 by median ratio)");
  for (const r of await q(`SELECT cs.recipe, s->>'title' step, count(*)::int n,
      round(percentile_cont(0.5) WITHIN GROUP (ORDER BY ${RATIO})::numeric,2) median_ratio
    FROM cook_sessions cs, ${STEPS} WHERE ${VALID_STEP}
    GROUP BY cs.recipe, s->>'title' ORDER BY median_ratio DESC NULLS LAST LIMIT 12`))
    console.log(`  ×${pad(r.median_ratio, 6)} ${pad(r.recipe, 28)} ${pad(r.step, 22)} (n=${r.n})`);

  // ── written feedback ──
  const all = args.includes("--feedback");
  hr(all ? "ALL WRITTEN FEEDBACK" : "RECENT WRITTEN FEEDBACK (last 12 — pass --feedback for all)");
  const fb = await q(`SELECT cs.created_at, cs.recipe, cs.rating, (cs.payload_json)::jsonb->>'comment' comment, u.email
    FROM cook_sessions cs LEFT JOIN users u ON u.id = cs.user_id
    WHERE COALESCE((cs.payload_json)::jsonb->>'comment','') <> ''
    ORDER BY cs.created_at DESC ${all ? "" : "LIMIT 12"}`);
  if (!fb.length) console.log("  (no written comments yet)");
  for (const r of fb) {
    console.log(`\n  ${r.created_at}  ·  ${r.recipe}  ·  ${r.rating ?? "—"}★  ·  ${r.email || "?"}`);
    console.log(`  "${(r.comment || "").replace(/\s+/g, " ").trim()}"`);
  }
  console.log("");
  await pool.end();
} catch (e) { console.error("Error:", e.message); await pool.end(); process.exit(1); }
