/*
 * Fridge scan — vision endpoint + match serving (Phase B of the scan spec).
 *
 * PRIVACY INVARIANT (deliberate, load-bearing — do not weaken):
 *   Photo bytes are processed IN MEMORY ONLY. They are never written to disk,
 *   never stored in any table, and never logged (no console.log may ever take
 *   the images array or anything derived from its bytes). Telemetry stores
 *   only canonical ingredient ids; free-text "other" detections are stored
 *   WITHOUT identity (events row with user_id NULL) because they can contain
 *   odd personal info. The API key lives in the server env, never the client.
 */
import { Router, type Response } from "express";
import crypto from "node:crypto";
import { db } from "./db.js";
import { requireAuth, type AuthedRequest } from "./auth.js";
import { VOCAB, VOCAB_IDS } from "./scan-data.js";
import { matchRecipes, deriveRequirements, type RecipeReq, type MatchResult } from "./match.js";

// ---- config (tunable) --------------------------------------------------------
const SCAN_MODEL = process.env.SCAN_MODEL || "claude-haiku-4-5-20251001"; // cheapest vision tier; audition vs mid-tier before settling
const SCANS_PER_DAY = Number(process.env.SCANS_PER_DAY || 10);            // per-user daily cap
const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;   // backstop — the client compresses to ~200-400KB first
const VISION_TIMEOUT_MS = 10_000;

// ---- requirements cache (derived from the recipes table at first use) --------
let reqCache: { at: number; reqs: RecipeReq[]; meta: Map<string, any> } | null = null;
async function recipeRequirements(): Promise<{ reqs: RecipeReq[]; meta: Map<string, any> }> {
  if (reqCache && Date.now() - reqCache.at < 10 * 60 * 1000) return reqCache;
  const rows = (await db.all("SELECT id, name, data_json, is_music_sync FROM recipes")) as any[];
  const reqs: RecipeReq[] = [];
  const meta = new Map<string, any>();
  for (const r of rows) {
    let data: any = {};
    try { data = JSON.parse(r.data_json || "{}"); } catch { /* skip */ }
    const req = deriveRequirements(r.id, data.ingredients || []);
    if (!req) continue;
    reqs.push(req);
    meta.set(r.id, {
      id: r.id, title: data.title || r.name, emoji: data.emoji || "🍽️", thumb: data.thumb || "",
      isMusicSync: !!Number(r.is_music_sync), difficulty: data.difficulty || null,
      estimatedTimeMin: data.estimatedTimeMin || null, totalIngredients: req.totalIngredients,
    });
  }
  reqCache = { at: Date.now(), reqs, meta };
  return reqCache;
}

// ---- vision call --------------------------------------------------------------
function visionPrompt(): string {
  const vocabLines = VOCAB.map((v) => `${v.id} — ${v.label}${v.aliases.length ? ` (aka: ${v.aliases.join(", ")})` : ""}`).join("\n");
  return `You identify food ingredients visible in photos of fridges, pantries and kitchen counters.

CANONICAL VOCABULARY (the ONLY ids you may return in "matched"):
${vocabLines}

Rules:
- Presence only — no quantities, no counts.
- Ignore brands, condiment micro-packets, drinks that aren't ingredients, and anything non-food.
- Do NOT guess occluded or uncertain items; only report what is clearly visible.
- Clearly-visible food items that don't fit any vocabulary id go in "other" as short plain names.
- If the image is unusable, set "quality" ("too_dark" | "too_blurry" | "not_food") and return empty arrays.

Return STRICT JSON only — no prose, no code fences:
{"matched":["ingredient_ids"],"other":["free text"],"quality":"ok"}`;
}

function parseVision(text: string): { matched: string[]; other: string[]; quality: string } | null {
  const cleaned = String(text || "").replace(/```(json)?/g, "").trim();
  const start = cleaned.indexOf("{"), end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const j = JSON.parse(cleaned.slice(start, end + 1));
    const matched = Array.isArray(j.matched) ? j.matched.filter((x: any) => typeof x === "string" && VOCAB_IDS.has(x)) : [];
    const other = Array.isArray(j.other) ? j.other.filter((x: any) => typeof x === "string").map((x: string) => x.slice(0, 60)).slice(0, 20) : [];
    const quality = ["ok", "too_dark", "too_blurry", "not_food"].includes(j.quality) ? j.quality : "ok";
    return { matched: [...new Set(matched)] as string[], other: other as string[], quality };
  } catch { return null; }
}

async function callVision(images: string[]): Promise<{ matched: string[]; other: string[]; quality: string; usage?: any }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw Object.assign(new Error("scan-disabled"), { code: 503 });
  const content: any[] = images.map((b64) => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: b64 } }));
  content.push({ type: "text", text: "Identify the ingredients per the system rules. STRICT JSON only." });
  const body = JSON.stringify({
    model: SCAN_MODEL, max_tokens: 700,
    system: visionPrompt(),
    messages: [{ role: "user", content }],
  });
  const attempt = async () => {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), VISION_TIMEOUT_MS);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", signal: ctl.signal,
        headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body,
      });
      if (!res.ok) throw new Error("vision-http-" + res.status);
      const j: any = await res.json();
      const text = (j.content || []).map((c: any) => c.text || "").join("");
      const parsed = parseVision(text);
      if (!parsed) throw new Error("vision-malformed");
      // cost visibility for the model audition — token counts only, never image data
      if (j.usage) console.log(`[scan] model=${SCAN_MODEL} in=${j.usage.input_tokens} out=${j.usage.output_tokens}`);
      return { ...parsed, usage: j.usage };
    } finally { clearTimeout(t); }
  };
  try { return await attempt(); }
  catch (e: any) {
    if (String(e?.message).includes("malformed")) return await attempt();   // retry ONCE on malformed output
    throw e;
  }
}

// ---- helpers -------------------------------------------------------------------
const todayStart = () => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d.toISOString(); };
function decorate(matches: MatchResult[], meta: Map<string, any>) {
  return matches
    .filter((m) => m.status !== "missing")
    .map((m) => ({ ...m, recipe: meta.get(m.recipeId) || { id: m.recipeId } }));
}
async function logScan(userId: string, detected: string[], added: string[], summary: { ready: number; almost: number }) {
  const id = crypto.randomUUID();
  await db.run(
    "INSERT INTO scans (id, user_id, detected_ids, added_ids, match_summary, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    [id, userId, JSON.stringify(detected), JSON.stringify(added), JSON.stringify(summary), new Date().toISOString()]
  );
  return id;
}

export const scanRouter = Router();

// vocabulary for the client's chips/autocomplete (public, cache-friendly)
scanRouter.get("/scan/vocab", (_req, res) => {
  res.set("Cache-Control", "public, max-age=3600");
  res.json({ vocab: VOCAB.map((v) => ({ id: v.id, label: v.label, staple: !!v.staple })) });
});

// POST /api/scan — two modes, one source of truth for matching:
//   { images: [b64...], assumeStaples }            → vision + match (creates a scan row)
//   { ids: [...], scanId?, assumeStaples }         → match only (confirm-screen edits / manual mode)
scanRouter.post("/scan", requireAuth, async (req: AuthedRequest, res: Response) => {
  const userId = req.userId!;
  const assumeStaples = req.body?.assumeStaples !== false;
  const { reqs, meta } = await recipeRequirements();

  // ---- match-only mode (no vision, no cap, cheap) ----
  if (Array.isArray(req.body?.ids)) {
    const ids: string[] = (req.body.ids as any[]).filter((x: any) => typeof x === "string" && VOCAB_IDS.has(x)).slice(0, 60);
    const matches = matchRecipes(ids, reqs, { assumeStaples });
    const summary = { ready: matches.filter((m) => m.status === "ready").length, almost: matches.filter((m) => m.status === "almost").length };
    let scanId: string | null = String(req.body?.scanId || "") || null;
    try {
      if (scanId) {
        const own = (await db.all("SELECT detected_ids FROM scans WHERE id = ? AND user_id = ?", [scanId, userId])) as any[];
        if (own.length) {
          const detected: string[] = JSON.parse(own[0].detected_ids || "[]");
          const added = ids.filter((x) => !detected.includes(x));   // manual additions = vocab-gap + vision-miss signal
          await db.run("UPDATE scans SET added_ids = ?, match_summary = ? WHERE id = ?", [JSON.stringify(added), JSON.stringify(summary), scanId]);
        } else scanId = null;
      }
      if (!scanId) scanId = await logScan(userId, [], ids, summary);   // manual-only session
    } catch { /* telemetry is best-effort */ }
    return res.json({ scanId, detected: ids, other: [], quality: "ok", matches: decorate(matches, meta) });
  }

  // ---- vision mode ----
  const images = Array.isArray(req.body?.images) ? req.body.images : [];
  if (!images.length || images.length > MAX_IMAGES) return res.status(400).json({ error: "bad-images" });
  for (const img of images) {
    if (typeof img !== "string" || img.length * 0.75 > MAX_IMAGE_BYTES) return res.status(413).json({ error: "image-too-large" });
  }
  // per-user daily cap (named constant above)
  const cnt = (await db.all("SELECT count(*) AS n FROM scans WHERE user_id = ? AND created_at >= ? AND detected_ids <> '[]'", [userId, todayStart()])) as any[];
  if (Number(cnt[0]?.n || 0) >= SCANS_PER_DAY) return res.status(429).json({ error: "scan-cap" });

  try {
    const v = await callVision(images);
    // PRIVACY: from here on only derived ids/text exist; the base64 buffers go out of scope and are never persisted.
    const matches = v.quality === "ok" ? matchRecipes(v.matched, reqs, { assumeStaples }) : [];
    const summary = { ready: matches.filter((m) => m.status === "ready").length, almost: matches.filter((m) => m.status === "almost").length };
    let scanId: string | null = null;
    try {
      scanId = await logScan(userId, v.matched, [], summary);
      // "other" free text: aggregate-only, deliberately NOT tied to identity
      if (v.other.length) await db.run(
        "INSERT INTO events (id, type, recipe, user_id, created_at) VALUES (?, 'scan_other', ?, NULL, ?)",
        [crypto.randomUUID(), v.other.join(", ").slice(0, 120), new Date().toISOString()]
      );
    } catch { /* best-effort */ }
    res.json({ scanId, detected: v.matched, other: v.other, quality: v.quality, matches: decorate(matches, meta) });
  } catch (e: any) {
    if (e?.code === 503) return res.status(503).json({ error: "scan-disabled" });
    res.status(502).json({ error: "scan-failed" });   // client falls back to manual chips
  }
});

// a recipe was launched from scan results → complete the demand loop
scanRouter.post("/scan/launched", requireAuth, async (req: AuthedRequest, res: Response) => {
  const scanId = String(req.body?.scanId || ""), recipeId = String(req.body?.recipeId || "").slice(0, 80);
  if (scanId && recipeId) {
    try { await db.run("UPDATE scans SET launched_recipe_id = ? WHERE id = ? AND user_id = ?", [recipeId, scanId, req.userId!]); } catch { /* best-effort */ }
  }
  res.json({ ok: true });
});
