# prod-2026-07-08 — PRODUCTION brief (smash burgers, all wired image slots)

Source batch: `recipes/drafts/smash-burgers/image-prompts.md` (recipe copy
LOCKED, shipped in cues.js/app.js). One prompt per slot, N=1, real slot
filenames (the images ARE the product). Covers the 9 wired slots.

⚠️ TWO STYLE CLASSES (RECIPE_FORMAT.md §7) — each prompt below already has
the correct base block appended:
- APPETITE (glossy golden-hour / warm wood): `hero`, `cue-finish`.
- IN-COOK REFERENCE (bright NEUTRAL daylight, color-is-data): the 7
  diagnostic cues. Do NOT warm these — warm light makes raw beef look
  seared and a wet middle look done.

⚠️ RAW-BEEF slots (cue-smash, cue-season): raw patties only — no garnish,
no greenery, nothing else in frame (banned in the prompt). ⚠️ VALIDATE
slots (cue-lacy-edges, cue-doneness): founder validates the diagnostic
truth against a real reference at audit. Canonical burger = DOUBLE stack.

Paste convention: paste each slot's scene text + its bracketed base block
verbatim. The ⚠️ / VALIDATE / Judgment lines are operator/review
annotations — not pasted.

## SLOTS (generate these 9 — one each)

**results/hero.webp** — A finished DOUBLE-stack smash burger on a warm wood countertop beside the cast-iron pan: two thin beef patties whose lacy, deep-brown crispy edges spill out past a glossy toasted bun, a slice of American cheese melted between the patties and draping the sides, a little sauce and a pickle just visible; crispy lacy edges reading clearly PAST the bun. [appetite beauty shot: cast-iron pan + warm wood countertop + golden-hour side light + glossy food-magazine finish + shallow depth of field, the same cast-iron kitchen and cookware across the whole recipe for filmstrip continuity, no text. Square.] — role: browse card + detail hero (listing-continuity); continuous with cue-finish.

**results/cue-smash.webp** — Top-down into a ripping-hot dry cast-iron pan: two loose, cold balls of raw ground beef just pressed flat under a parchment square with a stiff metal spatula bearing straight down, each patty smashed thin and wider than a bun with craggy torn edges; raw beef, dry pan. [photorealistic in-cook reference photo, bright even NEUTRAL daylight, neutral white balance, no colored shadows, one subject / the diagnostic feature filling the frame, cast-iron skillet (locked cookware), light neutral surface, no garnish, no props beyond what the step names, no text, realistic achievable home-kitchen result. Square.] ⚠️ RAW BEEF — no garnish, no greenery, no herbs, no toppings, no sauce, no bun; raw patties + parchment + spatula only. Judgment: "smashed thin and wide, spatula straight down." (Round 1 & 2 reuse this file.)

**results/cue-season.webp** — Top-down: the parchment just peeled away, two raw smashed beef patties in the hot cast-iron pan, a hand sprinkling a generous, even scatter of salt and coarse black pepper onto the wet raw tops from up high; craggy edges just beginning to sear at the rim. [photorealistic in-cook reference photo, bright even NEUTRAL daylight, neutral white balance, no colored shadows, one subject / the diagnostic feature filling the frame, cast-iron skillet (locked cookware), light neutral surface, no garnish, no props beyond what the step names, no text, realistic achievable home-kitchen result. Square.] ⚠️ RAW BEEF — no garnish, no greenery, no herbs, no toppings; raw patties + seasoning only. Judgment: "seasoned generously and evenly on the raw tops."

**results/cue-lacy-edges.webp** — Low ~20° side angle at the pan rim on one smash patty: the border is unmistakably LACY — deep mahogany-brown, crispy, filigreed with tiny holes and craggy fried-out lace where the beef fat has crisped into the pan; the lacy crust is the whole subject, dominating the frame and reading instantly even as a phone thumbnail; side one, not yet flipped. [photorealistic in-cook reference photo, bright even NEUTRAL daylight, neutral white balance, no colored shadows, one subject / the diagnostic feature filling the frame, cast-iron skillet (locked cookware), light neutral surface, no garnish, no props beyond what the step names, no text, realistic achievable home-kitchen result. Square.] ⚠️ THE load-bearing flip-gate reference — VALIDATE: lacy holes + deep-brown crisp must be UNMISTAKABLE at phone-glance size, distinctly lacy not merely browned. Judgment: "lacy, brown, crispy edges with tiny holes = flip." (Round 1 & 2 reuse this file.)

**results/cue-scrape-flip.webp** — Close low angle in the pan: a stiff metal spatula laid flat and low, ~45° into the pan, scraping hard UNDER a crusted patty so the whole deep-brown crust lifts off the pan surface with the beef (no crust left stuck to the pan), caught mid-scrape just before the flip. [photorealistic in-cook reference photo, bright even NEUTRAL daylight, neutral white balance, no colored shadows, one subject / the diagnostic feature filling the frame, cast-iron skillet (locked cookware), light neutral surface, no garnish, no props beyond what the step names, no text, realistic achievable home-kitchen result. Square.] Judgment: "spatula flat and low; scrape ALL the brown off the pan."

**results/cue-cheese-stack.webp** — Top-down in the pan: a single slice of American cheese laid on one just-flipped patty (crusted side up), the second patty set on top of the cheese to build the double stack, the cheese beginning to melt and slump at the edges; crusted beef + melting cheese, no bun yet. [photorealistic in-cook reference photo, bright even NEUTRAL daylight, neutral white balance, no colored shadows, one subject / the diagnostic feature filling the frame, cast-iron skillet (locked cookware), light neutral surface, no garnish, no props beyond what the step names, no text, realistic achievable home-kitchen result. Square.] Judgment: "cheese on the moment it flips, second patty stacked." (Round 1 & 2 reuse this file.)

**results/cue-burner-off.webp** — The cast-iron pan slid fully OFF the burner onto a folded kitchen towel on the counter, the stove control dial/knob turned visibly to OFF, the burner/coil clearly empty and unoccupied; off-heat state unmistakable at a glance. [photorealistic in-cook reference photo, bright even NEUTRAL daylight, neutral white balance, no colored shadows, one subject / the diagnostic feature filling the frame, cast-iron skillet (locked cookware), light neutral surface, no garnish, no props beyond what the step names, no text, realistic achievable home-kitchen result. Square.] ⚠️ OFF-HEAT-UNMISTAKABLE: dial visibly OFF AND pan off the coil on a folded towel, burner clearly unoccupied. Judgment: "burner dial OFF, pan off the coil."

**results/cue-doneness.webp** — Cross-section: a smash patty broken / torn open and held to camera, the interior cooked fully through — juicy grey-brown all the way across with NO pink, wet, jelly-like middle — melted American cheese draping the crusted exterior; the interior color is the whole subject. [photorealistic in-cook reference photo, bright even NEUTRAL daylight, neutral white balance, no colored shadows, one subject / the diagnostic feature filling the frame, cast-iron skillet (locked cookware), light neutral surface, no garnish, no props beyond what the step names, no text, realistic achievable home-kitchen result. Square.] ⚠️ VALIDATE (doneness truth, food-safety): must read cooked-through — juicy grey-brown, NO pink-wet centre; cheese melted. Validate vs a real reference; internal-doneness copy stays authoritative. Judgment: "juicy grey-brown through, no pink-wet middle, cheese melted."

**results/cue-finish.webp** — The just-built DOUBLE-stack smash burger on its toasted bun, fresh on the counter: sauce on the bottom bun, pickles and lettuce, the double patty stack with lacy crispy edges spilling past the bun, cheese melted between, top bun crowning it — ready to eat right now. [appetite beauty shot: cast-iron pan + warm wood countertop + golden-hour side light + glossy food-magazine finish + shallow depth of field, the same cast-iron kitchen and cookware across the whole recipe for filmstrip continuity, no text. Square.] — must be continuous with hero. Judgment: "built and crowned — crispy edges past the bun, eat now."

## PREP WIZARD SLOTS (added 2026-07-08 — reference grade, generate these 6)

**results/prep-vent.webp** — A home kitchen from the stove: the overhead range-hood / extractor fan clearly running above an empty stovetop, a window cracked open behind, an empty cast-iron pan waiting on the counter; the ventilation setup is the subject, no food yet. [photorealistic in-cook reference photo, bright even NEUTRAL daylight, neutral white balance, no colored shadows, one subject / the diagnostic feature filling the frame, cast-iron skillet (locked cookware), light neutral surface, no garnish, no props beyond what the step names, no text, realistic achievable home-kitchen result. Square.] Judgment: "fan on, window open, before any smoke."

**results/prep-balls.webp** — Top-down: four loosely-rolled balls of raw ground beef (golf-ball size, craggy and airy, NOT packed tight) resting on a plate, cold from the fridge. [photorealistic in-cook reference photo, bright even NEUTRAL daylight, neutral white balance, no colored shadows, one subject / the diagnostic feature filling the frame, cast-iron skillet (locked cookware), light neutral surface, no garnish, no props beyond what the step names, no text, realistic achievable home-kitchen result. Square.] Raw beef only — no garnish, no greenery, no herbs, no seasoning; raw beef balls + plate only, nothing else in frame. ⚠️ RAW BEEF. Judgment: "loose, craggy balls — not packed tight."

**results/prep-parchment.webp** — Top-down: two roughly 6-inch squares of parchment paper cut and stacked on a light neutral counter beside a stiff metal spatula — the smash shield, ready; no food. [photorealistic in-cook reference photo, bright even NEUTRAL daylight, neutral white balance, no colored shadows, one subject / the diagnostic feature filling the frame, cast-iron skillet (locked cookware), light neutral surface, no garnish, no props beyond what the step names, no text, realistic achievable home-kitchen result. Square.] Judgment: "a couple of ~6-inch squares, one per patty."

**results/prep-toppings.webp** — Top-down: prepped burger toppings laid out in small dishes — sliced pickles, shredded lettuce, tomato slices, thin onion — plus a small bowl of pale mayo-mustard sauce stirred, all staged within reach; no raw meat in frame. [photorealistic in-cook reference photo, bright even NEUTRAL daylight, neutral white balance, no colored shadows, one subject / the diagnostic feature filling the frame, cast-iron skillet (locked cookware), light neutral surface, no garnish, no props beyond what the step names, no text, realistic achievable home-kitchen result. Square.] Judgment: "everything sliced and the sauce mixed, before the pan's hot."

**results/prep-buns.webp** — Top-down into the cast-iron pan over medium: two burger buns cut-side down toasting to golden, buttered cut faces glistening; buns only, no patties. [photorealistic in-cook reference photo, bright even NEUTRAL daylight, neutral white balance, no colored shadows, one subject / the diagnostic feature filling the frame, cast-iron skillet (locked cookware), light neutral surface, no garnish, no props beyond what the step names, no text, realistic achievable home-kitchen result. Square.] Judgment: "buns toasting cut-side down, golden — buns first."

**results/prep-stage.webp** — Top-down of a staged mise-en-place within arm's reach: stiff metal spatula, stacked parchment squares, unwrapped American cheese slices, two dressed buns (sauce + toppings), a sheet of foil — everything laid out pit-crew style; beef stays in the fridge, not in frame. [photorealistic in-cook reference photo, bright even NEUTRAL daylight, neutral white balance, no colored shadows, one subject / the diagnostic feature filling the frame, cast-iron skillet (locked cookware), light neutral surface, no garnish, no props beyond what the step names, no text, realistic achievable home-kitchen result. Square.] Judgment: "everything within arm's reach before the first ball hits the pan."

## REUSE (do NOT generate — recorded pointers)
Round-2 cues already reference the round-1 slot files in cues.js (identical state):
| target (cues.js) | source |
|---|---|
| at:190 "Round two — run it back" | cue-smash.webp |
| at:235 "Edges again — patience again" | cue-lacy-edges.webp |
| at:300 "Scrape, flip, cheese — last one" | cue-cheese-stack.webp |

## Manifest contract
Row per generation (slot, verbatim prompt, file, note) appended
IMMEDIATELY; N=1 per slot; 9 generations total; session footer at end.

## REVIEW NOTES (for /experiment-review — extra scrutiny slots)
⚠️ cue-lacy-edges (flip gate) is THE load-bearing reference — audit
hardest: lacy holes + deep-brown crisp unmistakable at thumbnail size.
⚠️ cue-doneness is doneness-truth / food-safety — validate juicy
grey-brown, NO pink-wet middle, cheese melted, against a real reference
before accepting. cue-burner-off must be off-heat-unmistakable (dial OFF +
pan off the coil on a towel). Appetite slots (hero, cue-finish) must share
the same cast-iron kitchen/light for filmstrip continuity.
