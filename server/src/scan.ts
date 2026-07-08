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
import { getLimitState } from "./limits.js";

// ---- config (tunable) --------------------------------------------------------
// SCAN 2.0 model ladder (Part 1): Haiku first pass per photo; sparse results on
// an ok-quality photo escalate THAT photo to Sonnet; a premium account tier can
// route straight to STRONG/MAX (hook wired, no UI yet — premium doesn't exist).
const SCAN_MODEL_DEFAULT = process.env.SCAN_MODEL || "claude-sonnet-4-6";   // FOUNDER DECISION 2026-07-07: Sonnet default (~5c/3-photo scan) — benchmark showed +12-25pt recall over the ladder; escalation stays as the premium MAX hook path
const SCAN_MODEL_STRONG = process.env.SCAN_MODEL_STRONG || "claude-sonnet-4-6";
const SCAN_MODEL_MAX = process.env.SCAN_MODEL_MAX || "claude-opus-4-8";
const ESCALATION_THRESHOLD = Number(process.env.SCAN_ESCALATION_THRESHOLD || 4);   // (matched+uncertain) below this on an ok photo → Sonnet re-run
const SCAN_MODEL = SCAN_MODEL_DEFAULT;   // legacy references
const SCANS_PER_DAY = Number(process.env.SCANS_PER_DAY || 10);            // per-user daily cap
const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;   // backstop — the client compresses to ~200-400KB first
const VISION_TIMEOUT_MS = Number(process.env.SCAN_VISION_TIMEOUT_MS || 20_000);   // per-photo calls at 1568px need headroom (Sonnet especially)

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
  const vocabLines = VOCAB.map((v: any) => `${v.id} — ${v.label}${v.aliases.length ? ` (aka: ${v.aliases.join(", ")})` : ""}${v.category ? ` [${v.category}]` : ""}`).join("\n");
  return `You identify food ingredients visible in ONE photo of a fridge, pantry or kitchen counter. Your job is to find EVERYTHING — a missed item is the worst outcome.

CANONICAL VOCABULARY (the ONLY ids you may return in "matched"/"uncertain"):
${vocabLines}

Method — sweep the image systematically, region by region: top shelf, middle shelves, bottom shelf, door shelves, drawers, counter. In each region enumerate EVERY distinct food item you can see — including items partially hidden behind others, items in transparent containers or bags, and packaged goods (READ the labels).

Output tiers:
- "matched": vocabulary ids you are confident about.
- "uncertain": items you are NOT sure about — partially visible, ambiguous, low confidence. Each as {"id_or_name":"...","reason":"..."} (a vocabulary id when one plausibly fits, else a short name). When unsure, put it in uncertain rather than omitting it — a wrong guess in uncertain costs nothing; an omission loses the item.
- "other": clearly visible food that fits no vocabulary id, as short plain names.
- CLOSED OR OPAQUE CONTAINERS (tubs, trays, boxes, bags you can't see into): guess the MOST LIKELY contents from shape, lid, packaging and fridge context, and put the guess in "uncertain" — never skip a container just because you can't see inside.

Rules:
- Presence only — no quantities, no counts.
- Ignore brands-as-such, condiment micro-packets, drinks that aren't cooking ingredients, and anything non-food.
- If the image is unusable, set "quality" ("too_dark" | "too_blurry" | "not_food") and return empty arrays.

Return STRICT JSON only — no prose, no code fences:
{"matched":["ids"],"uncertain":[{"id_or_name":"...","reason":"..."}],"other":["free text"],"quality":"ok"}`;
}

export type VisionTiers = { matched: string[]; uncertain: { id_or_name: string; reason: string }[]; other: string[]; quality: string };
export function parseVision(text: string): VisionTiers | null {
  const cleaned = String(text || "").replace(/```(json)?/g, "").trim();
  const start = cleaned.indexOf("{"), end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const j = JSON.parse(cleaned.slice(start, end + 1));
    const matched = Array.isArray(j.matched) ? j.matched.filter((x: any) => typeof x === "string" && VOCAB_IDS.has(x)) : [];
    const uncertain = Array.isArray(j.uncertain) ? j.uncertain
      .map((u: any) => (typeof u === "string" ? { id_or_name: u, reason: "" } : u))
      .filter((u: any) => u && typeof u.id_or_name === "string")
      .map((u: any) => ({ id_or_name: String(u.id_or_name).slice(0, 60), reason: String(u.reason || "").slice(0, 80) })).slice(0, 20) : [];
    const other = Array.isArray(j.other) ? j.other.filter((x: any) => typeof x === "string").map((x: string) => x.slice(0, 60)).slice(0, 20) : [];
    const quality = ["ok", "too_dark", "too_blurry", "not_food"].includes(j.quality) ? j.quality : "ok";
    return { matched: [...new Set(matched)] as string[], uncertain, other, quality };
  } catch { return null; }
}

export async function callVisionOne(imageB64: string, model: string): Promise<VisionTiers & { usage?: any }> {
  if (process.env.MOCK_AI === "1") {
    // deterministic fixtures keyed by payload size — matched+uncertain+other mix
    // so ghost chips exercise for real; tiny payloads simulate quality flags.
    const n = imageB64.length;
    if (n < 200) return { matched: [], uncertain: [], other: [], quality: "too_dark" };
    const pool = [
      { matched: ["egg", "milk"], uncertain: [{ id_or_name: "sour_cream", reason: "opaque tub" }], other: ["pineapple"], quality: "ok" },
      { matched: ["chicken_thigh", "butter"], uncertain: [{ id_or_name: "mystery pickle jar", reason: "unlabeled jar" }], other: [], quality: "ok" },
      { matched: ["parmesan", "garlic", "pasta", "heavy_cream"], uncertain: [{ id_or_name: "broccoli", reason: "closed container" }], other: [], quality: "ok" },
    ];
    return pool[n % pool.length];
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw Object.assign(new Error("scan-disabled"), { code: 503 });
  const content: any[] = [{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageB64 } }];
  content.push({ type: "text", text: "Sweep this photo region by region and identify every food item per the system rules. STRICT JSON only." });
  const body = JSON.stringify({
    model, max_tokens: 1200,
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
      if (j.usage) console.log(`[scan] model=${model} in=${j.usage.input_tokens} out=${j.usage.output_tokens}`);
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
  res.json({ vocab: VOCAB.map((v) => ({ id: v.id, label: v.label, staple: !!v.staple, category: v.category })) });
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
  // per-user daily cap (named constant above) — the abuse backstop ABOVE the
  // product limit below; they coexist and this one fires first if ever relevant.
  const cnt = (await db.all("SELECT count(*) AS n FROM scans WHERE user_id = ? AND created_at >= ? AND detected_ids <> '[]'", [userId, todayStart()])) as any[];
  if (Number(cnt[0]?.n || 0) >= SCANS_PER_DAY) return res.status(429).json({ error: "scan-cap" });
  // USAGE LIMIT (flag-gated): 3 photo scans / rolling 7 days, checked BEFORE the
  // vision call — a limited user's photo never reaches the model. Cache hits and
  // fresh calls count the same (the user got the value); manual/ids mode never
  // counts. Exempt accounts: counters tick (scans rows accrue), walls never show.
  const lim = await getLimitState(userId);
  if (lim && !lim.exempt && lim.scansUsed >= lim.scansLimit) return res.status(402).json({ error: "scan-limit" });

  try {
    // SCAN 2.0 (Part 1): ONE VISION CALL PER PHOTO, in parallel — full model
    // attention per image (cross-image dilution was the prime miss suspect).
    // Sparse ok-quality photos escalate to SCAN_MODEL_STRONG; Sonnet's verdicts
    // win merge conflicts. Single-photo failure degrades to the others' union.
    // Premium hook: users.scan_tier ("strong"|"max") routes ALL passes straight
    // to the stronger model, skipping escalation (no UI yet — wired for later).
    const tierRow = (await db.all("SELECT scan_tier FROM users WHERE id = ?", [userId])) as any[];
    const tier = tierRow[0]?.scan_tier || null;
    const baseModel = tier === "max" ? SCAN_MODEL_MAX : tier === "strong" ? SCAN_MODEL_STRONG : SCAN_MODEL_DEFAULT;
    const perPhoto = await Promise.all(images.map(async (img: string, i: number) => {
      try {
        let r = await callVisionOne(img, baseModel);
        if (!tier && r.quality === "ok" && (r.matched.length + r.uncertain.length) < ESCALATION_THRESHOLD) {
          console.log(`[scan] photo ${i + 1} sparse (${r.matched.length}+${r.uncertain.length}) → escalating to ${SCAN_MODEL_STRONG}`);
          try {
            const strong = await callVisionOne(img, SCAN_MODEL_STRONG);
            r = { matched: [...new Set([...strong.matched, ...r.matched])], uncertain: [...strong.uncertain, ...r.uncertain], other: [...new Set([...strong.other, ...r.other])], quality: strong.quality };
            try { await db.run("INSERT INTO events (id, type, recipe, user_id, created_at) VALUES (?, 'scan_photo_escalated', NULL, NULL, ?)", [crypto.randomUUID(), new Date().toISOString()]); } catch { /* best-effort */ }
          } catch { /* escalation failure keeps the Haiku result */ }
        }
        return { ok: true as const, ...r };
      } catch { return { ok: false as const, matched: [], uncertain: [], other: [], quality: "ok" }; }
    }));
    const okPhotos = perPhoto.filter((p) => p.ok);
    if (!okPhotos.length) throw new Error("all-photos-failed");
    // union-dedupe across photos; uncertain entries drop anything already matched
    const matchedAll = [...new Set(okPhotos.flatMap((p) => p.matched))];
    const seenU = new Set(matchedAll);
    const uncertainAll = okPhotos.flatMap((p) => p.uncertain).filter((u) => { const k = u.id_or_name; if (seenU.has(k)) return false; seenU.add(k); return true; }).slice(0, 20);
    const otherAll = [...new Set(okPhotos.flatMap((p) => p.other))].slice(0, 20);
    // quality: worst-of when nothing was found, else ok
    const quality = matchedAll.length || uncertainAll.length || otherAll.length ? "ok" : (okPhotos.find((p) => p.quality !== "ok")?.quality || "ok");
    const v = { matched: matchedAll, uncertain: uncertainAll, other: otherAll, quality, failed: images.length - okPhotos.length };
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
    res.json({ scanId, detected: v.matched, uncertain: v.uncertain, other: v.other, quality: v.quality, failedPhotos: v.failed, matches: decorate(matches, meta) });
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

// ---- §4.1 AI recipe-concept previews -------------------------------------------
// One Haiku-class call per UNIQUE confirmed ingredient set (cached, 7-day TTL).
// Failure of any kind = { concepts: [] } with 200 — previews never error, never
// block the catalog match sections.
const CONCEPT_MODEL = process.env.CONCEPT_MODEL || "claude-haiku-4-5-20251001";   // text-only creative task — stays Haiku (the scan model's Sonnet flip must not silently upgrade this spend)
const CONCEPT_TTL_MS = 7 * 24 * 3600 * 1000;
const CONCEPT_TIMEOUT_MS = 12_000;

function setKey(ids: string[], staples: boolean): string {
  return crypto.createHash("sha1").update([...ids].sort().join(",") + "|" + (staples ? 1 : 0)).digest("hex");
}

// UNIQUENESS (Scan 2.1): the catalog rides into the prompt AND a post-guard —
// concepts must not duplicate shipped recipes; a shipped recipe must stop
// appearing as an "idea" (cache is stamped with the catalog version).
// AI-ideas dupe scoping (root-cause fix): the TITLE check runs against the FULL
// catalog (never propose a title that literally exists — incl. the ~400 imports),
// but the INGREDIENT-overlap check runs ONLY against our authored cookable recipes
// (music-sync set). Checking ingredient overlap against 400 imports false-killed
// almost every generation ("shares chicken+rice with SOME import") → empty section.
async function catalogContext(): Promise<{ full: string[]; authored: { title: string; req: string[] }[]; stamp: string }> {
  const { reqs, meta } = await recipeRequirements();
  const full: string[] = [];
  const authored: { title: string; req: string[] }[] = [];
  for (const r of reqs) {
    const m = (meta.get(r.recipeId) || {}) as any;
    const title = m.title || r.recipeId;
    full.push(title);
    if (m.isMusicSync) authored.push({ title, req: r.required.filter((x) => !x.startsWith("~")) });
  }
  // stamp over AUTHORED titles only → shipping one of OUR recipes invalidates ideas
  // that duplicate it, but import churn no longer thrashes the cache.
  const stamp = crypto.createHash("sha1").update(authored.map((a) => a.title).sort().join("|")).digest("hex").slice(0, 10);
  return { full, authored, stamp };
}
const normTitle = (t: string) => String(t).toLowerCase().replace(/[^a-z ]+/g, "").split(/\s+/).filter((w) => w.length > 2 && !["with", "and", "the"].includes(w));
// Title dupe = near-identical title to ANY catalog recipe (Jaccard ≥ 0.7 on
// content words). Jaccard (not "60% of the catalog title's words") so a real
// variant like "Garlic Butter Rice" isn't killed by an import called "Garlic Rice".
function titleDupe(c: any, fullTitles: string[]): boolean {
  const ct = new Set(normTitle(c.title));
  if (!ct.size) return false;
  for (const t of fullTitles) {
    const rt = new Set(normTitle(t));
    if (!rt.size) continue;
    let inter = 0; ct.forEach((w) => { if (rt.has(w)) inter++; });
    const union = new Set([...ct, ...rt]).size;
    if (inter / union >= 0.7) return true;
  }
  return false;
}
// Ingredient dupe = uses ≥80% of one of OUR authored recipes' required set (a
// trivial variant of a real Choppd cook). Scoped to authored only — see above.
function ingredientDupe(c: any, authored: { title: string; req: string[] }[]): boolean {
  const uses = new Set(c.uses || []);
  for (const r of authored) {
    // Only recipes with a substantive required set (≥3) can be "owned" by ingredient
    // overlap. Otherwise chicken=[chicken_thigh] flags EVERY concept using chicken as
    // a trivial variant — the title check handles 1–2-ingredient recipes instead.
    if (r.req.length >= 3 && r.req.filter((id) => uses.has(id)).length / r.req.length >= 0.8) return true;
  }
  return false;
}
// Relevance: the concept must genuinely lean on THEIR fridge. ≥4 of their ids for
// small sets, ≥70% for larger ones (uses is already filtered to their ids on parse).
function isRelevant(c: any, ids: string[]): boolean {
  const n = ids.length;
  const need = n <= 5 ? Math.min(4, n) : Math.ceil(n * 0.7);
  return (c.uses || []).length >= need;
}
function conceptPrompt(ids: string[], staples: boolean, authored: { title: string; req: string[] }[] = []): string {
  const labels = ids.map((id) => { const v = VOCAB.find((x) => x.id === id); return `${id} — ${v ? v.label : id}`; }).join("\n");
  const need = ids.length <= 5 ? Math.min(4, ids.length) : Math.ceil(ids.length * 0.7);
  return `You invent simple stovetop recipe CONCEPTS for a beginner cooking app, from what's in someone's fridge.

THEIR CONFIRMED INGREDIENTS (the only "uses" ids you may return):
${labels}
${staples ? "Salt, pepper, cooking oil and butter may be assumed on top of the list." : "Assume NO staples beyond the list."}

OUR EXISTING COOKS (do NOT propose these or trivial variants — everything else is fair game):
${authored.map((r) => `- ${r.title}`).join("\n") || "- (none)"}

Hard rules:
- Propose 7 or 8 DISTINCT concepts (we show the best 5). Different dishes, not variations of each other.
- RELEVANCE: each concept must lean hard on THEIR fridge — "uses" must include at least ${need} of the ids above, and at least 70% of the concept's own ingredients must come from their list.
- Not a trivial variant of "our existing cooks" above.
- "would_need" = at most 2 common, cheap, staples-adjacent items NOT in their list. Fewer is better; empty is best.
- Beginner + equipment reality: stovetop only, one pan or one pot bias, no ovens, no specialty gear.
- No dietary or health claims of any kind.
- est_minutes honest end-to-end (prep + cook), 10–40 range. difficulty: "beginner" or "easy".
- one_line_hook: one short punchy line in a warm, no-nonsense register. No emoji.

Return STRICT JSON only — no prose, no code fences:
{"concepts":[{"title":"...","one_line_hook":"...","uses":["ids from their list"],"would_need":["item"],"est_minutes":25,"difficulty":"beginner"}]}`;
}

function parseConcepts(text: string, ids: string[]): any[] | null {
  const cleaned = String(text || "").replace(/```(json)?/g, "").trim();
  const start = cleaned.indexOf("{"), end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const j = JSON.parse(cleaned.slice(start, end + 1));
    if (!Array.isArray(j.concepts)) return null;
    const idset = new Set(ids);
    const out = j.concepts.slice(0, 8).map((c: any) => ({
      title: String(c.title || "").slice(0, 80),
      one_line_hook: String(c.one_line_hook || "").slice(0, 140),
      uses: Array.isArray(c.uses) ? c.uses.filter((x: any) => typeof x === "string" && idset.has(x)).slice(0, 20) : [],
      would_need: Array.isArray(c.would_need) ? c.would_need.filter((x: any) => typeof x === "string").map((x: string) => x.slice(0, 40)).slice(0, 2) : [],
      est_minutes: Math.max(5, Math.min(60, Number(c.est_minutes) || 25)),
      difficulty: c.difficulty === "easy" ? "easy" : "beginner",
    })).filter((c: any) => c.title && c.uses.length);
    return out.length ? out : null;
  } catch { return null; }
}

async function callConcepts(ids: string[], staples: boolean, authored: { title: string; req: string[] }[] = []): Promise<any[]> {
  if (process.env.MOCK_AI === "1") {
    // 8 candidates exercising the guards: 6 relevant+unique, 1 authored-title dupe,
    // 1 irrelevant (uses too few) → the pipeline should serve exactly 5.
    const dishes = ["Skillet", "One-Pan", "Loaded", "Weeknight", "Garlic-Butter", "Crispy"];
    const good = dishes.map((d, i) => ({ title: `${d} ${ids[i % ids.length]} bowl ${i}`.replace(/_/g, " "), one_line_hook: "fridge-clean-out that actually slaps.", uses: ids.slice(0, Math.max(4, ids.length)), would_need: [], est_minutes: 20 + i, difficulty: "beginner" }));
    return [
      ...good,
      { title: "Creamy One-Pot Garlic Parmesan Pasta", one_line_hook: "planted title dupe", uses: ids.slice(0, 3), would_need: [], est_minutes: 25, difficulty: "beginner" },
      { title: "Plain Buttered Toast", one_line_hook: "planted irrelevant", uses: ids.slice(0, 1), would_need: ["bread"], est_minutes: 5, difficulty: "easy" },
    ];
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return [];
  const body = JSON.stringify({
    model: CONCEPT_MODEL, max_tokens: 900,
    messages: [{ role: "user", content: conceptPrompt(ids, staples, authored) }],
  });
  const attempt = async () => {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), CONCEPT_TIMEOUT_MS);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", signal: ctl.signal,
        headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body,
      });
      if (!res.ok) throw new Error("concepts-http-" + res.status);
      const j: any = await res.json();
      if (j.usage) console.log(`[concepts] model=${SCAN_MODEL} in=${j.usage.input_tokens} out=${j.usage.output_tokens}`);
      const parsed = parseConcepts((j.content || []).map((c: any) => c.text || "").join(""), ids);
      if (!parsed) throw new Error("concepts-malformed");
      return parsed;
    } finally { clearTimeout(t); }
  };
  try { return await attempt(); }
  catch (e: any) {
    if (String(e?.message).includes("malformed")) { try { return await attempt(); } catch { return []; } }   // retry ONCE on malformed
    return [];
  }
}

// POST /api/scan/concepts — { ids, assumeStaples } → { concepts } (never errors)
scanRouter.post("/scan/concepts", requireAuth, async (req: AuthedRequest, res: Response) => {
  const ids: string[] = (Array.isArray(req.body?.ids) ? req.body.ids : []).filter((x: any) => typeof x === "string" && VOCAB_IDS.has(x)).slice(0, 60);
  const staples = req.body?.assumeStaples !== false;
  if (ids.length < 2) return res.json({ concepts: [] });   // too little to invent from
  const cat = await catalogContext();
  // "-v2" bumps the cache generation so results from the old false-killing guard
  // logic (often empty) are invalidated rather than served for 7 more days.
  const k = setKey(ids, staples) + "-v2-" + cat.stamp;
  try {
    const hit = (await db.all("SELECT concepts_json, created_at FROM concept_cache WHERE set_key = ?", [k])) as any[];
    if (hit.length && Date.now() - new Date(hit[0].created_at).getTime() < CONCEPT_TTL_MS) {
      return res.json({ concepts: JSON.parse(hit[0].concepts_json), cached: true });
    }
    // Serve the best 5: one filter pass over the candidates (title-dupe vs full
    // catalog, ingredient-dupe vs authored, relevance), regenerate ONCE if short.
    const counts = { candidates_generated: 0, rejected_duplicate: 0, rejected_irrelevant: 0, served: 0 };
    const seen = new Set<string>();
    const served: any[] = [];
    const consider = (arr: any[]) => {
      for (const c of arr) {
        if (served.length >= 5) break;
        const t = String(c.title || "").toLowerCase();
        if (!t || seen.has(t)) continue;
        seen.add(t);
        if (titleDupe(c, cat.full) || ingredientDupe(c, cat.authored)) { counts.rejected_duplicate++; continue; }
        if (!isRelevant(c, ids)) { counts.rejected_irrelevant++; continue; }
        served.push(c);
      }
    };
    const gen1 = await callConcepts(ids, staples, cat.authored);
    counts.candidates_generated += gen1.length;
    consider(gen1);
    if (served.length < 5) {
      const gen2 = await callConcepts(ids, staples, cat.authored);
      counts.candidates_generated += gen2.length;
      consider(gen2);
    }
    counts.served = served.length;
    try { console.log("[concepts]", JSON.stringify({ n_ids: ids.length, ...counts, shortfall: Math.max(0, 5 - served.length) })); } catch (e) { /* log best-effort */ }
    if (served.length) {
      await db.run("INSERT INTO concept_cache (set_key, concepts_json, created_at) VALUES (?, ?, ?) ON CONFLICT(set_key) DO UPDATE SET concepts_json = excluded.concepts_json, created_at = excluded.created_at", [k, JSON.stringify(served), new Date().toISOString()]);
    }
    res.json({ concepts: served });
  } catch { res.json({ concepts: [] }); }
});

// POST /api/scan/request — §4.2: explicit demand. { ids, concept? }
scanRouter.post("/scan/request", requireAuth, async (req: AuthedRequest, res: Response) => {
  const ids: string[] = (Array.isArray(req.body?.ids) ? req.body.ids : []).filter((x: any) => typeof x === "string" && VOCAB_IDS.has(x)).slice(0, 60);
  const c = req.body?.concept || null;
  const title = c && typeof c.title === "string" ? c.title.slice(0, 80) : null;
  const id = crypto.randomUUID();
  try {
    await db.run(
      "INSERT INTO recipe_requests (id, user_id, set_key, ingredient_ids, concept_title, concept_json, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'requested', ?)",
      [id, req.userId!, setKey(ids, true), JSON.stringify(ids), title, c ? JSON.stringify(c).slice(0, 2000) : null, new Date().toISOString()]
    );
    res.json({ ok: true, id });
  } catch { res.status(500).json({ error: "request-failed" }); }
});

// POST /api/scan/concept-request — Scan 2.1: the Instagram-DM demand loop.
// Handle is optional contact data used ONLY to tell them when it ships (full
// row delete on account deletion — see the delete transaction).
scanRouter.post("/scan/concept-request", requireAuth, async (req: AuthedRequest, res: Response) => {
  const ids: string[] = (Array.isArray(req.body?.ids) ? req.body.ids : []).filter((x: any) => typeof x === "string" && VOCAB_IDS.has(x)).slice(0, 60);
  const c = req.body?.concept || null;
  const message = String(req.body?.message || "").slice(0, 400) || null;
  let handle = String(req.body?.instagram || "").trim().replace(/^@/, "");
  if (handle && !/^[A-Za-z0-9._]{1,30}$/.test(handle)) return res.status(400).json({ error: "bad-handle" });
  try {
    await db.run(
      "INSERT INTO concept_requests (id, user_id, concept_json, message, instagram_handle, ingredient_set, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'new', ?)",
      [crypto.randomUUID(), req.userId!, c ? JSON.stringify(c).slice(0, 2000) : null, message, handle || null, JSON.stringify(ids), new Date().toISOString()]
    );
    res.json({ ok: true, withHandle: !!handle });
  } catch { res.status(500).json({ error: "request-failed" }); }
});

// GET /api/scan/requests/fulfilled — shipped-but-unseen requests for the home card
scanRouter.get("/scan/requests/fulfilled", requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const rows = (await db.all(
      "SELECT id, concept_title AS title2, shipped_recipe, 'legacy' AS src FROM recipe_requests WHERE user_id = ? AND status = 'shipped' AND seen_at IS NULL ORDER BY created_at DESC LIMIT 3",
      [req.userId!]
    )) as any[];
    const rows2 = (await db.all(
      "SELECT id, concept_json, shipped_recipe, 'concept' AS src FROM concept_requests WHERE user_id = ? AND status = 'shipped' AND user_seen_at IS NULL ORDER BY created_at DESC LIMIT 3",
      [req.userId!]
    )) as any[];
    const all = [...rows2.map((r) => { let t = null; try { t = JSON.parse(r.concept_json || "{}").title; } catch { /* ignore */ } return { id: r.id, title: r.shipped_recipe || t, src: r.src }; }), ...rows.map((r) => ({ id: r.id, title: r.shipped_recipe || r.title2, src: r.src }))];
    res.json({ fulfilled: all.filter((x) => x.title).slice(0, 3) });
  } catch { res.json({ fulfilled: [] }); }
});

// POST /api/scan/requests/seen — the notification card was viewed
scanRouter.post("/scan/requests/seen", requireAuth, async (req: AuthedRequest, res: Response) => {
  const id = String(req.body?.id || "");
  if (id) {
    try {
      await db.run("UPDATE recipe_requests SET seen_at = ? WHERE id = ? AND user_id = ?", [new Date().toISOString(), id, req.userId!]);
      await db.run("UPDATE concept_requests SET user_seen_at = ? WHERE id = ? AND user_id = ?", [new Date().toISOString(), id, req.userId!]);
    } catch { /* best-effort */ }
  }
  res.json({ ok: true });
});

// ---- SCAN 2.0 per-photo streaming endpoint --------------------------------------
// The client posts each photo separately so the live counter is REAL. The FIRST
// photo of a session creates the scan row (weekly limit + daily cap checked and
// the scan counted ONCE); later photos ride the same session. The confirm screen
// finalizes via the existing ids-mode /scan call with this scanId.
scanRouter.post("/scan/photo", requireAuth, async (req: AuthedRequest, res: Response) => {
  const userId = req.userId!;
  const img = req.body?.image;
  const sessionScanId = String(req.body?.scanId || "") || null;
  if (typeof img !== "string" || !img.length || img.length * 0.75 > MAX_IMAGE_BYTES) return res.status(413).json({ error: "image-too-large" });
  let scanId = sessionScanId;
  if (!scanId) {
    // first photo = the one countable scan of this session (limits enforced HERE)
    const cnt = (await db.all("SELECT count(*) AS n FROM scans WHERE user_id = ? AND created_at >= ? AND detected_ids <> '[]'", [userId, todayStart()])) as any[];
    if (Number(cnt[0]?.n || 0) >= SCANS_PER_DAY) return res.status(429).json({ error: "scan-cap" });
    const lim = await getLimitState(userId);
    if (lim && !lim.exempt && lim.scansUsed >= lim.scansLimit) return res.status(402).json({ error: "scan-limit" });
  } else {
    const own = (await db.all("SELECT 1 FROM scans WHERE id = ? AND user_id = ?", [scanId, userId])) as any[];
    if (!own.length) scanId = null;
  }
  try {
    const tierRow = (await db.all("SELECT scan_tier FROM users WHERE id = ?", [userId])) as any[];
    const tier = tierRow[0]?.scan_tier || null;
    const baseModel = tier === "max" ? SCAN_MODEL_MAX : tier === "strong" ? SCAN_MODEL_STRONG : SCAN_MODEL_DEFAULT;
    let v = await callVisionOne(img, baseModel);
    if (!tier && v.quality === "ok" && (v.matched.length + v.uncertain.length) < ESCALATION_THRESHOLD && baseModel !== SCAN_MODEL_STRONG) {
      try {
        const strong = await callVisionOne(img, SCAN_MODEL_STRONG);
        v = { matched: [...new Set([...strong.matched, ...v.matched])], uncertain: [...strong.uncertain, ...v.uncertain], other: [...new Set([...strong.other, ...v.other])], quality: strong.quality };
        try { await db.run("INSERT INTO events (id, type, recipe, user_id, created_at) VALUES (?, 'scan_photo_escalated', NULL, NULL, ?)", [crypto.randomUUID(), new Date().toISOString()]); } catch { /* best-effort */ }
      } catch { /* keep the first result */ }
    }
    if (!scanId) scanId = await logScan(userId, v.matched, [], { ready: 0, almost: 0 });
    else {
      // accumulate this photo's finds into the session's scan row
      try {
        const row = (await db.all("SELECT detected_ids FROM scans WHERE id = ?", [scanId])) as any[];
        const prev: string[] = JSON.parse(row[0]?.detected_ids || "[]");
        await db.run("UPDATE scans SET detected_ids = ? WHERE id = ?", [JSON.stringify([...new Set([...prev, ...v.matched])]), scanId]);
      } catch { /* best-effort */ }
    }
    if (v.other.length) { try { await db.run("INSERT INTO events (id, type, recipe, user_id, created_at) VALUES (?, 'scan_other', ?, NULL, ?)", [crypto.randomUUID(), v.other.join(", ").slice(0, 120), new Date().toISOString()]); } catch { /* ignore */ } }
    res.json({ scanId, matched: v.matched, uncertain: v.uncertain, other: v.other, quality: v.quality });
  } catch (e: any) {
    if (e?.code === 503) return res.status(503).json({ error: "scan-disabled" });
    res.status(502).json({ error: "photo-failed", scanId });
  }
});
