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

## The loop (Gemini / Nano Banana)
1. Open the image tool; log in (expect the login wall every few sessions).
2. **Reference class: lock a style anchor first.** Generate ONE reference
   image you're happy with (pan, surface, lighting, grade), then condition
   every subsequent reference generation on it (Nano Banana supports
   image-conditioning) so the library reads as one system.
3. For each slot block in `image-prompts.md`, in order:
   - Paste the prompt verbatim (it already carries the right class spec).
   - Generate; pick the best of the batch — judge against the audit
     checklist below, not general prettiness.
   - Download to `recipes/drafts/<slug>/images/` named EXACTLY by the slot
     filename in the block (`<recipe>-p<phase>-c<n>.webp` convention —
     rename on download; the build step depends on these names).
4. Keep the same kitchen/cookware across all slots of one recipe — if the
   model drifts (new pan, different counter), regenerate; the set reads as
   a filmstrip in the app.
5. **Comparison sets** (progression strips, under/right/over triptychs):
   generate each panel as a SEPARATE image from the identical prompt with
   only the state-words changed, conditioned on the same anchor — never
   ask for all states in one image (the model fudges the differences).

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
