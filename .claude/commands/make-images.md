---
description: DEFAULT image path — author a PRODUCTION brief for the free Cowork/web-UI lane from a recipe's image-prompts.md (one prompt per slot, N=1, no A/B). Generates nothing, spends nothing; paid /generate-images stays the opt-in alternative.
argument-hint: <recipe-slug>
---

# /make-images — production brief for the free lane (the default path)

Arguments: `$ARGUMENTS` → `<recipe-slug>`.

## Flow
1. Read `recipes/drafts/<slug>*/image-prompts.md` (glob — a recipe may
   have multiple batches, e.g. `-prephase-images` + `-prep-images`).
   ERROR clearly if no batch exists or a batch says the recipe copy
   isn't locked (same locked-recipe rule as always).
2. Write a PRODUCTION brief to
   `recipes/drafts/<slug>/experiments/prod-<YYYY-MM-DD>/brief.md`
   (suffix `-2`, `-3`… if the date collides). No variants, no A/B:
   - one complete prompt PER SLOT, verbatim from the batch (base-style
     line appended, class noted);
   - N = 1 per slot;
   - RESPECT REUSE annotations: reused slots are listed in a REUSE table
     (target ← source), NOT given prompts — Cowork never generates them;
   - file-naming contract: `results/<slot-filename>` (the real slot
     names, since these are the product — not exp-A-n);
   - the manifest contract is identical to experiment briefs (row per
     generation, appended live, session footer).
3. Print the founder's handoff line:
   "Run the PRODUCTION brief at <path> per docs/COWORK_IMAGE_EXPERIMENTS.md
   (production-brief section)."

## Hard rules
- This command generates NOTHING and never calls the imagegen MCP.
- Production briefs live under experiments/prod-* so /experiment-review
  picks them up; review of a prod-* brief defaults to IMAGE promotion
  (the images are the product) with per-slot accept/reject.
- Watermark-free needed, or an unattended run? Use the paid lane:
  `/generate-images <slug>`.
