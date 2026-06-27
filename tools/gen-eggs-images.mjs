#!/usr/bin/env node
/*
 * gen-eggs-images.mjs — BUILD-TIME, run-once "photo shoot" for the eggs pilot.
 * ============================================================================
 * NOT part of the app runtime. The live app NEVER calls an image API — it only
 * loads the approved static PNGs by path (see referenceImage in cues.js).
 *
 * What it does: for each Fluffy Scrambled Eggs cook cue (incl. the doneness
 * gate), gpt-4o-mini writes a food-photography prompt, gpt-image-1 renders it,
 * and the PNG lands in tools/eggs-gen/ (STAGING) alongside a review.html.
 * You review → regenerate single ones / drop in your own photo → then copy the
 * approved files into mvp/assets/recipes/eggs/ to make them live.
 *
 * Cost: ~8 images × gpt-image-1 (≈ a few cents total), paid ONCE by you.
 *
 * Usage:
 *   export OPENAI_API_KEY=sk-...
 *   node tools/gen-eggs-images.mjs                 # generate all 8
 *   node tools/gen-eggs-images.mjs --only cue-6    # regenerate just the gate
 *   node tools/gen-eggs-images.mjs --prompts-only  # write prompts only (free, no images)
 * Then open tools/eggs-gen/review.html in a browser.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(__dirname, "eggs-gen");
const KEY = process.env.OPENAI_API_KEY;

const args = process.argv.slice(2);
const promptsOnly = args.includes("--prompts-only");
const onlyIdx = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;

// ---- read the eggs cues straight from cues.js (single source of truth) ----
function loadEggs() {
  const src = fs.readFileSync(path.join(ROOT, "mvp", "cues.js"), "utf8");
  const win = {};
  new Function("window", src)(win); // cues.js only assigns to window.*
  if (!win.SCRAMBLED_EGGS) throw new Error("SCRAMBLED_EGGS not found in cues.js");
  return win.SCRAMBLED_EGGS;
}

async function openai(endpoint, body) {
  const r = await fetch("https://api.openai.com/v1/" + endpoint, {
    method: "POST",
    headers: { Authorization: "Bearer " + KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`OpenAI ${endpoint} → ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r.json();
}

const SYS = `You write prompts for a food-photography image generator. Given ONE step of a scrambled-eggs recipe, output ONE vivid prompt (max 55 words) describing exactly what the PAN and eggs look like AT THAT MOMENT, so a home cook can compare their pan to it. Always include: tight close-up food photography, a nonstick pan, soft natural kitchen light, appetizing, photorealistic. No text, no logos, no hands unless essential. Output only the prompt, no preamble.`;

async function makePrompt(cue) {
  const instruction = cue.beginner || cue.body || cue.title;
  const data = await openai("chat/completions", {
    model: "gpt-4o-mini",
    messages: [{ role: "system", content: SYS }, { role: "user", content: `Step "${cue.title}": ${instruction}` }],
    temperature: 0.5, max_tokens: 130,
  });
  return data.choices[0].message.content.trim().replace(/^["']|["']$/g, "");
}

async function makeImage(prompt, file) {
  const data = await openai("images/generations", { model: "gpt-image-1", prompt, size: "1024x1024", n: 1, quality: "medium" });
  fs.writeFileSync(file, Buffer.from(data.data[0].b64_json, "base64"));
}

(async () => {
  if (!promptsOnly && !KEY) {
    console.error("✗ Set OPENAI_API_KEY first:  export OPENAI_API_KEY=sk-...");
    process.exit(1);
  }
  fs.mkdirSync(OUT, { recursive: true });
  const eggs = loadEggs();
  const cues = eggs.cues.map((c, i) => ({ ...c, idx: i, slug: "cue-" + i, isGate: !!c.gate }));
  const targets = onlyIdx ? cues.filter((c) => c.slug === onlyIdx) : cues;
  if (!targets.length) { console.error(`✗ No cue matches --only ${onlyIdx} (try cue-0 … cue-${cues.length - 1})`); process.exit(1); }

  const updated = [];
  for (const c of targets) {
    console.log(`\n${c.slug}${c.isGate ? "  ⭐ DONENESS GATE" : ""} — "${c.title}"`);
    const prompt = await makePrompt(c);
    console.log("  prompt: " + prompt);
    const file = path.join(OUT, c.slug + ".png");
    if (!promptsOnly) { await makeImage(prompt, file); console.log("  saved:  " + path.relative(ROOT, file)); }
    updated.push({ slug: c.slug, idx: c.idx, title: c.title, isGate: c.isGate, instruction: c.beginner || c.body, prompt, file: c.slug + ".png" });
  }

  // merge into manifest so --only updates a single entry
  const mf = path.join(OUT, "manifest.json");
  let all = [];
  try { all = JSON.parse(fs.readFileSync(mf, "utf8")); } catch (e) {}
  for (const u of updated) { const j = all.findIndex((x) => x.slug === u.slug); if (j >= 0) all[j] = u; else all.push(u); }
  all.sort((a, b) => a.idx - b.idx);
  fs.writeFileSync(mf, JSON.stringify(all, null, 2));
  writeReview(all);

  console.log(`\n✓ Done — ${updated.length} ${promptsOnly ? "prompt(s)" : "image(s)"}.`);
  console.log(`  Review:  open ${path.relative(ROOT, path.join(OUT, "review.html"))}`);
  console.log(`  Approve: copy the good PNGs → mvp/assets/recipes/eggs/  (then they're live)`);
})().catch((e) => { console.error("\n✗ " + e.message); process.exit(1); });

function esc(s) { return String(s || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }
function writeReview(items) {
  const rows = items.map((m) => `
    <div class="row${m.isGate ? " gate" : ""}">
      <img src="${m.file}?t=${Date.now()}" onerror="this.classList.add('missing');this.alt='(not generated yet)'" alt="">
      <div class="meta">
        <h3>${esc(m.title)}${m.isGate ? ' <span class="badge">DONENESS GATE — this one must be accurate</span>' : ""}</h3>
        <p class="instr">${esc(m.instruction)}</p>
        <p class="prompt"><b>Prompt:</b> ${esc(m.prompt)}</p>
        <p class="cmd">↻ <code>node tools/gen-eggs-images.mjs --only ${m.slug}</code>&nbsp;&nbsp;·&nbsp;&nbsp;or replace <code>tools/eggs-gen/${m.file}</code> with your own photo</p>
      </div>
    </div>`).join("");
  const html = `<!doctype html><meta charset="utf8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Eggs image review</title>
<style>
  body{background:#0b0b0f;color:#eee;font:15px/1.55 system-ui,sans-serif;max-width:780px;margin:0 auto;padding:24px}
  h1{font-size:24px;background:linear-gradient(135deg,#ff6b35,#c44dff);-webkit-background-clip:text;background-clip:text;color:transparent}
  .row{display:flex;gap:16px;margin:16px 0;padding:14px;background:#16161e;border:1px solid #2a2a36;border-radius:14px}
  .row.gate{border-color:#ff6b35;box-shadow:0 0 0 1px #ff6b35 inset}
  img{width:200px;height:200px;object-fit:cover;border-radius:10px;background:#222;flex:0 0 auto}
  img.missing{opacity:.25;border:1px dashed #555}
  .badge{font-size:10px;background:#ff6b35;color:#fff;padding:2px 8px;border-radius:99px;vertical-align:middle}
  h3{margin:0 0 6px}.instr{color:#cfcfe0;margin:0 0 8px}.prompt{color:#9a9ab0;font-size:13px;margin:0 0 8px}
  .cmd{font-size:12px;color:#888;margin:0}code{background:#000;padding:2px 6px;border-radius:5px;color:#bbb}
</style>
<h1>🍳 Fluffy Scrambled Eggs — generated cue images</h1>
<p>Eyeball each below. Regenerate a bad one with the command shown, or drop your own photo into <code>tools/eggs-gen/&lt;slug&gt;.png</code>. The <b>doneness gate</b> one matters most — make sure it shows soft, glossy, just-set eggs. When happy, copy the approved PNGs into <code>mvp/assets/recipes/eggs/</code> to go live.</p>
${rows}`;
  fs.writeFileSync(path.join(OUT, "review.html"), html);
}
