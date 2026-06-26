#!/usr/bin/env node
/*
 * Nightly streak recompute (run by sizle-streak.timer at 00:20 UTC). Recomputes
 * every user's cached current_streak / longest_streak so streaks that broke
 * overnight (no cook that day) expire — a cook-save alone can't detect that.
 *
 *   cd ~/sizle/server && node tools/recompute-streaks.mjs
 */
import "dotenv/config";
import { initDb } from "../dist/db.js";
import { recomputeAllStreaks } from "../dist/streaks.js";

await initDb();
const n = await recomputeAllStreaks();
console.log(`[streaks] recomputed ${n} user(s) at ${new Date().toISOString()}`);
process.exit(0);
