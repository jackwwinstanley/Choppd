# Creamy One-Pot Garlic Parmesan Pasta 🍝 — Detailed Cue Breakdown

A two-phase beginner cook: a silent, real-time simmer (**Phase 1**) that hands off to a music-synced finish (**Phase 2**) set to the Choppd soundtrack. This document walks through every prep note, pre-phase step, timer, gate, and cue, sourced from [`mvp/cues.js`](mvp/cues.js#L501) (`window.ONEPOT_PASTA`).

---

## Overview

| Field | Value |
|---|---|
| **ID** | `one-pot-garlic-parmesan-pasta` |
| **Recipe** | Creamy One-Pot Pasta · One-Pot · finished tender & creamy |
| **Song** | the Choppd soundtrack (`audio/pasta-music.mp3`, royalty-free by Alex-Productions) |
| **Phase 2 duration** | 355 s (~5:55) — the song length; the Phase 1 simmer is real-time and separate |
| **Honest total time** | ~20 min |
| **Time breakdown** | ~12 min simmer + 6 min music-synced finish |
| **BPM** | 72 |
| **Servings** | 1–4 (base 2) — scales ingredient amounts only (perUnit 0.1, clamp 0.85–1.4) |

### Equipment needed
Wide, deep pan or pot with high sides · Box grater or microplane (for fresh cheese) · Measuring cups · Measuring spoons · Knife + cutting board (for the garlic)

### Ingredients
| Ingredient | Amount | Notes |
|---|---|---|
| Pasta | 8 oz | short pasta |
| Broth | 2 cups | |
| Cream | 1/2 cup | |
| Garlic | 2 cloves | |
| Parmesan | 1 cup | |
| Butter | 2 tbsp | |
| Basil | to garnish | optional (fresh basil finish) |
| Salt | to taste | optional |
| Pepper | to taste | optional |

**Serving note:** Not sure how much pasta you have? The weight in oz is printed on the side of your box. 1 lb = 16 oz = about 4 cups dry.

**Optional group — Fresh basil finish** 🌿: tear fresh basil over the top to serve.

---

## Prep (before anything starts)

Quick checklist shown on the prep screen:

1. Grab a wide, deep pan or pot.
2. Mince 2 garlic cloves; grate ~1/2 cup parmesan.
3. Measure 8 oz short pasta, 2 cups broth, 1/2 cup cream.
4. Have butter, salt, pepper (and basil) ready.

---

## Phase 1 — "Get it simmering" (silent, no song)

> **Intro:** No music yet — let's get the pasta going first. The song drops once it's tender.

A tap-through of three steps, then a real-time simmer timer with a doneness gate, then the "drop the music" transition that launches Phase 2.

### Tap-through steps

| # | Title | Heat | Instruction |
|---|---|---|---|
| 1 | **Butter + garlic** | medium | Heat the pan and melt the butter (2 tbsp), then sauté the garlic (2 cloves) for about 60 seconds until fragrant — don't let it brown. |
| 2 | **Pasta + broth in** | medium-high | Add the dry pasta (8 oz) and the broth (2 cups). Stir to combine. |
| 3 | **Bring to a simmer** | medium-high | Bring it to a gentle simmer on medium-high heat — about 2–3 minutes. |

### Simmer timer
- **Duration:** 600 s (10 min)
- **Label:** "Simmer uncovered, stir every 2 minutes. Don't wander off — the pasta has trust issues."
- **Early exit:** after 420 s (7 min) an "Pasta's done early ▸" option appears.

### Doneness gate
- **Question:** "Is the pasta tender and the liquid mostly absorbed?"
- **Yes →** "✅ Yes — start the music 🎸" (advances to the transition)
- **Not yet →** "⏳ Not yet — 2 more minutes" (adds 120 s, then asks again)

### Transition — the drop
- **Title:** 🎸 Drop it — the soundtrack starts now
- **Body:** Slide the pot off to a cold spot and turn the burner off. Tap play and finish the sauce to the music.
- **Button:** Play

---

## Phase 2 — music-synced finish (the soundtrack, 5:55)

Each cue fires when the cook clock (`songPos`) reaches `at` seconds into the song. The cook is off the heat for almost all of Phase 2 — this is the sauce-building finish, paced by the song's structure. Cues carry `custom` copy (used when the cook brings their own track, so there are no the soundtrack references).

### Cue timeline

| # | Time | Type | Heat | Title | Song moment |
|---|---|---|---|---|---|
| 1 | 0:00 | tip | off | Off the heat — rest | piano intro |
| 2 | 0:49 | action | off | Cream in — slow stir | ballad build |
| 3 | 1:45 | action | off | Parmesan in — melt it slow | emotional peak of the ballad |
| 4 | 3:03 | action | off | THE DROP — taste & season! 🎸 | the rock drop |
| 5 | 3:27 | tip | low | Adjust the consistency | opera-to-rock |
| 6 | 4:19 | baste | off | Basil + plate | gentle outro returns |
| 7 | 5:00 | tip | off | Admire it 🍝 | outro (no checkpoint) |
| 8 | 5:54 | finish | — | Plated 🍝 | song fades out |

---

### Cue-by-cue detail

#### 1 · 0:00 — Off the heat — rest `tip` · heat: off
- **Body:** Take the pan completely off the heat. Let it rest ~30s.
- **Beginner:** Take the pan completely off the heat. Let it sit for 30 seconds — the residual heat keeps working while the piano intro plays. Don't rush this.
- **Voice:** "Take the pan completely off the heat. Let it rest for about thirty seconds while the piano intro plays."
- **Haptic:** tap
- **Custom (own track):** "Take the pan completely off the heat. Let it sit for 30 seconds — the residual heat keeps working. Don't rush this." / Voice: "Take the pan off the heat completely. Let it rest about thirty seconds."

#### 2 · 0:49 — Cream in — slow stir `action` · heat: off
- **Body:** Off the heat, pour in the cream (1/2 cup) slowly, stirring in lazy circles.
- **Beginner:** Pour in the cream (1/2 cup) slowly while stirring. Keep stirring in lazy circles — the ballad sets the pace. Don't rush or the sauce breaks.
- **Voice:** "Pour in the cream slowly, stirring in lazy circles. Let the ballad set the pace — don't rush, or the sauce breaks."
- **Haptic:** double
- **Custom (own track):** "Pour in the cream (1/2 cup) slowly while stirring in lazy circles. Don't rush, or the sauce breaks." / Voice: "Pour in the cream slowly, stirring in lazy circles. Don't rush it."

#### 3 · 1:45 — Parmesan in — melt it slow `action` · heat: off
- **Body:** Add the parmesan (1/2 cup) a handful at a time, stirring until glossy.
- **Beginner:** Add the parmesan (1/2 cup) a handful at a time, stirring after each addition until fully melted. The sauce should be glossy and silky. Still on the ballad — keep the pace slow and steady.
- **Voice:** "Add the parmesan a handful at a time, stirring after each until it melts — glossy and silky. Keep the pace slow and steady."
- **Haptic:** tap
- **Custom (own track):** "Add the parmesan (1/2 cup) a handful at a time, stirring after each addition until melted — glossy and silky. Keep the pace slow and steady." / Voice: "Add the parmesan a handful at a time, stirring until glossy."

#### 4 · 3:03 — THE DROP — taste & season! 🎸 `action` · heat: off
> The biggest cue in the recipe — the rock section explodes.
- **Body:** The rock drop! Taste right now and season hard — salt + pepper to taste.
- **Beginner:** HERE IT IS — the rock drop. Taste the sauce right now. Season hard with salt and pepper to taste. This is the moment — bold, decisive, no second-guessing.
- **Voice:** "Here it is — the rock drop! Taste the sauce right now, and season hard with salt and pepper. Be bold — no second-guessing."
- **Haptic:** strong
- **Custom (own track):** *Title: Taste & season! 🥄* — "Taste the sauce right now. Season hard with salt and pepper to taste — bold and decisive, no second-guessing." / Voice: "Taste the sauce now, and season hard with salt and pepper. Be bold."

#### 5 · 3:27 — Adjust the consistency `tip` · heat: low
- **Body:** Too thick? A splash of the reserved broth (1-2 tbsp). Too thin? Let it sit.
- **Beginner:** Too thick? Stir in a splash of the reserved broth (1-2 tbsp, not the full 2 cups) to loosen it. Too thin? Let it sit — it thickens fast as it cools. Taste one more time and adjust.
- **Voice:** "Too thick? Loosen it with a splash of broth — just a tablespoon or two. Too thin? Let it sit, it thickens fast as it cools."
- **Haptic:** tap

#### 6 · 4:19 — Basil + plate `baste` · heat: off
- **Body:** Tear fresh basil (to garnish) over the top, then plate it up.
- **Beginner:** Tear fresh basil (to garnish) over the top. Plate it now — twirl or spoon into a warm bowl. The outro starts — you made it.
- **Voice:** "Tear some fresh basil over the top, then plate it up — twirl it into a warm bowl. The outro's starting. You made it."
- **Haptic:** tap
- **Custom (own track):** "Tear fresh basil over the top. Plate it now — twirl or spoon into a warm bowl. You made it." / Voice: "Tear basil over the top, then plate it up. You made it."

#### 7 · 5:00 — Admire it 🍝 `tip` · heat: off · *no checkpoint · shows finish button*
> `noCheckpoint: true` — the song plays out to the end while the cook sits and enjoys.
- **Body:** Put the fork down for a second. Look at what you made. You earned it.
- **Beginner:** Put the fork down for a second. Look at what you made. Creamy, glossy, perfectly seasoned one-pot pasta — cooked to the soundtrack. Pour a drink. You earned it.
- **Voice:** "Put the fork down for a second and look at what you made — creamy, glossy, perfectly seasoned pasta, cooked to the soundtrack. You earned it."
- **Haptic:** double
- **Custom (own track):** "Put the fork down for a second. Look at what you made — creamy, glossy, perfectly seasoned one-pot pasta. Pour a drink. You earned it." / Voice: "Put the fork down and look at what you made. You earned it."

#### 8 · 5:54 — Plated 🍝 `finish`
- **Body:** That's the cook. Enjoy it.
- **Beginner:** And that's the cook — the song fades out as you finish. Creamy one-pot garlic parmesan pasta, start to finish with the soundtrack.
- **Voice:** "That's the cook."
- **Haptic:** tap

---

## Notes on structure

- **Phase 1 is real-time and silent** — its timing lives in a live simmer timer and a doneness gate, *not* in the song. The pasta must be tender before the music starts.
- **Phase 2's `at` values are seconds into the soundtrack**, deliberately mapped to the song's structure: piano intro → rest, ballad → cream & parmesan, the rock drop → taste & season, outro → plate & admire.
- **`custom` copy** is swapped in when a premium cook plays their own track instead of the soundtrack, stripping the song-specific references.
- Unlike the steak cook, Phase 2 has **no doneness gates** — the safety/doneness checkpoint is the Phase 1 gate before the music drops.
