---
description: Author a zero-cost image experiment brief (prompt A/B via the free Cowork/web-UI lane). Writes brief.md only — generates NO images, spends NO API money.
argument-hint: <recipe-slug> "<question>" [--variants 2] [--n 4]
---

# /image-experiment — author an experiment brief for the free lane

Arguments: `$ARGUMENTS` → `<recipe-slug>`, `"<question>"` (the ONE thing
being tested), `--variants` (2–4, default 2), `--n` (per variant,
default 4).

## Flow
1. Read `docs/RECIPE_FORMAT.md` §7 (style spec + class split) and, if the
   recipe has locked copy, the relevant steps — variant prompts must be
   plausible real prompts, not abstractions.
2. Draft the variant prompt templates (A, B, C…): each a COMPLETE Nano
   Banana prompt built from the format doc's spec, with **exactly one
   experimental dimension varied** and everything else held byte-constant.
   If the question implies more than one dimension (e.g. "overhead vs 45°
   AND warm vs neutral"), FLAG it and propose splitting into two
   experiments — never confound.
3. Write the brief to
   `recipes/drafts/<slug>/experiments/<experiment-id>/brief.md` — id
   format `exp-NNN-<kebab-question>` (next free NNN). Brief contains:
   - experiment id + the one-line question
   - VARIANTS: labeled complete prompts (A, B, …)
   - N per variant
   - the file-naming contract: `exp-<variant>-<n>.png` into `results/`
   - judging criteria: what "winning" means, in checkable terms
4. Print the founder's handoff line:
   "Run the experiment brief at <path> per docs/COWORK_IMAGE_EXPERIMENTS.md."

## Hard rules
- This command NEVER generates images and never calls the imagegen MCP.
- Experiment outputs carry the web UI's watermark. After review they may
  either be promoted directly (founder's audited choice — provenance
  recorded) or have their winning PROMPT regenerated watermark-free via
  /generate-images.
