# Scrambled Eggs — Voice + Accuracy Spec, Pass 2 (drop-in for build agent)

**For:** the build/coding agent.
**Builds on:** `EGGS_VOICE_REWRITE_SPEC` (pass 1, already implemented). This pass does three things: (1) two accuracy fixes, (2) one flat `tip` cue gets personality, (3) a small, **curated** set of extra personality adds.

**Where the strings live:**
- `mvp/cues.js` → `window.SCRAMBLED_EGGS` (recipe metadata, `prep`, `prePhase`, `cues`)
- `mvp/app.js` → `eggsControlsHTML`, `eggsPrepSteps`, `eggsPrePhase`, `eggsCues`, `EGG_STOVE`, `EGG_FATS`

---

## 0. Hard rules — read before editing

1. **Text only.** Do not change any `at` timing, `heat`, `haptic`, `type`, gate structure, buttons, image refs, portion math, preheat **durations**, or fat/stove **logic**. Cooking instructions stay accurate.
2. **Match by exact string** (find the "NOW", replace with "NEW").
3. **Clarity beats comedy.** Every changed line still leads with the clear instruction. A joke that obscures the action gets cut.
4. **Never tease the user.** Point humor at the food, the situation, the deli, instinct — never the person cooking.
5. **DO NOT add humor anywhere not listed in this spec.** Specifically, **leave Cues 1, 4, and 7 exactly as they are** — they're the critical-action moments (drop the heat / figure-8 / off the heat) and stay clean. Also do not pile additional jokes onto Cues 2, 3, 8, or 9 — they already carry their seasoning from pass 1.

---

## 1. Accuracy fixes (not optional)

### 1-A — Make the shown total time stove-aware (electric is being oversold)

The displayed "~8 min" is right for **gas** but wrong for **electric**, whose preheat alone is 240s (4 min). Fix:

- **Gas (unchanged):** `~8 min — ~3 min prep + preheat, ~5 min cook`
- **Electric (new):** `~10–11 min — ~5–6 min prep + preheat, ~5 min cook`

The stove selection already flows through `EGG_STOVE`, so branch the displayed time the same way the preheat duration is already branched.

**If branching the displayed total isn't trivial,** use a single stove-agnostic version instead:
- Total: `8–11 min` · breakdown: `prep + preheat varies by stove (electric takes longer), then ~5 min cook`

> Note: I'm estimating the prep portion. If the actual prep-wizard length differs, adjust the prep number and round the total to match — keep it honest, round **up** rather than down.

### 1-B — Soften the cost claim in Cue 9 (`beginner`)

The audience knows what eggs cost; "fifty cents" reads as undersell and dents credibility. Change the number only — keep the rest of the line.

- NOW: `... made by you, for about fifty cents. The deli would've charged you six. Nice work. First of many.`
- NEW: `... made by you, for about a buck. The deli would've charged you six. Nice work. First of many.`

(The `$6` deli comparison still lands hard, and "about a buck" is unimpeachable.)

---

## 2. Cue 6 — give the one flat `tip` cue some personality

Cue 6 (`at 145`, `type: tip` — "Still glossy & wet"). It's a non-critical observation beat, so a dry line is safe. **Keep the look-for signal (wet/glossy = good) crystal clear** — that's the whole point of this cue.

**`body`**
- NOW: `Eggs should look glossy and slightly underdone.`
- NEW: `Eggs should look glossy and a little underdone — wetter than feels right. Trust it.`

**`beginner`**
- NOW: `The eggs should still look a little wet and glossy — that's good. They'll keep cooking from their own heat once you stop.`
- NEW: `The eggs should still look a little wet and glossy — yes, even though your gut says cook them longer. Your gut's wrong here. They keep cooking from their own heat once you stop.`

**`voice`**
- NOW: `Keep them glossy and a little wet. Almost there.`
- NEW: `Keep them glossy and a little wet. Looks underdone — that's the point. Almost there.`

---

## 3. Curated extra personality (do these, and ONLY these)

Light, dry, one beat each. Do not exceed what's written.

### 3-A — Preheat step "Pan on HIGH — empty" (`prePhase`)
- NOW: `Put your empty pan on the burner and turn it to HIGH. Nothing in it yet — no butter, no oil. We're just getting it hot.`
- NEW: `Put your empty pan on the burner and turn it to HIGH. Nothing in it yet — no butter, no oil, no eggs. Just the pan and the heat, getting acquainted.`

### 3-B — Fat selector description (`eggsControlsHTML` / `EGG_FATS`)
- NOW: `Butter tastes best, but any of these work. It goes in the pan, not the bowl.`
- NEW: `Butter tastes best — but oil, spray, whatever you've got, it all works. Goes in the pan, not the bowl.`

### 3-C — Stove selector description (`eggsControlsHTML` / `EGG_STOVE`)
- NOW: `Electric burners heat slower, so we give the pan longer to preheat.`
- NEW: `Electric burners heat slower, so we give the pan longer to preheat. Not your fault — just physics.`

### 3-D — Prep Step 2 "How to do it", the over-beat bullet
- NOW: `Don't over-beat — the moment it's evenly blended, stop. Over-beating thins the eggs and makes the texture weepy.`
- NEW: `Don't over-beat — the second it's evenly blended, stop. Keep going and you thin the eggs out and they turn weepy. Nobody wants weepy eggs.`

> That's the full list. Do not add personality to any other prep bullet, cue, gate, or button.

---

## 4. Self-check before you finish

- [ ] Gas time unchanged; electric time now shows the longer total.
- [ ] Cue 9 says "about a buck" (deli "$6" line intact).
- [ ] Cue 6 still clearly tells the user wet/glossy = done-enough.
- [ ] Only the 4 items in §3 got extra personality — nothing else.
- [ ] Cues 1, 4, 7 untouched. No timings/heat/haptics/gates/images/logic changed.
- [ ] No line teases the user — only the food, the situation, the deli, or instinct.
