# Scrambled Eggs — DRAFT (benchmark run — VERIFIED, 3 iterations, all six PASS)

> Pipeline draft from `/new-recipe "scrambled eggs" --have "eggs, butter, milk, salt" --type synced`.
> DRAFT ONLY — not wired to the catalog. Stove-test required before build.

## Ingredient mapping (--have → canonical ids)

| Input | Canonical id | Note |
|---|---|---|
| eggs | `egg` | required |
| butter | `butter` | STAPLE — rides the staples toggle, not listed in scan.required |
| milk | `milk` | required |
| salt | `salt` | STAPLE |

No unmapped items; no new vocabulary entries needed.

## 1. Header

```jsonc
{
  "id": "scrambled-eggs-bench",
  "type": "synced",
  "recipe": { "title": "Soft Scrambled Eggs", "technique": "Soft Scramble",
              "doneness": "Soft & creamy", "emoji": "🍳" },
  "song": {
    // FOUNDER PICKS THE TRACK — pipeline supplies the slot, not the license.
    // Requirements: calm tempo (~100–130 bpm), runtime ≥ durationSec (210s),
    // royalty-free stand-in file attached at handoff.
    "title": "TBD", "artist": "TBD", "spotifyQuery": "TBD",
    "youtubeId": null, "videoId": null,
    "audioFile": "audio/scrambled-eggs-bench.mp3", "audioCredit": "TBD (royalty-free)"
  },
  "bpm": 120,
  "durationSec": 210,
  "totalTimeMin": 8,
  "timeBreakdown": "~2 min prep + ~2–4 min preheat + ~3.5 min cook",
  "portion": { "label": "How many eggs?", "unit": "eggs", "base": 3, "options": [2, 3, 4, 6], "perUnit": 12, "clamp": [0.8, 1.6] },
  "difficulty": "beginner",
  "equipmentNeeded": ["Nonstick pan", "Whisk or fork", "Small bowl", "Rubber spatula", "Plate"],
  "heroImage": "assets/recipes/scrambled-eggs-bench/hero.jpg",
  "cookWarning": "The one way to wreck scrambled eggs is overcooking them. Pull them while they still look slightly underdone — they finish cooking on the way to the plate."
}
```

## 2. Scan metadata

```json
{ "scan": { "required": ["egg", "milk"], "optional": [], "staples_assumed": true } }
```

## 3. Ingredients

```jsonc
[
  { "name": "eggs", "measure": "3", "noInline": true },
  // FAT PICKER — first-class alternatives (each maps to a per-variant screen
  // + voice set below; implementation = the EGG_FATS swap pattern):
  { "name": "butter", "measure": "1 tbsp",
    "alternatives": [
      { "name": "vegetable oil", "measure": "1 tbsp" },
      { "name": "olive oil", "measure": "1 tbsp" },
      { "name": "cooking spray", "measure": "a few sprays" }
    ] },
  { "name": "milk", "measure": "1 tbsp" },
  { "name": "salt", "measure": "1 pinch" },
  { "name": "pepper", "label": "Black pepper", "measure": "to taste", "optional": true }  // the finish cue seasons with it
]
```

## 4a. Prep wizard (`prepSteps`)

```jsonc
[
  { "title": "Crack & whisk", "instructions": "Crack the eggs into a small bowl, add the milk and a pinch of salt, and whisk until the yolks and whites are fully blended — one even yellow, no streaks.",
    "techniqueGuide": [
      "Crack on a flat surface, not the bowl edge — fewer shell bits.",
      "Whisk means fast little circles with a fork or whisk — about 20 seconds.",
      "Fully blended = pale, even yellow with a few bubbles on top." ] },
  { "title": "Stage your station", "instructions": "Rubber spatula out, plate next to the stove. Soft eggs finish fast and won't wait for you to find a plate.",
    "techniqueGuide": [
      "A rubber or silicone spatula won't scratch the nonstick pan.",
      "Keep the whisked eggs within arm's reach of the pan." ] }
]
```

## 4b. Pre-phase (preheat — pattern copied from the stove-tested exemplar)

```jsonc
{
  "title": "Preheat the pan",
  "intro": "Eggs cook fast, so the pan gets hot first. Preheat on HIGH, then we drop it down before the eggs go in.",
  "startLabel": "Start preheating ⏱",
  "steps": [
    { "title": "Pan on HIGH — empty", "heat": "high",
      "body": "Put your empty nonstick pan on the burner and turn it to HIGH. Nothing in it yet — no butter, no eggs.",
      "voice": "Put your empty pan on the burner and turn it up to high. Nothing in it yet — just let it get hot.",
      "image_slot": "scrambled-eggs-bench/p1-c1.webp" }
  ],
  // STOVE-DEPENDENT TIMER (electric-lag rule): gas 90s / electric 240s
  "timer": { "sec": { "gas": 90, "electric": 240 }, "label": "Preheating the pan", "phaseLabel": "preheat",
             "note": "Keep the pan empty while it heats. When the timer's up we do a quick water-drop test before dropping the heat." },
  "gate": {
    "question": "Is the pan hot enough?",
    "lead": "Wet your fingertips and flick a few water drops onto the pan.\n\n✅ Ready: the drops ball up and skate around the pan like tiny marbles, then vanish. That's the sign.\n\n❌ Not ready: the drops sit flat and slowly bubble away. Give it another 30–45 seconds and flick again.\n\n⏸ Ready before YOU are? Turn the dial down to medium (or slide the pan off the burner) — an empty nonstick pan shouldn't sit screaming on high.\n\n(Keep your hand back — the pan is hot.)",
    "voice": "Flick a few drops of water on the pan — it's ready when they ball up and skate around like tiny marbles. If they sit flat and bubble, give it thirty to forty-five more seconds.",
    "yesLabel": "They danced — pan's ready ▸", "notYetLabel": "Not yet — keep heating",
    "notYetSec": 45, "notYetTimerLabel": "A little longer on high" },
  "transition": { "title": "Drop the heat — let's cook 🍳",
    "body": "Pan's hot. Tap to start — the first step brings the heat down and adds your fat. (If you parked the pan off the heat, pop it back on now.)",
    "voice": "Nice and hot. Tap to start — we bring the heat down, add the fat, and the eggs go in.",
    "button": "Start cooking", "emoji": "🍳" },
  "skippable": true
}
```

## 4c. Cues (cook clock = 210s)

```jsonc
[
  { "at": 0, "type": "action", "title": "Set medium-high + butter in", "heat": "medium-high",
    "body": "Set the heat to MEDIUM-HIGH. Add the butter and swirl until it melts and coats the pan — usually 15–20 seconds.",
    "beginner": "Set the heat to MEDIUM-HIGH now — wherever your dial ended up after the preheat, medium-high is the target. Add the butter and swirl; it melts in about 15–20 seconds and should foam a little, not brown. Browning means the pan ran too hot — lift it off for ten seconds and carry on.",
    "voice": "Set the heat to medium-high, then add the butter and swirl it around.",
    // PER-FAT VARIANTS — screen text AND voice (a loud kitchen can't rely on audio):
    "text_alts": {
      "vegetable_oil": { "title": "Set medium-high + oil in",
        "body": "Set the heat to MEDIUM-HIGH. Add the oil and swirl to coat the pan — ready in a few seconds when it flows thin and shimmers.",
        "beginner": "Set the pan to MEDIUM-HIGH and add the oil. Swirl to coat; it's ready in a few seconds, when it flows thin and shimmers. If it SMOKES, the pan ran too hot — slide it off for ten seconds, then carry on." },
      "olive_oil": { "title": "Set medium-high + oil in",
        "body": "Set the heat to MEDIUM-HIGH. Add the olive oil and swirl to coat — ready in a few seconds when it shimmers.",
        "beginner": "Set the pan to MEDIUM-HIGH and add the olive oil. Swirl to coat; ready in a few seconds when it shimmers. If it smokes, slide the pan off for ten seconds first." },
      "spray": { "title": "Set medium-high + spray",
        "body": "Set the heat to MEDIUM-HIGH. Lift the pan off the burner, coat it with a few sprays, and set it back.",
        "beginner": "Set the heat to MEDIUM-HIGH. Lift the pan OFF the burner to spray — a quick, even coat, edges too — then set it back down. If it smokes right away, slide the pan off for ten seconds and carry on; it's fine." }
    },
    "voice_alts": {
      "vegetable_oil": "Set the heat to medium-high, then add the oil and swirl it around.",
      "olive_oil": "Set the heat to medium-high, then add the olive oil and swirl it around.",
      "spray": "Set the heat to medium-high, lift the pan off to coat it with a few sprays, then set it back down."
    },
    "haptic": "double",
    "image_slot": "scrambled-eggs-bench/p2-c1.webp" },

  { "at": 25, "type": "action", "title": "Pour in the eggs", "heat": "medium-high",
    "body": "Pour the eggs in, then tap continue the moment they're in — the clock on the set starts now. No stirring.",
    "beginner": "Need a minute before pouring? Slide the pan OFF the burner so the fat doesn't burn — then back on for ten seconds before you pour. When you pour, tap continue right away (don't linger — they're cooking now), and then leave them completely alone. No stirring; they need to start setting first.",
    "voice": "Pour in the eggs and tap the moment they're in. Then leave them alone — no stirring yet.",
    "voice_alts": { "vegetable_oil": "Pour the eggs into the hot oil and tap the moment they're in. Then leave them alone — no stirring yet.",
                    "olive_oil": "Pour the eggs into the hot oil and tap the moment they're in. Then leave them alone — no stirring yet.",
                    "spray": "Pour the eggs into the coated pan and tap the moment they're in. Then leave them alone — no stirring yet." },
    "gate": { "kind": "confirm", "doneLabel": "They're in ▸",
      "notReadyCoach": "Taking more than a minute? Slide the pan off the burner so the fat doesn't burn — back on for ten seconds, then pour and tap straight away.",
      "checkCoach": "Eggs in? Tap the moment they hit the pan.",
      "doneCoach": "In — now hands off while they set.",
      "nudgeSec": 30 },
    "haptic": "double",
    "image_slot": "scrambled-eggs-bench/p2-c2.webp" },

  { "at": 55, "type": "action", "title": "Let them set — don't stir", "heat": "medium-high",
    "body": "Wait — no stirring. Watch the bottom and edges turn from clear to solid white, usually 30–60 seconds, then tap continue.",
    "beginner": "Hands off — it feels like nothing's happening, but the base is setting. Watch the edges: they turn from glossy-clear to solid white, usually 30–60 seconds. That white rim is your signal — when you see it, tap continue. Edges already browning or fully firm? You're ahead, not ruined — drop to medium-low and tap continue now.",
    "voice": "Let them sit — no stirring. When the edges turn solid white, tap continue.",
    "gate": { "kind": "confirm", "doneLabel": "Edges are solid white",
      "notReadyCoach": "Still glossy and clear? A few more seconds on medium-high — no stirring yet.",
      "checkCoach": "Check the edges — solid white yet? Tap when they've set.",
      "doneCoach": "Perfect — now drop the heat and start folding.",
      "nudgeSec": 25 },
    "haptic": "tap",
    "image_slot": "scrambled-eggs-bench/p2-c3.webp" },

  { "at": 85, "type": "action", "title": "Drop to medium-low + fold", "heat": "medium-low",
    "body": "Turn the heat down to MEDIUM-LOW. Drag the spatula slowly through the eggs in a figure-8, folding as you go.",
    "beginner": "Turn the heat DOWN to MEDIUM-LOW first — low and slow from here is what makes them creamy instead of rubbery. On electric, the coil takes a while to cool: lift the pan off for 20–30 seconds while it drops, then set it back down. Then drag your spatula through the eggs in a slow figure-8 — literally trace an 8, over and over, folding the cooked base up as you go.",
    "voice": "Turn the heat down to medium-low, then fold slowly in a figure eight — trace an eight through the eggs, gentle and steady.",
    "haptic": "tap",
    "image_slot": "scrambled-eggs-bench/p2-c4.webp" },

  { "at": 115, "type": "tip", "title": "Soft curds forming", "heat": "medium-low", "noCheckpoint": true,
    "body": "Soft, pillowy curds are forming. Keep the slow figure-8 going — no speeding up. (Need to step away? Slide the pan off the burner first.)",
    "beginner": "See those soft pillowy lumps forming? Those are curds — exactly right. Keep the same slow figure-8; going faster breaks them into grainy bits. If you need to pause for anything, slide the pan off the burner first — they won't wait on live heat.",
    "voice": "Nice — soft curds are forming. Keep that slow figure eight going.",
    "haptic": null,
    "image_slot": "scrambled-eggs-bench/p2-c5.webp" },

  { "at": 140, "type": "tip", "title": "Glossy & slightly wet", "heat": "medium-low", "noCheckpoint": true,
    "body": "The eggs should look glossy and a little wetter than you want to eat. That's correct — trust it. Gone matte or dry? Off the heat NOW — fold in a teaspoon of cold butter.",
    "beginner": "They should still look shiny and a little underdone — wetter than feels right. Your gut says keep cooking; your gut is wrong. They keep cooking from their own heat after they leave the pan. If they've already gone matte and dry, slide the pan off the burner right now and fold in a teaspoon of cold butter to soften them.",
    "voice": "Keep them glossy and a little wet. Looks underdone — that's the point.",
    "warning": "Pull them while they still look underdone — on this heat they turn rubbery fast, and you can't un-cook an egg.",
    "haptic": "tap",
    "image_slot": "scrambled-eggs-bench/p2-c6.webp" },

  { "at": 160, "type": "action", "title": "Off the heat — one more fold", "heat": "off",
    "body": "Slide the pan completely off the burner — onto the counter or a folded towel — and turn the burner OFF. One more gentle fold.",
    "beginner": "Take the pan completely OFF the heat now — physically slide it off the burner onto the counter or a folded towel, and turn the burner off too (sliding beats the dial: the coil stays hot for minutes either way, so the pan must MOVE). Give them one more gentle fold — the pan's leftover heat finishes them.",
    "voice": "Slide the pan off the burner and turn the burner off. One more gentle fold.",
    "haptic": "double",
    "image_slot": "scrambled-eggs-bench/p2-c7.webp" },

  { "at": 185, "type": "temp", "title": "Just set?", "heat": "off",
    "body": "Poke at them: soft, creamy, still a little glossy — and no runny raw egg in the middle? They're done.",
    "beginner": "Poke at them. Soft and creamy with a slight shine is perfect. If there's still runny raw liquid in the middle, set the pan back on the burner for a few seconds and check again.",
    "voice": "They should be soft, creamy, and a little glossy — no runny raw egg. If there is, back on the heat for a few seconds.",
    "gate": { "kind": "confirm", "doneLabel": "Just set — no raw egg",
      "notReadyCoach": "No rush — back on the burner at medium-low for a few seconds, then check again. Creamy, not dry.",
      "checkCoach": "How do they look? Tap once there's no runny raw egg.",
      "doneCoach": "Perfect — plate them before they overcook.",
      "nudgeSec": 20 },
    "haptic": "tap",
    "image_slot": "scrambled-eggs-bench/p2-c8.webp" },

  { "at": 205, "type": "finish", "title": "Season & plate 🍳",
    "body": "Season with salt, pepper if you like, straight onto the plate. Eat now — soft eggs wait for no one.",
    "beginner": "Season with salt, black pepper if you like, and slide them onto the plate right away — they keep firming up even off the heat. That's soft, creamy scrambled eggs, made by you.",
    "voice": "Season with salt and pepper, slide them onto the plate, and eat while they're soft. You just made proper scrambled eggs.",
    "haptic": "double",
    "image_slot": "scrambled-eggs-bench/p2-c9.webp" }
]
```

## 8. Rescue guidance

- **Too dry / rubbery (overcooked):** grainy, bouncy, liquid weeping out —
  there is no un-cooking; fold in a teaspoon of cold butter or a splash of
  milk off the heat to soften the worst of it, and pull earlier next time.
  (Surfaced in-flow at the glossy cue, per the red-team.)
- **Still raw in the middle at the gate:** back on the burner at
  medium-low for a few seconds at a time — never crank the heat to hurry.
- **Butter browning / oil smoking at cue 1:** pan ran too hot — lift the
  pan off for ten seconds, then continue; browned-butter flecks are
  cosmetic, not fatal.

## 7. Image prompts

See `image-prompts.md` (per-slot batch, style spec applied).
