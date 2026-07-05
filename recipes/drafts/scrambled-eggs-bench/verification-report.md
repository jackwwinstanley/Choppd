# Verification report — scrambled-eggs-bench

Pipeline run: `/new-recipe "scrambled eggs" --have "eggs, butter, milk, salt" --type synced`
Result: **ALL SIX VERIFIERS PASS** after 3 iterations (max allowed: 3).

## Verdict history

| Verifier | Iter 1 | Iter 2 | Iter 3 |
|---|---|---|---|
| format-checker | FAIL (2) | **PASS** | — |
| heat-physics-checker | FAIL (2) | **PASS** | — |
| timing-auditor | FAIL (3) | FAIL (1) | **PASS** |
| copy-checker | FAIL (2) | **PASS** | — |
| cross-referee | FAIL (2) | **PASS** | — |
| beginner-red-team | FAIL (8) | FAIL (4) | **PASS** |

Total violations found and repaired: **24** (19 in round 1, 5 in round 2).

## What each round fixed

**Iteration 1 → 2 (19):** missing pre-phase image slot + slot naming
convention (format ×2); missing `heat: "off"` on the two off-burner cues
(heat ×2); 30–60/“thirty”/45s three-way gate mismatch, 15s cue gap,
until-it-melts with no range (timing ×3); "figure-8" digits in two spoken
lines (copy ×2); fat alternatives existing only as a comment + hardcoded
"pinch of salt" duplicating amount-injection (cross-referee ×2); and the
red-team's eight: preheat-gate linger scorches the empty pan, per-fat
screen text missing (voice-only variants die in a loud kitchen),
pour-then-park sets the base on live heat, no already-overset branch at
the set gate, electric dial-drop lag unaddressed at the fold, tip cues
acting as checkpoints parking eggs on live heat, rubbery rescue not
surfaced in-flow, off-heat→gate gap physically too short.

**Iteration 2 → 3 (5):** olive-oil variant missing its time anchor
(timing); and the red-team's four — **two of which were regressions
introduced by round-1 fixes**: the ⏸-park-at-medium path contradicting
"bring the heat DOWN to medium-high" (now direction-neutral "set the heat
to"), the false "no rush — the pan holds" over live fat (now explicit
slide-off hold guidance), plus the spray variant lacking a too-hot
recovery and — the best catch of the run — **no cue ever said to turn the
burner OFF**, leaving a first-timer walking away from a live coil.

## Remaining warnings (non-blocking)

- The `song` block is TBD by design — founder picks the track + license;
  `durationSec: 210` and all cue `at` values assume a ≥210s track.
- `text_alts`/`voice_alts` and the stove-dependent `timer.sec` object are
  draft-format conveniences; implementation maps them onto the existing
  EGG_FATS-style transform and the stove-selector pattern.
- Copy is rule-compliant but flatter than the shipped Choppd register —
  see DIFF-REPORT.md recommendation #4 (no verifier currently checks brand
  voice).

## STOVE-TEST PLAN (risk-ranked — what to physically verify)

1. **Preheat gate, electric (highest risk):** run the full 240s electric
   preheat, then deliberately linger 3 minutes at the gate using the new
   ⏸ park-at-medium path. Verify the water-drop test still reads
   correctly after parking, and that a nonstick pan tolerates the whole
   sequence.
2. **The pour-is-the-confirm gate (cue 25):** new structure not present
   in the shipped recipe. Verify the pour→tap rhythm feels natural and
   the fat genuinely survives a ~60s pre-pour park with the slide-off
   guidance.
3. **The set gate (cue 55):** verify 30–60s edge-whitening matches
   reality at medium-high on BOTH stoves, and stress the already-overset
   branch (let it go 2 min, then follow the "you're ahead, not ruined"
   path — does it recover to acceptable eggs?).
4. **Electric dial-drop at the fold (cue 85):** verify the
   lift-off-20–30s guidance actually gets the pan to medium-low behavior
   on a coil, and that curds form on the timeline the cues assume.
5. **Timing ladder 140→160→185 (timing-auditor called these tight):**
   is 20s enough to find the towel and slide off (cue 160), and 25s
   enough for the last fold before the doneness gate?
6. **Spray variant (red-team flagged):** spray onto the just-off-HIGH
   pan using the lift-off-to-spray guidance — confirm no scorch/flare.
7. **Finish walk-away:** confirm the burner-off instruction at cue 160
   leaves the stove fully off when you plate (the safety catch).

## Cost note
15 verifier runs across 3 iterations ≈ 640k subagent tokens total.
