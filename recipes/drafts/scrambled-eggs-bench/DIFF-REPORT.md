# DIFF-REPORT — pipeline draft vs the real post-fix Scrambled Eggs

Comparing `recipes/drafts/scrambled-eggs-bench/recipe.md` (pipeline output,
3 verification iterations) against the shipped `SCRAMBLED_EGGS` in
`mvp/cues.js` + its `eggsPrePhase`/`EGG_STOVE`/`EGG_FATS` machinery.

> **Contamination caveat, stated up front:** the implementer that ran this
> pipeline also authored the real recipe's recent fixes, and the format
> doc's worked example IS this recipe. The draft cannot be treated as a
> blind generation; treat deltas as diagnostics about the RULES, not as a
> capability measurement. The first honest capability test is a novel dish.

## 1. Heat-sequence deltas

| Moment | Real recipe | Draft | Verdict |
|---|---|---|---|
| Preheat | HIGH, empty; gas 90s / electric 240s; water-drop gate; skippable | Identical pattern (copied from the exemplar, as the orchestrator instructs) | ✅ match |
| Fat in | Drop to medium-high, fat variants via EGG_FATS | Same, plus a **direction-neutral "set the heat"** wording and a **⏸ park-at-medium hold path** at the preheat gate | Draft adds robustness the real recipe lacks |
| Set → fold | medium-high → medium-low at the figure-8 | Same, plus **explicit electric dial-drop guidance** (lift the pan 20–30s while the coil cools) | Draft addition; real recipe relies on the generic heat-badge note |
| Off heat | Slide off the burner, dial-off-isn't-enough | Same, **plus "turn the burner OFF"** | ⚠️ the red-team catch **applies to the shipped recipe too**: no shipped cue ever says to turn the burner off |

## 2. Timing deltas

| | Real cue ladder | Draft cue ladder |
|---|---|---|
| `at` values | 0, 25, 55, 80, 110, 145, **170, 185**, 205 | 0, 25, 55, 85, 115, 140, **160, 185**, 205 |

- The draft retimed to satisfy the format doc's **≥20s cue-density floor**.
  The **shipped recipe violates it**: 170→185 is a 15s gap. Diagnostic:
  either relax the rule to ≥15s or retime the shipped recipe — the rule
  and the flagship currently disagree. (The draft's 160→185 also buys the
  red-team's "physically enough time to find the towel" complaint.)
- Draft `totalTimeMin: 8` matches shipped (electric 11 handled by the
  stove-dependent machinery in both).

## 3. Copy-quality deltas

- **Brand voice: the real recipe wins clearly.** Shipped copy has the
  Choppd register — "We're not making rubber", "Your gut says keep
  cooking; your gut is wrong", "You've got this". The draft is
  rule-compliant but flatter; it converged on utilitarian phrasing because
  **no verifier checks tone**. (Recommendation #4.)
- **Structural copy: the draft is stricter.** Every until-X has a range,
  the set-gate has an already-overset branch, the rubbery rescue surfaces
  in-flow, per-fat recovery lines exist for all four fats (the shipped
  recipe's spray variant has no too-hot recovery either).
- **Spoken-line hygiene:** the shipped voice line at the fold cue contains
  a digit — `"…then start the figure-8 — trace an eight…"` — which the
  copy-checker's §6 rule flags. Diagnostic: either verify Kokoro
  pronounces "figure-8" correctly and relax the rule to allow it, or fix
  the shipped line to match the rule.

## 4. What the real recipe knows that the pipeline missed

1. **The nudge system**: shipped gates carry tuned `checkCoach` +
   `nudgeSec` re-prompts ("Are the bottom and edges solid white…? Tap once
   they've set" at 25s). The draft supplied nudgeSec values but its
   checkCoach lines are thinner — the doc doesn't teach what a good nudge
   sounds like. → add a nudge-copy example to RECIPE_FORMAT.md §4.
2. **`fat: true` cue tagging**: the shipped implementation marks exactly
   which cues the fat-swap transform touches; the draft's
   `text_alts`/`voice_alts` blocks imply it but don't declare the
   transform scope. → §11 receipt step could formalize the mapping.
3. **The doneness-gate image discipline**: the shipped cue-6 image is
   curated as THE done-state reference; the draft's prompt says so but
   only because §7 does — parity, credit to the doc.
4. **Warmth at failure points** ("No rush", "You've got this") — see the
   brand-voice gap above.

## 5. What the pipeline caught that the shipped recipe lacks (backport candidates)

1. **No burner-off instruction anywhere in the shipped recipe** — a
   first-timer plates up and walks away from a live coil. Backport:
   append to the shipped off-heat cue.
2. **Shipped tip cues at 110/145 are checkpoints** (no `noCheckpoint`),
   so a lingering cook parks eggs on live medium-low heat mid-fold — the
   exact failure the red-team scripted. Backport: `noCheckpoint: true` or
   off-heat escape copy.
3. **Preheat-gate linger**: shipped gate has no "ready before you are"
   hold guidance; an empty nonstick pan can sit on HIGH for minutes.
4. **15s cue gap** (170→185) vs the density rule — see §2.

## 6. Rule/verifier strengthening recommendations (the point of this diff)

1. **Resolve the ≥20s density rule vs the shipped 15s gap** — pick one;
   currently the spec fails the flagship.
2. **Decide the digit-in-voice-line policy** using a real Kokoro
   pronunciation check of "figure-8".
3. **Backport the four §5 items** to the shipped recipe (small copy/flag
   edits, one session).
4. **Consider a brand-voice check** — either a 7th verifier with 3–4
   shipped-copy exemplars as the register reference, or an extension of
   copy-checker. The draft proves rule-compliance ≠ Choppd voice.
5. **Red-team earns its keep** — it found 12 of the 24 violations,
   including two regressions introduced by the repair loop itself and two
   latent issues in the SHIPPED recipe. Keep it last in the fan-out and
   never skip it.
