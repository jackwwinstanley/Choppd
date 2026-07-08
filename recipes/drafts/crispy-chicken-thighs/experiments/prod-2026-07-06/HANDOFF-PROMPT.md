# Handoff prompt — finish + wire the crispy-chicken-thighs images

Paste the block below into **Claude Code** (run from the repo root). It
reviews the completed `prod-2026-07-06` production batch, wires the
approved images into the recipe via the sanctioned `promote.js`, and
concludes the manifest. Cowork already generated all 13 slots (web-UI
lane, watermarked — the founder's audit is the gate).

---

Run `/experiment-review crispy-chicken-thighs prod-2026-07-06`, then wire the approved images into the recipe. Context and exact steps:

**State:** All 13 slots are generated and saved as 1024×1024 `.webp` in
`recipes/drafts/crispy-chicken-thighs/experiments/prod-2026-07-06/results/`.
This is a PRODUCTION brief, so default to IMAGE promotion with per-slot
accept/reject (the images are the product). Every image carries the
Gemini web-UI watermark — that's expected and acceptable per
`docs/COWORK_IMAGE_EXPERIMENTS.md`; my audit is the only gate.

1. **Verify manifest ↔ results.** Read `brief.md` and `manifest.md` in
   the experiment folder. Confirm all 13 rows have a file in `results/`
   and every file has a row. The 13 slots: `chicken-prep-1..5`,
   `chicken-c0-cold-pan`, `chicken-c160-render`, `chicken-c230-golden`,
   `chicken-c260-release`, `chicken-c300-skin-up`, `chicken-c355-temp`,
   `chicken-c375-rest`, `chicken-c388-serve`.

2. **Present each slot for my accept/reject**, restating the brief's
   Judgment line and Cowork's manifest note. Scrutinize these hardest —
   they're already flagged in the manifest:
   - `chicken-prep-5` (food-safety): thermometer shows **legible digits
     (~"88.0") + "ThermoPro" brand text** → breaks the no-text rule.
     Likely REJECT.
   - `chicken-c355-temp` (LOAD-BEARING temp gate + food-safety): probe
     reads central/top rather than clearly at the bone; dial face may
     show a faint readout — check legibility.
   - `chicken-c388-serve` (food-safety): no-pink is good, but it's shown
     **in-pan, not "plated,"** and the cut piece reads more like a
     bone-in leg than a thigh cross-section.
   - `chicken-c260-release` (LOAD-BEARING flip gate): looks strong —
     confirm the deep-golden release color.

3. **Wire each ACCEPTED slot into the recipe.** The recipe's `cues.js`
   already references `assets/recipes/chicken/<slot>.webp` for all 13
   slots, so no code edits are needed — just place the approved files
   with the sanctioned tool (records PROVENANCE.md; note dest dir is
   `chicken`, not the slug):

   ```
   node tools/imagegen-mcp/promote.js \
     --src recipes/drafts/crispy-chicken-thighs/experiments/prod-2026-07-06/results/<slot>.webp \
     --dest mvp/assets/recipes/chicken/<slot>.webp
   ```

   Run once per accepted slot. `promote.js` refuses an existing dest
   without `--force`; only `hero.jpg` currently exists in that dir, so
   first-time promotions need no `--force`. **REUSE needs no extra
   files:** `cues.js` already points cue `at:45` → `chicken-c0-cold-pan.webp`
   and cue `at:366` → `chicken-c375-rest.webp`, so promoting those two
   source slots covers the reuse.

4. **For any slot I REJECT,** do NOT promote it. Instead print the exact
   Cowork re-roll line for just those slots:
   "Re-roll these slots from the brief at
   recipes/drafts/crispy-chicken-thighs/experiments/prod-2026-07-06/brief.md:
   <slot list> — same prompts, replace the files, append new manifest
   rows." (For `chicken-prep-5` / `chicken-c355-temp`, if a re-roll again
   returns text instead of an image, prepend `Generate an image:` — the
   prep-5 tweak is already recorded in the manifest.)

5. **Conclude the manifest.** Append a `CONCLUDED: <winner/verdict> ·
   <date> · <reason>` line to the footer with the per-slot accept/reject
   verdicts.

6. **Verify wiring.** For every `referenceImage:
   "assets/recipes/chicken/…"` in `cues.js`, confirm the file now exists
   in `mvp/assets/recipes/chicken/`. Report any accepted slot whose file
   is missing, and confirm `PROVENANCE.md` was written beside the assets
   (web-ui/watermarked origin, so a future watermark-free `/generate-images`
   pass is a lookup, not a hunt).
