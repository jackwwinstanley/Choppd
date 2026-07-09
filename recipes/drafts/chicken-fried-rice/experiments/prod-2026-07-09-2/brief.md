# prod-2026-07-09-2 — PRODUCTION brief (chicken fried rice: Phase-2 chicken cues + prep steps)

Second batch for this recipe. Renders the images that were still text-only after the
phase restructure: the 3 new Phase-2 chicken cues (2a/2b/2c) and the 5 prep-wizard
steps. (2d reuses the existing doneness slot `friedrice-c2.webp` — NOT regenerated.)
Recipe copy LOCKED (shipped in cues.js). One prompt per slot, N=1, real slot filenames.

⚠️ STYLE CLASSES (RECIPE_FORMAT §7) — each prompt already has the correct base block appended:
- CHICKEN IN-COOK REFERENCE (bright NEUTRAL daylight, color-is-data, one STAINLESS pan to
  match the existing doneness shot c2/c3): `friedrice-p2-c1`, `-p2-c2`, `-p2-c3`.
- PREP-STATION REFERENCE (bright NEUTRAL daylight, cutting board / neutral counter, no pan,
  no heat): `friedrice-prep-1` … `-prep-4`.
- PREP STAGING (a slightly wider mise-en-place shot): `friedrice-prep-5`.

⚠️ RAW-PROTEIN slots — `friedrice-prep-2` (dicing raw chicken) and `friedrice-p2-c1` (chicken
just hitting the pan): keep NEUTRAL daylight so raw/searing reads true. These are TECHNIQUE
shots, not doneness claims (the doneness VALIDATE slot is c2/2d, already approved) — no founder
sign-off needed, just honest raw/pale colour, no pink-vs-cooked judgement implied.

Paste convention: paste each slot's scene text + its bracketed base block verbatim. The
⚠️ / class / Judgment lines are operator annotations — not pasted.

## SLOTS (generate these 8 — one each)

**results/friedrice-p2-c1.webp** — Top-down into a large stainless steel pan over medium-high heat: small half-inch cubes of diced chicken spread out FLAT in a single even layer across the whole pan — the pieces NOT piled or crowded, each cube resting on the pan surface with a little space around it, in a thin sheen of hot oil. The chicken just added: pale and turning opaque-white at the edges where it meets the pan, not browned yet, no stirring. [photorealistic in-cook reference photo, bright even NEUTRAL daylight, neutral white balance, no colored shadows, the diagnostic feature filling the frame, one large stainless steel pan (the same pan across every chicken shot), light neutral surface, no garnish, no props beyond what the step names, no text, realistic achievable home-kitchen result. Square.] Judgment: "spread flat in one layer, space between the pieces = it browns instead of steaming."

**results/friedrice-p2-c2.webp** — Top-down in the same stainless steel pan: the diced chicken mid-first-stir with a spatula — several cubes flipped over to reveal deep golden-brown seared undersides, while their tops are still pale and opaque; the clear contrast between the browned down-sides and the pale up-sides is the whole point. A few pieces caught being turned by the spatula. [photorealistic in-cook reference photo, bright even NEUTRAL daylight, neutral white balance, no colored shadows, the diagnostic feature filling the frame, one large stainless steel pan (the same pan across every chicken shot), light neutral surface, no garnish, no props beyond what the step names, no text, realistic achievable home-kitchen result. Square.] Judgment: "golden-brown down sides = flavor; pale grey means the pan was too cold."

**results/friedrice-p2-c3.webp** — Top-down in the same stainless steel pan: the diced chicken now stirred and nearly cooked — every piece turned an even light golden and fully opaque on all outside surfaces, with NO pink and no shiny raw patches anywhere on the outside; a spatula resting mid-stir, a little browned fond on the pan, a pinch of salt and pepper scattered over the top. The pieces are whole, not cut open. [photorealistic in-cook reference photo, bright even NEUTRAL daylight, neutral white balance, no colored shadows, the diagnostic feature filling the frame, one large stainless steel pan (the same pan across every chicken shot), light neutral surface, no garnish, no props beyond what the step names, no text, realistic achievable home-kitchen result. Square.] Judgment: "no pink on the outside surfaces, evenly golden, still stirring — the inside cut-check comes next."

**results/friedrice-prep-1.webp** — Top-down on a light neutral countertop: a wide shallow bowl of cold cooked day-old white rice, with fingers breaking up the clumps into loose separate grains — some clumps still intact on one side, broken fluffy separate grains on the other. Dry, cold, separate rice — not wet, glossy or sticky. [photorealistic prep-station reference photo, bright even NEUTRAL daylight, neutral white balance, no colored shadows, the prepped ingredient filling the frame on a light neutral countertop, no pan and no heat, no text, realistic achievable home-kitchen result. Square.] Judgment: "cold day-old rice, clumps broken into separate grains."

**results/friedrice-prep-2.webp** — Top-down on a wood cutting board: a raw chicken breast being cut into small, even half-inch cubes with a chef's knife — a neat pile of uniform small raw cubes already cut beside the blade, all roughly the same size. Pale raw chicken, honest neutral daylight, a clean board. [photorealistic prep-station reference photo, bright even NEUTRAL daylight, neutral white balance, no colored shadows, the prepped ingredient filling the frame on a wood cutting board, no pan and no heat, no text, realistic achievable home-kitchen result. Square.] ⚠️ RAW protein — honest pale-raw colour, technique shot (not a doneness claim). Judgment: "small even half-inch cubes, all the same size."

**results/friedrice-prep-3.webp** — Top-down on a countertop: two eggs beaten in a small bowl with a fork until the yolk and white are one uniform pale-yellow colour — smooth and evenly blended, no streaks of white left. The fork resting in the bowl; two empty eggshell halves beside it. [photorealistic prep-station reference photo, bright even NEUTRAL daylight, neutral white balance, no colored shadows, the prepped ingredient filling the frame on a light neutral countertop, no pan and no heat, no text, realistic achievable home-kitchen result. Square.] Judgment: "beaten to one even colour, no streaks of white."

**results/friedrice-prep-4.webp** — Top-down on a wood cutting board: the fried-rice flavour prep laid out in separate little groups — a small mound of minced garlic, a pile of thinly-sliced green-onion rounds, and a small dish of dark soy sauce measured out. Off to one side, a handful of still-frozen peas and carrots straight from the bag (bright green round peas + small orange carrot cubes — NOT peppers, broccoli or a medley). Everything prepped and ready, no cooking. [photorealistic prep-station reference photo, bright even NEUTRAL daylight, neutral white balance, no colored shadows, the prepped ingredients filling the frame on a wood cutting board, no pan and no heat, no text, realistic achievable home-kitchen result. Square.] Judgment: "garlic minced, onions sliced, soy measured — veg stays frozen."

**results/friedrice-prep-5.webp** — A mise-en-place staging shot on a light neutral countertop beside a stove: all the fried-rice components lined up in small bowls within arm's reach — cold white rice, diced raw chicken, a bowl of beaten egg, frozen peas and carrots, minced garlic and sliced green onion, a small dish of soy sauce, and a bottle of cooking oil — plus a clean empty plate ready for the cooked chicken and a spatula laid alongside. Everything ready before the pan gets hot. [photorealistic mise-en-place staging photo, bright even NEUTRAL daylight, neutral white balance, small bowls of prepped components lined up on a light neutral countertop beside a stove, slightly wider framing to show everything within reach, no text, realistic achievable home-kitchen result. Square.] Judgment: "everything within reach, empty plate + spatula ready — fried rice waits for no one."

## MANIFEST (row per generation, appended live by the render leg)
| slot | file | status |
|---|---|---|
| friedrice-p2-c1 | results/friedrice-p2-c1.webp | rendered (Gemini self-refined to a 2nd pass mid-turn — took the improved/final image; 1024x1024 webp, 245KB) |
| friedrice-p2-c2 | results/friedrice-p2-c2.webp | rendered (single pass; 1024x1024 webp, 371KB) |
| friedrice-p2-c3 | results/friedrice-p2-c3.webp | rendered (single pass; 1024x1024 webp, 341KB) |
| friedrice-prep-1 | results/friedrice-prep-1.webp | rendered (single pass; 1024x1024 webp, 194KB) |
| friedrice-prep-2 | results/friedrice-prep-2.webp | rendered (single pass, raw-protein slot — no refusal; 1024x1024 webp, 297KB) |
| friedrice-prep-3 | results/friedrice-prep-3.webp | rendered (single pass; 1024x1024 webp, 153KB) |
| friedrice-prep-4 | results/friedrice-prep-4.webp | rendered (single pass; 1024x1024 webp, 385KB) |
| friedrice-prep-5 | results/friedrice-prep-5.webp | rendered (single pass; 1024x1024 webp, 201KB) |

All 8/8 rendered on first attempt — no "Generate an image:" prefix retries needed, no login wall, no text-only refusals. Each slot ran in its own fresh Gemini chat thread (gemini.google.com/app, logged in as Jack) to avoid cross-contamination. Rendered 2026-07-09.
