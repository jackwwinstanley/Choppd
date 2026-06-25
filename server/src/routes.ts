/*
 * REST API. This is the stable contract the web client uses now and the
 * Expo/React-Native app will use later — "build the API once, swap the client."
 */
import crypto from "node:crypto";
import { Router } from "express";
import { db } from "./db.js";
import {
  issueCode, verifyCode, getOrCreateUser, signToken, requireAuth,
  verifyGoogleIdToken, upsertGoogleUser, GOOGLE_CLIENT_ID, DEV_AUTH,
  type AuthedRequest,
} from "./auth.js";

const DEV_PREMIUM_CODE = process.env.DEV_PREMIUM_CODE || "Dev123";

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
  };
}
const findUser = (id: string) => db.get("SELECT * FROM users WHERE id = ?", [id]);

export const api = Router();

// ---- health ----
api.get("/health", (_req, res) => res.json({ ok: true, service: "sizle-api", time: new Date().toISOString() }));

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
       music_platform = ?, streak = ?, updated_at = ? WHERE id = ?`,
    [
      b.experience ?? u.experience,
      b.isBeginner != null ? (b.isBeginner ? 1 : 0) : u.is_beginner,
      equipment, prefs,
      b.musicPlatform !== undefined ? b.musicPlatform : u.music_platform,
      b.streak != null ? b.streak : u.streak,
      new Date().toISOString(), u.id,
    ]
  );
  res.json({ user: userDTO(await findUser(u.id)) });
});

// ---- entitlement (server-enforced premium; dev/tester code for now) ----
api.post("/entitlement/redeem", requireAuth, async (req: AuthedRequest, res) => {
  const code = String(req.body?.code || "").trim();
  if (code !== DEV_PREMIUM_CODE) return res.status(400).json({ error: "invalid-code" });
  await db.run("UPDATE users SET tier = 'premium', updated_at = ? WHERE id = ?", [new Date().toISOString(), req.userId]);
  res.json({ user: userDTO(await findUser(req.userId!)) });
});

// ---- cook sessions (the data flywheel — now server-side, not localStorage) ----
api.post("/sessions", requireAuth, async (req: AuthedRequest, res) => {
  const s = req.body || {};
  const id = crypto.randomUUID();
  await db.run(
    `INSERT INTO cook_sessions (id, user_id, mode, recipe, rating, heat_source, pan, completed, payload_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, req.userId, s.mode ?? null, s.recipe ?? null, s.rating ?? null,
      s.heatSource ?? null, s.pan ?? null, s.completed ? 1 : 0,
      JSON.stringify(s), new Date().toISOString(),
    ]
  );
  res.json({ id });
});

api.get("/sessions", requireAuth, async (req: AuthedRequest, res) => {
  const rows = (await db.all(
    "SELECT payload_json, created_at FROM cook_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 200",
    [req.userId]
  )) as { payload_json: string; created_at: string }[];
  res.json({ sessions: rows.map((r) => ({ ...safeParse(r.payload_json, {}), savedAt: r.created_at })) });
});

// ---- recipes (thin TheMealDB passthrough so the native app uses one API too) ----
api.get("/recipes/search", async (req, res) => {
  const q = String(req.query.q || "").trim();
  try {
    const r = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(q)}`);
    res.json(await r.json());
  } catch {
    res.status(502).json({ error: "themealdb-unreachable" });
  }
});

// ---- per-recipe stats: real cook counts + avg rating (for the home cards) ----
api.get("/recipes/stats", async (_req, res) => {
  const rows = (await db.all(
    "SELECT recipe, count(*) AS cooks, avg(rating) AS rating FROM cook_sessions WHERE recipe IS NOT NULL AND recipe <> '' GROUP BY recipe"
  )) as any[];
  const stats: Record<string, { cooks: number; rating: number | null }> = {};
  for (const r of rows) stats[r.recipe] = { cooks: Number(r.cooks), rating: r.rating != null ? Math.round(Number(r.rating) * 10) / 10 : null };
  res.json({ stats });
});

// ---- nutrition proxy (per 100g): cache → seed → Open Food Facts ----
// Runs server-side, so it sidesteps the browser CORS problem that made a
// client-side Open Food Facts call unreliable.
api.get("/nutrition", async (req, res) => {
  const name = String(req.query.q || "").trim().toLowerCase();
  if (!name) return res.status(400).json({ error: "no-ingredient" });

  // Seed/cache lookup with light normalization: try the exact name, then a
  // de-pluralized form, then with leading qualifiers dropped ("raw king prawns").
  const stripped = name.replace(/^(fresh|raw|dried|ground|tinned|canned|chopped|minced|whole|ripe|fried)\s+/, "").trim();
  const variants = Array.from(new Set([name, name.replace(/s$/, ""), stripped, stripped.replace(/s$/, "")].filter(Boolean)));
  for (const v of variants) {
    const cached = (await db.get("SELECT data_json FROM nutrition_cache WHERE ingredient = ?", [v])) as
      | { data_json: string | null } | undefined;
    if (cached) return res.json({ ingredient: name, nutrition: safeParse(cached.data_json, null) });
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
  res.json({ ingredient: name, nutrition: out });
});
