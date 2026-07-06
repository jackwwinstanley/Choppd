# COWORK_IMAGE_EXPERIMENTS.md — the free image lane (instructions to Cowork)

Two roles, both zero-API-cost. Role 1 runs watermarked prompt experiments
in the Gemini web UI. Role 2 copilots the founder's audit of PAID batches.
You never talk to Claude Code directly — the drafts folder is the
interface. THE HARD RULE: web-UI images are watermarked, experiment-only,
and live exclusively under an `experiments/` path; they are never
presented as shippable and the build tooling refuses them mechanically.

## Role 1 — experiment runner

1. **Open the brief** the founder points you at
   (`recipes/drafts/<slug>/experiments/<id>/brief.md`). Read it fully.
   Confirm back to the founder — variants, N per variant, the file-naming
   contract, the judging criteria — and WAIT for their go before
   generating anything.
2. **The loop, per generation** (sequential, one at a time):
   a. Open gemini.google.com in Chrome. The founder is already logged
      in — if you see a login screen, STOP and tell them; you never
      handle credentials.
   b. Paste the variant's prompt VERBATIM from the brief (no improvising;
      if you must tweak mid-session because the model refuses, record the
      exact tweaked prompt in the manifest row).
   c. Generate. Download the image. Rename to the contract name
      (`exp-<variant>-<n>.png`). Move it into the experiment's `results/`
      folder.
   d. **Append the manifest row IMMEDIATELY** — variant, n, the exact
      prompt used, filename, and your one-line note (quirks, refusals,
      retries). Never batch manifest writes for the end: a crashed
      session must leave a valid partial manifest.
3. **Etiquette:** unhurried pacing between generations. If the UI
   throttles you or a free-tier limit appears: record it in the manifest
   footer, report how much work remains, and stop — never push through.
   If the UI doesn't match these steps (Google moved something), stop and
   describe what you actually see.
4. **Never:** edit anything outside the experiment folder · generate past
   the brief's N without being asked · present these images as shippable
   (they carry a visible watermark — that is the point of the quarantine).
5. **Session end:** write the manifest footer (date, generations used,
   rate-limit note), then tell the founder: the results path, and that
   the next step is `/experiment-review <slug> <id>` in Claude Code.

### manifest.md format
| variant | n | prompt (verbatim as pasted) | file | note |
|---|---|---|---|---|
(one row per generation, appended live)

Footer: `SESSION: <date> · generations used: <n> · rate-limit: <hit/none>`
After review, Claude Code appends: `CONCLUDED: <winner> · <date> · <reason>`

## Role 2 — audit copilot (paid batches; zero cost, zero watermark)

After `/generate-images` lands a PAID batch, you guide the founder's
audit — you organize, they judge:

1. Open the batch's `recipes/drafts/<slug>/images/AUDIT.md`.
2. For each slot, in order: display the image full-size alongside the
   audit checklist — style match for its class · no garnish on raw
   proteins · off-heat visually unmistakable (towel-on-counter) · no
   cut-early ambiguity · watermark check (API images should be
   sparkle-free — FLAG loudly if one isn't).
3. Record the founder's accept/reject + their one-line reason into a
   STATUS column you add to AUDIT.md (again: write as you go).
4. At the end: emit the exact regeneration command for the rejects —
   `/generate-images <slug> --only <slot1,slot2> --force` — and remind
   the founder that a reject can instead route through /image-experiment
   when the failure looks like a PROMPT-FORMULA problem (same miss across
   multiple rolls) rather than one bad roll.

## File conventions (the shared language)

    recipes/drafts/<slug>/experiments/<experiment-id>/
      brief.md      <- written by Claude Code (/image-experiment)
      results/      <- images you download + rename
      manifest.md   <- written by YOU, row-by-row as you work

brief.md contains: the id + one-line question · 2–4 labeled VARIANT
prompts (complete prompts, exactly one dimension varied) · N per variant ·
the exp-<variant>-<n>.png naming contract · the judging criteria. A filled
example lives at
recipes/drafts/one-pot-garlic-parmesan-pasta/experiments/ (first real run).
