# Choppd — Beginner Visual Reference System
### A deep spec for generating the most useful in-app images

---

## 1. The one principle everything else serves: the Glance Test

Every image in this system exists to answer one question a beginner asks mid-cook, one-handed, in about two seconds:

> *"Is the thing in my pan like the thing on my screen — and if not, which way is it off?"*

That's the whole job. Not to look beautiful. Not to inspire. To let a nervous beginner **confirm a judgment call they cannot make from words alone.**

This matters because beginner failure almost never happens at the *step* level. Recipes are just lists of instructions, and beginners can follow instructions. Failure happens at the **judgment calls buried inside the steps** — the moments where the recipe assumes you already know what something is supposed to look, sound, or feel like:

- "Sauté until golden" — golden compared to *what*? They have no reference in their head.
- "Simmer, don't boil" — those are two different bubble patterns they've never been taught to distinguish.
- "Dice the onion" — how big is a dice? Is what they did a dice?
- "Cook until the edges are set" — set looks like what, exactly?
- "Until fragrant" — is this fragrant, or is this about to be burnt?

Each of these is a spot where a beginner either freezes, guesses wrong, or produces a bad result and concludes *they* can't cook. A reference image collapses that gap instantly. This is the single highest-leverage thing visuals do — which means **every image should be built backwards from a specific judgment call**, not forward from "here's a nice photo of onions."

If an image isn't resolving a real judgment call, it's decoration and it's competing for attention with your audio-first, hands-free flow. Cut it.

---

## 2. Decide the medium *before* you generate: the three-tier triage

Not every judgment call wants an image. Sorting this first saves you from generating a library of things that would've been better as one sentence — and from the content treadmill that kills solo-founder projects.

**Tier 1 — Photo (target state / doneness).** Use when the judgment call is *"does my result match the target?"* and the answer is a static appearance: color, texture, translucency, set-vs-liquid, size. This is the biggest and most valuable tier, and it's what image generation is *for*. Diced onion, golden onion, a simmer's surface, a set egg white, a sear crust, sauce reduced enough to coat a spoon.

**Tier 2 — Motion (technique).** Use when the thing that's hard is *movement over time*, not an end state. Knife grip and the rock-chop, dicing an onion, the fold of a spatula through soft eggs, a pan flip. A still can *hint* at these but can't teach them. These are better as short silent loops or, at minimum, a 3–4 frame sequence — treat them as a separate, smaller, higher-effort batch and don't let them block the photo work.

**Tier 3 — Just better words.** A lot of "judgment calls" evaporate with one added clause. "Until fragrant, about 30 seconds — don't let it brown" needs no image; the time bound and the fail-state warning do the work. Before generating anything, ask: *can a sharper sentence kill this problem for free?* If yes, do that and move on.

The trap to avoid: full watch-along cooking video. It pulls the user back to staring at the screen, fights your TTS cues and music, and is brutal to produce and maintain. This system is the opposite — glanceable references that *support* hands-free flow, not a video channel bolted onto it.

---

## 3. What actually makes a reference image work

This is the deep part. These principles are what separate a useful reference from a pretty picture that quietly fails beginners.

### 3.1 One subject, and the diagnostic feature is the hero
The beginner is comparing exactly one thing: the *diagnostic feature* — the specific visual property that signals the judgment. For golden onions it's the color-and-translucency. For a dice it's the cube size. For a simmer it's the bubble pattern on the surface.

Everything that isn't the diagnostic feature is noise. No garnish, no props, no styled scatter of ingredients, no second dish in the background. A tight, clean frame where the diagnostic feature dominates beats a gorgeous composed shot every time, because the beginner has to *parse it in two seconds under stress.*

### 3.2 Realistic, not aspirational — this is counterintuitive and important
Instinct says make the food look amazing. **Don't.** Glossy food-porn hero shots set a bar a beginner's real pan will never match, so when their onions look like normal onions and not like a magazine, they think they failed. The reference should look like **a good result a real beginner can actually achieve on a cheap pan on a home stovetop** — same modest cookware, same normal kitchen, achievable color. The target is "oh, mine looks like that, I'm on track," not "mine looks nothing like that, I've ruined it."

### 3.3 The comparison set is often more useful than the single "correct" image
For a huge share of judgment calls, showing *only* the right answer is weaker than showing the **progression or the flanking fail-states**. Beginners don't just need to know what "done" looks like — they need to know *which direction they're off* so they can correct.

Two patterns:
- **Progression strip** (best for anything that develops over time): raw → softened → golden → caramelized onions; or the sauté as it goes. The beginner locates themselves on the timeline.
- **Under / just-right / over triptych** (best for a target with dangerous edges): undercooked / done / burnt garlic; rare / medium-rare / well steak cross-section.

Generate these as **separate single images with everything identical except the state**, then compose them side-by-side in the app. Do *not* ask the model to draw all three states in one image — it will fudge the differences and break consistency between panels. Singles give you clean, controllable, comparable frames.

### 3.4 Give scale anchors when size is the point
"Diced" is meaningless without a size reference. Put a consistent anchor in-frame: the edge of a standard chef's knife, a tablespoon, or a hand. A hand also doubles as a warmth/relatability cue for Gen Z — but keep it neutral and consistent (same framing every time) so it reads as a ruler, not a lifestyle shot.

### 3.5 Angle convention — pick per purpose and then be rigid about it
- **Top-down (overhead):** cutting-board states (dice, mince, chop sizes) and pan *contents* where color and coverage are the signal (sautéing onions, a reduction). Overhead flattens everything into a clean comparison plane.
- **Low/side angle (~15–30°):** anything where *height, surface, or texture* is the signal — a simmer vs. a boil (bubble action), a sear crust, foaming butter, oil shimmer. You need to see the surface in profile.
- **Cross-section (cut-through):** interior doneness — steak, chicken, a folded omelet. The inside *is* the information.

Lock one angle per category and never vary it within that category, or the library stops reading as a coherent set.

### 3.6 Lighting: bright, even, neutral — because color is data
For doneness, **color literally is the information**, so lighting can't distort it. Use bright, even, neutral-to-slightly-cool daylight with a neutral white balance and no strong colored shadows or moody restaurant warmth. Warm "cozy kitchen" lighting will make raw onions look golden and medium-rare look done — actively dangerous for a reference. Consistent flat light also makes the whole library look like one system.

### 3.7 It has to survive being a phone thumbnail
It'll be viewed small, fast, often glanced at from across the counter. That demands: subject fills the frame, high contrast between subject and background, no fine detail that only reads at full size, and a composition that's still legible at ~1 inch. Design for the worst-case viewing condition, not the ideal one.

---

## 4. The consistency system (lock these once, reuse forever)

A reference *library* only works if every image feels like it belongs to the same set — otherwise each new image reads as a different app. Lock these parameters once and treat them as fixed constants in every prompt:

| Parameter | Lock it to | Why |
|---|---|---|
| Cookware | One specific pan (e.g., matte black skillet) + one pot | Beginners subconsciously use the pan as a constant; a shifting pan adds noise |
| Surface / background | One light, neutral, matte surface | Coherence + subject pops at thumbnail size |
| Lighting | Bright, even, neutral daylight, no colored shadows | Color accuracy + set coherence |
| White balance | Neutral (never warm) | Warmth falsifies doneness color |
| Angle-per-category | Top-down for boards/contents; low for surfaces; cross-section for interiors | Comparability within a category |
| Aspect ratio | Pick one (1:1 is safest for inline glance cards) | Consistent layout in-app |
| Styling | None — no garnish, props, or text baked in | Diagnostic feature stays the hero |
| Realism level | Achievable home result, not restaurant hero | Doesn't demoralize beginners |

Brand note: these can live *inside* your visual language (the neutral surface can lean toward your palette, framing can feel like Choppd) — but **accuracy outranks brand styling every time.** Never let the orange (#FF6B35) tint a shot in a way that shifts perceived doneness color. Brand shows up in the frame, the card design, and the composition around the image — not in color-grading the food.

---

## 5. Generating the images: prompt system

### 5.1 The reusable base scaffold
Build every prompt from one scaffold and swap only the variable slots. This is what enforces consistency.

```
[ANGLE] photograph of [SUBJECT IN SPECIFIC STATE], shown in a
[LOCKED COOKWARE] on a [LOCKED SURFACE]. Bright, even, neutral
daylight; neutral white balance; no colored or dramatic shadows.
Clean minimal composition, subject fills the frame, no garnish,
no props, no text, no labels. Realistic everyday home-cooking
result — not styled or glossy restaurant food. Sharp focus on
[DIAGNOSTIC FEATURE]. [SCALE ANCHOR, if size matters].
[ASPECT RATIO].
```

Variable slots to fill per image:
- **ANGLE** — "Top-down" / "Low 20-degree side angle" / "Clean cross-section"
- **SUBJECT IN SPECIFIC STATE** — be exact about the state, not just the food
- **DIAGNOSTIC FEATURE** — name the exact property the beginner is checking
- **SCALE ANCHOR** — knife edge / tablespoon / hand, only when size is the point

### 5.2 Worked examples

**Golden sautéed onions (target state):**
> Top-down photograph of diced onions sautéed to soft golden, in a matte black skillet on a light neutral surface. Bright, even, neutral daylight; neutral white balance; no colored shadows. Clean minimal composition, onions fill the frame, no garnish, no props, no text. Realistic home-cooking result, not glossy restaurant food. Sharp focus on the even soft-golden color and slight translucency of the onion pieces. Square 1:1.

**A gentle simmer (surface-state, needs the side angle):**
> Low 20-degree side-angle photograph of water at a gentle simmer in a pot on a light neutral surface. Bright, even, neutral daylight; neutral white balance. Clean minimal composition, no props, no text. Sharp focus on the small bubbles rising gently at the edges with a barely-moving surface — not a rolling boil. Square 1:1.

**Diced onion size reference (needs scale anchor):**
> Top-down photograph of evenly diced onion on a light neutral cutting board. Bright, even, neutral daylight; neutral white balance. Clean minimal composition, no garnish, no text. The edge of a chef's knife sits alongside for scale. Sharp focus on the uniform roughly-1cm cube size of the pieces. Square 1:1.

### 5.3 Always-exclude list (negative-prompt intent)
Bake these avoidances into every prompt: no text or labels in the image; no hands unless used as a scale anchor; no dramatic, moody, warm, or restaurant lighting; no garnish or decorative scatter; no steam obscuring the food *unless steam is itself the cue*; no unrealistic gloss or wetness; no second dish or background clutter; no colored shadows.

### 5.4 Locking style across the library
Generate one image you're happy with as a **style anchor**, then feed it back as a reference/conditioning image (Nano Banana supports image-conditioning) so every subsequent generation inherits the same pan, surface, lighting, and grade. Reuse the identical scaffold text and only change the variable slots. This is how 50 images end up looking like one intentional set instead of 50 unrelated photos.

For comparison sets: generate each panel from the *same* prompt with only the state-words changed, ideally conditioned on the same anchor, so the panels differ *only* in the thing you're teaching.

---

## 6. Accuracy & food-safety caveat — read before generating any doneness image

Generated images can be confidently *wrong* in ways that matter. An image model asked for "medium-rare steak" may render something closer to rare; "cooked chicken" may render an interior that isn't actually safe. For most things (onion color, dice size) a small error is harmless. For **meat, poultry, pork, and eggs, undercooking is a health risk**, and a misleading reference image is worse than no image.

So, two rules for the high-stakes tier:
1. **Validate every doneness image against a real reference** before it ships. Don't trust the model's idea of "done" for anything with a food-safety edge.
2. **For meat and poultry, make internal temperature the authoritative cue and treat the image as support, not proof.** Teach the beginner the number (via your TTS/step copy) and let the cross-section image *illustrate* it. This is both safer and better cooking pedagogy — real cooks judge meat by temp, not just by looks. Consider real photography for the highest-stakes doneness states rather than generation.

Everything in the non-safety tiers (vegetables, sauces, sizes, textures, pasta) is fair game for generation with normal validation.

---

## 7. The build list (prioritized)

Grouped by tier and tagged with angle and whether it wants a comparison set. Start at the top — these are the highest-frequency beginner freeze-points across your existing recipes (one-pot pasta, steak, eggs).

### Tier 1 — Photos, high priority (build first)

| Image | Angle | Comparison set? | Notes |
|---|---|---|---|
| Diced onion (size ref) | Top-down | Optional: rough chop / dice / mince strip | Scale anchor required |
| Minced garlic | Top-down | — | Scale anchor helps |
| Onion sauté progression | Top-down | **Yes** — raw → softened → golden → caramelized | Your single most reused reference |
| Garlic: fragrant vs. browning vs. burnt | Top-down | **Yes** — triptych | Burnt garlic = bitter dish; critical fail-state |
| Gentle simmer | Low side | **Yes** — simmer vs. rolling boil | Classic beginner confusion; surface is the signal |
| Oil ready (shimmer vs. smoking) | Low side | **Yes** — pair | Smoking = too hot; prevents scorching |
| Pasta al dente vs. mushy | Top-down + cut piece | **Yes** — pair | Hard to shoot; a bitten cross-section reads best |
| Sauce reduced (coats a spoon) | Low side, on spoon back | — | The "coats the back of a spoon" test, shown |

### Tier 1 — Photos, second wave

| Image | Angle | Comparison set? | Notes |
|---|---|---|---|
| Butter: melted / foaming / browned / burnt | Low side | **Yes** — progression | Foaming = ready to cook; browned is a feature, burnt is a fail |
| Pan preheated (water-droplet test) | Low side | — | Shows *how to check*, not just the pan |
| Scrambled eggs: soft-set vs. overcooked | Top-down | **Yes** — pair | Beginners chronically overcook |
| Fried egg: white set, yolk runny | Low side | — | The set-white / liquid-yolk distinction |
| Fond / browning in the pan | Top-down | — | Teaches that brown bits = flavor, not burning |

### Tier 1 — Photos, food-safety tier (validate hard / consider real photography)

| Image | Angle | Comparison set? | Notes |
|---|---|---|---|
| Steak doneness cross-sections | Cross-section | **Yes** — rare / med-rare / med / well | Pair each with its internal temp in copy |
| Chicken done (interior + juices) | Cross-section | — | Temp is authoritative; image supports |
| Sear crust on steak (exterior) | Low side | — | Non-safety; the browned crust target |

### Tier 2 — Motion (separate, smaller batch, do after photos)

| Clip | Why it must move |
|---|---|
| Claw grip + rock chop | Grip and motion can't be taught by a still |
| Dicing an onion (cross-hatch method) | It's a sequence, not a state |
| Mincing garlic (smash → peel → mince) | Sequence |
| Folding soft eggs with a spatula | The gentle fold motion is the whole point |
| Pan flip / spatula flip | Timing and motion |

---

## 8. Suggested production workflow

1. **Lock the visual system first.** Generate and approve one style-anchor image (pan, surface, lighting, grade). Everything conditions on it.
2. **Batch Tier 1 high-priority photos** using the scaffold, changing only variable slots. Generate comparison-set panels from identical prompts.
3. **Validate the food-safety tier against real references** before anything ships; wire meat/poultry images to their temperatures in copy.
4. **Ship in tiers.** The onion progression, simmer-vs-boil, garlic fail-states, and dice-size reference alone will cover a large share of real beginner freeze-points — you don't need the whole catalog before the first images earn their keep.
5. **Only build Tier 2 motion** for the techniques a still genuinely can't teach. Keep it small; it's the expensive tier.
6. **Prune with the Glance Test.** Before adding any image, name the exact judgment call it resolves in two seconds. No judgment call, no image.

---

### The through-line
You're not building a cookbook's photography. You're building a set of two-second answers to *"is mine right, and if not, which way?"* — shot realistically enough that a beginner sees their own pan in it, consistent enough to read as one system, and accurate enough to trust where it matters. Generate backwards from the judgment call, every time.
