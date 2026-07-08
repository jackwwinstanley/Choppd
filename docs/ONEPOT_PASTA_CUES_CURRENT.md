# One-Pot Pasta 🍝 — Current Implemented Cues (post A+ voice pass)

Live copy as implemented in `window.ONEPOT_PASTA` ([mvp/cues.js:501](mvp/cues.js#L501)) after commit `bb5129c`. Fields changed or added in the A+ Choppd voice pass are marked **✏️ NEW**; everything else is the original copy. Structure (timing, `type`, `heat`, `haptic`, gates, buttons) is unchanged.

**Money enemy for the finish:** the Wednesday-night DoorDash cart — ~$23 out → ~$4 at home.

---

## Phase 1 — "Get it simmering" (silent, no song)

**Title:** Get it simmering

**Intro** ✏️ NEW
> No music yet — get the pasta going first. The song earns its entrance once the pasta's tender.

### Tap-through steps

| # | Title | Heat | Instruction |
|---|---|---|---|
| 1 | Butter + garlic | medium | Heat the pan and melt the butter (2 tbsp), then sauté the garlic (2 cloves) for about 60 seconds until fragrant — don't let it brown. |
| 2 | Pasta + broth in | medium-high | Add the dry pasta (8 oz) and the broth (2 cups). Stir to combine. |
| 3 | Bring to a simmer | medium-high | Bring it to a gentle simmer on medium-high heat — about 2–3 minutes. |

### Simmer timer (600 s / 10 min)
- **Label** ✏️ NEW — "Simmer uncovered, stir every 2 minutes — it sticks the second you leave. Use the gaps to grate the parmesan so future-you isn't scrambling."
- **Early exit:** after 420 s (7 min) → "Pasta's done early ▸"

### Doneness gate
- **Question:** "Is the pasta tender and the liquid mostly absorbed?"
- **Voice:** "Bite a piece — if the pasta's tender and the liquid's cooked down into a glossy sauce, you're ready. If not, give it a couple more minutes."
- **Yes →** "✅ Yes — start the music 🎸"
- **Not yet →** "⏳ Not yet — 2 more minutes" (+120 s)

### Transition — the drop
- **Title:** 🎸 Drop it — Bohemian Rhapsody starts now
- **Body:** Slide the pot off to a cold spot and turn the burner off. Tap play and finish the sauce to the music.
- **Voice:** "That's the pasta cooked. Slide the pot off the heat, and tap play — we finish the sauce to the music."
- **Button:** Play

---

## Phase 2 — music-synced finish (Bohemian Rhapsody, 5:55)

`at` = seconds into the song. `custom` = copy shown when the cook plays their own track (song-agnostic).

| # | Time | Type | Heat | Title | Changed? |
|---|---|---|---|---|---|
| 1 | 0:00 | tip | off | Off the heat — rest | — |
| 2 | 0:49 | action | off | Cream in — slow stir | — |
| 3 | 1:45 | action | off | Parmesan in — melt it slow | ✏️ beginner |
| 4 | 3:03 | action | off | THE DROP — taste & season! 🎸 | ✏️ beginner + custom |
| 5 | 3:27 | tip | low | Adjust the consistency | ✏️ beginner |
| 6 | 4:19 | baste | off | Basil + plate | — |
| 7 | 5:00 | tip | off | Admire it 🍝 | ✏️ beginner + custom |
| 8 | 5:54 | finish | — | Plated 🍝 | ✏️ body + beginner + voice + custom (added) |

---

### 1 · 0:00 — Off the heat — rest `tip` · heat: off
- **Body:** Take the pan completely off the heat. Let it rest ~30s.
- **Beginner:** Take the pan completely off the heat. Let it sit for 30 seconds — the residual heat keeps working while the piano intro plays. Don't rush this.
- **Voice:** "Take the pan completely off the heat. Let it rest for about thirty seconds while the piano intro plays."
- **Haptic:** tap
- **Custom:** *beginner* "Take the pan completely off the heat. Let it sit for 30 seconds — the residual heat keeps working. Don't rush this." · *voice* "Take the pan off the heat completely. Let it rest about thirty seconds."

### 2 · 0:49 — Cream in — slow stir `action` · heat: off
- **Body:** Off the heat, pour in the cream (1/2 cup) slowly, stirring in lazy circles.
- **Beginner:** Pour in the cream (1/2 cup) slowly while stirring. Keep stirring in lazy circles — the ballad sets the pace. Don't rush or the sauce breaks.
- **Voice:** "Pour in the cream slowly, stirring in lazy circles. Let the ballad set the pace — don't rush, or the sauce breaks."
- **Haptic:** double
- **Custom:** *beginner* "Pour in the cream (1/2 cup) slowly while stirring in lazy circles. Don't rush, or the sauce breaks." · *voice* "Pour in the cream slowly, stirring in lazy circles. Don't rush it."

### 3 · 1:45 — Parmesan in — melt it slow `action` · heat: off
- **Body:** Add the parmesan (1/2 cup) a handful at a time, stirring until glossy.
- **Beginner** ✏️ NEW**:** Add the parmesan (1/2 cup) a handful at a time, stirring after each until it melts — dump it all in at once and it clumps into a sad cheese rope. The sauce should go glossy and silky. Keep the pace slow and steady.
- **Voice:** "Add the parmesan a handful at a time, stirring after each until it melts — glossy and silky. Keep the pace slow and steady."
- **Haptic:** tap
- **Custom:** *beginner* "Add the parmesan (1/2 cup) a handful at a time, stirring after each addition until melted — glossy and silky. Keep the pace slow and steady." · *voice* "Add the parmesan a handful at a time, stirring until glossy."

### 4 · 3:03 — THE DROP — taste & season! 🎸 `action` · heat: off
- **Body:** The rock drop! Taste right now and season hard — salt + pepper to taste.
- **Beginner** ✏️ NEW**:** This is the drop the whole cook's been building to. Taste the sauce right now, then season hard — salt and pepper, more than feels polite. Restaurants call this 'finishing'; you're just making it taste like something.
- **Voice:** "Here it is — the rock drop! Taste the sauce right now, and season hard with salt and pepper. Be bold — no second-guessing."
- **Haptic:** strong
- **Custom** ✏️ NEW (beginner)**:** *title* "Taste & season! 🥄" · *beginner* "Taste the sauce right now, then season hard — salt and pepper, more than feels polite. Restaurants call this 'finishing'; you're just making it taste like something." · *voice* "Taste the sauce now, and season hard with salt and pepper. Be bold."

### 5 · 3:27 — Adjust the consistency `tip` · heat: low
- **Body:** Too thick? A splash of the reserved broth (1-2 tbsp). Too thin? Let it sit.
- **Beginner** ✏️ NEW**:** Too thick? Loosen it with a splash of the reserved broth — a tablespoon or two, not the whole cup. Too thin? Just let it sit; it tightens up fast as it cools. Taste it one more time. This is the part a restaurant charges you an extra twelve bucks for and calls 'finishing the sauce.'
- **Voice:** "Too thick? Loosen it with a splash of broth — just a tablespoon or two. Too thin? Let it sit, it thickens fast as it cools."
- **Haptic:** tap

### 6 · 4:19 — Basil + plate `baste` · heat: off
- **Body:** Tear fresh basil (to garnish) over the top, then plate it up.
- **Beginner:** Tear fresh basil (to garnish) over the top. Plate it now — twirl or spoon into a warm bowl. The outro starts — you made it.
- **Voice:** "Tear some fresh basil over the top, then plate it up — twirl it into a warm bowl. The outro's starting. You made it."
- **Haptic:** tap
- **Custom:** *beginner* "Tear fresh basil over the top. Plate it now — twirl or spoon into a warm bowl. You made it." · *voice* "Tear basil over the top, then plate it up. You made it."

### 7 · 5:00 — Admire it 🍝 `tip` · heat: off · *no checkpoint · shows finish button*
- **Body:** Put the fork down for a second. Look at what you made. You earned it.
- **Beginner** ✏️ NEW**:** Fork down for a second. Look at what you actually made — creamy, glossy, seasoned like you meant it, cooked start to finish to one song. Pour something. Then dig in.
- **Voice:** "Put the fork down for a second and look at what you made — creamy, glossy, perfectly seasoned pasta, cooked to Bohemian Rhapsody. You earned it."
- **Haptic:** double
- **Custom** ✏️ NEW (beginner)**:** *beginner* "Fork down for a second. Look at what you actually made — creamy, glossy, seasoned like you meant it, cooked start to finish to one song. Pour something. Then dig in." · *voice* "Put the fork down and look at what you made. You earned it."

### 8 · 5:54 — Plated 🍝 `finish`
- **Body** ✏️ NEW**:** One pan, no takeout, no delivery fee. That's dinner — go eat it.
- **Beginner** ✏️ NEW**:** And that's the cook — creamy one-pot garlic parmesan pasta, start to finish, in one pan you actually have to wash. The DoorDash version of this shows up lukewarm for like twenty-three bucks; you just made it hot for about four. First of many. Go eat.
- **Voice** ✏️ NEW**:** "That's the cook. One pan, no delivery fee — go eat."
- **Haptic:** tap
- **Custom** ✏️ NEW (added)**:** *beginner* "And that's the cook — creamy one-pot garlic parmesan pasta, start to finish, in one pan you actually have to wash. The DoorDash version shows up lukewarm for like twenty-three bucks; you just made it hot for about four, to your own soundtrack. First of many. Go eat."

---

## Summary of what's new

- **Intro** — light anti-pretension edge.
- **Simmer timer** — added a micro-action (grate the parm) to fill the longest wait.
- **Parmesan (3)** — dry beat aimed at the food ("sad cheese rope").
- **THE DROP (4)** — dry-confident over generic hype; jab at restaurant "finishing" pretension; mirrored in `custom`.
- **Adjust consistency (5)** — spent the wasted `tip` slot with a restaurant-pretension jab; kept the "1–2 tbsp not the whole cup" detail.
- **Admire it (7)** — warm pre-payoff, made song-agnostic; mirrored in `custom`.
- **Plated / FINISH (8)** — now carries the outcome (capability + ~$23 → ~$4 vs DoorDash + forward close), and gained a song-agnostic `custom` so bring-your-own-track cooks no longer see "Bohemian Rhapsody."

Unchanged (left clean by design): Off the heat (1), Cream in (2), Basil + plate (6), the doneness gate, and the transition.
