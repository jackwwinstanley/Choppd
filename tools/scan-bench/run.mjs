// SCAN 2.0 benchmark — recall/precision per photo per pipeline variant.
// Uses the REAL server code (server/dist): callVisionOne + parseVision.
// Baseline = the pre-2.0 prompt (embedded verbatim) in one batched call style.
import fs from "node:fs"; import path from "node:path"; import { execSync } from "node:child_process";
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || fs.readFileSync("../../server/.env", "utf8").match(/ANTHROPIC_API_KEY=(.+)/)?.[1]?.trim();
const { callVisionOne, parseVision } = await import("../../server/dist/scan.js");
const { VOCAB } = await import("../../server/dist/scan-data.js");
const DIR = "../../docs/scan-bench";
const HAIKU = "claude-haiku-4-5-20251001", SONNET = "claude-sonnet-4-6";

// ground truth → regex alternatives (any surfaced string matching = recalled)
const GT = {
  "01-normal-fridge.jpg": { eggs: /egg/, milk: /milk/, whipped: /whip/, sourcream: /sour cream|yogurt|yoghurt/, leftovers: /pasta|chili|bolognese|leftover|casserole|lasagn/, cheese: /cheese|cheddar/, pie: /pie|quiche|tart/, broccoli: /broccoli/, kimchi: /kimchi|salsa|pepper paste|fermented/, pineapple: /pineapple/, cabbage: /cabbage/, grapes: /grape/, pouches: /applesauce|pouch|squeez|fruit snack/, guac: /guac|avocado/, salad: /salad|greens|lettuce|spinach/, cucumber: /cucumber|zucchini/ },
  "02-dark.jpg": null,   // same list as 01
  "03-blurry.jpg": null, // same list as 01
  "04-near-empty.jpg": { waffles: /waffle/ },
  "05-pantry.jpg": { sauce: /pasta sauce|salsa|tomato sauce|marinara|sauce jar/, oats: /oat|grain|granola|cereal|nut/, rice: /rice|grain|flour/ },
  "06-non-food.jpg": {},
};
GT["02-dark.jpg"] = GT["01-normal-fridge.jpg"]; GT["03-blurry.jpg"] = GT["01-normal-fridge.jpg"];
const OLD_PROMPT = `You identify food ingredients visible in photos of fridges, pantries and kitchen counters.

CANONICAL VOCABULARY (the ONLY ids you may return in "matched"):
${VOCAB.map((v) => `${v.id} — ${v.label}${v.aliases.length ? ` (aka: ${v.aliases.join(", ")})` : ""}`).join("\n")}

Rules:
- Presence only — no quantities, no counts.
- Ignore brands, condiment micro-packets, drinks that aren't ingredients, and anything non-food.
- Do NOT guess occluded or uncertain items; only report what is clearly visible.
- Clearly-visible food items that don't fit any vocabulary id go in "other" as short plain names.
- If the image is unusable, set "quality" ("too_dark" | "too_blurry" | "not_food") and return empty arrays.

Return STRICT JSON only — no prose, no code fences:
{"matched":["ingredient_ids"],"other":["free text"],"quality":"ok"}`;

const b64 = (f) => {
  // PNG round-trip strips the stale EXIF orientation tag — the API applies EXIF,
  // so pixels-rotated-but-tag-remaining images arrive double-rotated (found the
  // hard way: Sonnet described the fridge sideways). The client's canvas path
  // never has this problem; only these sips-made bench copies did.
  const png = `/tmp/bench-${path.basename(f)}.png`, out = `/tmp/bench-${path.basename(f)}`;
  execSync(`sips -Z 1568 -s format png "${f}" --out "${png}" 2>/dev/null && sips -s format jpeg -s formatOptions 78 "${png}" --out "${out}" 2>/dev/null`);
  const buf = fs.readFileSync(out);
  return { data: buf.toString("base64"), kb: Math.round(buf.length / 1024) };
};
async function oldCall(img) {
  const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model: HAIKU, max_tokens: 700, system: OLD_PROMPT, messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: img } }, { type: "text", text: "Identify the ingredients per the system rules. STRICT JSON only." }] }] }) });
  const j = await res.json();
  return parseVision((j.content || []).map((c) => c.text || "").join("")) || { matched: [], uncertain: [], other: [] };
}
const labelOf = (id) => (VOCAB.find((v) => v.id === id) || {}).label || id;
const surfaced = (r) => [...r.matched.map(labelOf), ...(r.uncertain || []).map((u) => labelOf(u.id_or_name) || u.id_or_name), ...(r.other || [])];
function score(r, gt) {
  const items = surfaced(r).map((s) => String(s).toLowerCase());
  const keys = Object.entries(gt);
  if (!keys.length) return { recall: "n/a", prec: "n/a", found: items.length };
  const hits = keys.filter(([, rx]) => items.some((s) => rx.test(s)));
  const truePos = items.filter((s) => keys.some(([, rx]) => rx.test(s)));
  return { recall: Math.round((hits.length / keys.length) * 100), prec: items.length ? Math.round((truePos.length / items.length) * 100) : 100, found: items.length, missed: keys.filter(([, rx]) => !items.some((s) => rx.test(s))).map(([k]) => k) };
}
const photos = Object.keys(GT);
console.log("photo | variant | recall% | precision% | surfaced | missed");
for (const p of photos) {
  const { data, kb } = b64(path.join(DIR, p));
  const gt = GT[p];
  const variants = {
    baseline: () => oldCall(data),
    haiku: () => callVisionOne(data, HAIKU),
    ladder: async () => { let r = await callVisionOne(data, HAIKU); if (r.quality === "ok" && r.matched.length + r.uncertain.length < 4) { const s2 = await callVisionOne(data, SONNET); r = { matched: [...new Set([...s2.matched, ...r.matched])], uncertain: [...s2.uncertain, ...r.uncertain], other: [...new Set([...s2.other, ...r.other])], quality: s2.quality }; } return r; },
    sonnet: () => callVisionOne(data, SONNET),
  };
  for (const [name, fn] of Object.entries(variants)) {
    try { const r = await fn(); const sc = score({ uncertain: [], other: [], ...r }, gt); console.log(`${p} (${kb}KB) | ${name} | ${sc.recall} | ${sc.prec} | ${sc.found} | ${(sc.missed || []).join(",") || "-"}`); }
    catch (e) { console.log(`${p} | ${name} | ERROR ${String(e).slice(0, 40)}`); }
  }
}
