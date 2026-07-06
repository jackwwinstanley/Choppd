# AGENT_FAILURE_PATTERNS.md — what agents get wrong in this repo

Every pattern below is real: observed in this repo's pipeline runs (the
scrambled-eggs benchmark, the eggs backport, the prep/phase-1 hardening)
or in the build agent's own tooling. Read this before drafting, repairing,
or patching. The verifiers exist because of these patterns; this doc
exists so the *generator* stops feeding them.

---

## 1. The repair regression — a fix that breaks a sibling path

The single most repeated failure. A fix is authored for the path the
agent is looking at and silently breaks a path it isn't.

**Real examples:**
- Added a "⏸ park at medium" hold at the preheat gate → the next cue
  still said "bring the heat **down** to medium-high" — a cook parked at
  medium turns the dial the wrong way. (Happened TWICE: benchmark draft,
  then again in the shipped recipe when the park path was backported.)
- Added an escape sentence to a cue's beginner copy → the electric-stove
  override (`EGGS_ELECTRIC_FOLD`) **fully replaces** `beginner`, so
  electric users lost the escape the moment it shipped.
- Added a reassuring hold line "no rush — the pan holds" → false: the fat
  was burning on live medium-high the whole time.
- New wizard voice line said "the **butter** goes in the pan later" — but
  the fat is user-selectable; instructions swapped per fat, the voice
  didn't.

**How to avoid:** after writing any fix, enumerate every transform that
touches that string: fat variants, stove variants, liquid variants,
method overrides, `custom` (own-playlist) copy, voice vs screen. If an
override REPLACES a field wholesale, the fix must be added to the
override too — or the field made variant-neutral so no swap is needed
(the "your fat goes in the pan later" solution).

**Don't:** ship a copy fix without grepping for the overrides/templates
that rebuild the same cue (`eggsCues`, `pastaCues`, `steakGrillCues`,
`EGG_FATS`, method objects).

## 2. Default-path blindness

Copy silently assumes the default selection (butter, broth, gas, the
bundled song).

**Real examples:** the spoken line said "add the pasta and the broth"
after the user chose water+butter; the burnt-fat recovery said "gone dark
brown" — cooking spray smokes, it never darkens; electric-only physics
(coil lag) addressed nowhere or voice-only.

**How to avoid:** for every line touching an ingredient/heat/liquid, ask
"which selection am I assuming?" and either make the line neutral or
author the variant (screen AND voice — exact-match TTS means each variant
is its own clip).

**Don't:** rely on the voice line alone for variant-critical info — the
loud-kitchen rule: anything load-bearing must exist on screen.

## 3. Quantities stated twice — and they will disagree

Any amount hardcoded in copy eventually contradicts the scaled/dynamic
source of truth.

**Real examples:** "Use 1 tsp bouillon (= 1 cube)" printed right after
the dynamic measure already said "2 cups + 2 cubes"; "pinch of salt"
rendering as "pinch of salt (1 pinch)" through amount-injection; the pan
wizard claiming a "10–15 minute preheat" against the authored 9-minute
grill timer; "~2–4 min preheat" vs a 90-second gas timer; the
water+butter step counting its butter twice ("2 cups water + 2 tbsp
butter … and drop the extra butter in").

**How to avoid:** amounts live in ONE place — the ingredients block /
the timer value / the dynamic measure — and copy references the thing,
not the number. Let amount-injection do its job. Every duration in copy
must equal the timer it sits next to (range end = timer value).

**Don't:** restate a timer in prose ("give it about 2 minutes" next to a
2-minute countdown) or write per-serving ratios as absolute totals.

## 4. Perfect-pace authoring (the lingerer blind spot)

Flows written as if the cook advances instantly. Real beginners park
2–3 minutes at every screen — with food or fat on live heat.

**Real examples:** tip cues that were checkpoints parked eggs on live
medium-low; the garlic "liquid in NOW" alert only existed if the cook
tapped an optional ▶ timer; the eggs preheat countdown restarted from
zero on tap (empty pan screaming on HIGH for 6+ minutes); no cue ever
said to turn the burner OFF; checkpoints over hot fat with no hold
guidance.

**How to avoid:** walk every screen asking "what is on heat while the
user reads this, and what happens if they stay 3 minutes?" Every
parkable moment over heat needs a hold/escape line; safety nudges
auto-start, never behind optional taps; `noCheckpoint: true` for tips
that have no confirmable action.

**Don't:** put a checkpoint on a moment whose only effect is parking
food on heat, and don't write "wait until X" gates a low electric
setting can't physically satisfy.

## 5. The signal points at the wrong action

Cue copy that names the NEXT cue's action as this cue's signal.

**Real example:** "solid white — THAT'S your signal to start stirring"
on a cue whose button confirmed "they've set" (stirring belonged to the
next cue). The fix: the signal points at what THIS cue's confirm does
("once you see it, tap continue"); the `doneCoach` is where the handoff
to the next action lives.

## 6. Stale copy surviving a redesign

When a mechanic changes, its shadow copy elsewhere doesn't.

**Real examples:** prep copy still said "turned down to LOW / low to
cook" from an older recipe design (the cook is medium-high); dead
`prep[]` arrays carrying non-scaling amounts; base prePhase steps in
cues.js contradicting the live transform's timers.

**How to avoid:** after changing any mechanic, grep the whole repo for
its old vocabulary ("low", the old duration, the old title). Dead/base
data either gets synced with a source-of-truth comment or de-quantified
so it can't contradict.

## 7. Exact-match TTS amnesia

Clips are content-hash keyed: ANY text change = a new clip; a missed
line = silence in the kitchen.

**Real examples:** the respell to "figure eight" missed a spoken
`doneCoach`; new gas-butter and water+butter voice lines weren't in the
`__voiceLines` collector iteration (stove × liquid), so they'd have
shipped silent.

**How to avoid:** every voice-text change ends with: extend the
collector iteration if a new variant axis exists → regen → prune
orphans → report count/size. Gate coaches and transition/gate voices ARE
spoken lines under the same rules (no digits, one sentence).

## 8. Tooling: the patch-script traps

**Real examples:**
- **Substring trap:** a 4-space-indented search string matched inside
  its 8-space sibling (`count 2 != 1`) — patch aborted. Order patches
  most-indented/most-specific first, or include distinguishing context.
- **Inconsistent failure semantics:** an in-memory `rep()` script aborts
  before writing (all-or-nothing), a per-call `patch()` script has
  already written the successful ones — after a failure, VERIFY the file
  state before re-running, or re-runs double-apply / report false zeros.
- **Newline-chained commands:** `python patch.py` failing exit-1 did NOT
  stop the `git commit` on the next line. Chain with `&&` when later
  steps depend on earlier success.
- **Measuring the wrong thing:** asserting no-scroll on
  `document.scrollingElement` when `#app` is the real scroll container;
  reading `el.volume` when the audible level lives in a Web Audio gain
  node; injected test DOM wiped by the live cook clock mid-measurement
  (pause the engine before injecting).

**Don't:** trust a green assertion until you've confirmed it measures
the mechanism that actually produces the user-visible behavior.

## 9. Verifier nondeterminism — convergence ≠ correctness

Verifiers on identical input sometimes pass what they later fail (the
eggs draft passed timing in one run, failed the same bytes the next).

**How to hold it:** "all PASS" means "no verifier currently objects,"
not "no violation exists." The stove test / on-device check is the
backstop; park late findings explicitly rather than silently dropping
or endlessly re-running.

## 10. Rule-compliant but voiceless (or the reverse)

A draft can satisfy every objective rule and still sound like a neutral
recipe app — or a personality line can bury an instruction.

**Real examples:** the benchmark draft passed six verifiers while
reading flatter than "we're not making rubber"; conversely the guide had
to cut "look at you, functioning adult" (affectionate user-teasing is
still user-teasing — R1).

**How to avoid:** content reference ≠ voice reference: draft/spec
phrasing supplies the WHAT, shipped copy supplies the HOW-IT-SOUNDS.
Register per moment (§V): gates warm and joke-free, waits entertained,
live steps clarity-first. Voice notes are advisory — the founder owns
them.

---

### The meta-pattern

Almost everything above is one mistake wearing different clothes: **the
agent verified the path it changed and assumed the paths it didn't.**
Variants, overrides, lingerers, dynamic amounts, collectors, scroll
containers, gain nodes — the bug is always in the sibling path. End
every change by naming the sibling paths and checking one of each.
