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
3. PROMOTE — two options, founder's choice at review time. DEFAULT
   DEPENDS ON BRIEF TYPE: experiment briefs (exp-*) default to (a)
   prompt promotion; PRODUCTION briefs (prod-*) default to (b) image
   promotion — the images ARE the product there, reviewed per-slot
   (accept/reject each; for rejects, print the exact Cowork re-roll
   instruction covering ONLY the rejected slots: "Re-roll these slots
   from the brief at <path>: <slot list> — same prompts, replace the
   files, append new manifest rows").
   a. **Prompt promotion (exp-* default):** write the winning variant's
      template into the recipe's real `image-prompts.md` (replacing or
      annotating the affected slots); ship-quality files then come from
      /generate-images. If the experiment was CATEGORY-WIDE (a
      style-spec question), instead draft the RECIPE_FORMAT.md §7 edit
      and present it for approval — never silently change the spec.
   b. **Image promotion (prod-* default; on request for exp-*):**
      promote the winning FILES
      themselves into wiring via
      `node tools/imagegen-mcp/promote.js --src <results-file> --dest
      mvp/assets/recipes/<r>/<slot>` — the images carry the web UI's
      watermark and promote.js records that in PROVENANCE.md beside the
      asset; the founder's audit is the gate.
4. Mark the experiment CONCLUDED in manifest.md: verdict line (winner,
   date, one-line reason) appended to the footer.
5. Remind: web-UI images carry a visible watermark — if that matters for
   the slot, regenerate the winning prompt via `/generate-images`;
   otherwise image promotion is fine and PROVENANCE.md keeps the record
   for a future watermark-free upgrade pass.
