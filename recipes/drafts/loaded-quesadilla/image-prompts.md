# Loaded Quesadilla — image prompts (15 distinct slots)

> COOK-TEST UPDATE 2026-07-17: added `prep-grate` (grate-the-cheese step). Cutting board REMOVED from the
> recipe — `prep-c3` (landing zone) and `cook-c9` (rest) now stage a PLATE, not a board. Re-render those two
> + `prep-grate` via recipe-visualizer (the shipped .webp for prep-c3/cook-c9 still show a board until then).

Recipe LOCKED (shipped in cues.js as `window.LOADED_QUESADILLA`). One prompt per slot, N=1, real slot
filenames. Two style classes (RECIPE_FORMAT §7):
- **APPETITE** (glossy golden-hour / warm wood): `hero`.
- **IN-COOK REFERENCE** (bright NEUTRAL daylight, neutral white balance, color-is-data): `preheat-c1`,
  `cook-c1`–`cook-c9`. Do NOT warm these — golden vs pale vs burnt and the melt-vs-brown call must read
  TRUE. **Locked cookware = ONE light nonstick pan across every in-pan shot**, one neutral surface.
- **PREP-STATION REFERENCE** (bright NEUTRAL daylight, board / neutral counter, no pan/heat): `prep-c1`,
  `prep-grate`, `prep-c2`, `prep-c3`.

⚠️ VALIDATE slot (founder confirms before accepting):
- `cook-c8` (THE DONENESS GATE, load-bearing): both sides golden-brown and crisp, cheese fully melted
  and glossy at the crease — no dry un-melted shreds. Shoot EXACTLY the gate state.

Note: no raw-protein slot — the filling is PRE-COOKED protein (`prep-c2` shows cooked, chopped pieces).
Declared reuse: `cook-c5` (the fold) is reused by the :150 "now we wait" tip. `hero` serves the finish cue.

Paste convention: paste each slot's scene text + its bracketed base block verbatim. The ⚠️ / class /
Judgment lines are operator annotations — NOT pasted.

## SLOTS (generate these 14 — one each)

**results/hero.webp** — A loaded quesadilla cut into golden crisp wedges on a wood board, one wedge lifted to show a long melty cheese pull stretching from the stack, a small bowl of salsa and guacamole beside it. [appetite beauty shot: warm wood counter + golden-hour side light + glossy food-magazine finish + shallow depth of field, the cheese pull the hero moment, the same kitchen across the whole recipe, no text. Square.] — role: browse card + detail hero + finish cue.

**results/prep-c1.webp** — Top-down on a light neutral countertop: a quesadilla station staged — a 10-inch flour tortilla, a pile of shredded cheese with a hand beside it for scale (about half a cup ≈ two handfuls), a small pat of butter, and a wide spatula. [photorealistic prep-station reference photo, bright even NEUTRAL daylight, neutral white balance, on a light neutral countertop, no pan and no heat, no text, realistic achievable home-kitchen result. Square.] Judgment: "half a cup of cheese ≈ two big handfuls — the scale is the point."

**results/prep-grate.webp** — Top-down on a light neutral countertop: a box grater on its side with a loose, fluffy pile of freshly grated cheese spilling from the large holes, about half a cup (≈ a handful and a half), a hand loosely beside it for scale — fluffy shreds, not packed, not a solid block. [photorealistic prep-station reference photo, bright even NEUTRAL daylight, neutral white balance, on a light neutral countertop, no pan and no heat, no text, realistic achievable home-kitchen result. Square.] Judgment: "a fluffy half-cup pile of hand-grated shreds — a beginner reads amount + texture in two seconds."

**results/prep-c2.webp** — Top-down on a wood cutting board: cooked chicken (or taco beef) chopped into small even fingernail-size pieces on one side, next to one deliberately oversized chunk for contrast — the small pieces are right, the big chunk is too big. [photorealistic prep-station reference photo, bright even NEUTRAL daylight, neutral white balance, on a wood cutting board, no pan and no heat, no text, realistic achievable home-kitchen result. Square.] Judgment: "chop small — fingernail-size; the big chunk makes the fold fight back."

**results/prep-c3.webp** — On a light neutral countertop right beside a stovetop: a clean dinner PLATE with a pizza cutter (or knife) resting on it, staged and ready as the landing zone; the empty stove just in frame. NO cutting board. [photorealistic prep-station reference photo, bright even NEUTRAL daylight, neutral white balance, a staged plate + cutter beside the stove, no pan on heat, no text, realistic achievable home-kitchen result. Square.] Judgment: "plate + cutter staged beside the stove — straight from pan to plate, sliced right on the plate."

**results/preheat-c1.webp** — Low ~20° side angle: an empty light nonstick pan sitting on a stovetop burner, the dial visibly set to MEDIUM, nothing in the pan at all — no butter, no tortilla, just warming up. [photorealistic in-cook reference photo, bright even NEUTRAL daylight, neutral white balance, no colored shadows, one light nonstick pan (the same pan across every in-pan shot) on the burner with the dial at medium, no garnish, no text, realistic achievable home-kitchen result. Square.] Judgment: "empty pan, dial at MEDIUM — heat it before the butter."

**results/cook-c1.webp** — Low ~20° side angle into the same nonstick pan on medium heat: a small pat of butter just melted into a thin pool, foaming and bubbling gently — pale and golden, NOT browned, NOT dark. [photorealistic in-cook reference photo, bright even NEUTRAL daylight, neutral white balance, no colored shadows, one light nonstick pan (locked cookware), neutral surface, no garnish, no text, realistic achievable home-kitchen result. Square.] Judgment: "melted + gently bubbling, still pale = go; browning = move now."

**results/cook-c2.webp** — Top-down into the same nonstick pan: a single round flour tortilla laid flat in the buttered pan, sitting fully flat with light contact, just starting to warm — no cheese yet, nothing on it. [photorealistic in-cook reference photo, bright even NEUTRAL daylight, neutral white balance, no colored shadows, one light nonstick pan (locked cookware), neutral surface, no garnish, no text, realistic achievable home-kitchen result. Square.] Judgment: "tortilla flat in the pan, soft contact sizzle."

**results/cook-c3.webp** — Top-down: shredded cheese spread in an even layer over exactly ONE HALF of the tortilla in the pan, with a clean finger-width bare border left around the edge of that half; the other half of the tortilla is empty (it's the lid). [photorealistic in-cook reference photo, bright even NEUTRAL daylight, neutral white balance, no colored shadows, one light nonstick pan (locked cookware), neutral surface, no garnish, no text, realistic achievable home-kitchen result. Square.] Judgment: "cheese on ONE half, clean border at the edge = the seal."

**results/cook-c4.webp** — Top-down: chopped cooked protein scattered evenly over the cheese on the one half, with a little extra shredded cheese pinched on top of the protein; the empty half still bare. [photorealistic in-cook reference photo, bright even NEUTRAL daylight, neutral white balance, no colored shadows, one light nonstick pan (locked cookware), neutral surface, no garnish, no text, realistic achievable home-kitchen result. Square.] Judgment: "protein over cheese, extra cheese on top — cheese on both sides is the glue."

**results/cook-c5.webp** — Low side angle: the tortilla folded into a half-moon (the empty half folded over the cheese), a wide spatula pressing gently down on top to seal it, in the pan. [photorealistic in-cook reference photo, bright even NEUTRAL daylight, neutral white balance, no colored shadows, one light nonstick pan (locked cookware), neutral surface, no garnish, no text, realistic achievable home-kitchen result. Square.] Judgment: "folded half-moon, spatula pressing gently to seal." (reused by the :150 wait tip)

**results/cook-c6.webp** — Low angle with the spatula lifting the edge of the folded quesadilla to reveal its underside: golden-brown toasted spots across the bottom — clearly golden, not pale-blond and not burnt-black — the flip-readiness check, the underside dominating the frame. [photorealistic in-cook reference photo, bright even NEUTRAL daylight, neutral white balance, no colored shadows, one light nonstick pan (locked cookware), neutral surface, no garnish, no text, realistic achievable home-kitchen result. Square.] Judgment: "golden-brown spots underneath = flip; pale = wait."

**results/cook-c7.webp** — Close low-side shot of the folded quesadilla in the pan, the crease (the folded edge) facing the camera with melted cheese just visible at the seam looking glossy and molten — side two cooking. [photorealistic in-cook reference photo, bright even NEUTRAL daylight, neutral white balance, no colored shadows, one light nonstick pan (locked cookware), neutral surface, no garnish, no text, realistic achievable home-kitchen result. Square.] Judgment: "crease cheese glossy and melting = getting close."

**results/cook-c8.webp** — The finished folded quesadilla lifted on the spatula out of the pan, showing it's golden-brown and crisp on BOTH sides with the cheese fully melted and glossy at the crease — no dry un-melted shreds; the done state. [photorealistic in-cook reference photo, bright even NEUTRAL daylight, neutral white balance, no colored shadows, one light nonstick pan (locked cookware), neutral surface, no garnish, no text, realistic achievable home-kitchen result. Square.] ⚠️ VALIDATE (load-bearing doneness gate): golden-crisp BOTH sides + crease cheese fully melted, no dry shreds. Judgment: "golden both sides + melted crease = done."

**results/cook-c9.webp** — A finished quesadilla resting on a clean dinner PLATE on the counter, with the nonstick pan set off to the side on a folded kitchen towel, the stove burner visibly empty — the off-heat rest pattern; the quesadilla is whole and uncut. NO cutting board. [photorealistic in-cook reference photo, bright even NEUTRAL daylight, neutral white balance, no colored shadows, quesadilla on a plate + pan on a folded towel beside an empty burner, no cutting shown, no garnish, no text, realistic achievable home-kitchen result. Square.] Judgment: "off the heat, pan slid onto a towel, rest on the plate before cutting."

## MANIFEST (row per generation, appended live by the render leg)
| slot | file | status |
|---|---|---|
| hero | results/hero.webp | pending |
| prep-c1 | results/prep-c1.webp | pending |
| prep-grate | results/prep-grate.webp | pending — NEW (cook-test): fluffy half-cup grated pile |
| prep-c2 | results/prep-c2.webp | pending |
| prep-c3 | results/prep-c3.webp | pending — RE-RENDER: plate not board |
| cook-c9 | results/cook-c9.webp | pending — RE-RENDER: plate not board |
| preheat-c1 | results/preheat-c1.webp | pending |
| cook-c1 | results/cook-c1.webp | pending |
| cook-c2 | results/cook-c2.webp | pending |
| cook-c3 | results/cook-c3.webp | pending |
| cook-c4 | results/cook-c4.webp | pending |
| cook-c5 | results/cook-c5.webp | pending |
| cook-c6 | results/cook-c6.webp | pending |
| cook-c7 | results/cook-c7.webp | pending |
| cook-c8 | results/cook-c8.webp | pending — ⚠️ VALIDATE (load-bearing doneness): golden both sides + melted crease |
| cook-c9 | results/cook-c9.webp | pending |
