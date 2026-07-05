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
PROMPTS built from the §7 style spec (cast-iron/pot + warm wood +
golden-hour + glossy magazine + the AI-image rules) — prompts only, this
pipeline never generates images.

## d. Fan out ALL SIX verifiers (parallel)
Launch the six verifier subagents in a single message so they run in
parallel, each with the draft path as input:
`format-checker`, `heat-physics-checker`, `timing-auditor`,
`copy-checker`, `cross-referee`, `beginner-red-team`.
(If a named agent type isn't registered in this session, launch a
`general-purpose` agent whose prompt is the corresponding
`.claude/agents/<name>.md` file's body plus the draft path, and require
the same strict VERDICT/VIOLATIONS output.)

## e. Repair loop (max 3 iterations)
Collect every violation. Apply fixes to ONLY the flagged sections of the
draft — do not rewrite passing sections. Re-run ONLY the verifiers that
FAILED. Repeat until all PASS or 3 iterations are spent. If violations
remain after 3: STOP and surface the stuck violations verbatim in the
report — do not silently ship a failing draft.

## f. Outputs (all under recipes/drafts/<slug>/)
1. `recipe.md` — the verified draft.
2. `verification-report.md` — per-verifier verdict HISTORY across
   iterations (what failed, what was fixed, what re-passed), remaining
   warnings, and a **STOVE-TEST PLAN** section: the specific steps the
   founder must physically verify, chosen by risk — every heat gate,
   every timing the timing-auditor flagged as tight, everything the
   red-team worried about (even if repaired).
3. `image-prompts.md` — the per-slot prompt batch formatted for the Cowork
   image playbook (`docs/IMAGE_PIPELINE.md`): one block per slot with the
   slot filename, the prompt, and the applicable AI-image rules.

Finish by summarizing: verdicts table, iterations used, where the three
files are, and the reminder that the draft enters the catalog only after
the stove-test via the normal build flow.
