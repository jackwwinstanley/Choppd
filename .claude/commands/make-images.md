---
description: DEFAULT image path — author a PRODUCTION brief from a recipe's image-prompts.md (one prompt per slot, N=1, no A/B), then AUTO-INVOKE recipe-visualizer to render it on the free Gemini/Cowork web-UI lane (non-blocking; manual fallback preserved). Zero paid API spend; paid /generate-images stays the opt-in alternative.
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
3. Print the handoff line (the brief is the durable artifact — it always
   gets written before the render leg, so the manual path below still works
   even if step 4 is skipped or fails):
   "Wrote the PRODUCTION brief at <path> — auto-rendering via recipe-visualizer
   (see step 4); manual fallback: run it per docs/COWORK_IMAGE_EXPERIMENTS.md
   (production-brief section)."
4. **AUTO-INVOKE the render leg (recipe-visualizer) — inline, non-blocking.**
   This is the integration seam: brief.md has just been produced, and this
   fires BEFORE `/experiment-review`. Invoke the **`recipe-visualizer`**
   subagent (user-level, `~/.claude/agents/recipe-visualizer.md`) via the
   Agent/Task tool, passing the recipe **slug** so it resolves this same
   brief (`recipes/drafts/<slug>/experiments/*/brief.md`, newest) and renders
   each slot's prompt on the free Gemini/Cowork lane into `results/<slot>.webp`.
   - Invocation matches the repo convention (see `/new-recipe` step d): use
     the registered `recipe-visualizer` agent type; if it isn't registered in
     the session, launch a `general-purpose` agent whose prompt is the body of
     `~/.claude/agents/recipe-visualizer.md` plus the slug. Do NOT restyle or
     re-engineer the prompts here — recipe-visualizer pastes them VERBATIM
     (scene text + bracketed base block, stripping only the ⚠️/VALIDATE/
     Judgment annotations); the wiring must never turn them into generic
     cinematic prompts (protects the raw-beef / neutral-daylight / food-safety
     discipline and the slot→filename mapping).
   - **NON-BLOCKING — never halt recipe creation on an image failure.** If the
     image step is skipped, `brief.md` is missing/empty, or the render leg
     fails (login wall never cleared, Chrome unavailable, agent errors), emit a
     clear WARNING that names (a) exactly what failed and (b) which downstream
     artifacts are now missing — the `results/<slot>.webp` files that
     `/experiment-review` reviews and `promote.js` would wire into
     `mvp/assets/` — then CONTINUE. The brief remains on disk for the manual
     fallback.
5. Point to the next step: once `results/` is populated, run
   `/experiment-review <slug> <exp-id>` → `promote.js` for the accepted slots.

## Manual fallback (preserved, backward-compatible)
The old path still works verbatim: after the brief exists, you can run it by
hand — "use recipe-visualizer for <slug>", or paste the brief into Cowork per
docs/COWORK_IMAGE_EXPERIMENTS.md. Step 4's auto-invoke is additive; it does not
remove or gate the manual trigger.

## Hard rules
- This command still **generates nothing itself and never calls the paid
  imagegen MCP — zero API spend.** Step 4 delegates rendering to
  recipe-visualizer on the **free Gemini/Cowork web-UI lane**; the paid lane
  (`/generate-images <slug>`) stays the explicit opt-in alternative.
- Image generation keeps its existing pipeline position — AFTER `/new-recipe`'s
  text verifiers and its `image-prompts.md`, at the `/make-images` brief output,
  BEFORE `/experiment-review`. Step 4 does not reorder it.
- Production briefs live under experiments/prod-* so /experiment-review
  picks them up; review of a prod-* brief defaults to IMAGE promotion
  (the images are the product) with per-slot accept/reject.
- Watermark-free needed, or an unattended run? Use the paid lane:
  `/generate-images <slug>`.
