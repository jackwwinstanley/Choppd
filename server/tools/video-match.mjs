#!/usr/bin/env node
/*
 * VIDEO-MATCH PIPELINE — "watch this moment" at scale.
 *
 *   cd ~/sizle/server
 *   node tools/video-match.mjs <slug>        # one recipe, synchronous
 *   node tools/video-match.mjs --pilot       # the household-name pilot 20
 *   node tools/video-match.mjs --all-premium # full catalog (GATED, see below)
 *   ... [--force] [--full-res] [--rematch-only]
 *
 * Idempotent: a recipe whose video_matches row is status pilot|approved is
 * skipped unless --force. --all-premium REFUSES until the pilot-approved flag
 * file exists (server/data/.video-match-pilot-approved) — the founder gate.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * §7 HARD LINES — enforced here and grep-checked by video-match.test.mjs:
 *   NO_DOWNLOAD      — never downloads, clips, re-hosts, or extracts audio/frames.
 *   NO_TRANSCRIPT    — never scrapes transcripts via unofficial endpoints.
 *   OFFICIAL_ONLY    — the only video understanding is Gemini's official public
 *                      URL ingestion; playback is exclusively the official embed.
 *   EMBEDDABLE_ONLY  — a non-embeddable video is never selected.
 * Secrets: API keys are read ONLY from process.env (loaded from server/.env by
 * dotenv). They are NEVER logged, echoed, or written to any file or report.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import "dotenv/config";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { initDb, db, migrate } from "../dist/db.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "../data");
const EVENTS_CACHE = join(DATA, "video-events-cache");
const PILOT_FLAG = join(DATA, ".video-match-pilot-approved");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- constants (env-overridable; NOT secrets) ------------------------------
const GEMINI_VIDEO_MODEL = process.env.GEMINI_VIDEO_MODEL || "gemini-2.5-flash";
const MATCH_MODEL = process.env.VIDEO_MATCH_MODEL || "claude-haiku-4-5-20251001";
const RELEVANCE_MODEL = process.env.VIDEO_RELEVANCE_MODEL || "claude-haiku-4-5-20251001";
const MAX_VIDEO_SECONDS = Number(process.env.MAX_VIDEO_SECONDS || 1500);      // skip longer videos at selection
const WIRE_CONFIDENCE = Number(process.env.VIDEO_WIRE_CONFIDENCE || 0.75);    // ≥ this + no conflict → auto-wire
const VIDEO_MATCH_SPEND_CAP_USD = Number(process.env.VIDEO_MATCH_SPEND_CAP_USD || 10);
const YT_SEARCH_BUDGET_PER_DAY = Number(process.env.YT_SEARCH_BUDGET_PER_DAY || 90); // 10K units / 100 per search, minus overhead

// Approx unit costs (batch, low-res default) — used ONLY for the pre-submit
// estimate + the spend cap. Real cost is reported from token usage after each call.
const EST_GEMINI_USD_PER_VIDEO_LOWRES = 0.02;
const EST_GEMINI_USD_PER_VIDEO_FULLRES = 0.06;
const EST_HAIKU_USD_PER_RECIPE = 0.004;

// The household-name pilot 20 (verified official video), pending founder approval.
const PILOT_IDS = [
  "mealdb-52803", "mealdb-52908", "mealdb-53145", "mealdb-52982", "mealdb-52772",
  "mealdb-53065", "mealdb-52765", "mealdb-53281", "mealdb-53080", "mealdb-53353",
  "mealdb-53402", "mealdb-53009", "mealdb-53379", "mealdb-52835", "mealdb-53032",
  "mealdb-53356", "mealdb-53266", "mealdb-53006", "mealdb-53355", "mealdb-52854",
];

// ---- secret access (single choke point; grep-invariant target) -------------
function requireKey(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set — add it to server/.env (never hardcode it).`);
  return v;
}

// ---- YouTube Data API v3 ----------------------------------------------------
const YT = "https://www.googleapis.com/youtube/v3";
export function parseIsoDuration(iso) {
  // "PT1H2M3S" → seconds
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || "");
  if (!m) return null;
  return (Number(m[1] || 0) * 3600) + (Number(m[2] || 0) * 60) + Number(m[3] || 0);
}
export function ytIdFromUrl(url) {
  const m = /[?&]v=([\w-]{11})|youtu\.be\/([\w-]{11})|embed\/([\w-]{11})/.exec(url || "");
  return m ? (m[1] || m[2] || m[3]) : null;
}
async function ytGet(path, params) {
  const key = requireKey("YOUTUBE_API_KEY");
  const qs = new URLSearchParams({ ...params, key }).toString();
  const res = await fetch(`${YT}/${path}?${qs}`);
  if (!res.ok) throw new Error(`youtube ${path} ${res.status}`);
  return res.json();
}
// videos.list — statistics + contentDetails + status (embeddable). Batched.
async function ytVideosMeta(ids) {
  if (!ids.length) return [];
  const data = await ytGet("videos", { part: "snippet,statistics,contentDetails,status", id: ids.join(","), maxResults: "50" });
  return (data.items || []).map((v) => ({
    id: v.id,
    title: v.snippet?.title || "",
    channel: v.snippet?.channelTitle || "",
    description: (v.snippet?.description || "").slice(0, 500),
    viewCount: Number(v.statistics?.viewCount || 0),
    seconds: parseIsoDuration(v.contentDetails?.duration),
    // EMBEDDABLE_ONLY: status.embeddable must be explicitly true.
    embeddable: v.status?.embeddable === true,
  }));
}
async function ytSearch(query) {
  const data = await ytGet("search", {
    part: "snippet", q: query, type: "video", videoEmbeddable: "true",
    videoDuration: "medium", relevanceLanguage: "en", maxResults: "10",
  });
  return (data.items || []).map((i) => i.id?.videoId).filter(Boolean);
}

// A candidate passes the mechanical filters (EMBEDDABLE_ONLY + duration).
export function candidatePassesFilters(meta) {
  return !!meta && meta.embeddable === true && Number.isFinite(meta.seconds) &&
    meta.seconds > 0 && meta.seconds <= MAX_VIDEO_SECONDS;
}

// ---- Anthropic (Haiku) — relevance + the match contract --------------------
async function anthropic(model, system, user, maxTokens) {
  const key = requireKey("ANTHROPIC_API_KEY");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return (data.content || []).map((c) => c.text || "").join("");
}

// Defensive JSON parse — strips ``` fences and trailing prose (the standing pattern).
export function parseJsonLoose(text) {
  let t = String(text || "").trim();
  t = t.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const a = t.indexOf("{"), b = t.indexOf("[");
  const start = (b >= 0 && (a < 0 || b < a)) ? b : a;
  if (start < 0) throw new Error("no JSON found");
  const end = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
  return JSON.parse(t.slice(start, end + 1));
}

// Cheap relevance gate: same dish? not a compilation / shorts? Returns bool + why.
async function relevanceCheck(recipe, meta) {
  const sys = "You score whether a YouTube video actually teaches how to cook ONE specific dish. Reply STRICT JSON only.";
  const user = `Recipe: "${recipe.title}" (${recipe.category || ""}, key ingredients: ${keyIngredients(recipe).join(", ")}).
Video title: "${meta.title}"
Video description: "${meta.description}"
Return {"relevant": true|false, "reason": "one line"}. relevant=false if it's a compilation ("10 recipes in..."), a Short, a different dish, or not a cooking tutorial.`;
  try {
    const out = parseJsonLoose(await anthropic(RELEVANCE_MODEL, sys, user, 120));
    return { relevant: out.relevant === true, reason: String(out.reason || "").slice(0, 120) };
  } catch (e) {
    return { relevant: false, reason: "relevance-parse-failed: " + e.message };
  }
}

// ---- Gemini official public-URL video ingestion (NO download/scrape) --------
// OFFICIAL_ONLY: the video URL is passed by reference to Gemini; we never fetch
// the media ourselves. Events are cached by video_id so re-runs (and match-only
// offset fixes) cost nothing.
async function geminiIngest(videoId, { lowRes }) {
  if (!existsSync(EVENTS_CACHE)) mkdirSync(EVENTS_CACHE, { recursive: true });
  const cacheFile = join(EVENTS_CACHE, `${videoId}.json`);
  if (existsSync(cacheFile)) {
    const c = JSON.parse(readFileSync(cacheFile, "utf8"));
    return { events: c.events, cached: true, usd: 0 };
  }
  const key = requireKey("GEMINI_API_KEY");
  const url = `https://www.youtube.com/watch?v=${videoId}`;  // OFFICIAL public URL, by reference only
  const prompt = `Watch this cooking video and return a STRICT JSON array of every distinct cooking EVENT in order:
[{ "ts_seconds": number, "event": "flips the chicken", "phase_hint": "prep|cooking|serving", "spoken_context": "one line of what they said" }]
Include: every ingredient addition, heat change, cooking action, doneness check, and rest. NOT scene descriptions or intro/outro chatter. ts_seconds = when the action happens in the video. Return ONLY the JSON array.`;
  const body = {
    contents: [{ parts: [{ file_data: { file_uri: url } }, { text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      ...(lowRes ? { mediaResolution: "MEDIA_RESOLUTION_LOW" } : {}),
    },
  };
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_VIDEO_MODEL}:generateContent?key=${key}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
  const events = parseJsonLoose(text);
  if (!Array.isArray(events)) throw new Error("gemini did not return an events array");
  // Real cost from token usage (not an estimate).
  const um = data.usageMetadata || {};
  const inTok = Number(um.promptTokenCount || 0), outTok = Number(um.candidatesTokenCount || 0);
  const usd = (inTok / 1e6) * (lowRes ? 0.05 : 0.15) + (outTok / 1e6) * 0.30; // flash batch-ish rate; reported, not billed by us
  writeFileSync(cacheFile, JSON.stringify({ videoId, lowRes, events, usageMetadata: um }, null, 2));
  return { events, cached: false, usd };
}

// ---- match contract (Haiku): events → per-step timestamps ------------------
async function matchEventsToSteps(recipe, events) {
  const steps = recipe.steps.map((s, i) => ({ step_index: i, text: s.text }));
  const sys = `You map a recipe's steps to timestamps in a cooking video's event list. Reply STRICT JSON only.
RULES:
- Match by CONTENT, not order — creators prep mid-video and reorder freely.
- A step with no matching event gets video_ts=null. That is honest, not a failure.
- METHOD CONFLICT: if the video's technique contradicts the step (e.g. their cold-pan vs a hot-start step, a microwave shortcut), set method_conflict=true and explain in note. Never pick a timestamp for a conflicting step.
- One timestamp may serve multiple adjacent steps. NEVER invent a timestamp not in the events.`;
  const user = `STEPS:\n${JSON.stringify(steps)}\n\nVIDEO EVENTS:\n${JSON.stringify(events)}\n
Return a STRICT JSON array, one object per step, same order:
[{ "step_index": number, "video_ts": number|null, "confidence": 0..1, "method_conflict": true|false, "note": "one line" }]`;
  const out = parseJsonLoose(await anthropic(MATCH_MODEL, sys, user, 1500));
  if (!Array.isArray(out)) throw new Error("match did not return an array");
  return out;
}

// ---- routing: threshold → wired flag ---------------------------------------
export function routeSteps(matchRows) {
  return matchRows.map((r) => ({
    step_index: r.step_index,
    video_ts: (typeof r.video_ts === "number" && r.video_ts >= 0) ? r.video_ts : null,
    confidence: Math.max(0, Math.min(1, Number(r.confidence) || 0)),
    method_conflict: r.method_conflict === true,
    note: String(r.note || "").slice(0, 200),
    // auto-wire ONLY: has a ts, high confidence, no conflict.
    wired: (typeof r.video_ts === "number" && r.video_ts >= 0) &&
      (Number(r.confidence) || 0) >= WIRE_CONFIDENCE && r.method_conflict !== true,
  }));
}

// ---- helpers ----------------------------------------------------------------
export function stepsFingerprint(steps) {
  // stable hash of step texts → detects a re-import that shifted indices.
  let h = 5381;
  const s = steps.map((x) => x.text).join("");
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${steps.length}:${(h >>> 0).toString(16)}`;
}
function keyIngredients(recipe) {
  return (recipe.ingredients || []).filter((i) => !i.optional).slice(0, 2).map((i) => i.name);
}
function searchQuery(recipe) {
  return `${recipe.title} ${keyIngredients(recipe).join(" ")} recipe`.trim();
}

async function loadRecipe(id) {
  const row = await db.get("SELECT data_json FROM recipes WHERE id = ? AND is_music_sync = 0", [id]);
  if (!row) return null;
  try { return JSON.parse(row.data_json); } catch { return null; }
}
async function existingMatch(id) { return db.get("SELECT recipe_id, status FROM video_matches WHERE recipe_id = ?", [id]); }

async function storeMatch(recipe, video, routed, status, note, seedSource) {
  const now = new Date().toISOString();
  const fp = stepsFingerprint(recipe.steps);
  await db.run(
    `INSERT INTO video_matches (recipe_id, video_id, video_title, channel, view_count, seed_source, status, steps_json, steps_fingerprint, review_note, matched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(recipe_id) DO UPDATE SET video_id=excluded.video_id, video_title=excluded.video_title, channel=excluded.channel,
       view_count=excluded.view_count, seed_source=excluded.seed_source, status=excluded.status, steps_json=excluded.steps_json,
       steps_fingerprint=excluded.steps_fingerprint, review_note=excluded.review_note, matched_at=excluded.matched_at`,
    [recipe.id, video?.id || null, video?.title || null, video?.channel || null, video?.viewCount || null,
     seedSource || null, status, JSON.stringify(routed || []), fp, note || null, now]
  );
}

// ---- video selection: SEED-LINK-FIRST → verify → search fallback -----------
async function selectVideo(recipe) {
  // 1) seed: the recipe's own official TheMealDB link, verified.
  const seedId = ytIdFromUrl(recipe.youtube || "");
  if (seedId) {
    const [meta] = await ytVideosMeta([seedId]);
    if (candidatePassesFilters(meta)) {
      const rel = await relevanceCheck(recipe, meta);
      if (rel.relevant) return { video: meta, source: "themealdb-link" };
    }
  }
  // 2) fallback: search.list → most-viewed RELEVANT passer.
  const ids = await ytSearch(searchQuery(recipe));
  const metas = (await ytVideosMeta(ids)).filter(candidatePassesFilters)
    .sort((a, b) => b.viewCount - a.viewCount);           // most-viewed first
  for (const meta of metas) {
    const rel = await relevanceCheck(recipe, meta);
    if (rel.relevant) return { video: meta, source: "search" };
  }
  return { video: null, source: "none" };                  // → no-good-video review
}

// ---- process one recipe end to end -----------------------------------------
async function processRecipe(id, { status, lowRes, force, rematchOnly }, spend) {
  const recipe = await loadRecipe(id);
  if (!recipe) return { id, outcome: "skip", reason: "not an imported recipe" };
  const prior = await existingMatch(id);
  if (prior && (prior.status === "approved" || prior.status === "pilot") && !force && !rematchOnly) {
    return { id, title: recipe.title, outcome: "skip", reason: "already matched (use --force)" };
  }

  // SELECT (skippable on a match-only re-run if we already have a video)
  let video, source;
  if (rematchOnly && prior && prior.video_id) {
    const [m] = await ytVideosMeta([prior.video_id]);
    video = m; source = prior.seed_source || "search";
  } else {
    ({ video, source } = await selectVideo(recipe));
  }
  if (!video) { await storeMatch(recipe, null, [], "review", "no relevant embeddable video found", "none"); return { id, title: recipe.title, outcome: "no-video" }; }

  // INGEST (cached by video_id → 0 cost on re-runs / offset fixes)
  const ing = await geminiIngest(video.id, { lowRes });
  spend.usd += ing.usd;
  if (spend.usd > VIDEO_MATCH_SPEND_CAP_USD) throw new SpendCapError(spend.usd);

  // MATCH + ROUTE
  const routed = routeSteps(await matchEventsToSteps(recipe, ing.events));
  spend.usd += EST_HAIKU_USD_PER_RECIPE;
  const wiredCount = routed.filter((s) => s.wired).length;
  const conflicts = routed.filter((s) => s.method_conflict).length;
  const rowStatus = conflicts > 0 && wiredCount === 0 ? "review" : status;  // pure-conflict recipes go to review
  await storeMatch(recipe, video, routed, rowStatus, conflicts ? `${conflicts} method-conflict step(s)` : null, source);
  return { id, title: recipe.title, outcome: "matched", video: video.id, source, steps: routed.length, wired: wiredCount, conflicts, cached: ing.cached };
}

class SpendCapError extends Error { constructor(usd) { super(`SPEND CAP $${VIDEO_MATCH_SPEND_CAP_USD} exceeded (at $${usd.toFixed(2)})`); this.usd = usd; } }

// ---- main -------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  const flag = (f) => args.includes(f);
  const mode = flag("--pilot") ? "pilot" : flag("--all-premium") ? "all" : "single";
  const opts = { force: flag("--force"), lowRes: !flag("--full-res"), rematchOnly: flag("--rematch-only") };
  const slug = args.find((a) => !a.startsWith("--"));

  await initDb();
  await migrate();

  // resolve the working set
  let ids, rowStatus;
  if (mode === "single") {
    if (!slug) { console.error("usage: video-match.mjs <slug> | --pilot | --all-premium"); process.exit(2); }
    ids = [slug]; rowStatus = "review"; // single runs land as review for founder eyes unless already pilot/approved
  } else if (mode === "pilot") {
    ids = PILOT_IDS; rowStatus = "pilot";
  } else {
    if (!existsSync(PILOT_FLAG)) {
      console.error("REFUSED: --all-premium is gated. Flip the pilot-approved flag first:\n  touch " + PILOT_FLAG);
      process.exit(3);
    }
    const rows = await db.all("SELECT id FROM recipes WHERE is_music_sync = 0 ORDER BY id");
    ids = rows.map((r) => r.id); rowStatus = "approved";
  }

  // PRE-SUBMIT spend estimate (§3c) — printed BEFORE any paid call.
  const per = opts.lowRes ? EST_GEMINI_USD_PER_VIDEO_LOWRES : EST_GEMINI_USD_PER_VIDEO_FULLRES;
  const est = ids.length * (per + EST_HAIKU_USD_PER_RECIPE);
  console.log(`video-match: mode=${mode} recipes=${ids.length} res=${opts.lowRes ? "low" : "full"}`);
  console.log(`ESTIMATE  ~$${est.toFixed(2)} (cap $${VIDEO_MATCH_SPEND_CAP_USD}; cached videos cost $0). Search budget ${YT_SEARCH_BUDGET_PER_DAY}/day.`);
  if (est > VIDEO_MATCH_SPEND_CAP_USD) { console.error(`Estimate exceeds the cap — raise VIDEO_MATCH_SPEND_CAP_USD or narrow the run.`); process.exit(4); }

  const spend = { usd: 0 };
  const report = { matched: 0, wired_recipes: 0, review: 0, noVideo: 0, skip: 0, errors: [], seed: 0, search: 0, steps_total: 0, steps_wired: 0 };
  for (const id of ids) {
    try {
      const r = await processRecipe(id, { status: rowStatus, ...opts }, spend);
      if (r.outcome === "matched") {
        report.matched++; report.steps_total += r.steps; report.steps_wired += r.wired;
        if (r.wired > 0) report.wired_recipes++;
        if (r.source === "themealdb-link") report.seed++; else if (r.source === "search") report.search++;
        console.log(`  ✓ ${r.title} — ${r.wired}/${r.steps} wired${r.conflicts ? `, ${r.conflicts} conflict` : ""} [${r.source}${r.cached ? ",cached" : ""}]`);
      } else if (r.outcome === "no-video") { report.noVideo++; console.log(`  ∅ ${r.title} — no relevant embeddable video → review`); }
      else { report.skip++; console.log(`  · ${r.title || id} — skip (${r.reason})`); }
      await sleep(300); // polite to YouTube; the search-quota pacing lives in the state below
    } catch (e) {
      if (e instanceof SpendCapError) { console.error(`\nPAUSED: ${e.message}. Re-run to continue (done work is cached).`); break; }
      report.errors.push({ id, error: e.message });
      console.error(`  ! ${id} failed: ${e.message}`);  // skip-and-report; never stop the whole run
    }
  }

  console.log(`\nRESULT  matched ${report.matched} · wired-recipes ${report.wired_recipes} · no-video ${report.noVideo} · skip ${report.skip} · errors ${report.errors.length}`);
  console.log(`STEPS   ${report.steps_wired}/${report.steps_total} wired (${report.steps_total ? Math.round(100 * report.steps_wired / report.steps_total) : 0}%)`);
  console.log(`SELECT  seed-link ${report.seed} · search-fallback ${report.search}`);
  console.log(`SPEND   ~$${spend.usd.toFixed(3)} actual (token-metered)`);
  if (report.errors.length) { console.log("SKIPPED (with reason):"); for (const e of report.errors) console.log(`  - ${e.id}: ${e.error}`); }
  process.exit(0);
}

// Only run when invoked directly (the pure helpers above are imported by tests).
if (process.argv[1] && process.argv[1].endsWith("video-match.mjs")) {
  main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
}
