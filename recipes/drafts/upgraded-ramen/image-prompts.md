# Upgraded Ramen — image prompts (21 distinct slots)

Recipe LOCKED (shipped in cues.js as `window.UPGRADED_RAMEN`). TWO METHOD LADDERS = two sets of cook
shots: **soup** (`soup-c1`–`soup-c7` + pre-phase `soup-p1-c1`/`soup-p1-c2`) and **stir-fry**
(`sf-c1`–`sf-c7` + pre-phase `sf-p1-c1`), sharing hero + 3 prep. One prompt per slot, N=1, real slot
filenames. Three style classes (RECIPE_FORMAT §7):
- **APPETITE** (glossy, warm side light): `hero`.
- **IN-COOK REFERENCE** (bright NEUTRAL daylight, neutral white balance, color-is-data): every
  `soup-*` and `sf-*` (incl. the two pre-phase boil frames). Do NOT warm these — the
  low-simmer-vs-rolling-boil call and the soft-yolk-vs-set-white call must read TRUE. **Locked
  cookware = ONE light small pot across every in-pot shot**, one neutral surface. Name the exact
  ingredients in every shot (never a generic "veg medley").
- **PREP-STATION REFERENCE** (bright NEUTRAL daylight, board / neutral counter, no pot/heat): `prep-c1`,
  `prep-c2`, `prep-c3`.

⚠️ VALIDATE slots (founder confirms before accepting — load-bearing):
- `soup-c3` (HEAT-DOWN state): noodles cooked, broth dropped to LOW — only a few small GENTLE bubbles,
  clearly NOT a rolling boil, NO egg yet. This is the "drop to low, gentle simmer" reference.
- `soup-c4` (THE EGG DROP): one egg cracked into that gentle low simmer, whites just beginning to
  cloud, untouched. The gentle-simmer-with-egg state.
- `soup-c5` (THE EGG CHECK, doneness reference): whites fully set and cloudy-solid, yolk still soft
  under the surface — the "money egg" state.
- `sf-c4` (THE GLOSSY TOSS): every noodle strand shining, fully coated in the dark soy-butter sauce —
  the viral glossy sheen. Shoot EXACTLY that coated-and-glossy state.

Note: no raw-protein slot — any added protein is PRE-COOKED (a copy note, not a tracked ingredient).

Paste convention: paste each slot's scene text + its bracketed base block verbatim. The ⚠️ / class /
Judgment lines are operator annotations — NOT pasted.

## SLOTS (generate these 21 — one each)

**results/hero.webp** — A finished bowl of upgraded soup ramen: wavy ramen noodles in a glossy golden
broth, a poached egg on top with its soft yolk just broken and running into the broth, sliced green
onion and a swirl of sriracha, chopsticks resting on the rim. [appetite beauty shot: warm side light +
glossy food-magazine finish + shallow depth of field, the running yolk the hero moment, the same
kitchen across the whole recipe, no text. Square.] — role: browse card + detail hero.

**results/prep-c1.webp** — Top-down on a light neutral countertop: a fridge-raid ramen station staged —
one sealed instant-ramen packet, one whole egg, a small pile of minced garlic, a few sliced green-onion
rounds, and a little heap of shredded cooked chicken, all set out together. [photorealistic
prep-station reference photo, bright even NEUTRAL daylight, neutral white balance, on a light neutral
countertop, no pot and no heat, no text, realistic achievable home-kitchen result. Square.] Judgment:
"raid the fridge — the packet is the only must-have, everything else is a bonus."

**results/prep-c2.webp** — Top-down on a light neutral countertop, split staging for the two methods: on
one side an opened ramen packet with its little seasoning sachet set aside next to a handful of frozen
peas and corn (the soup path); on the other side a small bowl holding soy sauce and brown sugar with a
pat of butter and minced garlic beside it (the stir-fry sauce). [photorealistic prep-station reference
photo, bright even NEUTRAL daylight, neutral white balance, on a light neutral countertop, no pot and
no heat, no text, realistic achievable home-kitchen result. Square.] Judgment: "season station — soup
sets the packet aside; stir-fry measures the soy + brown sugar sauce."

**results/prep-c3.webp** — On a light neutral countertop: a small empty cooking pot set beside an empty
serving bowl and a pair of chopsticks, staged and ready before anything is cooked. [photorealistic
prep-station reference photo, bright even NEUTRAL daylight, neutral white balance, on a light neutral
countertop, no pot on heat, no text, realistic achievable home-kitchen result. Square.] Judgment:
"pot + a real bowl out and ready."

### SOUP pre-phase (build the broth, then boil)

**results/soup-p1-c1.webp** — Low ~20° side angle into the same light small pot on medium heat: a pat of
butter melted into a thin pool with a little minced garlic just gone fragrant in it — pale gold, NOT
browned. [photorealistic in-cook reference photo, bright even NEUTRAL daylight, neutral white balance,
no colored shadows, one light small pot (the same pot across every in-pot shot), neutral surface, no
garnish, no text, realistic achievable home-kitchen result. Square.] Judgment: "butter + garlic ~30
sec till fragrant — don't brown it."

**results/soup-p1-c2.webp** — Top-down into the same pot: water and a poured-in seasoning packet coming
up to a rolling boil, big bubbles across the whole surface, a lid resting to the side. [photorealistic
in-cook reference photo, bright even NEUTRAL daylight, neutral white balance, no colored shadows, one
light small pot (locked cookware), neutral surface, no garnish, no text, realistic achievable
home-kitchen result. Square.] Judgment: "water + seasoning packet, heat to high — big rolling bubbles."

### SOUP cook ladder

**results/soup-c1.webp** — Top-down into the same light small pot of rolling, boiling broth: a nest of
wavy instant ramen noodles just dropped in, beginning to soften and loosen apart, being nudged with
chopsticks. [photorealistic in-cook reference photo, bright even NEUTRAL daylight, neutral white
balance, no colored shadows, one light small pot (locked cookware), neutral surface, no garnish, no
text, realistic achievable home-kitchen result. Square.] Judgment: "noodles into the boil, nudge
apart."

**results/soup-c2.webp** — Top-down into the same pot: a handful of frozen peas and corn dropped
straight into the boiling broth alongside the softening ramen noodles, no thawing. [photorealistic
in-cook reference photo, bright even NEUTRAL daylight, neutral white balance, no colored shadows, one
light small pot (locked cookware), neutral surface, no garnish, no text, realistic achievable
home-kitchen result. Square.] Judgment: "frozen peas and corn straight in — cooks with the noodles."

**results/soup-c3.webp** — Top-down into the same pot now on LOW heat: the noodles fully cooked and soft
in the broth, the surface with only a few small gentle bubbles (clearly NOT a rolling boil) — the calm
low simmer, NO egg in it yet. [photorealistic in-cook reference photo, bright even NEUTRAL daylight,
neutral white balance, no colored shadows, one light small pot (locked cookware), neutral surface, no
garnish, no text, realistic achievable home-kitchen result. Square.] ⚠️ VALIDATE (load-bearing): LOW
gentle simmer — a few small bubbles only, NOT rolling — noodles cooked, no egg yet. Judgment: "taste a
noodle, then drop to LOW — gentle bubbles are the setup for the egg."

**results/soup-c4.webp** — Top-down into the same pot at a gentle low simmer: a single whole egg cracked
directly into the barely-bubbling broth among the noodles, its white just beginning to turn cloudy at
the edges, completely undisturbed. [photorealistic in-cook reference photo, bright even NEUTRAL
daylight, neutral white balance, no colored shadows, one light small pot (locked cookware), neutral
surface, no garnish, no text, realistic achievable home-kitchen result. Square.] ⚠️ VALIDATE
(load-bearing): egg cracked into a GENTLE simmer (not rolling), whites just clouding, untouched.
Judgment: "crack the egg into the gentle simmer and leave it — 6 minutes, hands off."

**results/soup-c5.webp** — Top-down into the pot: the poached egg after six minutes — its white now
fully set, cloudy and solid all the way across the surface with nothing clear or wobbly, the yolk still
a soft raised dome underneath. [photorealistic in-cook reference photo, bright even NEUTRAL daylight,
neutral white balance, no colored shadows, one light small pot (locked cookware), neutral surface, no
garnish, no text, realistic achievable home-kitchen result. Square.] ⚠️ VALIDATE (doneness reference):
whites fully set + cloudy-solid, yolk still soft under the surface. Judgment: "whites set, yolk soft =
the money egg."

**results/soup-c6.webp** — A finished bowl being topped: the ramen and broth ladled into a serving
bowl, the set poached egg placed on top, a scatter of sliced green onion and a swirl of sriracha going
over it, off the heat. [photorealistic in-cook reference photo, bright even NEUTRAL daylight, neutral
white balance, no colored shadows, a neutral serving bowl on a neutral surface, no text, realistic
achievable home-kitchen result. Square.] Judgment: "everything into the bowl, egg last and gentle,
green onion + sriracha on top."

**results/soup-c7.webp** — A finished bowl of upgraded soup ramen on the counter, the poached egg's
soft yolk just breaking and running into the glossy broth, sliced green onion and sriracha on top,
steam rising. [photorealistic in-cook reference photo, bright even NEUTRAL daylight, neutral white
balance, no colored shadows, a neutral serving bowl on a neutral surface, no text, realistic achievable
home-kitchen result. Square.] Judgment: "same fifty-cent packet — look at it now."

### STIR-FRY pre-phase + cook ladder

**results/sf-p1-c1.webp** — Top-down into the same light small pot of plain water coming to a rolling
boil, big bubbles across the whole surface, nothing else in it (no seasoning packet), a lid resting to
the side. [photorealistic in-cook reference photo, bright even NEUTRAL daylight, neutral white balance,
no colored shadows, one light small pot (locked cookware), neutral surface, no garnish, no text,
realistic achievable home-kitchen result. Square.] Judgment: "plain water to a boil — no packet, that's
for the toss."

**results/sf-c1.webp** — Top-down into the same pot of plain boiling water (no seasoning): a nest of
wavy instant ramen noodles cooking, looking springy and just slightly underdone, no broth color.
[photorealistic in-cook reference photo, bright even NEUTRAL daylight, neutral white balance, no
colored shadows, one light small pot (locked cookware), neutral surface, no garnish, no text, realistic
achievable home-kitchen result. Square.] Judgment: "plain water, no packet — pull them ~30 sec early,
they finish in the sauce."

**results/sf-c2.webp** — The cooked ramen noodles being drained in a colander over a sink, steam
rising, the same small pot empty beside it ready to go back on the burner. [photorealistic in-cook
reference photo, bright even NEUTRAL daylight, neutral white balance, no colored shadows, one light
small pot (locked cookware) plus a colander, neutral surface, no text, realistic achievable
home-kitchen result. Square.] Judgment: "drain the noodles safely — colander easiest — empty pot back
on medium."

**results/sf-c3.webp** — Low ~20° side angle into the same small pot on medium heat: a pat of butter
melted into a thin pool with minced garlic just gone fragrant in it — pale gold, NOT browned, NOT dark.
[photorealistic in-cook reference photo, bright even NEUTRAL daylight, neutral white balance, no
colored shadows, one light small pot (locked cookware), neutral surface, no garnish, no text, realistic
achievable home-kitchen result. Square.] Judgment: "butter + garlic ~30 sec till fragrant — slide the
pot off if it's browning."

**results/sf-c4.webp** — Top-down into the same pot: the drained ramen noodles tossed back into the
butter with soy sauce and brown sugar, every single strand glossy, dark, and fully coated in the shiny
sauce, mid-toss. [photorealistic in-cook reference photo, bright even NEUTRAL daylight, neutral white
balance, no colored shadows, one light small pot (locked cookware), neutral surface, no garnish, no
text, realistic achievable home-kitchen result. Square.] ⚠️ VALIDATE (load-bearing): every strand
shining and fully coated in the dark soy-butter sauce — the glossy sheen. Judgment: "toss till every
strand is glossy and coated — that's the viral shot."

**results/sf-c5.webp** — Top-down into the pot: the glossy noodles pushed to one side, a beaten egg
poured into the cleared gap and gently scrambling into soft curds, just set — not dry. [photorealistic
in-cook reference photo, bright even NEUTRAL daylight, neutral white balance, no colored shadows, one
light small pot (locked cookware), neutral surface, no garnish, no text, realistic achievable
home-kitchen result. Square.] Judgment: "beat the egg first, then scramble it soft in the gap and fold
it through."

**results/sf-c6.webp** — The finished stir-fry noodles turned into a serving bowl, topped with sliced
green onion and a swirl of sriracha, off the heat. [photorealistic in-cook reference photo, bright even
NEUTRAL daylight, neutral white balance, no colored shadows, a neutral serving bowl on a neutral
surface, no text, realistic achievable home-kitchen result. Square.] Judgment: "into the bowl — green
onion, sriracha, protein folded through."

**results/sf-c7.webp** — A finished bowl of glossy soy-butter stir-fry ramen on the counter, chopsticks
lifting a tangle of shining coated noodles up from the bowl, sliced green onion on top. [photorealistic
in-cook reference photo, bright even NEUTRAL daylight, neutral white balance, no colored shadows, a
neutral serving bowl on a neutral surface, no text, realistic achievable home-kitchen result. Square.]
Judgment: "better than the packet deserved — the glossy chopstick lift."

## MANIFEST (row per generation, appended live by the render leg)
| slot | file | status |
|---|---|---|
| hero | results/hero.webp | pending |
| prep-c1 | results/prep-c1.webp | pending |
| prep-c2 | results/prep-c2.webp | pending |
| prep-c3 | results/prep-c3.webp | pending |
| soup-p1-c1 | results/soup-p1-c1.webp | pending |
| soup-p1-c2 | results/soup-p1-c2.webp | pending |
| soup-c1 | results/soup-c1.webp | pending |
| soup-c2 | results/soup-c2.webp | pending |
| soup-c3 | results/soup-c3.webp | pending — ⚠️ VALIDATE (load-bearing): LOW gentle simmer, noodles cooked, no egg |
| soup-c4 | results/soup-c4.webp | pending — ⚠️ VALIDATE (load-bearing): egg cracked into gentle simmer, untouched |
| soup-c5 | results/soup-c5.webp | pending — ⚠️ VALIDATE (doneness): whites set, yolk soft |
| soup-c6 | results/soup-c6.webp | pending |
| soup-c7 | results/soup-c7.webp | pending |
| sf-p1-c1 | results/sf-p1-c1.webp | pending |
| sf-c1 | results/sf-c1.webp | pending |
| sf-c2 | results/sf-c2.webp | pending |
| sf-c3 | results/sf-c3.webp | pending |
| sf-c4 | results/sf-c4.webp | pending — ⚠️ VALIDATE (load-bearing): every strand glossy + coated |
| sf-c5 | results/sf-c5.webp | pending |
| sf-c6 | results/sf-c6.webp | pending |
| sf-c7 | results/sf-c7.webp | pending |
