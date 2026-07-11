/*
 * REST API. This is the stable contract the web client uses now and the
 * Expo/React-Native app will use later — "build the API once, swap the client."
 */
import crypto from "node:crypto";
import { Router } from "express";
import { db } from "./db.js";
import { upsertLedgerOnDelete, LIBRARY_VISIBLE } from "./limits.js";
import { recomputeUserStreak, localDate, addDays, todayLocalDate } from "./streaks.js";
import {
  issueCode, verifyCode, getOrCreateUser, signToken, requireAuth, recordLogin, optionalUserId,
  verifyGoogleIdToken, upsertGoogleUser, GOOGLE_CLIENT_ID, DEV_AUTH,
  type AuthedRequest,
} from "./auth.js";

// Comp/premium codes come ONLY from env — comma-separated PREMIUM_CODES list,
// no hardcoded fallback. Unset ⇒ code redemption is disabled entirely.
const PREMIUM_CODES = (process.env.PREMIUM_CODES || "").split(",").map((s) => s.trim()).filter(Boolean);

function safeParse<T>(s: string | null, fallback: T): T {
  try { return s ? (JSON.parse(s) as T) : fallback; } catch { return fallback; }
}
function userDTO(u: any) {
  return {
    id: u.id, email: u.email, name: u.name, avatarUrl: u.avatar_url,
    experience: u.experience, isBeginner: !!u.is_beginner,
    equipment: safeParse(u.equipment_json, { pans: [], heat: null }),
    prefs: safeParse(u.prefs_json, {}),
    tier: u.tier, musicPlatform: u.music_platform, streak: u.streak,
    timezone: u.timezone || null,
    currentStreak: u.current_streak || 0, longestStreak: u.longest_streak || 0,
  };
}
const findUser = (id: string) => db.get("SELECT * FROM users WHERE id = ?", [id]);

export const api = Router();

// ---- health ----
api.get("/health", (_req, res) => res.json({ ok: true, service: "sizle-api", time: new Date().toISOString() }));

// ---- product events (cook-card generated/shared, etc.) ----
api.post("/event", async (req, res) => {
  const type = String(req.body?.type || "").trim().slice(0, 40);
  const recipe = req.body?.recipe ? String(req.body.recipe).slice(0, 120) : null;
  if (!type) return res.json({ ok: true });
  try {
    await db.run("INSERT INTO events (id, type, recipe, user_id, created_at) VALUES (?, ?, ?, ?, ?)",
      [crypto.randomUUID(), type, recipe, optionalUserId(req), new Date().toISOString()]);
  } catch { /* best-effort analytics */ }
  res.json({ ok: true });
});

// ---- app open (monthly active users; anonymous-friendly, no auth required) ----
api.post("/visit", async (req, res) => {
  const visitorId = String(req.body?.visitorId || "").slice(0, 64);
  const userId = optionalUserId(req);
  if (!visitorId && !userId) return res.json({ ok: true });
  try {
    await db.run(
      "INSERT INTO app_visits (id, visitor_id, user_id, created_at) VALUES (?, ?, ?, ?)",
      [crypto.randomUUID(), visitorId || "u:" + userId, userId, new Date().toISOString()]
    );
  } catch { /* best-effort analytics */ }
  res.json({ ok: true });
});

// ---- auth config (so the client can discover the Google client ID + dev mode) ----
api.get("/auth/config", (_req, res) => {
  res.json({ googleClientId: GOOGLE_CLIENT_ID || null, devAuth: DEV_AUTH });
});

// ---- auth: Google OAuth (production path) ----
api.post("/auth/google", async (req, res) => {
  const idToken = String(req.body?.idToken || req.body?.credential || "");
  if (!idToken) return res.status(400).json({ error: "no-id-token" });
  const profile = await verifyGoogleIdToken(idToken);
  if (!profile) return res.status(401).json({ error: "google-verify-failed" });
  const user = await upsertGoogleUser(profile);
  await recordLogin(user.id, "google");
  res.json({ token: signToken(user.id), user: userDTO(user) });
});

// ---- auth: passwordless OTP → JWT (local dev / fallback) ----
api.post("/auth/request", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!email.includes("@")) return res.status(400).json({ error: "invalid-email" });
  const { code, devReturned } = await issueCode(email);
  res.json({ sent: true, ...(devReturned ? { devCode: code } : {}) });
});

api.post("/auth/verify", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const code = String(req.body?.code || "").trim();
  if (!(await verifyCode(email, code))) return res.status(401).json({ error: "bad-code" });
  const user = await getOrCreateUser(email);
  await recordLogin(user.id, "email");
  res.json({ token: signToken(user.id), user: userDTO(user) });
});

// ---- profile ----
api.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const u = await findUser(req.userId!);
  if (!u) return res.status(404).json({ error: "no-user" });
  res.json({ user: userDTO(u) });
});

api.put("/me", requireAuth, async (req: AuthedRequest, res) => {
  const u = await findUser(req.userId!);
  if (!u) return res.status(404).json({ error: "no-user" });
  const b = req.body || {};
  const equipment = b.equipment ? JSON.stringify(b.equipment) : u.equipment_json;
  const prefs = b.prefs ? JSON.stringify(b.prefs) : u.prefs_json;
  await db.run(
    `UPDATE users SET experience = ?, is_beginner = ?, equipment_json = ?, prefs_json = ?,
       music_platform = ?, streak = ?, timezone = ?, updated_at = ? WHERE id = ?`,
    [
      b.experience ?? u.experience,
      b.isBeginner != null ? (b.isBeginner ? 1 : 0) : u.is_beginner,
      equipment, prefs,
      b.musicPlatform !== undefined ? b.musicPlatform : u.music_platform,
      b.streak != null ? b.streak : u.streak,
      b.timezone !== undefined ? b.timezone : u.timezone,
      new Date().toISOString(), u.id,
    ]
  );
  res.json({ user: userDTO(await findUser(u.id)) });
});

// ---- delete account (hard delete, self-service) ----
// Identity comes ONLY from the verified JWT (req.userId) — nothing from the body,
// so a user can only ever delete themselves. Personal data (users row incl. the
// google_sub OAuth linkage, cook_sessions, cook_state, receipt_ledger, basket,
// pending auth_codes) is hard-deleted; aggregate analytics rows (events /
// app_visits / logins) are ANONYMIZED instead — identity nulled/scrubbed, counts
// preserved — so AARRR/MAU metrics stay intact. FK order: cook_sessions +
// cook_state + receipt_ledger + basket reference users, so children go first. Wrapped in a
// transaction so a mid-way failure can't leave a half-deleted account.
api.delete("/me", requireAuth, async (req: AuthedRequest, res) => {
  const uid = req.userId!;
  const u = await findUser(uid);
  if (!u) return res.status(404).json({ error: "no-user" });
  try {
    await db.run("BEGIN");
    await db.run("DELETE FROM cook_sessions WHERE user_id = ?", [uid]);                              // FK child first
    await db.run("DELETE FROM cook_state WHERE user_id = ?", [uid]);                                 // active cook snapshot (recipe/step only) — FK child, hard delete
    await db.run("DELETE FROM receipt_ledger WHERE user_id = ?", [uid]);                             // savings tab rows — FK child, hard delete
    await db.run("DELETE FROM basket WHERE user_id = ?", [uid]);                                     // starter-basket checklist — FK child, hard delete
    await db.run("UPDATE events SET user_id = NULL WHERE user_id = ?", [uid]);                       // anonymize
    await db.run("UPDATE app_visits SET user_id = NULL WHERE user_id = ?", [uid]);                   // anonymize
    await db.run("UPDATE app_visits SET visitor_id = 'deleted' WHERE visitor_id = ?", ["u:" + uid]); // scrub embedded id
    await db.run("UPDATE logins SET user_id = 'deleted' WHERE user_id = ?", [uid]);                  // NOT NULL → sentinel
    // USAGE-LIMIT LEDGER — the DELIBERATE EXCEPTION that survives deletion
    // (anti-abuse): one-way identity hashes + counters only, no personal data.
    // Disclosed in the delete-modal copy. Re-registration restores counters.
    await upsertLedgerOnDelete({ id: uid, email: u.email, google_sub: (u as any).google_sub });
    await db.run("UPDATE scans SET user_id = NULL WHERE user_id = ?", [uid]);                        // fridge-scan demand data stays, identity goes
    await db.run("UPDATE recipe_requests SET user_id = NULL WHERE user_id = ?", [uid]);              // recipe requests: same anonymize pattern
    await db.run("DELETE FROM concept_requests WHERE user_id = ?", [uid]);                           // Instagram handles + messages = personal contact data → FULL row delete
    await db.run("DELETE FROM auth_codes WHERE email = ?", [u.email]);                               // pending OTPs
    await db.run("DELETE FROM users WHERE id = ?", [uid]);                                           // identity + google_sub
    await db.run("COMMIT");
  } catch (e) {
    try { await db.run("ROLLBACK"); } catch { /* already rolled back */ }
    console.error("account delete failed:", e);
    return res.status(500).json({ error: "delete-failed" });
  }
  // Stateless JWTs can't be individually revoked — the row deletion IS the
  // invalidation: any surviving copy of the token now resolves to no user (404s).
  res.json({ ok: true, deleted: true });
});

// ---- entitlement (server-enforced premium; dev/tester code for now) ----
api.post("/entitlement/redeem", requireAuth, async (req: AuthedRequest, res) => {
  const code = String(req.body?.code || "").trim();
  if (!code || !PREMIUM_CODES.includes(code)) return res.status(400).json({ error: "invalid-code" });
  await db.run("UPDATE users SET tier = 'premium', updated_at = ? WHERE id = ?", [new Date().toISOString(), req.userId]);
  res.json({ user: userDTO(await findUser(req.userId!)) });
});

// ---- cook sessions (the data flywheel — now server-side, not localStorage) ----
api.post("/sessions", requireAuth, async (req: AuthedRequest, res) => {
  const s = req.body || {};
  const id = crypto.randomUUID();
  const durationSec = typeof s.durationSec === "number" ? Math.round(s.durationSec) : null;
  await db.run(
    `INSERT INTO cook_sessions (id, user_id, mode, recipe, rating, heat_source, pan, completed, duration_sec, payload_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, req.userId, s.mode ?? null, s.recipe ?? null, s.rating ?? null,
      s.heatSource ?? null, s.pan ?? null, s.completed ? 1 : 0, durationSec,
      JSON.stringify(s), new Date().toISOString(),
    ]
  );
  // A completed cook can extend the streak — recompute + return it so the finish
  // screen can celebrate immediately.
  let current: number | undefined, longest: number | undefined;
  if (s.completed) {
    const u = await findUser(req.userId!);
    const r = await recomputeUserStreak(req.userId!, (u && u.timezone) || "UTC");
    current = r.current; longest = r.longest;
  }
  res.json({ id, currentStreak: current, longestStreak: longest });
});

api.get("/sessions", requireAuth, async (req: AuthedRequest, res) => {
  const rows = (await db.all(
    "SELECT payload_json, created_at FROM cook_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 200",
    [req.userId]
  )) as { payload_json: string; created_at: string }[];
  res.json({ sessions: rows.map((r) => ({ ...safeParse(r.payload_json, {}), savedAt: r.created_at })) });
});

// ---- Cook History (Premium): streak calendar / paginated history / records ----

// Median pace ratio → label, from a session's authored-vs-actual step timings
// (guided cooks). Music cooks have no authored per-step times → null.
function sessionPaceLabel(payload: any): string | null {
  const steps = Array.isArray(payload?.steps) ? payload.steps : [];
  const ratios: number[] = [];
  for (const s of steps) {
    const a = Number(s.authoredSec), ac = Number(s.actualSec);
    if (a > 5 && ac > 0) ratios.push(ac / a);
  }
  if (!ratios.length) return null;
  ratios.sort((x, y) => x - y);
  const m = ratios[Math.floor(ratios.length / 2)];
  return m < 0.9 ? "Brisk" : m <= 1.15 ? "On pace" : "Relaxed";
}

// 180-day calendar of completed cooks (in the user's tz) + header stats.
api.get("/profile/streak-calendar", requireAuth, async (req: AuthedRequest, res) => {
  const u = await findUser(req.userId!);
  const tz = (u && u.timezone) || "UTC";
  const rows = (await db.all(
    "SELECT created_at FROM cook_sessions WHERE user_id = ? AND completed = 1", [req.userId]
  )) as { created_at: string }[];
  const counts: Record<string, number> = {};
  let since: string | null = null;
  for (const r of rows) {
    const d = localDate(r.created_at, tz);
    counts[d] = (counts[d] || 0) + 1;
    if (!since || d < since) since = d;
  }
  // `counts` maps every cook day → count, so the client can paint a real
  // month-by-month calendar across the whole range (not just a 180-day window).
  const today = todayLocalDate(tz);
  res.json({ counts, today, current: u?.current_streak || 0, longest: u?.longest_streak || 0, total: rows.length, since });
});

// Paginated full history (20/page) with name search + status/time filters.
api.get("/profile/history", requireAuth, async (req: AuthedRequest, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const per = 20;
  const q = String(req.query.q || "").trim().toLowerCase();
  const filter = String(req.query.filter || "all");
  const all = (await db.all(
    "SELECT recipe, rating, heat_source, pan, completed, duration_sec, payload_json, created_at FROM cook_sessions WHERE user_id = ? ORDER BY created_at DESC",
    [req.userId]
  )) as any[];
  const now = Date.now();
  const within = (iso: string, days: number) => now - new Date(iso).getTime() <= days * 86400000;
  const filtered = all.filter((r) => {
    if (q && !String(r.recipe || "").toLowerCase().includes(q)) return false;
    if (filter === "completed" && !r.completed) return false;
    if (filter === "abandoned" && r.completed) return false;
    if (filter === "week" && !within(r.created_at, 7)) return false;
    if (filter === "month" && !within(r.created_at, 30)) return false;
    return true;
  });
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / per));
  const sessions = filtered.slice((page - 1) * per, page * per).map((r) => {
    const p = safeParse<any>(r.payload_json, {});
    return {
      recipe: r.recipe, rating: r.rating, heatSource: r.heat_source, pan: r.pan,
      completed: !!r.completed, durationSec: r.duration_sec, createdAt: r.created_at,
      emoji: p.emoji, song: p.song, artist: p.artist, category: p.category, difficulty: p.difficulty,
      comment: p.comment || null, pace: sessionPaceLabel(p),
    };
  });
  res.json({ sessions, page, totalPages, total });
});

// Personal records, computed dynamically + cached 5 minutes per user.
const recordsCache = new Map<string, { at: number; data: any }>();
function weekStart(iso: string, tz: string): string {
  const d = localDate(iso, tz);
  const [y, m, day] = d.split("-").map(Number);
  const dow = (new Date(Date.UTC(y, m - 1, day)).getUTCDay() + 6) % 7; // Mon=0
  return addDays(d, -dow);
}
api.get("/profile/records", requireAuth, async (req: AuthedRequest, res) => {
  const cached = recordsCache.get(req.userId!);
  if (cached && Date.now() - cached.at < 5 * 60 * 1000) return res.json(cached.data);
  const u = await findUser(req.userId!);
  const tz = (u && u.timezone) || "UTC";
  const rows = (await db.all(
    "SELECT recipe, rating, pan, completed, duration_sec, created_at FROM cook_sessions WHERE user_id = ?", [req.userId]
  )) as any[];
  const completed = rows.filter((r) => r.completed);

  // "Hardest" cook = the one that took the longest (a badge of effort, not speed).
  let hardest: any = null;
  for (const r of completed) if (r.duration_sec > 0 && (!hardest || r.duration_sec > hardest.duration_sec)) hardest = r;
  let best: any = null;
  for (const r of rows) if (r.rating != null && (!best || r.rating > best.rating)) best = r;
  const byRecipe: Record<string, number> = {};
  for (const r of completed) if (r.recipe) byRecipe[r.recipe] = (byRecipe[r.recipe] || 0) + 1;
  let favourite: any = null;
  for (const [recipe, n] of Object.entries(byRecipe)) if (!favourite || n > favourite.n) favourite = { recipe, n };
  const totalSec = completed.reduce((a, r) => a + (r.duration_sec || 0), 0);
  const byWeek: Record<string, number> = {};
  for (const r of completed) { const w = weekStart(r.created_at, tz); byWeek[w] = (byWeek[w] || 0) + 1; }
  let bestWeek: any = null;
  for (const [start, n] of Object.entries(byWeek)) if (!bestWeek || n > bestWeek.n) bestWeek = { start, n };
  const byPan: Record<string, number> = {};
  for (const r of completed) if (r.pan) byPan[r.pan] = (byPan[r.pan] || 0) + 1;
  let pan: any = null;
  for (const [p, n] of Object.entries(byPan)) if (!pan || n > pan.n) pan = { pan: p, n };
  const rated = rows.filter((r) => r.rating != null);
  const avgRating = rated.length ? rated.reduce((a, r) => a + r.rating, 0) / rated.length : null;

  const data = {
    hardest: hardest ? { recipe: hardest.recipe, sec: hardest.duration_sec } : null,
    best: best ? { recipe: best.recipe, rating: best.rating } : null,
    favourite, totalSec,
    bestWeek: bestWeek ? { n: bestWeek.n, start: bestWeek.start } : null,
    pan, avgRating,
    longestStreak: u?.longest_streak || 0,
  };
  recordsCache.set(req.userId!, { at: Date.now(), data });
  res.json(data);
});

// ---- recipes (thin TheMealDB passthrough so the native app uses one API too) ----
api.get("/recipes/search", async (req, res) => {
  // LIBRARY HIDDEN: this passthrough only ever returns imported TheMealDB recipes,
  // so with the catalog hidden it returns nothing (no live TheMealDB call).
  if (!LIBRARY_VISIBLE) return res.json({ meals: null });
  const q = String(req.query.q || "").trim();
  try {
    const r = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(q)}`);
    res.json(await r.json());
  } catch {
    res.status(502).json({ error: "themealdb-unreachable" });
  }
});

// ---- per-recipe stats: real cook counts + avg rating (for the home cards) ----
// Gated by recipe_flags.show_cook_count (default OFF for every recipe): counts
// keep accumulating in cook_sessions, but they only leave the server for
// recipes an admin has explicitly flagged on (admin → Cook Counts tab). With
// no flags set this returns an empty map and no user surface shows a count.
api.get("/recipes/stats", async (_req, res) => {
  const rows = (await db.all(
    `SELECT s.recipe, count(*) AS cooks, avg(s.rating) AS rating
       FROM cook_sessions s
       JOIN recipe_flags f ON f.recipe = s.recipe AND f.show_cook_count = 1
      WHERE s.recipe IS NOT NULL AND s.recipe <> ''
      GROUP BY s.recipe`
  )) as any[];
  const stats: Record<string, { cooks: number; rating: number | null; show: boolean }> = {};
  for (const r of rows) stats[r.recipe] = { cooks: Number(r.cooks), rating: r.rating != null ? Math.round(Number(r.rating) * 10) / 10 : null, show: true };
  res.json({ stats });
});

// ---- full recipe catalog (bulk-imported from TheMealDB) with filters ----
// Filtering runs against our DB (every recipe), not a static 20-recipe file.
// ?cuisine=a,b (OR) &difficulty=tier &mealTime=slot &q=name &limit=
api.get("/recipes", async (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  const cuisine = String(req.query.cuisine || "").trim();
  const difficulty = String(req.query.difficulty || "").trim();
  const mealTime = String(req.query.mealTime || "").trim();
  const limit = Math.min(600, Math.max(1, Number(req.query.limit) || 400));
  const where: string[] = [];
  const params: any[] = [];
  if (cuisine) {
    const list = cuisine.split(",").map((s) => s.trim()).filter(Boolean);
    if (list.length) { where.push(`cuisine IN (${list.map(() => "?").join(",")})`); params.push(...list); }
  }
  if (difficulty) { where.push("difficulty = ?"); params.push(difficulty); }
  if (mealTime && mealTime !== "any") {
    if (mealTime === "latenight") { where.push("(est_min <= 20 AND (meal_time LIKE ? OR meal_time LIKE ?))"); params.push('%"dinner"%', '%"any"%'); }
    else { where.push("(meal_time LIKE ? OR meal_time LIKE ?)"); params.push(`%"${mealTime}"%`, '%"any"%'); }
  }
  if (q) { where.push("lower(name) LIKE ?"); params.push(`%${q}%`); }
  // LIBRARY HIDDEN: serve only the authored flagships (imported rows stay in the
  // table, just filtered out of every browse/search result). Reversible.
  if (!LIBRARY_VISIBLE) where.push("is_music_sync = 1");
  const sql = `SELECT data_json, is_music_sync FROM recipes ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY is_music_sync DESC, name LIMIT ${limit}`;
  try {
    const rows = (await db.all(sql, params)) as { data_json: string; is_music_sync: number }[];
    // Light list payloads: drop the heavy steps/ingredients arrays (fetched on
    // demand via /recipes/:id when a recipe is opened) so big result sets stay small.
    const recipes = rows.map((r) => {
      const o = safeParse<any>(r.data_json, {});
      const { steps, ingredients, ...light } = o;
      light.isMusicSync = !!Number(r.is_music_sync);
      return light;
    });
    res.json({ recipes, count: recipes.length });
  } catch (e: any) {
    res.status(500).json({ error: "recipes-query-failed", message: e?.message });
  }
});

// Full single recipe (steps + ingredients) for the detail/cook screen.
api.get("/recipes/:id", async (req, res) => {
  const row = (await db.get("SELECT data_json, is_music_sync FROM recipes WHERE id = ?", [String(req.params.id)])) as
    | { data_json: string; is_music_sync: number } | undefined;
  if (!row) return res.status(404).json({ error: "not-found" });
  // LIBRARY HIDDEN: a deep link to an imported recipe resolves to "not available"
  // (the client routes home gracefully) — the row itself is untouched.
  if (!LIBRARY_VISIBLE && !Number(row.is_music_sync)) return res.status(404).json({ error: "not-available" });
  const o = safeParse<any>(row.data_json, {});
  o.isMusicSync = !!Number(row.is_music_sync);
  // VIDEO-MATCH: attach ONLY the wired steps of a non-dead match → the client
  // renders a "Watch this moment" button on those steps only. Dead matches
  // (nightly health check) are excluded, so their buttons un-render for free.
  try {
    const vm = (await db.get(
      "SELECT video_id, video_title, channel, steps_json FROM video_matches WHERE recipe_id = ? AND status <> 'dead'",
      [String(req.params.id)]
    )) as { video_id: string; video_title: string; channel: string; steps_json: string } | undefined;
    if (vm && vm.video_id) {
      const steps = safeParse<any[]>(vm.steps_json, []);
      const wired: Record<number, number> = {};
      for (const s of steps) if (s && s.wired && typeof s.video_ts === "number") wired[s.step_index] = s.video_ts;
      if (Object.keys(wired).length) o.videoMatch = { videoId: vm.video_id, title: vm.video_title, channel: vm.channel, steps: wired };
    }
  } catch { /* a missing match or query error must never break the recipe */ }
  res.json({ recipe: o });
});

// ---- nutrition proxy (per 100g): memory LRU → DB cache/seed → Open Food Facts ----
// Runs server-side, so it sidesteps the browser CORS problem that made a
// client-side Open Food Facts call unreliable.
// In-memory LRU in FRONT of the persistent nutrition_cache: repeat lookups cost
// nothing and never touch OFF (upstream-ban mitigation). ~500 entries, 24h TTL.
const NUTRI_LRU_MAX = 500, NUTRI_TTL_MS = 24 * 60 * 60 * 1000;
const nutriLru = new Map<string, { at: number; body: unknown }>();
function nutriLruGet(k: string): unknown | null {
  const e = nutriLru.get(k);
  if (!e) return null;
  if (Date.now() - e.at > NUTRI_TTL_MS) { nutriLru.delete(k); return null; }
  nutriLru.delete(k); nutriLru.set(k, e);   // refresh recency
  return e.body;
}
function nutriLruSet(k: string, body: unknown) {
  if (nutriLru.size >= NUTRI_LRU_MAX) nutriLru.delete(nutriLru.keys().next().value as string);   // evict LRU
  nutriLru.set(k, { at: Date.now(), body });
}
api.get("/nutrition", async (req, res) => {
  const name = String(req.query.q || "").trim().toLowerCase();
  if (!name) return res.status(400).json({ error: "no-ingredient" });

  const hot = nutriLruGet(name);
  if (hot) { console.log(`[nutrition] memory-cache hit: ${name}`); return res.json(hot); }

  // Seed/cache lookup with light normalization: try the exact name, then a
  // de-pluralized form, then with leading qualifiers dropped ("raw king prawns").
  const stripped = name.replace(/^(fresh|raw|dried|ground|tinned|canned|chopped|minced|whole|ripe|fried)\s+/, "").trim();
  const variants = Array.from(new Set([name, name.replace(/s$/, ""), stripped, stripped.replace(/s$/, "")].filter(Boolean)));
  for (const v of variants) {
    const cached = (await db.get("SELECT data_json FROM nutrition_cache WHERE ingredient = ?", [v])) as
      | { data_json: string | null } | undefined;
    if (cached) { const body = { ingredient: name, nutrition: safeParse(cached.data_json, null) }; nutriLruSet(name, body); return res.json(body); }
  }

  // Open Food Facts fallback. NOTE: the v2 search endpoint ignores `search_terms`
  // and returns the same default product for every query — use the legacy
  // full-text search, and accept only the first product with a *plausible*
  // per-100g energy (0–900 kcal) so we never cache nonsense.
  let out: any = null;
  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(name)}&search_simple=1&action=process&json=1&page_size=12&fields=product_name,nutriments`;
    const data: any = await (await fetch(url, { headers: { "User-Agent": "Sizle/0.1 (founder@sizle.nodaysoff.pro)" } })).json();
    for (const prod of (data.products || [])) {
      const n = prod.nutriments || {};
      let kcal = n["energy-kcal_100g"];
      if (kcal == null && n["energy_100g"] != null) kcal = n["energy_100g"] / 4.184;
      if (kcal == null || kcal <= 0 || kcal > 900) continue; // implausible per-100g → skip
      out = {
        kcal: Math.round(kcal),
        protein: n.proteins_100g != null ? Math.round(n.proteins_100g) : null,
        fat: n.fat_100g != null ? Math.round(n.fat_100g) : null,
        carbs: n.carbohydrates_100g != null ? Math.round(n.carbohydrates_100g) : null,
        source: "openfoodfacts",
      };
      break;
    }
  } catch { /* leave null */ }

  // Portable upsert (SQLite + Postgres) instead of SQLite-only INSERT OR REPLACE.
  await db.run(
    `INSERT INTO nutrition_cache (ingredient, data_json, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(ingredient) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at`,
    [name, out ? JSON.stringify(out) : null, new Date().toISOString()]
  );
  const body = { ingredient: name, nutrition: out };
  nutriLruSet(name, body);
  res.json(body);
});
