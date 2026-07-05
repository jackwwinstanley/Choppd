# RECIPE_FORMAT.md — the Choppd recipe authoring contract

**What this is.** The definitive template for authoring a new Choppd recipe.
Fill this format out completely and hand it over — that is the *only*
founder-side work needed. Everything in here maps 1:1 onto structures the
code actually consumes (`mvp/cues.js`, `server/src/scan-data.ts`, the
pre-generated TTS pipeline, the image slots). Nothing in this doc is
aspirational; every field name below exists in the shipped code today.

**The two recipe types:**

| | **Music-synced** (`synced`) | **Guided** (`guided`) |
|---|---|---|
| What it is | Hand-authored cook where cues land on song moments | Tap-through step list, per-step timing guidance, no music sync |
| Lives in | `mvp/cues.js` (a `window.RECIPE_NAME` object, added to `window.EXPERIENCES`) + a seed row in `server/src/db.ts` (`MUSIC_COOKS`) | The `recipes` DB table (`data_json`), same shape the TheMealDB importer produces |
| Cook engine | `screens.cook` (cook clock, muffle, checkpoints, voice control) | `screens.guidedCook` (tap-through) |
| Sections of this doc that apply | ALL | 1, 2, 3, 4 (steps subset), 6 (no per-cue clips today), 7, 8, 10, 11 — **omit** §5 (music) and the pre-phase/gate machinery unless noted |

New flagship recipes are `synced`. `guided` is the long-tail catalog format.

---

## 1. RECIPE HEADER BLOCK

Every recipe starts with this block. Field names are the literal code fields.

| Field | Type | Rules | Example |
|---|---|---|---|
| `id` | string | kebab-case slug, permanent (it keys telemetry, bookmarks, scan launches — never rename). Pattern: `<song-or-technique>-<dish>` or plain dish | `"freebird-medium-rare-steak"`, `"scrambled-eggs"` |
| `recipe.title` | string | Display name, title-case, ≤ 28 chars (card layouts) | `"Fluffy Scrambled Eggs"` |
| `recipe.emoji` | string | One emoji, used on cards/tiles when no photo | `"🍳"` |
| `recipe.technique` | string | One-or-two-word method shown as a pill | `"Soft Scramble"`, `"Pan Sear"` |
| `recipe.doneness` | string | The target, in plain words | `"Medium-rare"`, `"Soft & creamy"` |
| type | `synced` \| `guided` | Determines which engine runs it | `synced` |
| `durationSec` | number | **Synced only.** The cook-clock length — the span the cues are authored across. This is NOT the user-facing time | `210` |
| `totalTimeMin` | number | The honest end-to-end estimate users see (`expMins()` prefers it over `durationSec`). **PAD RULE (learned the hard way):** include preheats, rests, and any hard-boil/come-to-temp step — steak is `17` (8 cook + 9 grill preheat), pasta is `28` (5 boil + 10 simmer + 6 music + rest), NOT the song length | `17` |
| `timeBreakdown` | string (optional) | Shown next to the total when the split isn't obvious | `"~5 min hard boil + ~10 min simmer + 6 min music finish (plus a short rest)"` |
| `portion` | object | Servings control: `{ label, unit, base, options, perUnit, clamp }`. `perUnit`/`clamp` control whether timing scales — for simultaneous cooking (steaks in one pan) use `perUnit: 0, clamp: [1,1]` so cue timing NEVER scales; only ingredient amounts do | `{ label: "How many eggs?", unit: "eggs", base: 3, options: [2,3,4,6], perUnit: 12, clamp: [0.8,1.6] }` |
| `servingNote` | string (optional) | One line under the servings picker | `"The weight in oz is printed on the side of your box…"` |
| `difficulty` | `beginner` \| `intermediate` \| `advanced` | Seed-row field (drives the card pill) | `beginner` |
| `equipmentNeeded` | string[] | The "You'll need" list. Plain nouns, no emoji (established). Method-specific kits allowed (see §4 methods) | `["Nonstick pan", "Whisk or fork", "Small bowl", "Rubber spatula"]` |
| `heroImage` | string | Beauty shot path (browse card + prep overview). **Use the plated finish shot** so listing → detail → in-cook imagery is continuous (the pasta rule) | `"assets/recipes/eggs/hero.jpg"` |
| `cookWarning` | string (optional) | THE one mistake, shown prominently pre-cook | `"The one surefire way to wreck scrambled eggs is overcooking them…"` |
| `song` | object | **Synced only** — see §5 | |
| `bpm` | number | **Synced only** — beat grid for musical seam alignment | `129` |

**Methods (optional):** a recipe may offer alternative techniques
(`methods: [{ id, label, emoji, technique, ... }]`, e.g. steak pan vs grill).
Each method may override `cues`, `prep`/`prepSteps`, `equipmentNeeded`,
`ingredients`, `optionalGroups`; anything omitted falls back to the recipe's
top-level value. **If methods differ in prep style (preheat-driven vs
pan-driven), author separate content — never share strings across methods**
(the grill-borrowed-pan-copy lesson).

---

## 2. SCAN METADATA (required for every new recipe)

The fridge scan matches recipes by canonical ingredient ids from
`server/src/scan-data.ts`. Every new recipe ships with:

```json
{
  "scan": {
    "required": ["egg", "milk"],
    "optional": [],
    "staples_assumed": true
  }
}
```

- `required` — canonical ids the cook literally cannot proceed without.
- `optional` — ids that enhance but aren't needed (cowboy butter's garlic).
- `staples_assumed: true` — the recipe additionally uses the staple set
  (`salt`, `black_pepper`, `cooking_oil`, `butter`, `water`); these are
  auto-satisfied by the user's "I've got the basics" toggle and must NOT be
  listed in `required`.

**Vocabulary rule:** if an ingredient isn't in the vocabulary yet, the
author adds an entry *as part of the recipe*, using this mini-template
(goes into `VOCAB` in `scan-data.ts` on implementation):

```json
{ "id": "leek", "label": "Leek", "aliases": ["leeks", "baby leeks"], "staple": false }
```

Vocabulary id rules: snake_case, singular, brand-free. Aliases should cover
plurals and the common names a vision model or a typing user would produce.

> ⚠️ **Known wart (do not template around it silently):** synced recipes'
> display-ingredient lists live client-side in `cues.js`, while their scan
> requirements live server-side in `AUTHORED_REQUIREMENTS`
> (`scan-data.ts`) — two places that can drift. Guided recipes don't have
> this problem (one `data_json`). **Proposed unification:** a build step
> that exports each authored recipe's base ingredient list from `cues.js`
> into the `MUSIC_COOKS` seed's `data_json`, letting the server derive
> requirements the same way it does for imported recipes (with the curated
> required/optional split kept as an override). Not done yet because
> several authored ingredient lists are *dynamic* (pasta scales with
> servings/liquid, eggs swap the fat) — the export needs to pick the base
> configuration. Until then: **when you author or change a synced recipe's
> ingredients, update both places** (§11 receipt step 3 covers this).

---

## 3. INGREDIENTS BLOCK

The display list (what renders on the prep overview / detail screen). Code
shape (`ingredients` array):

```json
{ "name": "butter", "label": "Butter — for finishing", "measure": "1 tbsp",
  "optional": true, "defaultOff": false, "noInline": false }
```

- `name` — lowercase, singular-ish; it is the lookup key for nutrition and
  optional-toggles, so keep it stable. Display capitalization is automatic.
- `label` — optional prettier display name (falls back to `name`).
- `measure` — free text with the amount; the engine injects it into cue
  copy (`injectAmounts`: "add the butter" → "add the butter (1 tbsp)"), so
  don't repeat amounts in cue text. `noInline: true` opts an ingredient out
  of injection (e.g. `"steak" — "1 (1-inch+)"` reads badly inline).
- `optional: true` renders a checkbox; unchecking drops it from the recipe
  AND from any cue tagged with a matching `opt:` id. `defaultOff: true` =
  a "level it up" extra that starts unchecked (cowboy butter).

**Authoring rules (established through real fixes):**

1. **Equivalences wherever a unit is ambiguous** — state them in the
   ingredient measure AND repeat them in the pre-phase step where the item
   is first prepped: `"1 tsp bouillon = 1 cube"` appears in both places.
2. **Alternatives are first-class:** if a fat or liquid can vary (eggs:
   butter/oils/spray; pasta: broth/water+butter/bouillon), list every
   variant the picker will offer, with per-variant measures. **TTS
   implication:** every variant that changes spoken copy needs its own
   exact voice line (clips are content-hash keyed — "add the butter" and
   "add the oil" are different files). Supply the full line per variant.
3. Optional finish ingredients that appear only in the finish cue get
   `optional: true` and conditional cue copy (see §6 — the grill-butter
   pattern strips the line when unchecked).

---

## 4. PHASE / STEP / CUE STRUCTURE (the heart)

A synced recipe has up to four layers, in cook order:

```
PREP WIZARD  →  PRE-PHASE (optional, silent)  →  MUSIC PHASE (cues)  →  FINISH
(prepSteps)     (prePhase: steps→timer→gate→drop)  (cues[] on the clock)   (the finish cue)
```

A guided recipe has one layer: `steps[]` (tap-through with per-step timing).

### 4a. PREP WIZARD (`prepSteps[]`) — before anything is hot

One screen per step: `{ title, instructions, techniqueGuide: [bullets],
equipmentNeeded? }`. Measuring, mincing, grating, patting dry, tool
staging. NO stove work here — stove work belongs in the pre-phase or cues.

### 4b. PRE-PHASE (`prePhase`) — stove work before the music

Use a pre-phase when real cooking must happen before the song earns its
entrance (pasta's simmer, eggs' preheat, grill's 9-minute head start).

```json
{
  "title": "Preheat the pan",
  "intro": "one-time context line shown on step 1",
  "startLabel": "Start preheating ⏱",
  "steps": [ { "title": "", "heat": "high", "body": "", "voice": "",
               "referenceImage": "", "timerSeconds": 120, "timerNote": "",
               "timerAlert": { "atSec": 30, "text": "" },
               "simmerPicker": false, "startsBgTimer": false } ],
  "timer": { "sec": 600, "label": "", "note": "", "phaseLabel": "preheat",
             "earlyAfterSec": 420, "earlyLabel": "It's ready ▸",
             "heat": "medium-low", "stirEvery": 120, "tips": ["rotating dead-time tips"] },
  "gate": { "question": "", "lead": "", "voice": "", "yesLabel": "", 
            "notYetLabel": "", "notYetSec": 120, "notYetTimerLabel": "" },
  "transition": { "title": "", "body": "", "voice": "", "button": "Play", "emoji": "🔥" },
  "skippable": false
}
```

- **Step timers** (`timerSeconds` + `timerNote`) are advisory inline
  timers; `timerAlert` fires a mid-timer nudge ("smell that? liquid in
  NOW").
- **`startsBgTimer: true`** — confirming this step starts the main phase
  timer in the *background* while the remaining steps run (the grill
  preheat pattern: light it FIRST, prep during). The phase-timer screen
  then picks up whatever time is left.
- **`simmerPicker: true`** — the box-time pattern. Use it whenever the real
  duration comes from packaging (pasta box time). The user picks from
  `[8, 10, 12, 15]` minutes; the step copy must say the box is the source
  of truth.
- **The main `timer`** is the long wait (simmer/preheat), full-screen with
  rotating `tips` (make dead time useful) and optional `stirEvery`
  reminders. `earlyAfterSec` reveals an early-exit button.
- **The `gate`** is the sensory doneness check that ends the pre-phase —
  see checkpoint copy rules below. The gate `lead` supports multi-line
  copy (blank lines render as breaks — the ✅/❌ two-state format).
- **The `transition`** is "the drop": the tap that starts the song.

### 4c. MUSIC-PHASE CUES (`cues[]`)

```json
{ "at": 55, "type": "action", "title": "Let them set — don't stir",
  "heat": "medium-high",
  "body": "terse experienced-cook copy",
  "beginner": "reassuring copy that explains WHY (shown in beginner mode)",
  "voice": "the spoken line — see §6",
  "haptic": "tap",
  "referenceImage": "assets/recipes/eggs/cue-set.png",
  "warning": "optional prominent don't-ruin-it line",
  "fadeTips": ["optional rotating reminder under the instruction"],
  "opt": "optionalGroupId — cue drops if the group is deselected",
  "gate": { "kind": "confirm", "doneLabel": "They've set — solid white",
            "notReadyCoach": "", "checkCoach": "", "doneCoach": "", "nudgeSec": 25 },
  "noCheckpoint": false,
  "custom": { "title": "", "body": "", "beginner": "", "voice": "" } }
```

- `at` — seconds on the **cook clock** (== authored song position).
- `type` ∈ `prep | action | flip | baste | rest | temp | tip | finish` —
  drives the colored pill and (for `finish`) the end-of-cook behavior
  (music hard-stops the instant the finish cue fires; engine-global).
- `haptic` ∈ `null | "tap" | "double" | "strong"`.
- `custom` — the variant shown when the user plays their own Spotify
  track: NO song references allowed in custom copy ("the solo kicks in" →
  "home stretch").
- **Every non-first, non-finish cue is a checkpoint** (pauses the cook
  clock, muffles the music) unless `noCheckpoint: true`. Cues with a
  `gate` ALWAYS wait, even if the user disabled generic checkpoints.

### COPY RULES (with real GOOD/BAD from our fixes)

**Sensory-first: describe what the user SEES; name the action for the
not-ready state.**

> ✅ GOOD (the water-drop fix): *"the drops ball up and dance around the
> pan like tiny marbles, then disappear. That's the sign."* / not ready:
> *"the drops just sit there and fizzle flat. Give it another 30–60
> seconds and flick again."*
>
> ❌ BAD (what it replaced): *"Hot enough = they sizzle, skitter across
> the surface, and vanish in a second or two."* — three verbs, no picture,
> no fix direction for the failing state.

**A cue's instruction must match what THIS cue's confirm actually does.**

> ❌ BAD (the eggs cue-3 bug): *"…solid white. THAT'S your signal to start
> stirring"* — but stirring belonged to the NEXT cue; this cue's button
> only confirmed "they've set".
> ✅ GOOD: *"That white base is what you're waiting for — once you see it,
> tap continue."*

**Thin/thick (and any two-state diagnosis): define both states in plain
sensory language AND give the correct fix direction for each.**

> ✅ GOOD (pasta): *"Too THIN — watery, soupy, liquid pooling around the
> pasta? Simmer uncovered 1–2 min; do NOT add water. Too THICK —
> paste-like, gluey, no loose liquid left? Loosen with a splash more
> broth, 1–2 tbsp at a time."*

**No redundant "wait N seconds" prose where the app already shows a timer
or the clock carries the wait.** The timer UI is the countdown; copy says
what to look for, not how long to stare.

### HEAT — every heat-touching step declares it

Declare heat with the app's vocabulary (renders as a badge with the exact
dial per stove; **never put dial numbers in copy** — the badge localizes
gas vs electric):

| `heat` value | Badge | Gas dial | Electric dial |
|---|---|---|---|
| `high` | 🔥🔥🔥 HIGH HEAT | full flame | 8–9 / 10 |
| `medium-high` | 🔥🔥 MED-HIGH | just under full | 6–7 / 10 |
| `medium` | 🔥🔥 MEDIUM | middle flame | 5 / 10 |
| `medium-low` | 🔥 MED-LOW | low-middle flame | 3–4 / 10 |
| `low` | 🔥 LOW | low flame | 2 / 10 |
| `off` | 🚫 OFF HEAT | burner off | burner off |

Where gas and electric need different *timing* (preheats!), author both —
the eggs pattern: gas 90s / electric 240s preheat, selected by the user's
stove type.

> **📦 ELECTRIC-STOVE CHECKLIST (hard-won — run for every recipe):**
> - [ ] Every preheat has an electric duration ≥ the gas one (electric lag
>       is real; eggs needed 240s vs 90s).
> - [ ] Every "take it off the heat" is EXPLICIT and visually
>       unmistakable: *"physically slide it off the burner onto the
>       counter or a folded towel — turning the dial off isn't enough; the
>       burner stays hot for minutes."* Never just "remove from heat."
> - [ ] Never author a gate that a low electric setting can't physically
>       satisfy (the egg 2/10 stall: a doneness gate at LOW on electric
>       can take forever — either raise the floor or give a
>       back-on-heat escape in `notReadyCoach`).
> - [ ] Max-heat garlic (or anything that scorches) must be followed by
>       liquid within ~45 s — author the `timerAlert` nudge (the pasta
>       "smell that? liquid in NOW" pattern).

### TIMERS

- **Inline step timers** (`timerSeconds`): fixed, advisory, author-set.
- **User-input timers** (`simmerPicker`): whenever packaging is the source
  of truth (box cook time). Don't guess a fixed number for those.
- **Rests are first-class steps** — a `rest`-type cue (or the finish cue
  carrying the rest, grill-style) with the don't-cut-early `warning`. Rest
  time counts toward `totalTimeMin`.

### CHECKPOINTS

Place a checkpoint (gate) when: (a) doneness/safety must be confirmed
(temp checks, flip-readiness), or (b) user pace genuinely varies. The
engine handles the mechanics: music muffles (lowpass + gain), the cook
clock parks, continue re-syncs the song and lifts the muffle after the
seek lands.

Checkpoint copy must contain: the sensory check (what does done look
like), the confirm label in the user's voice (`"I flipped it"`,
`"It's there"`), a `notReadyCoach` with the fix action, and a `doneCoach`
handoff line. **Voice-control note:** the checkpoint's spoken lines are
what the mic's false-trigger guard runs against — the matcher only fires
on exact short commands, but still avoid writing spoken lines that END in
a bare command word ("…so continue" is worse than "…tap continue when
you're ready").

### 4d. GUIDED-RECIPE STEPS (the subset)

Guided steps in `data_json` are:
`{ "text", "timing": {"minSec","typicalSec","maxSec"}, "guide": "~2 min", "active": true,
   "doneness"?: true, "safetyCritical"?: true, "gate"?: { "kind":"confirm", "doneLabel", "prompt", "safeTempF", "safeTempC", "notReadyCoach" } }`
Author the same copy rules; timing fields are honest ranges (the engine
buffers +15%). Safety gates carry internal temps in °F AND °C. Everything
in §5 and the pre-phase machinery is **omitted** for guided recipes.

---

## 5. MUSIC SYNC BLOCK (synced recipes only)

```json
{
  "song": { "title": "Free Bird", "artist": "Lynyrd Skynyrd",
            "spotifyQuery": "Free Bird Lynyrd Skynyrd",
            "youtubeId": "0LwcvjNJTuM",
            "videoId": null,
            "audioFile": "audio/steak-music.mp3",
            "audioCredit": "Music: Alex-Productions (royalty-free)" },
  "bpm": 63,
  "durationSec": 480
}
```

- `audioFile` — the bundled royalty-free stand-in track (the licensed
  Spotify path is separate). It must be **at least `durationSec` long**
  (the chicken track is 4s short of its timeline — don't repeat that).
- `youtubeId` = the free-tier official-video embed; `videoId` = reserved
  for the future YouTube music backend (leave `null`).
- **What the author supplies:** each cue's `at` = the *intended landing
  moment* in the song (the flip on the drum fill, the finish on the
  outro). Use `bpm` to place cues on bar boundaries where it matters.
- **What the engine derives (do NOT author around it):** checkpoint drift
  and re-sync — while the user parks at a checkpoint the song keeps
  playing muffled, and on continue the engine seeks back to the authored
  moment under the muffle. Author moments as if the user were perfectly
  on pace.
- **Cue density rules:** ≥ 20s between cues (each is a checkpoint tap);
  never two gates back-to-back without an action between; the first cue
  is at `0` (auto-fires, no checkpoint), the finish cue is last and never
  waits. Rough budget: a 4-minute song fits 7–9 cues.
- **Guided recipes:** omit this entire block — no song object, no `at`
  values, no `bpm`; steps advance by tap only.

---

## 6. VOICE / TTS BLOCK

Every cue and pre-phase step has a `voice` field — the spoken line,
SEPARATE from screen text. Constraints (all enforced by how the pipeline
works):

- **One sentence-ish, ≤ ~25 words**, written for `am_michael`'s pacing —
  read it aloud; if you run out of breath, split the screen copy instead.
- **No emoji, no ALL-CAPS** (the model reads them literally/oddly).
- **No heat-dial speech** — the badge shows the dial; voice says the
  action ("crank the heat all the way up"), never "set it to 8".
- Numbers that matter get spelled out the way you'd say them
  ("a hundred and twenty-five", "thirty to forty-five seconds").
- **Exact-match rule:** clips are content-hash keyed. ANY text change =
  a new clip; a stale line = silence. Every fat/liquid/method variant
  that alters the words needs its own complete line (the eggs fat
  variants: one line per fat). Conditional copy (grill's optional butter)
  needs both the with- and without- variants supplied.
- Gate coaches (`notReadyCoach`, `checkCoach`, `doneCoach`) and pre-phase
  `gate.voice`/`transition.voice` are also spoken lines — same rules.

**Pre-generation (implementation step, but know it exists):** clips are
generated by `tools/voicegen/gen.mjs` from the app's own
`window.__voiceLines()` collector — a new recipe means new clips
(typically 15–30, ~50–100 KB each); the implementer reports count/size
and prunes orphans against the manifest.

---

## 7. IMAGE SLOTS

Every pre-phase step and cue has an optional `referenceImage` slot
(404-safe: missing image = text-only, nothing breaks). Supply one per
*visually distinct* moment.

**Naming convention** (per-recipe folder under `mvp/assets/recipes/`):
`<recipe>/<phase-or-method>-c<N>.webp` — the pasta pattern
(`pasta/onepot-p1-c1.webp`, `pasta/onepot-p2-c8.webp`) is the standard for
new recipes; legacy sets (`eggs/cue-N.png`, `steak/steakcue3grill.png`)
predate it. Format: **1200px longest edge**, webp preferred (~60 KB) or
JPEG/PNG. Hero: `<recipe>/hero.jpg` = the plated finish shot.

**Style spec (the reusable appetizing look):** cast-iron / carbon-steel
pan or rustic pot · warm wood countertop · golden-hour side light · glossy
food-magazine finish · shallow depth of field · consistent kitchen +
cookware across every image in one recipe (they read as a filmstrip).

**AI-image rules (from real re-shoots):**
- 🚫 No garnish on raw proteins (no rosemary on raw steak).
- "Off the heat" images must be visually unmistakable — the **pan on a
  folded towel on the counter** pattern, burner visible and clearly
  unoccupied.
- Never depict cutting/plating in a step that forbids it yet (no sliced
  steak in a resting shot — no cut-early ambiguity).
- The doneness-gate image is load-bearing: it IS "this is what done looks
  like." Shoot the exact state the gate copy describes.

**Reuse policy:** consecutive cues showing the same physical state may
share an image (steak's temp-check reuses the off-heat frame); a cue
whose whole point is a state *change* must not.

---

## 8. CONSISTENCY / RESCUE GUIDANCE (standard block)

Any recipe with sauce or doneness variance ships this block:

- **Too thin / too thick** — both states defined in sensory language +
  correct fix direction each way (§4 copy rules; pasta is the reference).
  Include the escalation (cornstarch slurry) where reducing may not be
  enough on electric.
- **Doneness check** — the sensory check plus the instrument check
  (internal temp °F/°C) plus the no-instrument fallback ("soft with a
  little spring, like the base of your thumb").
- **The rest warning** (any rested protein): the don't-cut-early pattern —
  `warning: "Cut in early and the juices run out onto the plate — grey,
  dry steak. Give it the full 5 minutes."` — attached to the cue that
  carries the rest.

---

## 9. WORKED EXAMPLE — Fluffy Scrambled Eggs (post-fixes, annotated)

The real shipped recipe, abridged where repetitive. `//` comments explain WHY.

```jsonc
{
  "id": "scrambled-eggs",                       // permanent slug — keys telemetry + scan launches
  "type": "synced",
  "recipe": { "title": "Fluffy Scrambled Eggs", "technique": "Soft Scramble",
              "doneness": "Soft & creamy", "emoji": "🍳" },
  "song": { "title": "Here Comes the Sun", "artist": "The Beatles",
            "spotifyQuery": "Here Comes the Sun The Beatles",
            "youtubeId": "KQetemT1sWc", "videoId": null,
            "audioFile": "audio/eggs-music.mp3",
            "audioCredit": "Music: SigmaMusicArt (royalty-free)" },
  "bpm": 129,
  "durationSec": 210,                           // the cue clock: a ~3.5 min cook
  "totalTimeMin": 8,                            // PAD RULE: prep + preheat + cook. Electric shows 11 (preheat lag)
  "heroImage": "assets/recipes/eggs/hero.jpg",
  "cookWarning": "The one surefire way to wreck scrambled eggs is overcooking them. Take them off while they still look a little underdone…",
                                                // THE one mistake, up front, before anything is hot
  "equipmentNeeded": ["Nonstick pan", "Whisk or fork", "Small bowl", "Rubber spatula"],

  "scan": { "required": ["egg", "milk"], "optional": [], "staples_assumed": true },
                                                // butter is the DEFAULT FAT but fats are swappable → staples cover it

  "portion": { "label": "How many eggs?", "unit": "eggs", "base": 3, "options": [2,3,4,6] },
  "ingredients": [
    { "name": "eggs", "measure": "3", "noInline": true },
    { "name": "butter", "measure": "1 tbsp" },  // swappable: vegetable/olive/canola oil, spray —
                                                // EACH variant has its own voice lines (exact-match TTS)
    { "name": "milk", "measure": "1 tbsp" },
    { "name": "salt", "measure": "1 pinch" },
    { "name": "pepper", "label": "Black pepper", "measure": "to taste", "optional": true }
                                                // listed because the finish cue seasons with it — the list
                                                // must cover everything any cue mentions
  ],

  "prePhase": {                                 // stove work before the song: the preheat
    "title": "Preheat the pan",
    "intro": "Eggs cook fast, so we get the pan hot first…",
    "steps": [
      { "title": "Pan on HIGH — empty", "heat": "high",
        "body": "Put your empty pan on the burner and turn it to HIGH. Nothing in it yet…",
        "voice": "Put your empty pan on the burner and turn it all the way up to high. Nothing in it yet — no butter, no oil, no eggs. Just let it get hot." }
    ],
    "timer": { "label": "Preheating the pan", "phaseLabel": "preheat" },
                                                // sec is STOVE-DEPENDENT: gas 90 / electric 240
                                                // (the electric-lag rule — never one number for both)
    "gate": {
      "question": "Is the pan hot enough?",
      "lead": "Wet your fingertips and flick a few water drops onto the pan.\n\n✅ Ready: the drops ball up and dance around the pan like tiny marbles, then disappear. That's the sign.\n\n❌ Not ready: the drops just sit there and fizzle flat. Give it another 30–60 seconds and flick again.\n\n(Keep your hand back — the pan is hot.)",
                                                // SENSORY-FIRST two-state copy: what you SEE for ready,
                                                // what you SEE + the FIX ACTION for not-ready
      "voice": "Flick a few drops of water on the pan — it's ready when the drops ball up and dance around like tiny marbles. If they just sit and fizzle, give it another thirty seconds.",
                                                // condensed ONE-sentence spoken variant, no emoji
      "yesLabel": "It sizzled — pan's ready ▸", "notYetLabel": "Not yet — heat a little longer",
      "notYetSec": 45 },
    "transition": { "title": "Drop the heat — let's cook 🍳", "button": "Start cooking", "emoji": "🍳" },
    "skippable": true                           // pan already hot? let them bypass the wait
  },

  "cues": [
    { "at": 0, "type": "action", "title": "Drop to medium-high + butter in", "heat": "medium-high",
      "body": "Bring the heat down to MEDIUM-HIGH. Add the butter and let it melt and coat the pan.",
      "voice": "Bring the heat down to medium-high, then add the butter and let it melt.",
      "haptic": "double" },                     // first cue: at 0, auto-fires, never a checkpoint

    { "at": 55, "type": "action", "title": "Let them set — don't stir", "heat": "medium-high",
      "body": "Wait — don't stir. Let the bottom and edges turn from clear to solid white, then tap continue.",
      "beginner": "Hands off — I know it feels like nothing's happening. It is… That white base is what you're waiting for — once you see it, tap continue.",
                                                // THE FIXED CUE: the signal points at what THIS cue's
                                                // confirm does (continue), NOT at the next cue's action (stirring)
      "voice": "Let them sit — no stirring. Once the bottom and edges turn solid white, tap continue.",
      "gate": { "kind": "confirm", "doneLabel": "They've set — solid white",
                "notReadyCoach": "Not white yet? Give them a few more seconds on medium-high — still no stirring.",
                "doneCoach": "Perfect — now drop the heat and start the figure-8.",
                                                // doneCoach = the HANDOFF into the next cue; it may
                                                // reference the next action because it fires on continue
                "nudgeSec": 25 } },

    { "at": 170, "type": "action", "title": "Take them off early",
      "beginner": "Take the pan completely off the heat now — physically slide it off the burner onto the counter or a folded towel. Turning the dial off isn't enough; the burner stays hot for minutes…",
                                                // ELECTRIC RULE: off-heat is explicit + physical,
                                                // and the image shows the towel-on-counter pattern
      "voice": "Take the pan off the heat now — slide it off the burner, don't just turn the dial off. One more gentle fold.",
      "referenceImage": "assets/recipes/eggs/cue-5.png" },

    { "at": 185, "type": "temp", "title": "Just set?",
      "referenceImage": "assets/recipes/eggs/cue-6.png",
                                                // the doneness-gate image IS "what done looks like"
      "body": "Poke at them. Soft, creamy, still a little glossy, no runny raw egg in the middle? Pull them…",
      "gate": { "kind": "confirm", "doneLabel": "Just set",
                "notReadyCoach": "No rush — back on low for a few seconds, then check again…" } },
                                                // escape hatch: back-ON-heat action, satisfiable on electric

    { "at": 205, "type": "finish", "title": "Season & plate 🍳",
      "body": "Salt, a little pepper if you want it, plate up, and eat now while they're soft.",
      "voice": "Season with salt and pepper, plate up, and eat while they're soft. You just made scrambled eggs from scratch — nice work." }
                                                // finish cue: music hard-stops here (engine-global),
                                                // the payoff line lives in the voice
  ]
}
```

---

## 10. AUTHORING CHECKLIST (run before handoff)

- [ ] Every heat-touching step declares a `heat` level; every preheat has
      **both** gas and electric timing; the electric checklist (§4) passes.
- [ ] Every cue and gate coach has screen text **and** a spoken line;
      every fat/liquid/method variant has its own complete voice line.
- [ ] Every ingredient maps to a vocabulary id (or ships a new vocabulary
      entry); `scan.required`/`optional` filled; staples not listed.
- [ ] Equivalences stated at the ingredient AND at first prep.
- [ ] Image slots listed per step with prompts following the style spec;
      off-heat and doneness images obey the AI-image rules.
- [ ] Timers sourced: fixed numbers justified, box-time steps use the
      picker, rests are steps and counted in `totalTimeMin`.
- [ ] **The zero-shopping filter:** does this recipe beat delivery on
      effort for someone who scans a normal fridge? (If it needs 4
      specialty items, it's catalog filler, not a flagship.)
- [ ] Stove-test plan noted: which steps I will physically verify on my
      stove (minimum: every gate, every preheat, the rescue block).

## 11. HANDOFF FORMAT

**Deliver: one markdown file per recipe** — `docs/recipes/<slug>.md` —
following this template's section order, with the machine-readable parts
as fenced ` ```json ` blocks exactly like §9 (comments allowed; they're
stripped on implementation). One file = one recipe = one review unit.
Image files (or generation prompts) referenced by their slot names;
audio stand-in track attached or linked with its credit line.

**On receipt, the implementer (me) does, in order:**
1. Transcribe the JSON blocks into `mvp/cues.js` (+ `window.EXPERIENCES`)
   and the `MUSIC_COOKS` seed in `server/src/db.ts` — or into a `recipes`
   row's `data_json` for guided recipes.
2. Add/extend the vocabulary + `AUTHORED_REQUIREMENTS` in
   `server/src/scan-data.ts`; run `npm run test:match`.
3. Keep the §2 dual-storage note honest: ingredients updated in both
   places (until the unification lands).
4. Place image assets per the naming convention (1200px, webp), wire
   `referenceImage` slots, verify 404-safety.
5. Regenerate TTS: refresh `voice-lines.json` from `__voiceLines()`, run
   `tools/voicegen/gen.mjs`, prune orphans, report clip count/size.
6. Headless verification: full cook click-through (both stove types,
   every variant), gates, timers, scan match includes the new recipe.
7. Version bumps + commit + rsync deploy per repo norm; on-device
   checklist handed back for the founder's stove test.
