# Scrambled Eggs — Full Cue & Copy Audit

Every piece of user-facing text in the **Fluffy Scrambled Eggs** recipe, by phase and step, exactly as it appears in the code. Images are embedded inline where a cue has one.

- **Content source:** `mvp/cues.js` → `window.SCRAMBLED_EGGS` (recipe, prep, prePhase, cues)
- **Generated/selection-aware parts:** `mvp/app.js` → `eggsControlsHTML`, `eggsPrepSteps`, `eggsPrePhase`, `eggsCues`, `EGG_STOVE`, `EGG_FATS`
- **Images:** `mvp/assets/recipes/eggs/` (`cue-0.png` … `cue-7.png`, `hero.jpg`)
- **Reflects:** brand-voice rewrite pass 1 (EGGS_VOICE_REWRITE_SPEC) + pass 2 (V2: stove-aware time, accuracy fixes, curated personality).
- Generated: 2026-06-30 (rev 3)

---

## Recipe overview (metadata)

| Field | Value |
|---|---|
| Title | **Fluffy Scrambled Eggs** 🍳 |
| Technique | Soft Scramble |
| Doneness | Soft & creamy |
| Cook song | **"Here Comes the Sun"** — The Beatles (`audio/eggs-music.mp3`) |
| Audio credit | Music: SigmaMusicArt (royalty-free) |
| **Total time (shown)** | **stove-aware** — Gas: ~8 min ("~3 min prep + preheat, ~5 min cook") · Electric: ~11 min ("~5–6 min prep + preheat, ~5 min cook"). Updates live with the stove selector. |
| Cook clock (Phase 2) | 210 s · bpm 129 (song-synced; pauses at every checkpoint) |
| Hero image | `assets/recipes/eggs/hero.jpg` |

**Hero image:**

![eggs hero](mvp/assets/recipes/eggs/hero.jpg)

**Cook warning** (shown on the prep overview, before the cook — the #1 beginner mistake; the bold lead is rendered by `app.js`):
> ⚠️ **Pull them early.** The one surefire way to wreck scrambled eggs is overcooking them. Take them off while they still look a little underdone — they keep cooking on the way to the plate. Underdone is the target here, not a mistake.

**Ingredients** (all required; amounts scale with the egg count):

| Ingredient | Amount (base = 3 eggs) | Notes |
|---|---|---|
| eggs | 3 | portion-selectable: 2 / 3 / 4 / 6 |
| butter | 1 tbsp | (the *fat* — selectable, see below) |
| milk | 1 tbsp | beaten into the bowl |
| salt | 1 pinch | beaten into the bowl |

**Equipment needed:** Nonstick pan · Whisk or fork · Small bowl · Rubber spatula

**Portion selector:** "How many eggs?" — options 2 / 3 / 4 / 6 (base 3). Amounts scale linearly; timing stretches gently (`perUnit 0.08`, clamp 0.85–1.3).

---

## Prep-screen selectors (overview)

Two eggs-specific selectors appear on the prep overview (`eggsControlsHTML`):

### Your stove 🔥 Gas / ♨️ Electric
> *Electric burners heat slower, so we give the pan longer to preheat. Not your fault — just physics.*

Drives the preheat-timer length **and** the shown total time:

| Stove | Preheat timer | "Test it now" early-exit appears after | Shown total time |
|---|---|---|---|
| Gas | **90 s** | 45 s | ~8 min |
| Electric | **240 s** | 120 s | ~11 min |

### Fat for the pan
> *Butter tastes best — but oil, spray, whatever you've got, it all works. Goes in the pan, not the bowl.*

| Option | Ingredient label | Amount |
|---|---|---|
| 🧈 Butter (default) | butter | 1 tbsp |
| Vegetable oil | vegetable oil | 1 tbsp |
| Olive oil | olive oil | 1 tbsp |
| Canola oil | canola oil | 1 tbsp |
| Cooking spray | cooking spray | a few sprays |

The fat choice rewrites the ingredient list, the prep "ready your pan" wording, and the first two cook cues (see **Fat-aware cue variations** at the end).

---

## Phase 0 — Prep wizard (gather + technique steps)

### Gather list (`prep[]`)
1. Crack {n} eggs into a bowl.
2. Beat in the milk and salt until fully blended — no streaks of white. Don't over-beat.
3. Your butter (or chosen fat) goes in the PAN, not the bowl — added later, once the pan's hot and turned down to low.
4. Have a spatula, a non-stick pan, and a plate ready. We preheat the pan on high, then drop to low for the eggs.

### Step 1 — Crack your eggs
> Crack {n} eggs into a bowl — tap each one on a flat surface, not the edge of the bowl.

*How to do it:*
- A flat-surface crack makes a cleaner break with fewer shell shards.
- Crack into a bowl first — never straight into the pan, in case of shell.
- A shell fragment fell in? Scoop it out with a larger piece of shell — it acts like a magnet.

### Step 2 — Beat in the milk + salt
> Add the milk and salt to the eggs, then beat with a fork or whisk just until the colour is uniform — about 30 seconds, no streaks of white. Don't over-beat.

*How to do it:*
- Milk goes in the bowl with the eggs — it makes them softer and richer.
- Salting the raw eggs in the bowl seasons them all the way through — better than salting at the end.
- Don't over-beat — the second it's evenly blended, stop. Keep going and you thin the eggs out and they turn weepy. Nobody wants weepy eggs.
- Streaks of white left in mean patchy, uneven texture in the pan.
- Hold the pepper for now if you like — it can go on at the end.

### Step 3 — Ready your pan, fat & spatula
> Have a nonstick pan, a rubber spatula, your butter, and a plate within reach. The butter goes in the PAN (not the bowl) — added once the pan's hot and turned down to low.

*(For a non-butter fat, "butter" is swapped for the chosen fat name throughout this step.)*

*How to do it:*
- We preheat the pan on HIGH, then drop it to low before the eggs — high to preheat, low to cook.
- Nonstick means nothing sticks and folding is easy.
- A rubber or silicone spatula won't scratch the pan.
- Get the plate out now — soft eggs finish fast and won't wait.

---

## Phase 1 — Preheat (`prePhase`, no music)

Runs in `screens.preCook` before the song. A calm shuffled royalty-free chill mix plays underneath (Delosound · Mondamusic · PumpupTheMind · Alex Morgan · "Way Home" by Tokyo Music Walker).

### Intro
- **Title:** Preheat the pan
- **Intro copy:** Eggs cook fast, so we get the pan hot first. Preheat on HIGH, then we drop it right down to low before the eggs go in — high to preheat, low to cook.

### Step — "Pan on HIGH — empty" (heat: HIGH)
> Put your empty pan on the burner and turn it to HIGH. Nothing in it yet — no butter, no oil, no eggs. Just the pan and the heat, getting acquainted.

- Primary button: **Start preheating ⏱**
- Skip option (both here and on the timer): **"Skip — my pan's already hot ▸"** → jumps straight to the music-synced cook.

### Timer — "Preheating the pan"
- Phase label: *preheat*
- Duration: **90 s (gas) / 240 s (electric)**
- Early-exit button: **Test it now ▸**
- **Note is stove-aware** (`eggsPrePhase`):
  - **Gas:** Keep the pan empty while it heats — nothing in it yet. Resist the urge to poke at it; it just needs to get hot. When the timer's up, we'll do a quick water-drop test before dropping the heat.
  - **Electric:** Keep the pan empty while it heats — nothing in it yet. Electric burners take their sweet time, so this one's a bit of a wait. Nothing's wrong; the pan's just slow. When the timer's up, we'll do a quick water-drop test before dropping the heat.
  - *(Fallback note in `cues.js`, used only if the stove override is absent: "Keep the pan empty while it heats — nothing in it yet. Electric burners take their time, so hang tight if it's a wait. When the timer's up, we'll do a quick water-drop test before dropping the heat.")*

### Gate — water-drop test ("pan check")
- **Question:** Is the pan hot enough?
- **Lead:** Flick a few drops of water onto the pan. Hot enough = they sizzle, skitter across the surface, and vanish in a second or two. Not yet = they just sit there and slowly bubble. (Careful — the pan's hot.)
- Confirm button: **It sizzled — pan's ready ▸**
- Not-ready button: **Not yet — heat a little longer** → reheats 45 s ("A little longer on high"), then re-check.

### Transition — launch the cook
- **Title:** Drop to LOW — let's cook 🍳
- **Body:** Nice and hot. Tap to start — the first step drops the heat to low and adds your fat, so the eggs stay soft and creamy.
- Button: **Start cooking**

---

## Phase 2 — Music-synced cook (`cues[]`, 9 cues)

Each cue fires at `at` seconds into the song. Every cue is a checkpoint that pauses the cook clock until tapped, **except** the first (auto-starts) and the finish. `gate` cues always block until confirmed.

Fields per cue: **at · type · heat · haptic**, then **body** (standard), **beginner** (shown to beginners), **voice** (spoken/TTS), and any **gate**.

---

### Cue 1 — `at 0` · action · heat LOW · haptic double — "Drop to low + butter in"
![cue 0](mvp/assets/recipes/eggs/cue-0.png)
- **Body:** Turn the heat down to LOW. Add the butter and let it melt and coat the pan.
- **Beginner:** The pan's hot from preheating — now turn it down to LOW. Add the butter; it melts fast and coats the pan. Low heat from here on is the whole secret to soft, creamy eggs — no browning.
- **Voice:** Turn the heat down to low, then add the butter and let it melt.
- *(fat-aware — see variations below)*

### Cue 2 — `at 25` · action · heat LOW · haptic double — "Pour in the eggs"
![cue 1](mvp/assets/recipes/eggs/cue-1.png)
- **Body:** Pour the eggs into the melted butter. Now leave them alone — no stirring yet. We're not making rubber.
- **Beginner:** Pour your whisked eggs into the melted butter. Now leave them completely alone — no stirring. We want them to start setting first. We're not making rubber.
- **Voice:** Pour in the eggs. Now leave them alone — don't stir yet. We're not making rubber.
- *(fat-aware — see variations below)*

### Cue 3 — `at 45` · action · heat LOW · haptic tap — "Let them set — don't stir" 🔒 GATE
*(no reference image)*
- **Body:** Wait — don't stir yet. Let the bottom and edges turn from clear to solid white. That's your signal.
- **Beginner:** Hands off — I know it feels like nothing's happening. It is, for a few seconds. Let the eggs sit on the low heat until the bottom and edges turn from runny and clear to solid white. THAT'S your signal to start stirring — not a moment before.
- **Voice:** Let them sit. Wait until the bottom and edges turn solid white before you stir.
- **Gate (confirm):**
  - Done button: **They've set — solid white**
  - Check coach: Are the bottom and edges solid white (not runny)? Tap once they've set.
  - Not-ready coach: Not white yet? Give them a few more seconds on low — still no stirring.
  - Done coach: Perfect — now the figure-8.
  - Nudge after: 15 s

### Cue 4 — `at 70` · action · heat LOW · haptic tap — "Figure-8 stir"
![cue 2](mvp/assets/recipes/eggs/cue-2.png)
- **Body:** Now stir slowly in a figure-8 — trace an '8' through the eggs with your spatula.
- **Beginner:** Now that they've set, start moving: drag your spatula through the eggs in a slow figure-8 — literally trace the shape of an '8', over and over, folding the eggs gently around the pan. That steady figure-8 builds soft, small, creamy curds. Keep it gentle and unhurried — don't whip it fast.
- **Voice:** Now start the figure-8 — trace an eight through the eggs, gentle and steady.

### Cue 5 — `at 110` · tip · heat LOW · haptic none — "Soft curds forming"
![cue 3](mvp/assets/recipes/eggs/cue-3.png)
- **Body:** Small, soft curds appear. Keep that gentle figure-8 going.
- **Beginner:** See those soft curds forming? That's exactly right. Keep the heat low and keep tracing that slow figure-8 — gentle and steady, not fast.
- **Voice:** Nice — soft curds are forming. Keep that gentle figure-8 going.

### Cue 6 — `at 145` · tip · heat LOW · haptic tap — "Still glossy & wet"
![cue 4](mvp/assets/recipes/eggs/cue-4.png)
- **Body:** Eggs should look glossy and a little underdone — wetter than feels right. Trust it.
- **Beginner:** The eggs should still look a little wet and glossy — yes, even though your gut says cook them longer. Your gut's wrong here. They keep cooking from their own heat once you stop.
- **Voice:** Keep them glossy and a little wet. Looks underdone — that's the point. Almost there.

### Cue 7 — `at 170` · action · (no heat badge) · haptic double — "Take them off early"
![cue 5](mvp/assets/recipes/eggs/cue-5.png)
- **Body:** Off the heat just before done — then one more fold.
- **Beginner:** Take the pan completely off the heat now — just before they look fully cooked. Give them one more gentle fold; the residual heat finishes them in the next few seconds.
- **Voice:** Take the eggs off the heat now, just before they look done. One more gentle fold.

### Cue 8 — `at 185` · temp · (no heat badge) · haptic tap — "Just set?" 🔒 GATE
![cue 6](mvp/assets/recipes/eggs/cue-6.png)
*(⭐ the doneness-gate reference — "this is what done looks like")*
- **Body:** Poke at them. Soft, creamy, still a little glossy, no runny raw egg in the middle? Pull them — they keep cooking off the heat. You've got this.
- **Beginner:** Poke at them. They should be soft, creamy, and still a little glossy — no runny raw liquid left. If they're still wet and raw in the middle, back on low for a few seconds, then check again. Pull them before they feel fully done — they finish off the heat. You've got this.
- **Voice:** They should be soft, creamy, and a little glossy — no runny raw egg. Pull them now; they finish off the heat.
- **Gate (confirm):**
  - Done button: **Just set**
  - Check coach: How do they look? Tap "Just set" once there's no runny raw egg.
  - Not-ready coach: No rush — back on low for a few seconds, then check again. No runny raw egg, but keep them creamy.
  - Done coach: Perfect — soft and creamy.
  - Nudge after: 20 s

### Cue 9 — `at 205` · finish · haptic double — "Season & plate 🍳"
![cue 7](mvp/assets/recipes/eggs/cue-7.png)
- **Body:** Salt, a little pepper if you want it, plate up, and eat now while they're soft.
- **Beginner:** Final pinch of salt, some pepper if you like, slide them onto a plate, and eat straight away while they're soft. That's soft, restaurant-style scrambled eggs — made by you, for about a buck. The deli would've charged you six. Nice work. First of many.
- **Voice:** Season with salt and pepper, plate up, and eat while they're soft. You just made scrambled eggs from scratch — nice work.
- **Code note:** carries a `// TODO` to wire a completion achievement (first-ever cook → "Didn't Order Takeout"; repeat egg cook → "Certified Egg Guy") once an achievement system exists — not yet built.

---

## Fat-aware cue variations

When the fat selector is **not** butter, `eggsCues()` rewrites the first two cues. Source phrases come from `EGG_FATS`:

### Cue 1 ("Drop to low + …")
| Fat | Title | Body |
|---|---|---|
| Butter (default) | Drop to low + butter in | Turn the heat down to LOW. Add the butter and let it melt and coat the pan. |
| Vegetable / Olive / Canola oil | Drop to low + oil in | Turn the heat down to LOW. Add the oil and swirl it to coat the pan. |
| Cooking spray | Drop to low + spray in | Turn the heat down to LOW. Coat the pan with a few sprays of cooking spray. |

(Beginner & voice lines adapt the same way — e.g. spray voice: *"Turn the heat down to low, then coat the pan with spray."*)

### Cue 2 ("Pour in the eggs") — all branches now carry the dry "We're not making rubber." tag
| Fat | Body |
|---|---|
| Butter | Pour the eggs into the melted butter. Now leave them alone — no stirring yet. We're not making rubber. |
| Oil (veg/olive/canola) | Pour the eggs into the hot oil. Now leave them alone — no stirring yet. We're not making rubber. |
| Cooking spray | Pour the eggs into the coated pan. Now leave them alone — no stirring yet. We're not making rubber. |

| Fat | Beginner |
|---|---|
| Butter | Pour your whisked eggs into the melted butter. Now leave them completely alone — no stirring. We want them to start setting first. We're not making rubber. |
| Oil | Pour your whisked eggs into the hot oil. Now leave them completely alone — no stirring. We want them to start setting first. We're not making rubber. |
| Cooking spray | Pour your whisked eggs into the coated pan. Now leave them completely alone — no stirring. We want them to start setting first. We're not making rubber. |

(Voice is fat-agnostic: *"Pour in the eggs. Now leave them alone — don't stir yet. We're not making rubber."*)

---

## Image inventory

| Cue | Image | Present? |
|---|---|---|
| 1 — Drop to low + butter in | `cue-0.png` (`?v=2`) | ✅ |
| 2 — Pour in the eggs | `cue-1.png` | ✅ |
| 3 — Let them set — don't stir | — | ❌ (no image) |
| 4 — Figure-8 stir | `cue-2.png` | ✅ |
| 5 — Soft curds forming | `cue-3.png` | ✅ |
| 6 — Still glossy & wet | `cue-4.png` | ✅ |
| 7 — Take them off early | `cue-5.png` | ✅ |
| 8 — Just set? (gate) | `cue-6.png` | ✅ |
| 9 — Season & plate | `cue-7.png` | ✅ |
| Hero (browse/prep) | `hero.jpg` | ✅ |

> Note: image embeds use repo-relative paths and render in a Markdown viewer (VS Code / GitHub). The only cook cue without an image is **"Let them set — don't stir"** (cue 3).
