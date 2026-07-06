---
description: Review a completed image experiment (Cowork free lane): verify results vs manifest, organize the side-by-side for the founder's judgment, then promote the WINNING PROMPT (never the images) into the real batch.
argument-hint: <recipe-slug> <experiment-id>
---

# /experiment-review — judge an experiment, promote the winning PROMPT

Arguments: `$ARGUMENTS` → `<recipe-slug>` `<experiment-id>`.

## Flow
1. Read `recipes/drafts/<slug>/experiments/<id>/brief.md` + `manifest.md`.
   Verify every manifest row's file exists in `results/` and every file
   has a row — FLAG gaps (a crashed Cowork session leaves a valid partial
   manifest; missing files are the signal).
2. Present the comparison FOR THE FOUNDER'S judgment (the command
   organizes; the founder judges): files grouped by variant, each
   variant's verbatim prompt, Cowork's per-row notes, and the brief's
   judging criteria restated. The founder looks at the images and
   declares a winner (or "no winner — rerun/split").
3. PROMOTE THE PROMPT, not the pixels: write the winning variant's
   template into the recipe's real `image-prompts.md` (replacing or
   annotating the affected slots). If the experiment was CATEGORY-WIDE
   (a style-spec question, not one recipe), instead draft the
   RECIPE_FORMAT.md §7 style-spec edit and present it for approval —
   never silently change the spec.
4. Mark the experiment CONCLUDED in manifest.md: verdict line (winner,
   date, one-line reason) appended to the footer.
5. Remind: the winning images themselves are WATERMARKED and quarantined —
   ship-quality files come from `/generate-images <slug>` with the newly
   promoted prompt (the wiring quarantine will refuse experiments/ paths
   anyway; that's enforced in tools/imagegen-mcp, not etiquette).
