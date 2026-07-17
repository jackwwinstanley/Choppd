# One-Pot Pasta — Choppd A+ Voice Audit & Implementation Plan

Audit of `window.ONEPOT_PASTA` ([mvp/cues.js:501](mvp/cues.js#L501)) against [CHOPPD_CUES_A_PLUS_PROMPT.md](CHOPPD_CUES_A_PLUS_PROMPT.md). Copy-only scope — no timing, `type`, `heat`, `haptic`, gate structure, buttons, `opt`, or portion math changes.

**Money enemy for this recipe (from the prompt's table):** the Wednesday-night DoorDash cart — **~$23 out → ~$4 at home.**

---

## Part 1 — The Audit

### Arc analysis (the recipe as a whole)

The rubric grades a recipe on its **arc**: light edge in prep → entertain the wait → clean on critical moves → warm at gates → outcome payoff at the finish.

**What's working:**
- **Clarity is strong end to end.** No buried instructions, no lost safety/technique detail — zero automatic-F conditions. Every "off the heat," "don't rush or it breaks," "1–2 tbsp not the full cup" survives.
- **No user-insults anywhere** — nothing punches at the cook. Clean on Rule 1.
- **THE DROP (3:03)** genuinely feels like a moment — the one cue that earns its beat-sync.
- **The simmer timer** already has a real dry beat ("the pasta has trust issues").

**What's dragging it below A:**
1. **The FINISH is flat and fails the ship bar.** "That's the cook. Enjoy it." carries no OUTCOME — no money-vs-DoorDash beat, no capability/identity, no forward close. The rubric is explicit: a finish that reads like "nice work" is a **fail**. This is the single highest-leverage miss.
2. **Under-voiced middle.** Cues 1–3 and 5–6 read like a neutral recipe app, not Choppd. The `tip` cues (esp. **Adjust the consistency, 5**) are low-stakes humor slots being wasted — those are the *best* in-cook slots to carry the voice.
3. **The longest wait has a joke but no micro-action.** The 10-min simmer teases the impulse but doesn't hand the cook something to *do* ("grate the parm while you wait"). Rubric wants both.
4. **Bug — the finish leaks the song name to own-track cooks.** Cue 8 (`finish`) has **no `custom` variant** but its `beginner` says "start to finish with the soundtrack." Every other Phase-2 cue strips song refs in `custom`; this one can't, so a bring-your-own-track cook sees the wrong song named. Guardrail #5 violation baked into the current copy.

**Overall recipe grade: B− (clear and safe, but under-voiced, and the finish doesn't land the payoff).**

---

### Grade table

| # | Cue / element | `at` | Type | Register (target) | Grade | One-line reason |
|---|---|---|---|---|---|---|
| **Phase 1** | | | | | | |
| P0 | Intro line | — | intro | Clear + light edge | **B−** | Clear, but no dry beat / anti-pretension edge. |
| P1 | Butter + garlic | — | step | Clear + light edge | **B−** | Technique preserved ("don't brown"); voice neutral. |
| P2 | Pasta + broth in | — | step | Clear + light edge | **C+** | Purely functional, zero voice. |
| P3 | Bring to a simmer | — | step | Clear + light edge | **C+** | Purely functional, zero voice. |
| P4 | **Simmer timer** (longest wait) | — | timer | Humor + micro-action | **B** | Good joke, **missing the micro-action** the rubric wants. |
| P5 | Doneness gate | — | gate | Warm + reassuring | **B** | Clear + warm-ish; question and labels fine, not remarkable. |
| P6 | Transition ("Drop it") | — | transition | Clear + a moment | **B+** | The handoff lands; slightly generic hype vs. dry Choppd. |
| **Phase 2** | | | | | | |
| 1 | Off the heat — rest | 0:00 | tip | Clear, dry edge | **B−** | Clear; plain. Short rest, low-stakes slot left clean. |
| 2 | Cream in — slow stir | 0:49 | action | Clear (fenced-ish) | **B** | "Don't rush or it breaks" is great; otherwise plain. |
| 3 | Parmesan in — melt slow | 1:45 | action | Clear, dry edge | **B−** | Clear; another wasted low-stakes voice slot. |
| 4 | **THE DROP — taste & season** | 3:03 | action | Signature sync — a moment | **A−** | Feels like a moment; a touch generic-hype vs. dry. |
| 5 | Adjust the consistency | 3:27 | tip | Clear, dry edge | **C+** | Best humor slot in the cook, totally un-voiced. |
| 6 | Basil + plate | 4:19 | baste | Warm | **B** | "You made it" is warm; fine, unremarkable. |
| 7 | Admire it | 5:00 | tip | Warm payoff (pre-finish) | **B−** | Warm, but does pre-payoff work the finish should escalate. |
| 8 | **Plated (FINISH)** | 5:54 | finish | Warm outcome payoff | **C−** | **Fails ship bar** — no outcome, no money beat; leaks song name to own-track cooks. |

**Ship bar reminder:** every cue ≥ A−, FINISH + every GATE = A. Currently failing on the FINISH (C−) and several under-voiced cues (C+/B−).

---

### Per-cue detail (why each grade)

**P4 · Simmer timer — B.** This is the recipe's longest dead-time (10 min). The instruction is clear ("stir every 2 minutes, don't wander off") and the beat ("trust issues") is genuinely Choppd. But the rubric's dead-time rule wants a **micro-action** to fill the silence — there's nothing to *do*. One notch off A.

**Cue 4 · THE DROP — A−.** Register correct (signature beat-sync = "a moment"), instruction clear (taste + season now). It leans slightly on generic hype ("HERE IT IS", "bold, decisive, no second-guessing") where dry-confident would hit harder, but it's the strongest cue in the set. `custom` correctly strips the song ref.

**Cue 5 · Adjust the consistency — C+.** Technically solid (the 1–2 tbsp / "not the full cup" detail is preserved and important). But it's a `tip` cue — the rubric names these the *best* in-cook humor slots — and it's completely flat. Punching at restaurant "finishing the sauce" pretension here is free voice.

**Cue 8 · FINISH — C−.** The most important line in the recipe. Current: `body: "That's the cook. Enjoy it."` / `voice: "That's the cook."` — no capability beat, no money-vs-DoorDash, no forward close. Per the FINISH FORMULA this is a fail. **Plus** the `beginner` names the Choppd soundtrack with no `custom` fallback, leaking the song to own-track cooks.

---

## Part 2 — Implementation Plan (for the build agent)

### 0. Setup & guardrails (read first)

- **File:** [mvp/cues.js](mvp/cues.js), object `window.ONEPOT_PASTA` (starts [line 501](mvp/cues.js#L501)). Phase 1 lives in `prePhase` (~L539–550); Phase 2 in `cues[]` (~L553–616).
- **Copy-only.** Do NOT touch `at`, `type`, `heat`, `haptic`, `noCheckpoint`, `finishButton`, gate/timer *structure*, `opt`, `portion`, `durationSec`, `bpm`, or image refs. Rewrite only `title`, `body`, `beginner`, `voice`, `intro`, step `body`, timer `label`/`earlyLabel`, gate `question`/`*Label`, transition `title`/`body`, and every `custom.*`.
- **Mirror across variants.** Every Phase-2 cue that has a `custom` block must get the *same* voice upgrade in both the default copy and the `custom` copy — and the `custom` copy must stay **fully song-agnostic** (no "the soundtrack," "the soundtrack pool," "the ballad," "the rock drop," "the opera," "the outro").
- **Preserve every actionable detail:** "off the heat," "don't rush or the sauce breaks," "a handful at a time," "1–2 tbsp not the full 2 cups," "stir every 2 minutes," "don't let it brown." Losing one = automatic F.
- **After edits:** sanity-check the JS parses (JavaScriptCore via osascript per `.claude/settings.json`); no syntax breakage from quotes/em-dashes. Then commit (repo convention: commit after each change).

### Order of work (highest leverage first, per the rubric's PROCESS)

1. **FINISH (cue 8)** — carry the outcome. *(fixes the C− ship-bar failure)*
2. **Fix the song-leak** — add a `custom` to the finish (and audit all `custom` blocks are song-agnostic).
3. **Longest WAIT (P4 simmer timer)** — add a micro-action.
4. **Admire it (cue 7)** — sharpen the pre-payoff so it escalates *into* the finish, not competes with it.
5. **THE DROP (cue 4)** — trade generic hype for dry-confident.
6. **`tip` cues (5, 3) + P0–P3 prep** — spend the wasted voice slots.
7. Re-grade the whole arc; revise until every cue ≥ A− and FINISH = A.

---

### Task 1 — FINISH cue (cue 8, ~L610). Priority: ship-bar.

Formula: **[clear final instruction] + ONE warm outcome beat (capability + money vs DoorDash) + forward close.** Keep `voice` short and natural to hear.

```
body:     "That's the cook. Enjoy it."
→         "One pan, no takeout, no delivery fee. That's dinner — go eat it."

beginner: "And that's the cook — the song fades out as you finish. Creamy one-pot garlic parmesan pasta, start to finish with the soundtrack."
→         "And that's the cook — creamy one-pot garlic parmesan pasta, start to finish, in one pan you actually have to wash. The DoorDash version of this shows up lukewarm for like twenty-three bucks; you just made it hot for about four. First of many. Go eat."

voice:    "That's the cook."
→         "That's the cook. One pan, no delivery fee — go eat."
```

**Grade target: A.** Carries capability (*you made this*) + money vs the right enemy (~$23 → ~$4) + forward close ("first of many"). Punches at DoorDash, never the user.

### Task 2 — Fix the song-leak (add `custom` to the finish)

Cue 8 currently has no `custom`, so own-track cooks see "the soundtrack." Add a song-agnostic `custom` mirroring the new default (the new `body`/`voice` above are already song-agnostic, so only `beginner` needs a variant):

```js
custom: {
  beginner: "And that's the cook — creamy one-pot garlic parmesan pasta, start to finish, in one pan you actually have to wash. The DoorDash version shows up lukewarm for like twenty-three bucks; you just made it hot for about four, to your own soundtrack. First of many. Go eat.",
},
```

Then **verify every other `custom` block** in Phase 2 (cues 1, 2, 3, 4, 6, 7) stays song-agnostic after rewrites — no "ballad," "rock drop," "opera," "outro," "piano intro."

### Task 3 — Longest WAIT: simmer timer (P4, ~L547). Add a micro-action.

Keep the hard instruction (stir cadence, uncovered, don't wander) and add something to *do*:

```
label:      "Simmer uncovered, stir every 2 minutes. Don't wander off — the pasta has trust issues."
→           "Simmer uncovered, stir every 2 minutes — it sticks the second you leave. Use the gaps to grate the parmesan so future-you isn't scrambling."

earlyLabel: "Pasta's done early ▸"   (leave as-is — clear and fine)
```

**Grade target: A.** Instruction intact, dry beat intact, now has the micro-action ("grate the parm") the dead-time rule requires.

### Task 4 — Admire it (cue 7, ~L602). Make it the *pre*-payoff.

It's `noCheckpoint`/`finishButton` and lands right before the finish. Keep it warm; let it set up the finish rather than duplicate it (money beat belongs in the finish). Current copy is close — tighten to one clean warm beat + the micro-action ("pour something"):

```
beginner: "Put the fork down for a second. Look at what you made. Creamy, glossy, perfectly seasoned one-pot pasta — cooked to the soundtrack. Pour a drink. You earned it."
→         "Fork down for a second. Look at what you actually made — creamy, glossy, seasoned like you meant it, cooked start to finish to one song. Pour something. Then dig in."
```
Mirror the same edit (song-agnostic) in `custom.beginner`. Keep `body`/`voice` warm and clean. **Grade target: A−/A.**

### Task 5 — THE DROP (cue 4, ~L579). Dry-confident over generic hype.

Already A−; nudge to A by trading "HERE IT IS / no second-guessing" hype for dry Choppd, keeping the instruction (taste + season now) unmistakable:

```
beginner: "HERE IT IS — the rock drop. Taste the sauce right now. Season hard with salt and pepper to taste. This is the moment — bold, decisive, no second-guessing."
→         "This is the drop the whole cook's been building to. Taste it right now, then season hard — salt and pepper, more than feels polite. Restaurants call this 'finishing'; you're just making it taste like something."
```
`custom` (song-agnostic) already exists — mirror the "season hard, more than feels polite / this is what makes it taste like something" energy without the "drop" ref. Keep `body` instruction-first. **Grade target: A.** *(Note: this cue is action-adjacent — keep the taste-and-season instruction 100% clean; the pretension jab trails after it.)*

### Task 6 — Spend the wasted voice slots (`tip` cues + prep)

Lower stakes → safe for one dry beat each. **Do not over-season — vary density; if two land next to each other, keep the stronger one.**

**Cue 5 · Adjust the consistency (~L587)** — best slot in the cook:
```
beginner: "Too thick? Stir in a splash of the reserved broth (1-2 tbsp, not the full 2 cups) to loosen it. Too thin? Let it sit — it thickens fast as it cools. Taste one more time and adjust."
→         "Too thick? Loosen it with a splash of the reserved broth — a tablespoon or two, not the whole cup. Too thin? Just let it sit; it tightens up fast as it cools. Taste it one more time. This is the part a restaurant charges you an extra twelve bucks for and calls 'finishing the sauce.'"
```

**Cue 3 · Parmesan in (~L571)** — keep clean instruction, add one dry beat in `beginner` only (e.g. "a handful at a time — dump it all in and it clumps into a sad cheese rope"). Preserve "a handful at a time / stir until glossy."

**P0 Intro / P1–P3 steps (~L541–545)** — one light anti-pretension beat total across prep (not one per line). Suggested on the intro:
```
intro: "No music yet — let's get the pasta going first. The song drops once it's tender."
→      "No music yet — get the pasta going first. The song earns its entrance once the pasta's tender."
```
Keep P1's "don't let it brown," P2's amounts, P3's "2–3 minutes" verbatim in the instruction.

**Leave clean (fenced / already fine):** Cue 1 (off the heat), Cue 2 (cream pour — "don't rush or the sauce breaks" is the whole point), Cue 6 (basil + plate), P5 gate, P6 transition. A trailing dry beat is optional on these but not required; when unsure, leave clean.

---

### Verification checklist (before finalizing)

- [ ] Every rewritten line preserves its original actionable/safety detail (diff each before→after for lost specifics).
- [ ] FINISH grades A (outcome + money-vs-DoorDash + forward close) and every gate stays warm/reassuring.
- [ ] Every `custom` block is fully song-agnostic; the finish now has a `custom`.
- [ ] No cue insults the user; jabs land on takeout / restaurants / pretension only.
- [ ] `voice` fields read naturally spoken (no visual-only jokes, no punctuation gags).
- [ ] Humor density varies — no three wisecracks in a row; warm beats allowed to land.
- [ ] JS still parses (osascript/JavaScriptCore); commit with a message noting the A+ voice pass.
- [ ] Present the full before→after change list for review before shipping (PROCESS step 7).

### Expected post-fix grades

| Cue | Before | After (target) |
|---|---|---|
| FINISH (8) | C− | **A** |
| Adjust consistency (5) | C+ | **A−** |
| Simmer timer (P4) | B | **A** |
| Admire it (7) | B− | **A−** |
| THE DROP (4) | A− | **A** |
| Parmesan (3) | B− | **A−** |
| Intro/prep (P0–P3) | C+/B− | **A−/B+** |
| **Recipe (arc)** | **B−** | **A / A+** |
