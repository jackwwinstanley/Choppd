---
description: Generate a recipe's image-prompt batch via the imagegen MCP (Nano Banana / Gemini). Sequential, rate-limit aware, writes slot-named files + AUDIT.md, never overwrites audited images without --force.
argument-hint: <recipe-slug> [--only slot1,slot2] [--force]
---

# /generate-images — run a recipe's image-prompt batch

Arguments: `$ARGUMENTS` → `<recipe-slug>` (required), `--only slot,slot`
(subset), `--force` (maps to overwrite:true — for regenerating slots the
founder rejected in audit).

## Flow
a. Read `recipes/drafts/<slug>*/image-prompts.md` (glob — batches may be
   suffixed like `<slug>-prephase-images`). Error clearly if no batch
   exists, or if the batch header says the recipe copy isn't locked
   (the locked-recipe-only rule from docs/IMAGE_PIPELINE.md).
b. Parse the slot blocks (bold `**filename**` headers + prompt text +
   the base-style line to append). For each slot — or only the --only
   subset: call the `generate_image` MCP tool (server: imagegen) with
   the full prompt and the slot-named path under
   `recipes/drafts/<slug>/images/`. If the MCP server isn't connected
   this session, the identical CLI works:
   `node tools/imagegen-mcp/cli.js --prompt "..." --out <path> [--force]`.
   Square slots pass aspect_ratio "1:1".
c. RESPECT REUSE annotations: slots the batch marks as REUSE are recorded
   in AUDIT.md pointing at their source slot — never regenerated.
d. SEQUENTIAL generation with a ~3s delay between calls (rate limits).
   On error `rate_limited`: pause ~30s, note it, resume. After 3
   consecutive failures: STOP and report — don't burn the batch.
   NOTE: `rate_limited` with instant response usually means the key's
   project has NO image quota (free tier limit is 0 — billing required);
   report that instead of retrying.
e. Without --force, existing files are skipped and noted — re-runs only
   fill gaps; approved/wired images are never regenerated accidentally.
f. Write `recipes/drafts/<slug>/images/AUDIT.md`: one row per slot —
   slot name, verbatim prompt, file link, status
   (generated/reused/skipped/failed). End by reminding the founder of
   the audit checklist: style match for the image's class, no garnish on
   raw proteins, off-heat visually unmistakable, no cut-early ambiguity,
   and check for watermarks (API images should be sparkle-free — flag if
   not). THEN STOP — the audit is the founder's; wiring happens after
   approval via the normal image-swap pattern.
