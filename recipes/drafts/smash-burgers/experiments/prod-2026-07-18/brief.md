# PRODUCTION brief — smash burgers — cue-smash SIDE-BY-SIDE re-render (2026-07-18)

**Scope: ONE slot only — `cue-smash`.** This is a targeted defect fix. The current
`cue-smash.webp` renders the two patties STACKED (a raw mound on top of a smashed base);
the cue copy says "two cold balls into the pan, a few inches apart." Cue 1 (at:0 "Balls in
— then SMASH") and cue 6 (at:190 "Round two — run it back") BOTH reference this one file
(REUSE by design), so fixing this single slot fixes both cues. **Do NOT render or touch any
other slot.** Only the patty ARRANGEMENT changed vs the prior prompt — framing, top-down
angle, neutral daylight, cast-iron pan, bare-metal-spatula/no-parchment discipline, and the
raw-beef bans are all preserved (filmstrip continuity with the rest of the set).

Style class: **IN-COOK REFERENCE grade** (neutral daylight — color is data; raw beef must
read raw). Candidates: **N = 3** (founder picks one before promote). Filename contract:
render to `results/cue-smash.webp` (pick the winner into that exact name; stage the other
two as `results/cue-smash-alt1.webp`, `results/cue-smash-alt2.webp` for review).

---

## SLOT: cue-smash  (→ results/cue-smash.webp)

Top-down into a ripping-hot dry cast-iron pan: TWO loose cold balls of raw ground beef set
a few inches apart with a clear gap of bare pan between them, each being smashed dead flat
by a stiff metal spatula pressed straight down DIRECTLY on the bare beef — NO parchment, NO
paper towel, the bare metal spatula on the patty (the primary no-parchment path) — each
patty forced thin and wider than a bun, the two patties SIDE BY SIDE and NOT touching, both
flat on the pan surface and both fully in frame, their craggy torn edges already going lacy
and browning where they meet the hot iron. Raw beef in the centres, a dry pan, crust
starting at the edges. Exactly TWO patties SIDE BY SIDE with a visible gap between them,
both making full contact with the pan; NO stacking, NO overlap, NO patty resting on another,
NO third patty; NO garnish, NO greenery, NO herbs, NO toppings, NO sauce, NO bun, NO
parchment, NO paper towel; nothing else in frame. [photorealistic in-cook reference photo,
bright even NEUTRAL daylight, neutral white balance, no colored shadows, the two side-by-side
smashed patties filling the frame as the single diagnostic subject, cast-iron skillet (locked
cookware), light neutral surface, no garnish, no props beyond what the step names, no text,
realistic achievable home-kitchen result. Square.]

Glance test (governs acceptance): a beginner confirms in TWO SECONDS — two separate patties,
side by side, clear gap between them, both flat on the surface, no stacking.

---

## REUSE (no separate prompt — recorded)
| cue (cues.js) | reuses slot |
|---|---|
| at:0 "Balls in — then SMASH" | cue-smash.webp |
| at:190 "Round two — run it back" | cue-smash.webp |

## MANIFEST (append a row per generation)
| # | slot | file | outcome | notes |
|---|------|------|---------|-------|
| 1 | cue-smash | results/cue-smash.webp | rendered | Gemini 3.5 Thinking web-UI, gen 1/3. Two separate patties, clear gap, both flat, two spatulas pressing each — no stacking/overlap. Picked as lead candidate. Watermarked (web-ui). |
| 2 | cue-smash | results/cue-smash-alt1.webp | rendered | gen 2/3 ("Try again" on same thread). Side-by-side, clear gap, both flat, one spatula on left patty. No stacking. Watermarked (web-ui). |
| 3 | cue-smash | results/cue-smash-alt2.webp | rendered | gen 3/3 ("Try again" again). Side-by-side, clear gap, both flat, spatula on right patty. No stacking. Watermarked (web-ui). |
