# Image prompts — smash burgers (hero + music-phase cues, Cowork batch)

> COOK-TEST 2026-07-17: `cue-smash` (bare-spatula press, no parchment/paper towel) + `prep-shield`
> (parchment squares, not paper towel) ✅ RE-RENDERED via recipe-visualizer (Gemini free lane, faint
> watermark) and SHIPPED to `mvp/assets/recipes/smash/` (1024×1024 webp). ⚠️ Founder eye: prep-shield's
> spatula rendered as a narrow offset/icing spatula, not the wide flat turner in cue-smash — re-render if you
> want it consistent. NOTE: `experiments/prod-2026-07-08/brief.md` + `PROVENANCE.md` still carry the OLD
> parchment-under-spatula / paper-towel prompts — update if you want the paper trail to match what shipped.

Scope: the 9 WIRED slots the recipe references in `mvp/cues.js`
(`assets/recipes/smash/…`): `hero`, `cue-smash`, `cue-season`,
`cue-lacy-edges`, `cue-scrape-flip`, `cue-cheese-stack`, `cue-burner-off`,
`cue-doneness`, `cue-finish`. (The 6 prep-wizard slots — prep-vent /
-balls / -shield / -toppings / -buns / -stage — are in the PREP WIZARD
section below, added 2026-07-08; prep-shield was renamed from
prep-parchment in the four-fixes change.) Recipe copy is LOCKED (shipped in
cues.js/app.js).

## TWO STYLE CLASSES (RECIPE_FORMAT.md §7 — do not blur them)

Prompts are built from the recipe's §7 cue table + the format doc's §7
style spec. §7 splits images into two grades with OPPOSITE lighting, and
this recipe uses both:

- **APPETITE / HERO grade** — slots `hero` and `cue-finish` (selling the
  outcome). Base style to append:
  *[appetite beauty shot: cast-iron pan + warm wood countertop +
  golden-hour side light + glossy food-magazine finish + shallow depth of
  field, the same cast-iron kitchen and cookware across the whole recipe
  for filmstrip continuity, no text. Square.]*

- **IN-COOK REFERENCE grade** — the 7 diagnostic cues (`cue-smash`,
  `cue-season`, `cue-lacy-edges`, `cue-scrape-flip`, `cue-cheese-stack`,
  `cue-burner-off`, `cue-doneness`). COLOR IS DATA here, so the OPPOSITE
  grade — warm/golden light would make raw beef look seared and a wet
  middle look done. Base style to append:
  *[photorealistic in-cook reference photo, bright even NEUTRAL daylight,
  neutral white balance, no colored shadows, one subject / the diagnostic
  feature filling the frame, cast-iron skillet (locked cookware), light
  neutral surface, no garnish, no props beyond what the step names, no
  text, realistic achievable home-kitchen result. Square.]*

Cast-iron cookware is locked across BOTH grades (filmstrip continuity);
only the light changes. Canonical burger = the DOUBLE stack (recipe
default) for hero / cheese-stack / finish.

---

## HERO (appetite grade)

**hero.webp — plated finish / beauty shot (listing-continuity rule)**
A finished DOUBLE-stack smash burger on a warm wood countertop beside the
cast-iron pan: two thin beef patties whose lacy, deep-brown crispy edges
spill out past a glossy toasted bun, a slice of American cheese melted
between the patties and draping the sides, a little sauce and a pickle
just visible. The outcome you're selling — crispy lacy edges must read
clearly PAST the bun. Role: browse card + detail hero + prep overview;
must be continuous with `cue-finish`.

## MUSIC-PHASE CUES (in-cook reference grade unless noted)

**cue-smash.webp — "Balls in — then SMASH" (round 1 & 2)** — COOK-TEST 2026-07-17 RE-RENDER
Top-down into a ripping-hot dry cast-iron pan: a loose cold ball of raw
ground beef being smashed dead flat by a stiff metal spatula pressed
straight down DIRECTLY on the bare beef — NO parchment, NO paper towel,
the bare metal spatula on the patty (the primary no-parchment path) —
the patty forced thin and wider than a bun, its craggy torn edges already
going lacy and browning where they meet the hot iron. Raw beef in the
centre, a dry pan, crust starting at the edges.
⚠️ RAW BEEF — ban explicitly: NO garnish, NO greenery, NO herbs, NO
toppings, NO sauce, NO bun, NO parchment, NO paper towel. Bare metal
spatula pressing the raw patty flat, nothing else in frame.
Judgment: "bare metal spatula pressing the patty DEAD FLAT, lacy crust
starting at the edges — a beginner reads 'that's the move + that flat' in two seconds."

**cue-season.webp — "Peel + season" (RAW BEEF)**
Top-down: the parchment just peeled away, two raw smashed beef patties in
the hot cast-iron pan, a hand sprinkling a generous, even scatter of salt
and coarse black pepper onto the wet raw tops from up high. Craggy edges
just beginning to sear at the rim.
⚠️ RAW BEEF — ban explicitly: NO garnish, NO greenery, NO herbs, NO
toppings. Raw patties + seasoning only, nothing else in frame.
Judgment: "seasoned generously and evenly on the raw tops."

**cue-lacy-edges.webp — THE FLIP GATE (load-bearing) ⚠️ VALIDATE**
Low ~20° side angle at the pan rim on one smash patty: the border is
unmistakably LACY — deep mahogany-brown, crispy, filigreed with tiny
holes and craggy fried-out lace where the beef fat has crisped into the
pan. The lacy crust is the whole subject, dominating the frame and
reading instantly even as a phone thumbnail. Side one, not yet flipped.
⚠️ LOAD-BEARING reference — **VALIDATE**: the lacy holes + deep-brown
crisp must be UNMISTAKABLE at phone-glance size — distinctly lacy/craggy,
not merely browned. Neutral daylight only (color is the data).
Judgment: "lacy, brown, crispy edges with tiny holes = ready to flip."

**cue-scrape-flip.webp — "SCRAPE and flip"**
Close low angle in the pan: a stiff metal spatula laid flat and low,
~45° into the pan, scraping hard UNDER a crusted patty so the whole
deep-brown crust lifts off the pan surface with the beef — no crust left
stuck to the pan — caught mid-scrape just before the flip.
Judgment: "spatula flat and low; scrape ALL the brown off the pan — it
belongs to the burger."

**cue-cheese-stack.webp — "Cheese ON — stack — OUT" (round 1 & 2)**
Top-down in the pan: a single slice of American cheese laid on one
just-flipped patty (crusted side now up), the second patty set on top of
the cheese to build the double stack, the cheese beginning to melt and
slump at the edges. Crusted beef + melting cheese — no bun yet.
Judgment: "cheese on the moment it flips, second patty stacked on top."

**cue-burner-off.webp — "Burner OFF — pan off the heat" (off-heat family)**
The cast-iron pan slid fully OFF the burner onto a folded kitchen towel
on the counter, the stove control dial/knob turned visibly to OFF, and
the burner/coil clearly empty and unoccupied. Off-heat state unmistakable
at a glance.
⚠️ OFF-HEAT-UNMISTAKABLE pattern: dial visibly OFF **and** pan slid off
the coil onto a folded towel on the counter, burner clearly unoccupied.
Judgment: "burner dial OFF, pan off the coil on a towel."

**cue-doneness.webp — "Doneness check" ⚠️ VALIDATE (doneness truth)**
Cross-section: a smash patty broken / torn open and held to camera, the
interior cooked fully through — juicy grey-brown all the way across with
NO pink, wet, jelly-like middle — melted American cheese draping the
crusted exterior. The interior color is the whole subject.
⚠️ **VALIDATE (doneness truth, food-safety)**: must read cooked-through —
juicy grey-brown, NO pink-wet centre; cheese clearly melted. Validate
against a real reference before it ships; internal-doneness copy stays
authoritative. Neutral daylight, no warm cast (color is the data).
Judgment: "juicy grey-brown through, no pink-wet middle, cheese melted."

**cue-finish.webp — "Build it — eat it NOW" (appetite grade)**
The just-built DOUBLE-stack smash burger on its toasted bun, fresh on the
counter: sauce on the bottom bun, pickles and lettuce, the double patty
stack with lacy crispy edges spilling past the bun, cheese melted
between, top bun crowning it — ready to eat right now. Same cast-iron
kitchen as the rest of the set; must be continuous with `hero`.
Judgment: "built and crowned — crispy edges past the bun, eat immediately."

## PREP WIZARD (in-cook reference grade — neutral daylight, staged end-state)

Per §7, prep steps show the correctly-staged end state; reference grade
(not appetite). Cast-iron cookware locked where a pan appears.

**prep-vent.webp — "Open a window / fan ON"**
A home kitchen from the stove: the overhead range-hood / extractor fan
clearly running above an empty stovetop, a window cracked open behind, an
empty cast-iron pan waiting on the counter. The ventilation setup is the
subject — no food in frame yet.
Judgment: "fan on, window open, before any smoke."

**prep-balls.webp — "Ball the beef — loosely, keep it cold" (RAW BEEF)**
Top-down: four loosely-rolled balls of raw ground beef (golf-ball size,
craggy and airy, NOT packed tight) resting on a plate, cold from the
fridge.
⚠️ RAW BEEF — ban explicitly: NO garnish, NO greenery, NO herbs, NO
seasoning yet; raw beef balls + plate only, nothing else in frame.
Judgment: "loose, craggy balls — not packed tight."

**prep-shield.webp — "Your smash press — parchment or spatula" (COOK-TEST 2026-07-17 RE-RENDER)**
Top-down on a light neutral counter, no food: a few small squares of
PARCHMENT PAPER (smooth, matte — NOT quilted paper towel) stacked beside a
stiff metal spatula. NO paper towel anywhere. NOTE: the recipe now removes
paper towels entirely — the press is a parchment square OR the bare metal
spatula; this reference shows both options staged.
Judgment: "parchment squares + the metal spatula — the two ways to press, no paper towel."

**prep-toppings.webp — "Toppings + sauce ready"**
Top-down: prepped burger toppings laid out in small dishes — sliced
pickles, shredded lettuce, tomato slices, thin onion — plus a small bowl
of pale mayo-mustard sauce stirred, all staged within reach. No raw meat
in frame.
Judgment: "everything sliced and the sauce mixed, before the pan's hot."

**prep-buns.webp — "Toast the buns NOW"**
Top-down into the cast-iron pan over medium: two burger buns cut-side
down toasting to golden, buttered cut faces glistening. Buns only — no
patties.
Judgment: "buns toasting cut-side down, golden — buns first."

**prep-stage.webp — "Stage it — pit-crew mode"**
Top-down of a staged mise-en-place within arm's reach: stiff metal
spatula, stacked parchment squares, unwrapped American cheese slices, two
dressed buns (sauce + toppings), a sheet of foil — everything laid out
pit-crew style. (Beef stays in the fridge, not in frame.)
Judgment: "everything within arm's reach before the first ball hits the pan."

## REUSE (recorded — do NOT write duplicate prompts)

Round-2 cues already point at the round-1 slot files in `cues.js`
(state is identical), so each is generated ONCE:

| round-2 cue (cues.js) | reuses slot |
|---|---|
| at:190 "Round two — run it back" | cue-smash.webp |
| at:235 "Edges again — patience again" | cue-lacy-edges.webp |
| at:300 "Scrape, flip, cheese — last one" | cue-cheese-stack.webp |

Note: `hero` and `cue-finish` are the two APPETITE/plated shots — kept as
separate slots (hero = beauty/browse card; cue-finish = the just-built
in-scene burger), NOT a reuse, but they must share the same kitchen +
cast-iron cookware + light for filmstrip continuity.
