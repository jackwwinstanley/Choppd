#!/usr/bin/env node
/*
 * VIDEO-MATCH nightly health check (run by a systemd timer, like sizle-import).
 *   cd ~/sizle/server && node tools/video-health.mjs
 *
 * videos.list on every wired video_id (batched, ~1 quota unit / 50 ids). A video
 * that went missing / private / region-blocked / had its embeddable flag flipped
 * off is marked status='dead' — which un-wires its buttons (routes.ts excludes
 * status='dead'), the cook is unaffected, and the /admin/videos badge pings
 * automatically (it counts status IN ('review','dead')). Re-match is one tap.
 *
 * Reads YOUTUBE_API_KEY ONLY from process.env (server/.env). Never logs it.
 */
import "dotenv/config";
import { initDb, db, migrate } from "../dist/db.js";

const YT = "https://www.googleapis.com/youtube/v3";
function requireKey(name) { const v = process.env[name]; if (!v) throw new Error(`${name} is not set`); return v; }

async function liveIds(ids) {
  // returns the set of ids that still EXIST and are EMBEDDABLE.
  const ok = new Set();
  const key = requireKey("YOUTUBE_API_KEY");
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const qs = new URLSearchParams({ part: "status", id: batch.join(","), key }).toString();
    const res = await fetch(`${YT}/videos?${qs}`);
    if (!res.ok) throw new Error(`youtube videos ${res.status}`);
    const data = await res.json();
    for (const v of data.items || []) if (v.status?.embeddable === true && v.status?.privacyStatus !== "private") ok.add(v.id);
    await new Promise((r) => setTimeout(r, 200));
  }
  return ok;
}

async function main() {
  await initDb();
  await migrate();
  const rows = await db.all("SELECT recipe_id, video_id FROM video_matches WHERE video_id IS NOT NULL AND status <> 'dead'");
  const ids = [...new Set(rows.map((r) => r.video_id))];
  if (!ids.length) { console.log("health: no wired videos to check."); process.exit(0); }
  const ok = await liveIds(ids);
  let dead = 0;
  for (const r of rows) {
    if (!ok.has(r.video_id)) {
      await db.run("UPDATE video_matches SET status = 'dead', review_note = ? WHERE recipe_id = ?",
        ["health check: missing/private/region-blocked/non-embeddable", r.recipe_id]);
      dead++;
      console.log(`  ✗ DEAD ${r.recipe_id} (${r.video_id}) — buttons un-wired`);
    }
  }
  console.log(`health: checked ${ids.length} videos · ${dead} marked dead${dead ? " (admin badge will ping)" : ""}.`);
  process.exit(0);
}
main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
