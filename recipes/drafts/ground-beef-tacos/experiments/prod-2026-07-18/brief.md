# PRODUCTION brief — ground-beef-tacos cue-restructure image pass (2026-07-18)

Two slots, tied to the cue-ladder restructure (brown-start + paper-towel drain).
Rendered on the free Gemini/Cowork web-UI lane (same as the 2026-07-09 batch).
N = 1 per slot. Paste each slot's scene text + its bracketed base block verbatim.

**Base block (in-cook reference, reuse the recipe's established style):**
`[photorealistic in-cook reference photo, bright even NEUTRAL daylight, neutral white balance, no colored shadows, one large stainless steel skillet (the same pan across every in-pan shot), light neutral surface, no garnish, no text, realistic achievable home-kitchen result. Square.]`

---

## SLOTS

**results/tacos-c2-start.webp** — NEW (browning-START reference, wired to the "Brown the beef" cue). Top-down in the same large stainless skillet: ground beef EARLY in browning — broken into small crumbles but only part-cooked, still clearly showing raw PINK-RED patches, with browned tan-brown edges just beginning to form on some crumbles; a spatula resting in the meat mid-break-up. This is the START state, mid-browning. [photorealistic in-cook reference photo, bright even NEUTRAL daylight, neutral white balance, no colored shadows, the diagnostic feature filling the frame, one large stainless steel skillet, light neutral surface, no garnish, no text, realistic achievable home-kitchen result. Square.] ⚠️ VALIDATE (Glance-Test): a beginner confirms in 2 seconds "mine looks like this" — explicitly NOT fully-gray steamed meat and NOT fully-browned/done either; pink still visible, edges just starting to brown. Judgment: "still pink in places, edges browning = keep going."

**results/tacos-c3.webp** — REGEN (replaces the old scoop-the-grease image; now the paper-towel drain step). Top-down on a light neutral counter: browned ground-beef crumbles piled on a white paper-towel-lined plate, draining — the paper towel visibly darkened where it has soaked up the rendered grease around and under the meat, the beef evenly browned with a light sheen; the empty skillet set aside off to one edge. [photorealistic in-cook reference photo, bright even NEUTRAL daylight, neutral white balance, no colored shadows, the diagnostic feature filling the frame, browned beef draining on a paper-towel-lined plate on a light neutral counter, no garnish, no text, realistic achievable home-kitchen result. Square.] ⚠️ VALIDATE (Glance-Test): clean read — browned crumbles on a grease-darkened paper towel. Judgment: "browned beef draining on paper towels — the towel wicks the grease."

## Wiring (already set in mvp/cues.js)
- cue 0 "Brown the beef" → `assets/recipes/tacos/tacos-c2-start.webp` (this brief's browning-START)
- cue 1 "Cooked through?" → `assets/recipes/tacos/tacos-c2.webp` (UNCHANGED — fully-browned/no-pink doneness ref; do NOT overwrite)
- cue 2 "Drain on paper towels" → `assets/recipes/tacos/tacos-c3.webp` (this brief's REGEN)

## MANIFEST
| slot | file | status |
|---|---|---|
| tacos-c2-start | results/tacos-c2-start.webp | PENDING render (imagegen key / logged-in Chrome not available in the authoring env) |
| tacos-c3 | results/tacos-c3.webp | PENDING render (regen — replaces the old scoop-grease image) |
