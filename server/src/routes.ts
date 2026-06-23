/*
 * REST API. This is the stable contract the web client uses now and the
 * Expo/React-Native app will use later — "build the API once, swap the client."
 */
import crypto from "node:crypto";
import { Router } from "express";
import { db } from "./db.js";
import { issueCode, verifyCode, getOrCreateUser, signToken, requireAuth, type AuthedRequest } from "./auth.js";

const DEV_PREMIUM_CODE = process.env.DEV_PREMIUM_CODE || "Dev123";

function safeParse<T>(s: string | null, fallback: T): T {
  try { return s ? (JSON.parse(s) as T) : fallback; } catch { return fallback; }
}
function userDTO(u: any) {
  return {
    id: u.id, email: u.email, experience: u.experience, isBeginner: !!u.is_beginner,
    equipment: safeParse(u.equipment_json, { pans: [], heat: null }),
    prefs: safeParse(u.prefs_json, {}),
    tier: u.tier, musicPlatform: u.music_platform, streak: u.streak,
  };
}
const findUser = (id: string) => db.prepare("SELECT * FROM users WHERE id = ?").get(id) as any;

export const api = Router();

// ---- health ----
api.get("/health", (_req, res) => res.json({ ok: true, service: "seartune-api", time: new Date().toISOString() }));

// ---- auth (passwordless OTP → JWT) ----
api.post("/auth/request", (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!email.includes("@")) return res.status(400).json({ error: "invalid-email" });
  const { code, devReturned } = issueCode(email);
  res.json({ sent: true, ...(devReturned ? { devCode: code } : {}) });
});

api.post("/auth/verify", (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const code = String(req.body?.code || "").trim();
  if (!verifyCode(email, code)) return res.status(401).json({ error: "bad-code" });
  const user = getOrCreateUser(email);
  res.json({ token: signToken(user.id), user: userDTO(user) });
});

// ---- profile ----
api.get("/me", requireAuth, (req: AuthedRequest, res) => {
  const u = findUser(req.userId!);
  if (!u) return res.status(404).json({ error: "no-user" });
  res.json({ user: userDTO(u) });
});

api.put("/me", requireAuth, (req: AuthedRequest, res) => {
  const u = findUser(req.userId!);
  if (!u) return res.status(404).json({ error: "no-user" });
  const b = req.body || {};
  const equipment = b.equipment ? JSON.stringify(b.equipment) : u.equipment_json;
  const prefs = b.prefs ? JSON.stringify(b.prefs) : u.prefs_json;
  db.prepare(
    `UPDATE users SET experience = ?, is_beginner = ?, equipment_json = ?, prefs_json = ?,
       music_platform = ?, streak = ?, updated_at = ? WHERE id = ?`
  ).run(
    b.experience ?? u.experience,
    b.isBeginner != null ? (b.isBeginner ? 1 : 0) : u.is_beginner,
    equipment, prefs,
    b.musicPlatform !== undefined ? b.musicPlatform : u.music_platform,
    b.streak != null ? b.streak : u.streak,
    new Date().toISOString(), u.id
  );
  res.json({ user: userDTO(findUser(u.id)) });
});

// ---- entitlement (server-enforced premium; dev/tester code for now) ----
api.post("/entitlement/redeem", requireAuth, (req: AuthedRequest, res) => {
  const code = String(req.body?.code || "").trim();
  if (code !== DEV_PREMIUM_CODE) return res.status(400).json({ error: "invalid-code" });
  db.prepare("UPDATE users SET tier = 'premium', updated_at = ? WHERE id = ?").run(new Date().toISOString(), req.userId);
  res.json({ user: userDTO(findUser(req.userId!)) });
});

// ---- cook sessions (the data flywheel — now server-side, not localStorage) ----
api.post("/sessions", requireAuth, (req: AuthedRequest, res) => {
  const s = req.body || {};
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO cook_sessions (id, user_id, mode, recipe, rating, heat_source, pan, completed, payload_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id, req.userId, s.mode ?? null, s.recipe ?? null, s.rating ?? null,
    s.heatSource ?? null, s.pan ?? null, s.completed ? 1 : 0,
    JSON.stringify(s), new Date().toISOString()
  );
  res.json({ id });
});

api.get("/sessions", requireAuth, (req: AuthedRequest, res) => {
  const rows = db.prepare(
    "SELECT payload_json, created_at FROM cook_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 200"
  ).all(req.userId) as { payload_json: string; created_at: string }[];
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

// ---- nutrition proxy (per 100g): cache → seed → Open Food Facts ----
// Runs server-side, so it sidesteps the browser CORS problem that made a
// client-side Open Food Facts call unreliable.
api.get("/nutrition", async (req, res) => {
  const name = String(req.query.q || "").trim().toLowerCase();
  if (!name) return res.status(400).json({ error: "no-ingredient" });

  const cached = db.prepare("SELECT data_json FROM nutrition_cache WHERE ingredient = ?").get(name) as
    | { data_json: string | null } | undefined;
  if (cached) return res.json({ ingredient: name, nutrition: safeParse(cached.data_json, null) });

  let out: any = null;
  try {
    const url = `https://world.openfoodfacts.org/api/v2/search?search_terms=${encodeURIComponent(name)}&fields=nutriments&page_size=1`;
    const data: any = await (await fetch(url, { headers: { "User-Agent": "SearTune/0.1 (testing)" } })).json();
    const n = (data.products && data.products[0] && data.products[0].nutriments) || {};
    let kcal = n["energy-kcal_100g"];
    if (kcal == null && n["energy_100g"] != null) kcal = n["energy_100g"] / 4.184;
    if (kcal != null || n.proteins_100g != null) {
      out = {
        kcal: kcal != null ? Math.round(kcal) : null,
        protein: n.proteins_100g != null ? Math.round(n.proteins_100g) : null,
        fat: n.fat_100g != null ? Math.round(n.fat_100g) : null,
        carbs: n.carbohydrates_100g != null ? Math.round(n.carbohydrates_100g) : null,
        source: "openfoodfacts",
      };
    }
  } catch { /* leave null */ }

  db.prepare("INSERT OR REPLACE INTO nutrition_cache (ingredient, data_json, updated_at) VALUES (?, ?, ?)")
    .run(name, out ? JSON.stringify(out) : null, new Date().toISOString());
  res.json({ ingredient: name, nutrition: out });
});
