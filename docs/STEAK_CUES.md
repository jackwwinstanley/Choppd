# Medium-Rare Steak 🥩 — Detailed Cue Breakdown

The flagship Sizle experience: pan-searing (or grilling) a medium-rare steak in time with **Free Bird** by Lynyrd Skynyrd. This document is a full, plain-language walkthrough of every cue, gate, and timing the app fires, sourced from [`mvp/cues.js`](mvp/cues.js#L14) (`window.FREEBIRD_STEAK`).

---

## Overview

| Field | Value |
|---|---|
| **ID** | `freebird-medium-rare-steak` |
| **Recipe** | Medium-Rare Steak · Pan Sear · finished medium-rare |
| **Song** | *Free Bird* — Lynyrd Skynyrd (`audio/steak-music.mp3`, royalty-free by Alex-Productions) |
| **Cook duration** | 480 s (~8 min) mapped onto the song |
| **BPM** | 63 (beat grid for musical seams) |
| **Methods** | Pan-sear (default) · Grill |
| **Servings** | 1–4 steaks — scales *ingredient amounts only*; timing never scales (steaks sear simultaneously, doneness is per-steak internal temp) |

### Equipment needed
Cast iron or stainless pan · Tongs · Paper towels · Cutting board & knife · Instant-read thermometer (optional)

### Ingredients
| Ingredient | Amount | Notes |
|---|---|---|
| Steak | 1 (1-inch+) | ribeye or NY strip recommended |
| Oil | 1 tbsp | high-smoke-point (avocado/canola) |
| Butter | 2 tbsp | |
| Garlic | 3 cloves | |
| Salt | to taste | **required** — every steak needs seasoning |
| Pepper | to taste | required |
| Thyme | 3 sprigs | optional |
| Cowboy butter | to finish | optional, **default OFF** — garlic, herbs, lemon & chili in butter; enabling it unlocks the cowboy-butter finishing cue |

### Pre-cook reminder
A **30-minute walk-away timer** (steak only) for the room-temp rest: *"Take it out of the fridge ~30 min before cooking so it sears evenly."* → *"Steak's at room temp 🔥 — let's sear it."*

---

## Prep (before the cook clock starts)

Quick checklist shown on the prep screen:

1. Best with a 1-inch-plus steak — ribeye or NY strip are forgiving for beginners.
2. Pull the steak out 30 min early so it comes to room temperature.
3. Pat it bone-dry with paper towel — dry = better crust.
4. Season generously with salt (and pepper) on both sides.
5. Have tongs, butter, and a plate or board ready before you start.

### Rich prep-step wizard (one screen each)

**1. Pick & temper your steak** — A 1-inch-plus ribeye or NY strip is the most forgiving cut. Take it out of the fridge ~30 min before cooking.
- A cold steak cooks unevenly — grey and overdone outside before the middle warms up.
- Thinner than an inch? It'll overcook before it sears — go thicker if you can.
- Tempered when the surface no longer feels fridge-cold to the touch.

**2. Pat it bone-dry** — Press paper towels firmly against both sides until no more moisture comes off.
- Surface water steams instead of searing — steam means no crust.
- Bone-dry meat browns fast and deep; that crust is where the flavour lives.
- Pat it again right before it goes in the pan.

**3. Season generously** — Salt both sides more than feels right — most of it falls off. Add pepper too if you like.
- Sprinkle salt from a height (8–10 inches) so it lands evenly.
- Aim for ~¾ tsp kosher salt per side — be bold.
- Season just before cooking, then press it in lightly so it sticks.

**4. Heat your pan or grill** — Pan-searing? You'll heat the pan screaming-hot the moment we start. Grilling? It needs a 10–15 min preheat — start it now.
- Pan: heaviest pan (cast iron ideal), empty, on high ~2 min.
- Grill: lid down 10–15 min until grates are screaming hot.
- Grill: build a 2-zone fire — one hot side, one cooler side to dodge flare-ups.

**5. Tools + your doneness target** — Have tongs, a resting board, and butter ready. Medium-rare finishes at 130–135°F — you'll pull it around 125–130°F.
- Use tongs, never a fork — piercing leaks out the juices.
- It climbs ~5°F while it rests, so pull it a touch early.
- No thermometer? Medium-rare feels soft with a little spring — like the base of your thumb.

---

## Method A — Pan-Sear 🍳 (default)

Each cue fires when the cook clock (`songPos`) reaches `at` seconds. Every cue is a checkpoint that pauses the cook timer (the song keeps playing underneath) except the first (auto-starts) and the finish cue. **Gate** cues always wait for the cook to confirm before advancing.

Optional group: **Garlic butter baste** 🧄 — finish in foaming butter with smashed garlic & thyme (cues tagged `opt: "garlicButter"` drop if deselected).

### Cue timeline

| # | Time | Type | Heat | Title |
|---|---|---|---|---|
| 1 | 0:00 | tip | high | Heat the pan — HOT |
| 2 | 1:00 | action | high | Add the oil |
| 3 | 1:30 | action | high | Lay the steak in |
| 4 | 3:00 | tip | high | Building the crust |
| 5 | 3:30 | flip 🔒 | high | Flip it — once |
| 6 | 4:30 | baste | medium | Butter, garlic, thyme *(opt)* |
| 7 | 5:30 | baste | medium | Spoon-baste the top *(opt)* |
| 8 | 6:00 | baste | medium-high | Sear the edges |
| 9 | 6:30 | tip | medium-high | Solo's kicking in 🔥 |
| 10 | 6:50 | action | — | Off the heat |
| 11 | 7:00 | temp 🔒 | — | Temp check 🌡️ |
| 12 | 7:15 | rest | — | Let it REST |
| 13 | 7:40 | baste | — | Cowboy butter finish 🧈 *(opt)* |
| 14 | 7:50 | finish | — | Slice & serve 🎸 |

🔒 = doneness/safety **gate** — blocks progression until confirmed.

---

### Cue-by-cue detail

#### 1 · 0:00 — Heat the pan — HOT `tip` · heat: high
- **Body:** Heavy pan on high until it's screaming hot — about 2 minutes. Don't be gentle with it.
- **Beginner:** Put your heaviest pan on high heat and let it sit empty for about 2 minutes. We want it really hot so the steak sizzles the second it lands. Careful — the handle and pan get very hot.
- **Voice:** "Let's go. Put your pan on high heat and let it get really hot for about two minutes."
- **Haptic:** tap · *auto-starts (no pause)*

#### 2 · 1:00 — Add the oil `action` · heat: high
- **Body:** A little high-smoke-point oil. Swirl until it shimmers.
- **Beginner:** Add a thin layer of oil — something like avocado or canola, not olive oil. When it looks shimmery and almost smoking, it's ready.
- **Voice:** "Add a thin layer of oil. Wait until it shimmers."
- **Haptic:** tap

#### 3 · 1:30 — Lay the steak in `action` · heat: high
- **Body:** Place it down away from you, then leave it alone. Staring at it won't sear it faster.
- **Beginner:** Gently set the steak into the pan, laying it down away from you so the oil doesn't splash toward you. Now leave it completely alone — moving it stops the crust from forming.
- **Voice:** "Lay the steak into the pan, away from you. Now don't touch it."
- **Haptic:** double

#### 4 · 3:00 — Building the crust `tip` · heat: high
- **Body:** Still searing side one. Resist the urge to peek.
- **Beginner:** It's working. That loud sizzle is a good thing — it's building a brown, tasty crust. Let it keep going.
- **Voice:** "Nice. Leave it searing. That sizzle is building your crust."
- **Haptic:** none

#### 5 · 3:30 — Flip it — once `flip` · heat: high · 🔒 GATE
- **Body:** One clean flip. The first side should be deep brown.
- **Beginner:** Lift a corner — if it's deep golden brown, flip it over once. Just one flip. If it's still pale, give it another 30 seconds.
- **Voice:** "Time to flip. Lift a corner — if it's deep brown, flip it once."
- **Haptic:** strong
- **Gate** (`confirm`, done label *"I flipped it"*, nudge after 30 s):
  - *Not ready:* "No worries — give it another 30 seconds. You want a deep golden-brown crust, not grey. Then check again."
  - *Check:* "How's that crust looking? Tap "I flipped it" once it's done."
  - *Done:* "Beautiful. Searing the second side now."

#### 6 · 4:30 — Butter, garlic, thyme `baste` · heat: medium · *(opt: garlicButter)*
- **Body:** Drop heat to medium. Butter + smashed garlic + thyme.
- **Beginner:** Turn the heat DOWN to medium so the butter doesn't burn, then add a knob of butter and, if you have them, a smashed garlic clove and some thyme. Tilt the pan slightly so the melted butter pools at the bottom.
- **Voice:** "Drop the heat to medium, then add a spoon of butter, plus garlic and thyme if you have them."
- **Haptic:** tap
- **Fade tips:** "If the butter starts to burn, turn the heat down." · "Spoon the butter over the steak as it cooks."

#### 7 · 5:30 — Spoon-baste the top `baste` · heat: medium · *(opt: garlicButter)*
- **Body:** Spoon the foaming butter over the steak, keep it moving.
- **Beginner:** Use your spoon to scoop that foaming butter and pour it over the top of the steak again and again. This adds flavor and cooks the top evenly.
- **Voice:** "Spoon the butter over the top of the steak, again and again."
- **Haptic:** none
- **Fade tips:** "If the butter starts to burn, turn the heat down." · "Spoon the butter over the steak as it cooks."

#### 8 · 6:00 — Sear the edges `baste` · heat: medium-high
- **Body:** Tongs up — sear the fat edges, ~30–45s each.
- **Beginner:** Hold the steak on its side with your tongs and sear the fatty edges, about 30 to 45 seconds each. This renders that strip of fat and finishes the crust the whole way around.
- **Voice:** "Stand the steak on its edges with your tongs and sear the fat, about thirty seconds each side."
- **Haptic:** tap

#### 9 · 6:30 — Solo's kicking in 🔥 `tip` · heat: medium-high
- **Body:** The guitars climb — so does the heat. Almost there.
- **Beginner:** Hear the guitar solo taking off? You're in the home stretch — just a little longer to go.
- **Voice:** "The solo's kicking in, and so is the heat. Almost there."
- **Haptic:** tap
- **Custom (bring-your-own track, no Free Bird refs):** *Home stretch 🔥* — "Almost there — keep the heat steady." / Voice: "Almost there now. Keep it steady."

#### 10 · 6:50 — Off the heat `action`
- **Body:** Pull at 125–130°F — it keeps cooking off-heat.
- **Beginner:** Move the steak onto a board now — and pull it about 5°F BEFORE your target, around 125 to 130°F. It keeps cooking from its own heat and climbs to a perfect medium-rare while it rests.
- **Voice:** "Take the steak onto a board now — pull it about five degrees early, around a hundred and twenty-five."
- **Haptic:** double

#### 11 · 7:00 — Temp check 🌡️ `temp` · 🔒 GATE
- **Body:** ~125–130°F now → 130–135°F (medium-rare) after resting.
- **Beginner:** On a thermometer the middle should read about 125 to 130°F (52–54°C) right now — it climbs to 130 to 135°F, medium-rare, as it rests. No thermometer? Pressed in the center it should feel soft with a little spring, like the base of your thumb.
- **Voice:** "Aim for about a hundred and twenty-five to a hundred and thirty now — it rises to medium-rare as it rests."
- **Haptic:** tap
- **Gate** (`confirm`, done label *"It's there"*, nudge after 30 s):
  - *Not ready:* "Almost there — pop it back in the hot pan for another 30 to 60 seconds, then check again. You're close."
  - *Check:* "Check again — tap "It's there" once it's around 125 to 130."
  - *Done:* "Perfect — now it rests and climbs to medium-rare."

#### 12 · 7:15 — Let it REST `rest`
- **Body:** Rest 5+ minutes — do NOT cut yet.
- **Beginner:** This is the step beginners skip: do NOT cut into it yet. Let it rest at least 5 minutes (tent loosely with foil) so the juices settle back in. Cut early and they spill onto the board, leaving the steak dry.
- **Voice:** "Now let it rest — at least five minutes. Don't cut into it; that's what keeps it juicy."
- **Haptic:** strong
- **⚠️ Warning:** Cut in early and the juices bleed out — you'll get a grey, dry steak. Give it the full 5 minutes.

#### 13 · 7:40 — Cowboy butter finish 🧈 `baste` · *(opt: cowboy butter)*
- **Body:** Spoon warm cowboy butter over the rested steak — or serve it alongside.
- **Beginner:** Optional level-up: melt a knob of butter with minced garlic, chopped herbs, a squeeze of lemon and a pinch of chili, then spoon it over the rested steak — or serve it on the side for dipping. Big flavor, zero risk.
- **Voice:** "Spoon the cowboy butter over the rested steak, or serve it alongside."
- **Haptic:** tap

#### 14 · 7:50 — Slice & serve 🎸 `finish`
- **Body:** Slice against the grain. You made a medium-rare steak.
- **Beginner:** Rest is done! Slice it against the grain — across the lines in the meat — for tender bites. You just cooked a medium-rare steak to Free Bird. Nice work.
- **Voice:** "Rest's done. Slice it against the grain, and enjoy. You just made a medium-rare steak."
- **Haptic:** double
- **Reference images:** `assets/recipes/steak/slice.jpg`, `assets/recipes/steak/plate.jpg` (fade 1800 ms)
- **Custom (bring-your-own track):** "Rest is done! Slice it against the grain — across the lines in the meat — for tender bites. You just cooked a medium-rare steak to your own soundtrack. Nice work."

---

## Method B — Grill 🔥

Carries its own prep, cues, and optional group. Key differences from the pan method: the long preheat lives in prep, side one runs longer, **no butter baste**, and optional 45° rotations for crosshatch marks.

### Grill prep
1. Best with a 1-inch-plus steak — ribeye or NY strip are forgiving for beginners.
2. Pull the steak out 30 min early so it comes to room temperature.
3. Pat it bone-dry and season generously with salt (and pepper) on both sides.
4. Preheat the grill 10–15 min with the lid down until the grates are screaming hot (gas: high; charcoal: coals ashed-over and glowing).
5. Build a 2-zone fire: one hot direct side, one cooler side to dodge flare-ups.
6. Oil the grates right before cooking; keep tongs and a board ready.

Optional group: **Crosshatch grill marks** 🔥 — rotate the steak 45° partway through each side for diamond marks (cues tagged `opt: "grillMarks"`).

### Grill cue timeline

| # | Time | Type | Heat | Title |
|---|---|---|---|---|
| 1 | 0:00 | tip | high | Grates screaming hot |
| 2 | 0:20 | action | high | Lay it over direct heat |
| 3 | 2:10 | action | high | Quarter-turn for marks *(opt)* |
| 4 | 3:20 | tip | high | Flare-up? Slide it |
| 5 | 4:00 | flip 🔒 | high | Flip it — once |
| 6 | 5:40 | action | high | Quarter-turn again *(opt)* |
| 7 | 6:50 | action | — | Off the grill |
| 8 | 7:00 | temp 🔒 | — | Temp check 🌡️ |
| 9 | 7:15 | rest | — | Let it REST |
| 10 | 7:40 | baste | — | Cowboy butter finish 🧈 *(opt)* |
| 11 | 7:50 | finish | — | Slice & serve 🎸 |

### Grill cue-by-cue detail

#### 1 · 0:00 — Grates screaming hot `tip` · heat: high
- **Body:** Grill's preheated. Oil the grates — we cook over direct high heat.
- **Beginner:** Your grill should be ripping hot after that 10–15 minute preheat. Fold a paper towel, dip it in oil, and swipe the grates with your tongs. We'll cook over the hot, direct-heat zone.
- **Voice:** "Grill's hot. Oil the grates, and get ready to lay the steak over direct heat."
- **Haptic:** tap

#### 2 · 0:20 — Lay it over direct heat `action` · heat: high
- **Body:** Onto the hot zone, away from you. Then walk away — it doesn't need babysitting.
- **Beginner:** Lay the steak onto the hottest part of the grill, setting it down away from you. Now leave it alone — moving it stops the sear marks from forming. Lid up for a steak this thick.
- **Voice:** "Lay the steak over the hot zone, away from you. Now don't touch it."
- **Haptic:** double

#### 3 · 2:10 — Quarter-turn for marks `action` · heat: high · *(opt: grillMarks)*
- **Body:** Rotate 45° on the SAME side for crosshatch marks.
- **Beginner:** About halfway through this side, give the steak a 45-degree turn — keep it on the same face — to lay a second set of bars and get that diamond crosshatch.
- **Voice:** "Rotate the steak forty-five degrees, same side, for crosshatch marks."
- **Haptic:** tap

#### 4 · 3:20 — Flare-up? Slide it `tip` · heat: high
- **Body:** Flames from dripping fat — slide to the cool zone, then back.
- **Beginner:** If flames lick up (dripping fat causes flare-ups), slide the steak to the cooler side for a few seconds until they die down, then move it back. That cool zone is your escape valve on a grill.
- **Voice:** "If it flares up, slide it to the cooler side for a moment, then back."
- **Haptic:** none

#### 5 · 4:00 — Flip it — once `flip` · heat: high · 🔒 GATE
- **Body:** Side one deep-marked? One clean flip onto the hot zone.
- **Beginner:** Lift a corner — side one should have deep, dark grill marks. Flip it once back onto the hot zone. Still pale? Give it another 30 to 60 seconds.
- **Voice:** "Time to flip. If side one's deeply marked, flip it once."
- **Haptic:** strong
- **Gate** (`confirm`, done label *"I flipped it"*, nudge after 45 s):
  - *Not ready:* "No rush — another 30 to 60 seconds for deep marks. Slide it off direct heat if it's charring, then flip."
  - *Check:* "How are the marks? Tap "I flipped it" once it's over."
  - *Done:* "Nice — second side searing now."

#### 6 · 5:40 — Quarter-turn again `action` · heat: high · *(opt: grillMarks)*
- **Body:** Rotate 45° on side two for matching marks.
- **Beginner:** Same move on this side — a 45-degree turn partway through for a matching crosshatch.
- **Voice:** "Give it another forty-five-degree turn for marks on this side."
- **Haptic:** tap

#### 7 · 6:50 — Off the grill `action`
- **Body:** Pull at 125–130°F — it climbs while resting.
- **Beginner:** Move the steak onto a board now — pull it about 5°F before target, around 125 to 130°F. It keeps cooking off the grill and climbs to a perfect medium-rare as it rests.
- **Voice:** "Take the steak off onto a board — pull it about five degrees early, around a hundred and twenty-five."
- **Haptic:** double

#### 8 · 7:00 — Temp check 🌡️ `temp` · 🔒 GATE
- **Body:** ~125–130°F now → 130–135°F (medium-rare) after resting.
- **Beginner:** On a thermometer the middle should read about 125 to 130°F (52–54°C) now — it climbs to 130 to 135°F, medium-rare, as it rests. No thermometer? Pressed in the center it should feel soft with a little spring, like the base of your thumb.
- **Voice:** "Aim for about a hundred and twenty-five to a hundred and thirty now — it rises to medium-rare as it rests."
- **Haptic:** tap
- **Gate** (`confirm`, done label *"It's there"*, nudge after 30 s):
  - *Not ready:* "Almost — back over direct heat for 30 to 60 seconds, then check again. You're close."
  - *Check:* "Check again — tap "It's there" once it's around 125 to 130."
  - *Done:* "Perfect — now it rests and climbs to medium-rare."

#### 9 · 7:15 — Let it REST `rest`
- **Body:** Rest 5+ minutes — do NOT cut yet.
- **Beginner:** This is the step beginners skip: do NOT cut into it yet. Let it rest at least 5 minutes (tent loosely with foil) so the juices settle back in. Cut early and they spill onto the board, leaving the steak dry.
- **Voice:** "Now let it rest — at least five minutes. Don't cut into it; that's what keeps it juicy."
- **Haptic:** strong
- **⚠️ Warning:** Cut in early and the juices bleed out — you'll get a grey, dry steak. Give it the full 5 minutes.

#### 10 · 7:40 — Cowboy butter finish 🧈 `baste` · *(opt: cowboy butter)*
- **Body:** Spoon warm cowboy butter over the rested steak — or serve it alongside.
- **Beginner:** Optional level-up: melt butter with minced garlic, herbs, a squeeze of lemon and a pinch of chili, then spoon it over the rested steak — or serve on the side. Big flavor, no risk.
- **Voice:** "Spoon the cowboy butter over the rested steak, or serve it alongside."
- **Haptic:** tap

#### 11 · 7:50 — Slice & serve 🎸 `finish`
- **Body:** Slice against the grain. You grilled a medium-rare steak.
- **Beginner:** Rest is done! Slice it against the grain — across the lines in the meat — for tender bites. You just grilled a medium-rare steak to Free Bird. Nice work.
- **Voice:** "Rest's done. Slice it against the grain and enjoy — you grilled a perfect medium-rare steak."
- **Haptic:** double
- **Reference images:** `assets/recipes/steak/slice.jpg`, `assets/recipes/steak/plate.jpg` (fade 1800 ms)
- **Custom (bring-your-own track):** "Rest is done! Slice it against the grain for tender bites. You just grilled a medium-rare steak to your own soundtrack. Nice work."

---

## Cue schema reference

Each cue conforms to the shared schema in [`mvp/cues.js`](mvp/cues.js):

- **`at`** — seconds into the song = cook-clock position when the cue fires.
- **`type`** — `tip` · `action` · `flip` · `baste` · `temp` · `rest` · `finish` (drives the icon/visual).
- **`title`** / **`body`** — the on-screen headline and short instruction.
- **`beginner`** — expanded, reassuring copy for less-experienced cooks.
- **`voice`** — the exact line spoken by TTS.
- **`haptic`** — `tap` · `double` · `strong` · `null`.
- **`heat`** — `high` · `medium-high` · `medium` · `low` (optional).
- **`opt`** — ties the cue to an optional group; dropped if the cook deselects it on the prep screen.
- **`gate`** — a doneness/safety checkpoint that blocks progression (`kind: confirm`, `doneLabel`, `notReadyCoach`, `checkCoach`, `doneCoach`, `nudgeSec`).
- **`custom`** — override copy shown when the cook brings their own track (no Free Bird references).
- **`warning`** / **`fadeTips`** / **`referenceImage`** — extra safety text, rotating tips, and beauty-shot images.
