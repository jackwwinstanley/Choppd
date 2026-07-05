---
description: Draft a complete Choppd recipe in the canonical format from a dish name + available ingredients, verify it with the six specialist subagents, repair, and emit a stove-test-ready draft + verification report + image prompts. Never touches the live catalog.
argument-hint: "<dish name>" --have "<comma-separated ingredients>" [--type synced|guided]
---

# /new-recipe — recipe generation pipeline (orchestrator)

Arguments: `$ARGUMENTS` → parse as: `"<dish name>"` (required),
`--have "<comma-separated ingredients>"` (required),
`--type synced|guided` (default `guided`).

**Hard rule: this command NEVER writes into the live catalog or app data
(`mvp/cues.js`, `server/src/db.ts`, `scan-data.ts`, the DB). Output goes to
`recipes/drafts/<slug>/` only.** Catalog entry happens via the normal build
flow after the founder's stove-test.

## a. Read the sources of truth (in full, before drafting)
1. `docs/RECIPE_FORMAT.md` — the contract every section of the draft must
   satisfy. The verifiers' checklists all cite it.
2. `server/src/scan-data.ts` — the canonical ingredient vocabulary.
3. The two stove-tested exemplars in `mvp/cues.js`: `SCRAMBLED_EGGS` and
   `ONEPOT_PASTA` — heat-sequencing templates. **Prefer copying a proven
   heat pattern over inventing one** (their preheat → drop-heat → gate →
   off-heat shapes survived real stoves).

## b. Map the --have ingredients
Map each item to a canonical vocabulary id (`VOCAB` aliases help). For any
unmapped item: flag it in the draft header and include a proposed
vocabulary-entry block (RECIPE_FORMAT.md §2 mini-template). Build the scan
block (`required`/`optional`/`staples_assumed`) from the mapping — staples
never go in `required`.

## c. Draft
Write the COMPLETE recipe per RECIPE_FORMAT.md — every section that applies
to the chosen type, in the §11 handoff format (markdown + fenced json
blocks) — to `recipes/drafts/<slug>/recipe.md` (slug = kebab-case dish
name; suffix `-bench` only for benchmark runs). Include per-slot image
PROMPTS — prompts only, this pipeline never generates images — using the
§7 TWO-CLASS split:
- hero/finish slots → the appetite spec (cast-iron/pot + warm wood +
  golden-hour + glossy magazine);
- cue `referenceImage` slots → the beginner-reference scaffold from
  `docs/choppd-beginner-visual-reference.md` §5 (neutral daylight, locked
  cookware/surface, diagnostic feature named as the sharp-focus subject,
  angle per category, scale anchor when size matters, always-exclude
  list). Name the judgment call each reference slot resolves (the Glance
  Test) in the prompt block; flag doneness images for meat/poultry/eggs
  as VALIDATE-BEFORE-SHIP. Comparison sets = separate single prompts,
  identical except the state-words.

## d. Fan out the verifiers + the advisory voice-checker (parallel)
Launch all seven subagents in a single message so they run in parallel,
each with the draft path as input:
`format-checker`, `heat-physics-checker`, `timing-auditor`,
`copy-checker`, `cross-referee`, `beginner-red-team` — the six OBJECTIVE
verifiers — plus `voice-checker`, which is ADVISORY ONLY.
(If a named agent type isn't registered in this session, launch a
`general-purpose` agent whose prompt is the corresponding
`.claude/agents/<name>.md` file's body plus the draft path, and require
the same strict VERDICT/VIOLATIONS output.)

## e. Repair loop (max 3 iterations — SIX OBJECTIVE VERIFIERS ONLY)
Collect every violation FROM THE SIX OBJECTIVE VERIFIERS. Apply fixes to
ONLY the flagged sections of the draft — do not rewrite passing sections.
Re-run ONLY the verifiers that FAILED. Repeat until all six PASS or 3
iterations are spent. If violations remain after 3: STOP and surface the
stuck violations verbatim in the report — do not silently ship a failing
draft.

**voice-checker output is EXCLUDED from this loop — do not promote it.**
Its notes are never counted as violations, never fed to the generator as
fix instructions, never a reason to start an iteration, and never block
the PASS state. Convergence is defined by the six objective verifiers
ONLY. This holds EVEN FOR hard-rule-risk notes (a user-teasing line is a
serious flag the report must surface loudly — but fixing it is the
founder's call, not an auto-block). voice-checker is also never re-run in
repair iterations. The ONE repair-adjacent use permitted: if an iteration
is ALREADY happening for objective violations, the voice notes may ride
along as optional context for the flagged sections ("while fixing this
cue's timer, this line was also flagged as off-register") — voice notes
alone never start an iteration, and unresolved voice notes never fail the
run.

## f. Outputs (all under recipes/drafts/<slug>/)
1. `recipe.md` — the verified draft.
2. `verification-report.md` — per-verifier verdict HISTORY across
   iterations (what failed, what was fixed, what re-passed), remaining
   warnings, and a **STOVE-TEST PLAN** section: the specific steps the
   founder must physically verify, chosen by risk — every heat gate,
   every timing the timing-auditor flagged as tight, everything the
   red-team worried about (even if repaired). AFTER the stove-test plan,
   a **"VOICE NOTES (advisory — founder's call)"** section containing the
   voice-checker's output VERBATIM — it renders last because it is the
   polish layer, and it never affects the verdicts table.
3. `image-prompts.md` — the per-slot prompt batch formatted for the Cowork
   image playbook (`docs/IMAGE_PIPELINE.md`): one block per slot with the
   slot filename, the prompt, and the applicable AI-image rules.

Finish by summarizing: verdicts table, iterations used, where the three
files are, and the reminder that the draft enters the catalog only after
the stove-test via the normal build flow.
