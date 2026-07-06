# IMAGE_PIPELINE.md — Cowork image generation playbook

Operator doc for turning a verified recipe draft's `image-prompts.md` into
the actual step images. This leg is **supervised, not fire-and-forget**.

## When this runs
Only for a **LOCKED, stove-tested recipe** — never before. If the stove
test changes a step, its prompt changes; generating earlier burns free-tier
quota on images you'll re-shoot. Input = 
`recipes/drafts/<slug>/image-prompts.md` from the `/new-recipe` pipeline.

## Two image classes — know which one you're generating
Every slot block is tagged one of two classes (spec: RECIPE_FORMAT.md §7;
full reference system: `docs/choppd-beginner-visual-reference.md`):
- **HERO / appetite** (hero, finish): warm golden-hour glossy look — sell
  the outcome.
- **IN-COOK REFERENCE** (cue slots): the opposite — bright even NEUTRAL
  daylight, realistic achievable home result, one subject with the
  diagnostic feature dominating, locked cookware + light neutral surface,
  no garnish/props/text. These answer a beginner's two-second judgment
  call ("is mine right, and if not, which way?"), so accuracy outranks
  beauty and warm grading is actively dangerous (it falsifies doneness
  color). Never let brand orange tint the food.

## The loop — /generate-images (imagegen MCP; replaces the browser leg)
1. Pipeline emits the prompt batch (`image-prompts.md`) for a LOCKED,
   stove-tested recipe.
2. `/generate-images <slug>` runs the batch through the local imagegen
   MCP server (Nano Banana / gemini-2.5-flash-image): sequential,
   slot-named files under `recipes/drafts/<slug>/images/`, REUSE slots
   recorded not regenerated, existing files skipped, and an `AUDIT.md`
   sheet written (slot / prompt / file / status).
   - Reference class: still lock a style ANCHOR mentally per library —
     if the set drifts (different pan/surface), regenerate the drifters.
   - Comparison sets: separate slots from identical prompts with only
     the state-words changed (the batches are already authored this way).
3. FOUNDER AUDIT via AUDIT.md — the judgment stays manual. Rejected
   slots: `/generate-images <slug> --only <slot> --force` (optionally
   after editing the prompt in the batch file).
4. Approved set → the build assistant wires per the existing image-swap
   pattern (assets to `mvp/assets/recipes/<recipe>/`, ≤1200px,
   referenceImage slots, cache-busts, headless render check, deploy).

## The two lanes — which one to use
- **PAID / MCP lane** (`/generate-images`, Nano Banana API): ANYTHING THAT
  SHIPS. Watermark-free, ~4 cents each.
- **FREE / Cowork lane** (`/image-experiment` → docs/COWORK_IMAGE_EXPERIMENTS.md):
  style exploration and prompt A/B testing in the Gemini web UI —
  watermarked, quarantined under experiments/ paths (the tooling refuses
  to generate into or promote out of them — tools/imagegen-mcp enforces
  it), plus the audit-copilot role for paid batches.
- **The decision rule:** "Will any of these images ship?" → paid lane.
  "Am I testing what prompt to USE?" → free lane first, then regenerate
  the winner via the paid lane.

Cost & quota: ~$0.04/image on the billed tier (a 10-slot batch ≈ 40¢);
the FREE tier has NO image-generation quota (limit 0) — the key's Google
project must have billing enabled or every call returns 429 instantly.
RULE: approved/wired images are never regenerated without --force.

## Known frictions (expected — don't debug, just work through)
- Login walls and session expiry mid-batch.
- Free-tier rate limits: batches of ~10+ slots may need two sittings.
- UI drift: button names/layouts change; the loop above is the invariant.
- Occasional silent aspect-ratio changes — target wide/landscape
  (the app crops to a 1200px-wide 16:9-ish slot).

## Audit checklist (run on EVERY image before handoff)
- [ ] Style match FOR ITS CLASS: hero = warm golden-hour glossy; reference
      = bright neutral daylight, realistic home result, same locked
      pan/surface as the rest of the reference library.
- [ ] Reference class: the Glance Test — name the judgment call this image
      resolves in two seconds; the diagnostic feature dominates the frame;
      still legible at phone-thumbnail size; scale anchor present when
      size is the point; no warm/moody grading (color is data).
- [ ] ⚠️ FOOD-SAFETY TIER (meat/poultry/pork/egg doneness): validate
      against a real reference before shipping — a confidently-wrong
      doneness image is worse than none; internal temp stays the
      authoritative cue in copy, the image only supports it.
- [ ] 🚫 No garnish on raw proteins.
- [ ] Off-heat slots are visually unmistakable: pan on a folded towel on
      the counter, burner visibly unoccupied.
- [ ] No cut-early ambiguity: nothing sliced/plated in a step that forbids
      it (resting shots show the intact protein).
- [ ] The doneness-gate image shows EXACTLY the state its gate copy
      describes — it is the "this is what done looks like" reference.

## Handoff
Deliver the audited `images/` folder to the build assistant, who wires it
per the existing image-swap pattern: assets copied to
`mvp/assets/recipes/<recipe>/`, resized to 1200px longest edge,
`referenceImage` slots pointed at them, `?v=` cache-busts where files are
replaced, headless render check, commit + deploy.
