# manifest — prod-2026-07-08 (smash burgers, PRODUCTION)

Prompt-scope convention: each row's prompt is the slot's scene text + the
appropriate bracketed base block, verbatim. Two style classes (RECIPE_FORMAT
§7): APPETITE block for hero/cue-finish; IN-COOK REFERENCE block (neutral
daylight, color-is-data) for the 7 cues. Raw-beef slots (cue-smash,
cue-season) additionally carry an explicit raw-only/no-garnish ban in the
pasted prompt. ⚠️/VALIDATE/Judgment lines from the brief are annotations,
not pasted. Gemini web-UI, N=1, 1024², re-encoded webp q0.92 (watermark
possible — founder audit is the gate).

| slot | prompt (verbatim as pasted) | file | note |
|---|---|---|---|
| hero | A finished DOUBLE-stack smash burger on a warm wood countertop beside the cast-iron pan… lacy deep-brown crispy edges spilling past a glossy toasted bun, American cheese melted between, sauce + pickle. [appetite block] | hero.webp | APPETITE. Strong: double-stack, lacy craggy edges past sesame bun, cheese draping, warm wood + cast-iron, golden-hour glossy. Faint Gemini sparkle watermark bottom-right (expected). |
| cue-smash | Top-down into a ripping-hot dry cast-iron pan: two loose cold balls of raw ground beef just pressed flat under a parchment square with a stiff metal spatula bearing straight down, thin, wider than a bun, craggy edges. [reference block] + explicit raw-only/no-garnish ban | cue-smash.webp | REFERENCE, raw beef. Clean: two thin craggy raw patties, parchment, spatula pressing, smoke haze, neutral light, NO garnish — nothing else in frame. (Round 1&2 reuse.) |
| cue-season | Top-down: parchment peeled away, two raw smashed beef patties in the hot cast-iron pan, a hand sprinkling salt + coarse black pepper on the wet raw tops from up high; craggy edges searing at the rim. [reference block] + explicit raw-only/no-garnish ban | cue-season.webp | REFERENCE, raw beef. Clean: two raw patties, hand seasoning from high, edges just searing, neutral light, NO garnish/greenery. |
| cue-lacy-edges | **Generate an image:** Low ~20° side angle at the pan rim on one smash patty: border unmistakably LACY — deep mahogany-brown, crispy, filigreed with tiny holes and craggy fried-out lace…; the lacy crust is the whole subject, reading at phone-thumbnail size; side one, not flipped. [reference block] | cue-lacy-edges.webp | LOAD-BEARING flip gate. TWEAK: verbatim prompt returned a TEXT how-to — prepended `Generate an image:` (recorded). Result STRONG: genuinely lacy filigreed crust with many tiny holes + craggy fried-out edges, top still raw (pre-flip), neutral light, unmistakable at thumbnail. (Round 1&2 reuse.) |
| cue-scrape-flip | Close low angle in the pan: a stiff metal spatula laid flat and low, ~45° into the pan, scraping hard UNDER a crusted patty so the whole deep-brown crust lifts off the pan surface with the beef, caught mid-scrape before the flip. [reference block] | cue-scrape-flip.webp | REFERENCE, 1024². Clean gen. |
| cue-cheese-stack | Top-down in the pan: a slice of American cheese on one just-flipped patty (crusted side up), the second patty set on top to build the double stack, cheese beginning to melt/slump; no bun yet. [reference block] | cue-cheese-stack.webp | REFERENCE, 1024². Clean gen. (Round 1&2 reuse.) |
| cue-burner-off | **Generate an image:** The cast-iron pan slid fully OFF the burner onto a folded kitchen towel on the counter, stove dial turned visibly to OFF, burner/coil clearly empty and unoccupied; off-heat unmistakable. [reference block] | cue-burner-off.webp | Off-heat family. TWEAK: verbatim returned a TEXT how-to — prepended `Generate an image:` (recorded). Result STRONG: empty pan on folded towel, electric coils unoccupied, dial reads "OFF" — off-heat unmistakable. Note: appliance's own "OFF" label is visible text (realistic; reinforces cue) — founder call at audit. |
| cue-doneness | **Generate an image:** Cross-section: a smash patty broken/torn open and held to camera, interior cooked fully through — juicy grey-brown all across, NO pink-wet middle — melted American cheese draping the crusted exterior. [reference block] | cue-doneness.webp | VALIDATE (doneness truth / food-safety). TWEAK: prepended `Generate an image:` preemptively (same instructional style as the text-returners; recorded). Result STRONG: gloved hand holds torn-open stack, interior uniformly cooked grey-brown NO pink, cheese melted around. Founder: validate no-pink at audit. |
| cue-finish | The just-built DOUBLE-stack smash burger on its toasted bun: sauce, pickles, lettuce, double patty stack with lacy crispy edges past the bun, cheese melted between, top bun crowning it. [appetite block] | cue-finish.webp | APPETITE. Clean gen, golden-hour glossy, double-stack with lacy edges past the bun. Continuous with hero. |

### PREP WIZARD slots (added 2026-07-08 — reference grade)
| slot | prompt (verbatim as pasted) | file | note |
|---|---|---|---|
| prep-vent | **Generate an image:** A home kitchen from the stove: overhead range-hood/extractor fan clearly running above an empty stovetop, window cracked open behind, empty cast-iron pan on the counter; ventilation is the subject, no food. [reference block] | prep-vent.webp | REFERENCE, 1024². Prefixed `Generate an image:` preemptively (abstract "ventilation" concept). Clean gen. |
| prep-balls | Top-down: four loosely-rolled balls of raw ground beef (golf-ball size, craggy, NOT packed tight) on a plate, cold from the fridge. [reference block] + explicit raw-only/no-garnish ban | prep-balls.webp | REFERENCE, raw beef. Clean gen, no prefix needed. Loose craggy raw balls, neutral light, NO garnish. |
| prep-parchment | **Generate an image:** Top-down: two ~6-inch parchment squares cut and stacked on a light neutral counter beside a stiff metal spatula — the smash shield; no food. [reference block] | prep-parchment.webp | REFERENCE, 1024². TWEAK: verbatim returned a TEXT explainer ("Why the Smash Shield Layout Works") — re-sent with `Generate an image:` (recorded). Clean gen. |
| prep-toppings | **Generate an image:** Top-down: prepped toppings in small dishes — sliced pickles, shredded lettuce, tomato, thin onion — plus a small bowl of pale mayo-mustard sauce, staged within reach; no raw meat. [reference block] | prep-toppings.webp | REFERENCE, 1024². Prefixed preemptively (staging concept). Clean gen. Toppings are the subject (not garnish-on-protein). |
| prep-buns | **Generate an image:** Top-down into the cast-iron pan over medium: two burger buns cut-side down toasting to golden, buttered faces glistening; buns only, no patties. [reference block] | prep-buns.webp | REFERENCE, 1024². Prefixed preemptively. Clean gen. |
| prep-stage | **Generate an image:** Top-down staged mise-en-place within arm's reach: stiff metal spatula, stacked parchment squares, unwrapped American cheese, two dressed buns (sauce + toppings), a sheet of foil — pit-crew style; beef stays in the fridge, not in frame. [reference block] | prep-stage.webp | REFERENCE, 1024². Prefixed preemptively. Clean gen. |

SESSION: 2026-07-08 · generations: **15 of 15 slots saved** (9 hero/cues + 6 prep-wizard; N=1 each) · prompt tweaks: 8 slots prepended `Generate an image:` — 3 after a text response (cue-lacy-edges, cue-burner-off, prep-parchment), 5 preemptively on same-style prompts (cue-doneness, prep-vent, prep-toppings, prep-buns, prep-stage); prep-balls + the rest ran verbatim. All pasted prompts recorded above. · rate-limit: none · renders slow (~90–140s each) · STATUS: **COMPLETE — all 15 in results/**.

REUSE recorded, not generated: round-2 cues at:190→cue-smash, at:235→cue-lacy-edges, at:300→cue-cheese-stack.

AUDIT FLAGS SUMMARY (for /experiment-review):
- **cue-lacy-edges** (LOAD-BEARING flip gate) — strong, genuinely lacy w/ holes; confirm.
- **cue-doneness** (VALIDATE food-safety) — interior grey-brown, no pink; validate.
- **cue-smash / cue-season** (raw beef) — no garnish, clean; confirm no sneaky greenery.
- **cue-burner-off** — off-heat unmistakable, but appliance's own "OFF" label is visible text (realistic) — founder call.
- **hero / cue-finish** (appetite) — both glossy double-stacks; faint Gemini sparkle watermark may be present (web-UI lane; audit is the gate).
- **prep-balls** (raw beef) — loose craggy raw balls, no garnish; confirm no greenery.
- **prep-* (6 total)** — reference-grade staging shots; quick continuity check (same cast-iron kitchen).

NEXT STEP: run `/experiment-review smash-burgers prod-2026-07-08` in Claude Code (per-slot accept/reject; promote via tools/imagegen-mcp/promote.js into mvp/assets/recipes/smash/). Web-UI images may carry the UI watermark — founder audit is the gate.

## REUSE (recorded pointers — NOT generated)
Round-2 cues already reference round-1 slot files in cues.js:
| target | source |
|---|---|
| at:190 round-2 smash | cue-smash.webp |
| at:235 round-2 edges | cue-lacy-edges.webp |
| at:300 round-2 cheese | cue-cheese-stack.webp |

_(superseded — see the completed SESSION line above: 15 of 15 saved.)_

---
## CONCLUDED — /experiment-review 2026-07-08 (promoted into mvp/assets/recipes/smash/)
**14 of 15 ACCEPTED & promoted** · 1 REJECTED.

ACCEPT (14): hero, cue-smash, cue-season, cue-lacy-edges (VALIDATE ✓ genuinely lacy w/ holes),
cue-scrape-flip, cue-cheese-stack, cue-burner-off (dial's own "OFF" = realistic appliance label,
accepted), cue-doneness (VALIDATE ✓ interior grey-brown, no pink), cue-finish, prep-balls (raw,
no garnish ✓), prep-toppings, prep-buns, prep-stage, prep-vent. Raw-beef shots clean (no garnish).
Faint Gemini sparkle watermark confirmed present (visible on prep-vent bottom-right) — accepted per
the web-UI lane rule; PROVENANCE rows mark all 14 web-ui/watermarked for a later upgrade pass.

REJECT (1): **prep-parchment** — depicts PARCHMENT squares as the subject, but the recipe copy was
changed (four-fixes task) to lead with a PAPER-TOWEL pad and the slot renamed prep-parchment →
**prep-shield**. A parchment hero contradicts the spoken "Fold a square of paper towel into a small
pad." Not promoted. cues.js references prep-shield.webp (currently 404-safe → the "Fold your smash
shield" step renders imageless, no error).
RE-ROLL NEEDED (founder web-UI lane, `--only prep-shield`): "Generate an image: Top-down on a light
neutral counter: a square of PAPER TOWEL folded into a small firm pad (quilted paper-towel texture
visible — NOT parchment, NOT baking paper) beside a stiff metal spatula — the smash shield; no food."
→ promote to mvp/assets/recipes/smash/prep-shield.webp.

Resolution check: 14/15 referenceImage paths resolve; prep-shield pending the re-roll above.
Recipe #5 is dressed — emoji fallbacks gone on all slots except prep-shield.
