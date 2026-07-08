# Scrambled Eggs — Brand Voice Rewrite Spec (drop-in for build agent)

**For:** the build/coding agent.
**Goal:** Bring the user-facing copy of the **Fluffy Scrambled Eggs** recipe in line with the Choppd brand voice ("the funny friend who actually has your back"), per the register map. This is a **copy-only** change. Implement exactly as written below.

**Source of truth for current text:** `EGGS_AUDIT.md` (the existing cue & copy audit).
**Where the strings live:**
- `mvp/cues.js` → `window.SCRAMBLED_EGGS` (recipe metadata, `prep`, `prePhase`, `cues`)
- `mvp/app.js` → `eggsControlsHTML`, `eggsPrepSteps`, `eggsPrePhase`, `eggsCues`, `EGG_STOVE`, `EGG_FATS`

> **NOTE FROM PRODUCT:** Do **not** touch the music / audio track or its credit. That is intentionally out of scope. Ignore anything about the song.

---

## 0. Hard rules — read before editing

1. **Text only.** Change **only** the user-facing strings listed below. Do **NOT** change any `at` timing, `heat`, `haptic`, `type`, gate structure, button wiring, image references (`cue-*.png`), portion-scaling math, stove timer durations, or fat-branching **logic**. Cooking instructions must stay accurate — preserve every actionable detail (heat level, "don't stir," "off the heat," etc.).
2. **Match by exact string.** For each change, find the current string (left column / "NOW") and replace it with the new string ("NEW"). If a string appears in both `cues.js` and a generated helper in `app.js`, update whichever is the live source so the rendered output matches the NEW text.
3. **Clarity beats comedy.** Every line below still leads with the crystal-clear instruction. The humor/warmth is a garnish on top — never let it bury what to do.
4. **Never insult the user.** All teasing points at the food, the situation, or the deli — never the person cooking.
5. **`body` vs `beginner` are alternates** (only one shows per user), so it's fine that some phrases repeat across them. Update both.
6. If a target string has drifted slightly from what's quoted here, match on intent and keep the NEW copy verbatim.

---

## 1. Changes to implement

Ordered by priority. **P0 first** — these are the highest-leverage moments.

### ✅ P0-A — Completion screen (Cue 9, `type: finish`, `at 205`)

This is the payoff. Warm register.

**`body`**
- NOW: `Season, plate, and eat right away while soft.`
- NEW: `Salt, a little pepper if you want it, plate up, and eat now while they're soft.`

**`beginner`**
- NOW: `Add a final pinch of salt and some pepper if you like, slide them onto a plate, and eat straight away while they're soft. You just made fluffy scrambled eggs — nice work!`
- NEW: `Final pinch of salt, some pepper if you like, slide them onto a plate, and eat straight away while they're soft. That's soft, restaurant-style scrambled eggs — made by you, for about fifty cents. The deli would've charged you six. Nice work. First of many.`

**`voice`**
- NOW: `Season with salt and pepper, plate up, and enjoy. You made fluffy scrambled eggs.`
- NEW: `Season with salt and pepper, plate up, and eat while they're soft. You just made scrambled eggs from scratch — nice work.`

**Achievement hook (conditional):** If an achievement system exists, fire it on completion of this recipe:
- If this is the user's **first ever completed cook** → unlock **"Didn't Order Takeout"**.
- Else, if the user has completed eggs before → unlock/progress **"Certified Egg Guy"**.
- If no achievement system exists yet, **skip this** and leave a `// TODO: wire eggs completion achievement` comment. Do not build the system here.

---

### ✅ P0-B — Doneness gate (Cue 8, `type: temp`, `at 185`, GATE)

The anxious "is it done?" moment. Warm + reassuring register. Keep the gate logic and buttons unchanged.

**`body`**
- NOW: `Soft, creamy, no runny raw egg in the middle. You've got this.`
- NEW: `Poke at them. Soft, creamy, still a little glossy, no runny raw egg in the middle? Pull them — they keep cooking off the heat. You've got this.`

**`beginner`**
- NOW: `Check them: soft and creamy, with no runny raw liquid left. If they're still wet and raw, put them back on low for a few more seconds.`
- NEW: `Poke at them. They should be soft, creamy, and still a little glossy — no runny raw liquid left. If they're still wet and raw in the middle, back on low for a few seconds, then check again. Pull them before they feel fully done — they finish off the heat. You've got this.`

**`voice`**
- NOW: `They should be soft and creamy, with no runny raw egg.`
- NEW: `They should be soft, creamy, and a little glossy — no runny raw egg. Pull them now; they finish off the heat.`

**Gate coaches:** leave `Done button`, `Check coach`, `Not-ready coach`, `Done coach` **unchanged.** (They're already clear and reassuring.)

---

### ✅ P1-A — Preheat timer note (`prePhase` → "Preheating the pan" timer)

The wait is dead time — entertain register. Keep all durations (90s gas / 240s electric) unchanged; only the **note** text changes.

If the note can be made **stove-aware** (the stove selection already flows through `EGG_STOVE`), use these two variants:

- **Gas note:** `Keep the pan empty while it heats — nothing in it yet. Resist the urge to poke at it; it just needs to get hot. When the timer's up, we'll do a quick water-drop test before dropping the heat.`
- **Electric note:** `Keep the pan empty while it heats — nothing in it yet. Electric burners take their sweet time, so this one's a bit of a wait. Nothing's wrong; the pan's just slow. When the timer's up, we'll do a quick water-drop test before dropping the heat.`

If branching the note is **not** trivial, use this single fallback for both:
- **Fallback note:** `Keep the pan empty while it heats — nothing in it yet. Electric burners take their time, so hang tight if it's a wait. When the timer's up, we'll do a quick water-drop test before dropping the heat.`

(Replaces the current note: `Keep the pan empty while it preheats. When the timer's up we'll do a quick water-drop test before turning the heat down.`)

---

### ✅ P1-B — "Pour in the eggs" (Cue 2, `type: action`, `at 25`)

Live cue — clear, dry edge. This cue is **fat-aware** (butter / oil / spray). Update all three branches in `EGG_FATS` / `eggsCues`. Keep the branching logic; only the strings change. The new dry tag is **"We're not making rubber."**

**`body` (per fat):**
| Fat | NOW | NEW |
|---|---|---|
| Butter | `Pour the eggs into the melted butter. Don't touch them yet.` | `Pour the eggs into the melted butter. Now leave them alone — no stirring yet. We're not making rubber.` |
| Oil (veg/olive/canola) | `Pour the eggs into the hot oil. Don't touch them yet.` | `Pour the eggs into the hot oil. Now leave them alone — no stirring yet. We're not making rubber.` |
| Cooking spray | `Pour the eggs into the coated pan. Don't touch them yet.` | `Pour the eggs into the coated pan. Now leave them alone — no stirring yet. We're not making rubber.` |

**`beginner` (per fat):** replace the fat noun the same way and append the dry tag.
| Fat | NEW |
|---|---|
| Butter | `Pour your whisked eggs into the melted butter. Now leave them completely alone — no stirring. We want them to start setting first. We're not making rubber.` |
| Oil | `Pour your whisked eggs into the hot oil. Now leave them completely alone — no stirring. We want them to start setting first. We're not making rubber.` |
| Cooking spray | `Pour your whisked eggs into the coated pan. Now leave them completely alone — no stirring. We want them to start setting first. We're not making rubber.` |

**`voice`** (not fat-specific — leave generic):
- NOW: `Pour in the eggs. Now leave them alone — don't stir yet.`
- NEW: `Pour in the eggs. Now leave them alone — don't stir yet. We're not making rubber.`

---

### ✅ P1-C — Cook warning (prep overview, the ⚠️ block)

Clear + light edge. Tighten the repetition and reframe "underdone" as the goal.

- NOW:
  `⚠️ Don't overcook them. The #1 way to wreck scrambled eggs is overcooking them. Take them off the heat while they still look soft and a little underdone — they keep cooking on the way to the plate.`
- NEW:
  `⚠️ Pull them early. The one surefire way to wreck scrambled eggs is overcooking them. Take them off while they still look a little underdone — they keep cooking on the way to the plate. Underdone is the target here, not a mistake.`

(If the warning renders a bold lead, bold **"Pull them early."**)

---

### ✅ P2 — "Let them set" gate (Cue 3, `type: action`, `at 45`, GATE)

Lower priority, light warmth/reassurance. Keep the gate buttons and coaches unchanged.

**`body`**
- NOW: `Wait — don't stir yet. Let the bottom and edges turn solid white.`
- NEW: `Wait — don't stir yet. Let the bottom and edges turn from clear to solid white. That's your signal.`

**`beginner`**
- NOW: `Hands off. Let the eggs sit on the low heat until the bottom and the edges turn from runny and clear to solid white. THAT'S your signal to start stirring — not a moment before.`
- NEW: `Hands off — I know it feels like nothing's happening. It is, for a few seconds. Let the eggs sit on the low heat until the bottom and edges turn from runny and clear to solid white. THAT'S your signal to start stirring — not a moment before.`

**`voice`**: leave **unchanged** (`Let them sit. Wait until the bottom and edges turn solid white before you stir.`).
**Gate coaches:** leave **unchanged.**

---

## 2. Leave these UNCHANGED (do not edit)

To avoid collateral edits, these touchpoints stay exactly as they are:

- **Recipe metadata** (title, technique, doneness, ingredients, equipment, portion selector) — unchanged.
- **Prep wizard gather list + Steps 1–3** (crack / beat / ready your pan) — unchanged.
- **Stove selector + Fat selector descriptions** — unchanged.
- **Phase 1 preheat:** intro copy, "Pan on HIGH — empty" step, skip button, water-drop test gate, and the "Drop to LOW — let's cook" transition — unchanged. (Only the **timer note** changes, per P1-A.)
- **Cue 1** (Drop to low + fat in, `at 0`) — unchanged. Already clear; instruction is correct as-is.
- **Cue 4** (Figure-8 stir, `at 70`) — unchanged.
- **Cue 5** (Soft curds forming, `at 110`) — unchanged.
- **Cue 6** (Still glossy & wet, `at 145`) — unchanged.
- **Cue 7** (Take them off early, `at 170`) — unchanged.
- **All `at` values, `heat`, `haptic`, `type`, gate structure, image paths, and fat/stove logic** — unchanged.

---

## 3. Self-check before you finish

For every line you changed, confirm:
- [ ] The cooking instruction is still crystal clear and accurate (heat, stir/no-stir, off-heat all intact).
- [ ] No line insults the user — teasing points at the food / situation / deli only.
- [ ] No timings, heat levels, haptics, gates, images, or logic were altered.
- [ ] Fat-aware branches (Cue 2) updated for butter, oil, and spray.
- [ ] Completion achievement either wired correctly or left as a `// TODO` (not half-built).

---

## Appendix — OPTIONAL alternate completion lines (do NOT implement unless explicitly told)

Kept on file for later A/B testing of the Cue 9 `beginner` line. **Implement only the version in §1 P0-A above.** These are alternates for Jack to choose from later, not for this pass:

- **Competence angle:** `Final pinch of salt, some pepper if you like, slide them onto a plate, and eat while they're soft. That's eggs done right — soft, creamy, not rubber. Most people never get this far. You just did. First of many.`
- **Comfort angle:** `Final pinch of salt, some pepper if you like, slide them onto a plate, and eat while they're soft. A real plate of eggs, made by you, no one's help. That's a good start to a day. Nice work.`
