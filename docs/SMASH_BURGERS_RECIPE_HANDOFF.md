# SMASH BURGERS — Choppd recipe handoff (docs/recipes/smash-burgers.md)

Authored per RECIPE_FORMAT.md from three best-practice sources (Kenji's
ultra-smash method, Natasha's double-stack, the simple single-patty
version). Founder decisions baked in: nonstick BLOCKED at the gate,
single AND double patty offered as methods, base = 2 burgers, synced-type
infrastructure with song = null (wire music later), pan only.

---

## §1 RECIPE HEADER BLOCK

```json
{
  "id": "smash-burgers",
  "recipe": {
    "title": "Smash Burgers",
    "emoji": "🍔",
    "technique": "Smash & Sear",
    "doneness": "Lacy crispy edges, juicy middle"
  },
  "type": "synced",
  "durationSec": 380,
  "totalTimeMin": 20,
  "timeBreakdown": "~10 min prep (balls, buns, toppings) + 3–5 min pan preheat + ~5 min cooking in rounds",
  "portion": {
    "label": "How many burgers?",
    "unit": "burgers",
    "base": 2,
    "options": [1, 2, 3, 4],
    "perUnit": 0,
    "clamp": [1, 1]
  },
  "servingNote": "Half a pound of beef makes 2 burgers — every burger cooks in its own quick round, so timing never changes.",
  "difficulty": "beginner",
  "equipmentNeeded": ["Cast iron or stainless pan", "Stiff metal spatula", "Parchment paper squares", "Plate for the balls", "Foil to tent finished burgers"],
  "heroImage": "assets/recipes/smash/hero.webp",
  "cookWarning": "The one way to wreck a smash burger is a pan that isn't hot enough — you get a grey steamed patty instead of a crispy brown crust. Preheat like you mean it, and open a window first: real crust makes real smoke.",
  "song": null,
  "bpm": null
}
```

**Song infrastructure note:** authored as `synced` with a full cue ladder
(`at` times across the 380s cook clock) and `song: null` — the exact
shipped state of chicken thighs. The graceful no-music path runs it; wiring
a track later is data-only (add the song block + optionally retime cue
landings). No music work in this implementation.

**cookNeeds / pan gate:** declares `cookNeeds: { pans: ["cast_iron", "stainless"] }`
— NONSTICK GRAYS OUT at the engine gate with honest copy:
> "Not this time — smash burgers need a ripping-hot dry pan, and nonstick
> can't take that heat (the coating breaks down and the crust never forms).
> Cast iron or stainless only for this one."
The stove choice (gas/electric) proceeds normally and drives the preheat
timing below. No fat selector for this recipe — the pan stays DRY (the
80/20 beef brings its own fat; a dry pan is what makes the patty stick and
crust — that stick is the point).

---

## §1b METHODS — Single vs Double (user choice, steak-style methods block)

```json
{
  "methods": [
    {
      "id": "double",
      "label": "Double Stack",
      "emoji": "🍔🍔",
      "technique": "Two thin patties, cheese melted between",
      "default": true,
      "note": "The restaurant move: double the crust, cheese glues the stack. Barely harder — you smash two small balls instead of one."
    },
    {
      "id": "single",
      "label": "Single Patty",
      "emoji": "🍔",
      "technique": "One patty, one smash, done",
      "note": "The simplest possible burger. Same crust, one smash."
    }
  ]
}
```

Same total beef either way (½ lb per 2 burgers): **double** = four 2 oz
balls (2 balls per burger), **single** = two 4 oz balls (1 per burger).
Method overrides: ball-count/size lines in prep, the stack cue (double
only), per-method voice lines. Everything else shared. Per the format
rule: prep strings that differ are authored separately below, never
shared across methods.

---

## §2 SCAN METADATA

```json
{
  "scan": {
    "required": ["ground_beef", "burger_bun", "american_cheese"],
    "optional": ["pickle", "lettuce", "tomato", "onion", "mayonnaise", "yellow_mustard"],
    "staples_assumed": true
  }
}
```

**New vocabulary entries** (add to VOCAB in scan-data.ts — snake_case,
singular, brand-free; aliases cover what a vision model or typing user
produces):

```json
[
  { "id": "ground_beef", "label": "Ground beef", "aliases": ["ground beef", "hamburger meat", "ground chuck", "minced beef", "80/20 beef", "ground hamburger"], "staple": false, "category": "meat_seafood" },
  { "id": "burger_bun", "label": "Burger buns", "aliases": ["hamburger buns", "buns", "brioche buns", "potato rolls", "burger rolls"], "staple": false, "category": "pantry" },
  { "id": "american_cheese", "label": "American cheese", "aliases": ["american cheese slices", "cheese slices", "singles", "sliced cheese"], "staple": false, "category": "dairy_eggs" },
  { "id": "pickle", "label": "Pickles", "aliases": ["dill pickles", "pickle chips", "pickle slices", "gherkins"], "staple": false, "category": "sauces_condiments" },
  { "id": "mayonnaise", "label": "Mayonnaise", "aliases": ["mayo", "hellmann's", "kewpie"], "staple": false, "category": "sauces_condiments" },
  { "id": "yellow_mustard", "label": "Yellow mustard", "aliases": ["mustard", "french's"], "staple": false, "category": "sauces_condiments" }
]
```
(`lettuce`, `tomato`, `onion` already exist per the shipped vocabulary —
implementer verifies ids and reuses; if any is missing, add with the same
pattern. Cheese is REQUIRED, not optional: on the double method it is the
structural glue, and a cheeseburger is the recipe's identity.)

---

## §3 INGREDIENTS BLOCK (display list, base = 2 burgers)

- **½ lb ground beef, 80/20** — the fat ratio is the recipe. Leaner beef
  = dry patty and no self-oiling pan. Equivalence stated: "80/20 means
  80% lean, 20% fat — it's printed on the package."
- **2 burger buns** — any soft bun; brioche or potato rolls if choosing.
- **2 slices American cheese** (double method: it melts between the
  patties and glues the stack; single: it goes on top after the flip).
  Cheddar works; American melts fastest.
- **Salt + black pepper** (staples) — that's the whole seasoning.
- **Butter for the buns** (staple) — toasting is non-negotiable; a cold
  bare bun wastes the burger.
- *Optional toppings:* dill pickle slices, shredded lettuce, thin tomato,
  thin red onion.
- *Optional 30-second sauce:* ⅓ cup mayo + 1 tsp yellow mustard, stirred.
  (Ketchup/mustard straight from the bottle is completely fine — zero
  shopping required.)

**Ingredient rules honored:** no specialty items; everything passes the
zero-shopping filter for a normal fridge + staples toggle.

---

## §4 PREP STEPS (pre-cook, tap-through — the "be ready" doctrine)

Smash burgers cook in about two minutes. EVERYTHING is ready before the
pan gets hot — this is the recipe's discipline and the prep phase teaches
it explicitly.

1. **🔪 Ball the beef (method-split):**
   - *double:* "Divide the beef into 4 equal pieces (~2 oz each — golf-ball
     size). Roll LOOSELY into balls — don't pack them tight. Two balls =
     one burger."
   - *single:* "Divide the beef into 2 equal pieces (~4 oz each). Roll
     LOOSELY into balls — don't pack them tight."
   - Shared line: "Back in the fridge until the second they hit the pan.
     ❄️ Cold beef = juicy burger — the fat stays put until it meets the
     heat. (Room-temp rules are for steak. Not here.)"
   - voice (double): "Divide the beef into four equal golf-ball-sized
     pieces and roll them loosely — don't pack them tight. Then put them
     back in the fridge; cold beef makes a juicier burger."
   - voice (single): "Divide the beef into two equal pieces and roll them
     loosely into balls — don't pack them tight. Then back in the fridge;
     cold beef makes a juicier burger."
2. **🧻 Cut 2 parchment squares** (~6 inches). "This is your smash shield —
   it keeps the beef off the spatula, not off the pan."
3. **🥒 Toppings ready:** slice/shred anything you're using; mix the sauce
   if making it (mayo + mustard, stir, done). "Once the pan's hot there is
   NO time to chop."
4. **🍞 Toast the buns NOW:** butter the cut sides, toast face-down in the
   (not-yet-ripping) pan over medium until golden, set on a plate. "Buns
   first, burgers second — the burger will not wait for the bun."
5. **🪟 Open a window / vent fan ON:** "Real talk: this gets smoky.
   That smoke is the crust forming — it's the good kind. Fan on, window
   open, smoke alarm appeased in advance."
6. **🧰 Stage it:** spatula, parchment squares, cheese unwrapped, buns
   dressed with sauce/pickles/lettuce, foil for finished burgers, beef
   still in the fridge. "Everything within arm's reach. Pit crew mode."

---

## §5 PRE-PHASE — THE PREHEAT (gate)

```json
{
  "prePhase": {
    "steps": [
      { "title": "Pan on HIGH — dry and empty", "heat": "high",
        "body": "🔥 Empty DRY pan on HIGH — no oil, no butter, nothing\n🧲 Dry is correct: the beef must grip the pan to crust\n⏳ Walk away and let it get genuinely hot",
        "voice": "Put your empty, dry pan on high heat. No oil, no butter — the beef needs to grip the bare pan to build its crust. Let it get seriously hot." }
    ],
    "timer": { "label": "Preheating — hotter than feels right", "phaseLabel": "preheat" },
    "timerSec": { "gas": 180, "electric": 300 },
    "gate": {
      "question": "Is the pan ripping hot?",
      "lead": "Flick a couple of water drops in.\n\n✅ Ready: they hiss, skate, and vanish almost instantly — gone in about a second.\n\n❌ Not ready: they sit and bubble like a hot tub. Give it another minute and flick again.\n\n(Keep your hand high — this pan is hotter than anything else you've cooked on.)",
      "voice": "Flick a couple of water drops into the pan. If they hiss, skate, and vanish almost instantly, it's ready. If they sit and bubble, give it another minute.",
      "yesLabel": "Vanished instantly — it's ripping ▸",
      "notYetLabel": "Still bubbling — keep heating",
      "notYetSec": 60
    },
    "transition": { "title": "Beef out of the fridge — go time 🍔", "button": "Start the smash", "emoji": "🍔" },
    "skippable": false
  }
}
```

Electric strictly exceeds gas (300 vs 180) per the standing rule. Gate is
sensory-first two-state with the fix action. `skippable: false` — an
under-heated pan is THE failure mode (see cookWarning); nobody bypasses
this preheat.

---

## §6 CUES (the cook clock — 380s span, authored for the DOUBLE method;
single-method deltas noted inline)

**Batch rhythm:** one burger per round. Round 1 ≈ 0–150s, round 2 ≈
150–300s, assemble ≈ 300–380s. Cue timers are real cook times
(timing-auditor rules; no instruction exceeds its timer).

```json
{
  "cues": [
    { "at": 0, "type": "action", "title": "Balls in — then SMASH", "heat": "high",
      "beginner": "🥩 2 cold balls into the pan, apart from each other\n🧻 Parchment square on top of each\n💪 SMASH straight down with the spatula — hard, until they're thin and wider than the bun\n🤚 Hold the press 10 seconds — lean back, it spits",
      "voice": "Two cold balls into the pan, a few inches apart. Parchment on top, then smash straight down with your spatula — hard. Thinner than feels right, wider than the bun. Hold the press for ten seconds and keep your face back.",
      "haptic": "double",
      "referenceImage": "assets/recipes/smash/cue-smash.webp",
      "methodAlt": { "single": { "beginner": "🥩 1 cold ball per burger into the pan\n🧻 Parchment square on top\n💪 SMASH straight down — hard, thin, wider than the bun\n🤚 Hold 10 seconds — lean back, it spits",
        "voice": "One cold ball into the pan. Parchment on top, then smash straight down — hard. Thinner than feels right, wider than the bun. Hold it ten seconds and keep your face back." } } },

    { "at": 20, "type": "action", "title": "Peel + season", "heat": "high",
      "beginner": "🧻 Peel the parchment off slowly\n🧂 Salt + pepper on the wet tops — be generous\n✋ Then DON'T TOUCH. The pan is doing the work",
      "voice": "Peel the parchment off slowly, season the tops well with salt and pepper — and then leave them completely alone. The pan is doing the work now.",
      "referenceImage": "assets/recipes/smash/cue-season.webp" },

    { "at": 45, "type": "action", "title": "Watch the edges — don't poke", "heat": "high",
      "beginner": "👀 Watch the EDGES: lacy, brown, crispy — maybe tiny holes\n🚫 No poking, no peeking under, no early flips\n⏱️ ~2 minutes total on side one",
      "voice": "Watch the edges. You're waiting for lacy, brown, crispy borders — even little holes are perfect. No poking and no early flips. I know you want to. Don't.",
      "gate": { "kind": "confirm", "doneLabel": "Edges are lacy + brown",
        "notReadyCoach": "Not lacy yet? Give it another 30 seconds — the crust is worth the wait.",
        "doneCoach": "Now the money move: scrape, don't lift.",
        "nudgeSec": 40 },
      "referenceImage": "assets/recipes/smash/cue-lacy-edges.webp" },

    { "at": 150, "type": "action", "title": "SCRAPE and flip", "heat": "high",
      "beginner": "🔪 Spatula flat + LOW, 45° into the pan — scrape UNDER the crust\n🥞 Get ALL the brown — it belongs to the burger, not the pan\n🔄 Flip in one motion",
      "voice": "Get the spatula flat and low, forty-five degrees into the pan, and scrape hard under the patty — all of that brown crust belongs to the burger, not the pan. Then flip it in one motion.",
      "referenceImage": "assets/recipes/smash/cue-scrape-flip.webp" },

    { "at": 165, "type": "action", "title": "Cheese ON — stack — OUT", "heat": "high",
      "beginner": "🧀 Cheese on one patty the SECOND it's flipped\n🍔 Other patty goes on top of the cheese\n⏱️ 30–45 seconds max — side two is fast\n🚚 Slide the stack onto its bun, tent with foil",
      "voice": "Cheese on one patty the second it lands, then stack the other patty right on top of the cheese. Side two only needs thirty seconds — then slide the whole stack onto its bun.",
      "methodAlt": { "single": { "beginner": "🧀 Cheese on the SECOND it's flipped\n⏱️ 30–45 seconds — side two is fast\n🚚 Slide it onto its bun, tent with foil",
        "voice": "Cheese on the second it's flipped. Side two only needs thirty seconds — then slide it straight onto its bun." } },
      "gate": { "kind": "confirm", "doneLabel": "Burger one is on its bun",
        "notReadyCoach": "Cheese not melty? Ten more seconds — the patty heat does it.",
        "doneCoach": "Round two — same moves, and the pan is even better now." },
      "referenceImage": "assets/recipes/smash/cue-cheese-stack.webp" },

    { "at": 180, "type": "action", "title": "Round two — run it back", "heat": "high",
      "beginner": "🥩 Next cold balls in — same spots\n💪 Parchment, SMASH, hold 10\n🧂 Peel + season — you know the drill",
      "voice": "Round two. Next cold balls in, parchment on, smash hard, hold ten seconds, peel and season. You know the drill now — that's the whole skill.",
      "fat": false },

    { "at": 225, "type": "action", "title": "Edges again — patience again", "heat": "high",
      "beginner": "👀 Lacy brown edges = go\n✋ Hands off until then",
      "voice": "Same as before — wait for those lacy brown edges, hands off until you see them.",
      "gate": { "kind": "confirm", "doneLabel": "Lacy — flipping",
        "notReadyCoach": "Thirty more seconds. The crust decides, not the clock.",
        "doneCoach": "Scrape, flip, cheese, stack — bring it home." } },

    { "at": 300, "type": "action", "title": "Scrape, flip, cheese, done", "heat": "off",
      "beginner": "🔄 Scrape + flip\n🧀 Cheese, stack, 30 seconds\n🔴 Burner OFF — slide the pan off the heat\n🚚 Onto the bun",
      "voice": "Scrape, flip, cheese, stack — thirty seconds — and turn the burner off. Slide the pan off the heat. Last burger onto its bun.",
      "referenceImage": "assets/recipes/smash/cue-burner-off.webp" },

    { "at": 320, "type": "temp", "title": "Doneness check — the easy one",
      "beginner": "✅ Smashed-thin patties cook through by the time the crust forms — that's the trick\n👀 Any doubt: peek inside one — no pink jelly-wet middle, just juicy grey-brown\n🧀 Cheese melted = you're there",
      "voice": "Here's the smash burger secret — the patties are so thin they cook through by the time the crust forms. If you're ever unsure, peek inside one: juicy, not wet and pink. Cheese melted means you're there.",
      "gate": { "kind": "confirm", "doneLabel": "Cooked through — building",
        "notReadyCoach": "Middle looks wet? Back in the hot pan for twenty seconds a side — thin patties recover instantly." },
      "referenceImage": "assets/recipes/smash/cue-doneness.webp" },

    { "at": 340, "type": "finish", "title": "Build it — eat it NOW 🍔",
      "beginner": "🥪 Sauce on the bottom bun, pickles, lettuce → patty stack → top bun\n🚫 No resting — the opposite of steak: crispy edges soften as they sit\n📸 One photo, then eat while it's loud",
      "voice": "Build it — sauce on the bottom bun, pickles and lettuce, patty stack, top bun. And no resting: unlike your steak, this one gets worse by the minute. A smash burger this good costs about three bucks — the burger app wanted eighteen. First of many.",
      "referenceImage": "assets/recipes/smash/cue-finish.webp" }
  ]
}
```

**Portion behavior:** 1 burger = round 2 cues auto-skip (implementer wires
the same round-skip pattern the servings machinery supports; if it doesn't
support cue-skipping by portion, the 1-burger path simply ends after
burger one — flag which). 3–4 burgers = the "run it back" cue repeats;
timing never scales (`perUnit: 0`).

**Roast ledger (≤2/phase, never on safety):** "I know you want to. Don't."
(edge-watch); "you know the drill now" (round two); "worse by the minute"
(finish, doubles as real advice). Safety lines (smash spatter, hot pan,
burner-off) carry zero roast. Warmth closes: "First of many."

---

## §7 IMAGE SLOTS (free-lane batch, per the style spec — no generation in
this task; slots wired 404-safe)

| Slot | Depicts | Prompt notes (style spec + AI-image rules) |
|---|---|---|
| hero.webp | Finished double-stack on toasted bun, cut-open crumb OR whole with lacy edges visible, cast iron blurred behind | plated finish shot (listing-continuity rule) |
| cue-smash.webp | Spatula pressing a PAPER-TOWEL-pad-topped ball in a ripping pan, first sizzle (NOT parchment — paper towel is the shield) | RAW BEEF RULE: no garnish, no greenery |
| cue-season.webp | Thin smashed patties, tops glistening, seasoning falling | no garnish |
| cue-lacy-edges.webp | THE reference: lacy brown crispy edges with tiny holes, side-one crust | this is the doneness-of-side-one image — unmistakable |
| cue-scrape-flip.webp | Spatula at 45° scraping under a crusted patty, brown crust coming with it | |
| cue-cheese-stack.webp | Cheese melting between two stacked patties in the pan | |
| cue-burner-off.webp | Pan slid off the burner, dial visible at OFF | off-heat unmistakable (towel-pattern family) |
| cue-doneness.webp | One patty broken open: cooked through, juicy, cheese melted | doneness reference — no pink-wet middle |
| cue-finish.webp | Built burger, crispy edges poking past the bun | |

---

## §8 STOVE-TEST PLAN (founder gate — what I physically verify)

- The preheat gate on my electric coil: does 300s reach water-vanishes-
  instantly? (If my coil needs longer, bump the electric constant.)
- The smash + 10-second hold: spatter reality, parchment release.
- Side-one timing: do lacy edges genuinely arrive ~90–120s in at this
  heat on electric?
- The scrape-flip: does the crust release with the 45° technique on my
  pan (cast iron AND stainless if possible)?
- Cheese-melt window + stack stability.
- The smoke level with fan on — is the §4 warning calibrated right?
- Full double-method cook to the finish card; single method one round.

---
---

# IMPLEMENTATION PROMPT (paste to the build assistant)

```
NEW RECIPE — SMASH BURGERS (docs/recipes/smash-burgers.md attached/committed)

Implement the attached smash-burgers recipe doc per RECIPE_FORMAT.md §11
receipt steps, with these recipe-specific notes:

1. TYPE + MUSIC: synced-type cue ladder with song: null — identical
   infrastructure state to the shipped chicken thighs (graceful no-music
   path, cues on the clock, muffle/duck no-op). NO music work; wiring a
   track later must be data-only.
2. PAN GATE RESTRICTION (new mechanism — check first): the recipe declares
   cookNeeds pans: cast_iron + stainless. Report how the panStoveGate
   currently supports graying out an option; if it doesn't yet, implement
   the minimal cookNeeds → grayed-option support at the ENGINE level (any
   recipe can use it) with the honest copy from the doc. Nonstick must be
   unselectable for this recipe with the explanation visible.
3. METHODS: single vs double per the doc's methods block, steak-pattern
   wiring. methodAlt cues per the doc; separate prep ball-lines per
   method (never shared strings). Double is default.
4. NO FAT SELECTOR: this recipe has no pan-fat choice (dry pan is the
   method). Confirm the fat-selector machinery correctly doesn't render
   for a recipe without fat variants; report if it needs a flag.
5. PORTION: base 2, options [1,2,3,4], perUnit 0, clamp [1,1] — timing
   never scales. Report how round-2 cues behave at 1 burger (skip
   support or natural early end) and at 3–4 (repeat pattern) — implement
   the cleanest supported behavior and say which.
6. SCAN: add the 6 new vocabulary entries (verify lettuce/tomato/onion
   exist; add any missing), AUTHORED_REQUIREMENTS per §2, dual-storage
   note honored (ingredients in cues.js AND the seed). npm run test:match
   + extend the cook-now matrix (ready-on-exact-set / almost-on-minus-one)
   for this recipe.
7. PREHEAT: gas 180 / electric 300 (electric > gas rule), gate
   skippable: false — confirm the pre-phase machinery supports a
   non-skippable preheat; if the eggs pattern hardcodes skippable, add
   the flag.
8. IMAGES: wire all §7 slots 404-safe (emoji fallback). NO generation —
   the free-lane batch comes later; slot names per the doc.
9. VOICE: full clip generation for every screen/spoken pair incl. both
   methods' alt lines, standing rules (−16 LUFS, numbers-as-words,
   am_michael), refresh voice-lines.json, prune orphans, report
   count/size.
10. VERIFIER FAN-OUT: run all seven verifiers on the implemented recipe.
    Expected red-team attention: the smash-spatter moment, the ripping-
    hot-pan safety, the smoke warning, the no-rest finish (it inverts the
    steak rule — confirm the copy makes the WHY clear), lingerer-at-the-
    edge-gate (patty overcooks? thin patties are forgiving — verify the
    coach copy handles a long linger honestly). Fix objective findings;
    list advisories.
11. HEADLESS: full cook click-through — both methods, both stove types,
    portion 1 and 2, every gate, the doneness recovery branch, finish
    card; scan match surfaces the recipe on a ground_beef+buns+cheese
    confirmed set (Cook now) and minus-cheese (Almost, missing exactly
    american_cheese).
12. Version bump + commit + rsync deploy per repo norm. Report order:
    pan-gate mechanism findings → portion round behavior → fan-out
    results → clip count → the stove-test checklist handed back to me.
```
