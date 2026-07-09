# prod-2026-07-09 — PRODUCTION brief (chicken fried rice, all 10 wired slots)

Source batch: `recipes/drafts/chicken-fried-rice/image-prompts.md` (recipe copy
LOCKED, shipped in cues.js). One prompt per slot, N=1, real slot filenames.

⚠️ TWO STYLE CLASSES (RECIPE_FORMAT §7) — each prompt already has the correct base
block appended:
- APPETITE (glossy golden-hour / warm wood): `hero`, `friedrice-c9`.
- IN-COOK REFERENCE (bright NEUTRAL daylight, color-is-data): `friedrice-c1`–`c8`.

⚠️ VALIDATE slot — `friedrice-c2` (cooked chicken, no pink): founder validates the
doneness truth vs a real reference; diced cubes only, NO garnish/greenery.
Locked cookware = one large pan/wok across the whole set.

Paste convention: paste each slot's scene text + its bracketed base block verbatim.
The ⚠️ / VALIDATE / Judgment lines are operator annotations — not pasted.

## SLOTS (generate these 10 — one each)

**results/hero.webp** — A finished bowl of chicken fried rice on a warm wood countertop beside the wok: fluffy, separate grains flecked with soft-scrambled egg, peas, carrots and small cubes of golden chicken, thinly sliced green onion scattered over the top, chopsticks resting across the bowl. [appetite beauty shot: wok/large pan + warm wood countertop + golden-hour side light + glossy food-magazine finish + shallow depth of field, the same pan and kitchen across the whole recipe for filmstrip continuity, no text. Square.]

**results/friedrice-c1.webp** — Top-down into a large pan over medium-high: a thin film of cooking oil just beginning to shimmer, the surface glossy and rippling as the pan is tilted; empty pan, oil only, nothing else in it. [photorealistic in-cook reference photo, bright even NEUTRAL daylight, neutral white balance, no colored shadows, one subject / the diagnostic feature filling the frame, large pan or wok (locked cookware), light neutral surface, no garnish, no props beyond what the step names, no text, realistic achievable home-kitchen result. Square.]

**results/friedrice-c2.webp** — Top-down in the pan: small half-inch cubes of chicken cooked fully through — white all the way with NO pink, lightly golden at the edges; diced chicken only, dry pan. [photorealistic in-cook reference photo, bright even NEUTRAL daylight, neutral white balance, no colored shadows, one subject / the diagnostic feature filling the frame, large pan or wok (locked cookware), light neutral surface, no garnish, no props beyond what the step names, no text, realistic achievable home-kitchen result. Square.] ⚠️ VALIDATE (food-safety): must read cooked-through, white, NO pink; diced cubes, NO garnish.

**results/friedrice-c3.webp** — Top-down: the cooked diced chicken scooped onto a clean white plate set beside the pan, the pan still holding its oil and browned bits; chicken resting off the heat. [photorealistic in-cook reference photo, bright even NEUTRAL daylight, neutral white balance, no colored shadows, one subject / the diagnostic feature filling the frame, large pan or wok (locked cookware), light neutral surface, no garnish, no props beyond what the step names, no text, realistic achievable home-kitchen result. Square.]

**results/friedrice-c4.webp** — Top-down in the hot pan: frozen peas and diced carrots just added, glossy and beginning to steam, being stirred; bright green peas + orange carrot, no chicken in frame yet. [photorealistic in-cook reference photo, bright even NEUTRAL daylight, neutral white balance, no colored shadows, one subject / the diagnostic feature filling the frame, large pan or wok (locked cookware), light neutral surface, no garnish, no props beyond what the step names, no text, realistic achievable home-kitchen result. Square.]

**results/friedrice-c5.webp** — Top-down close: minced garlic just added to the pan among the frozen peas and diced carrots (bright green round peas + small orange carrot cubes — NOT peppers, broccoli, zucchini, snap peas or onion), the garlic pale and fragrant, NOT browned — no dark or burnt edges anywhere. NO chicken in the pan. [photorealistic in-cook reference photo, bright even NEUTRAL daylight, neutral white balance, no colored shadows, one subject / the diagnostic feature filling the frame, large pan or wok (locked cookware), light neutral surface, no garnish, no props beyond what the step names, no text, realistic achievable home-kitchen result. Square.]

**results/friedrice-c6.webp** — Top-down in the pan: the frozen peas and diced carrots (bright green round peas + small orange carrot cubes — NOT peppers, broccoli, zucchini, snap peas or onion) pushed to one side (NO chicken in the pan yet), beaten egg poured into the cleared empty side and gently stirred into soft, just-set curds — glossy and soft, not dry, not runny. [photorealistic in-cook reference photo, bright even NEUTRAL daylight, neutral white balance, no colored shadows, one subject / the diagnostic feature filling the frame, large pan or wok (locked cookware), light neutral surface, no garnish, no props beyond what the step names, no text, realistic achievable home-kitchen result. Square.]

**results/friedrice-c7.webp** — Top-down: cold white rice and cubes of cooked chicken added back into the pan with the frozen peas and diced carrots (bright green round peas + small orange carrot cubes — NOT peppers, broccoli, zucchini, snap peas or onion), clumps being broken up with the spatula mid-toss, everything starting to mix together; pre-sauce, plain white rice with no soy color yet. [photorealistic in-cook reference photo, bright even NEUTRAL daylight, neutral white balance, no colored shadows, one subject / the diagnostic feature filling the frame, large pan or wok (locked cookware), light neutral surface, no garnish, no props beyond what the step names, no text, realistic achievable home-kitchen result. Square.]

**results/friedrice-c8.webp** — Top-down: soy sauce being drizzled and tossed through the fried rice — white rice with frozen peas and diced carrots (bright green round peas + small orange carrot cubes — NOT peppers, broccoli, zucchini, snap peas or onion), soft egg and cubes of chicken — the grains turning an even light golden-brown all over, evenly colored, glossy, not soupy or puddled. [photorealistic in-cook reference photo, bright even NEUTRAL daylight, neutral white balance, no colored shadows, one subject / the diagnostic feature filling the frame, large pan or wok (locked cookware), light neutral surface, no garnish, no props beyond what the step names, no text, realistic achievable home-kitchen result. Square.]

**results/friedrice-c9.webp** — The finished chicken fried rice plated in a bowl: fluffy separate grains, egg, peas, carrots and golden chicken throughout, thin green onion over the top, a little steam rising, served hot. [appetite finish shot: wok/large pan behind + warm wood + golden-hour side light + glossy food-magazine finish + shallow depth of field, the same pan and kitchen across the whole recipe, no text. Square.]

## MANIFEST (row per generation, appended live by the render leg)
| slot | file | status |
|---|---|---|
| hero | results/hero.webp | rendered |
| friedrice-c1 | results/friedrice-c1.webp | rendered |
| friedrice-c2 | results/friedrice-c2.webp | rendered — ⚠️ VALIDATE (food-safety) pending founder review |
| friedrice-c3 | results/friedrice-c3.webp | rendered |
| friedrice-c4 | results/friedrice-c4.webp | rendered |
| friedrice-c5 | results/friedrice-c5.webp | re-rolled 2026-07-09 (peas+carrots fix; needed "Generate an image:" prefix retry) |
| friedrice-c6 | results/friedrice-c6.webp | re-rolled 2026-07-09 (peas+carrots fix) |
| friedrice-c7 | results/friedrice-c7.webp | re-rolled 2026-07-09 (peas+carrots fix) |
| friedrice-c8 | results/friedrice-c8.webp | re-rolled 2026-07-09 (peas+carrots fix) |
| friedrice-c9 | results/friedrice-c9.webp | rendered |
