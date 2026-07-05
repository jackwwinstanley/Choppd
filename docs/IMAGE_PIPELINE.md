# IMAGE_PIPELINE.md — Cowork image generation playbook

Operator doc for turning a verified recipe draft's `image-prompts.md` into
the actual step images. This leg is **supervised, not fire-and-forget**.

## When this runs
Only for a **LOCKED, stove-tested recipe** — never before. If the stove
test changes a step, its prompt changes; generating earlier burns free-tier
quota on images you'll re-shoot. Input = 
`recipes/drafts/<slug>/image-prompts.md` from the `/new-recipe` pipeline.

## The loop (Gemini / Nano Banana)
1. Open the image tool; log in (expect the login wall every few sessions).
2. For each slot block in `image-prompts.md`, in order:
   - Paste the prompt verbatim (it already carries the style spec).
   - Generate; pick the best of the batch — judge against the audit
     checklist below, not general prettiness.
   - Download to `recipes/drafts/<slug>/images/` named EXACTLY by the slot
     filename in the block (`<recipe>-p<phase>-c<n>.webp` convention —
     rename on download; the build step depends on these names).
3. Keep the same kitchen/cookware across all slots of one recipe — if the
   model drifts (new pan, different counter), regenerate; the set reads as
   a filmstrip in the app.

## Known frictions (expected — don't debug, just work through)
- Login walls and session expiry mid-batch.
- Free-tier rate limits: batches of ~10+ slots may need two sittings.
- UI drift: button names/layouts change; the loop above is the invariant.
- Occasional silent aspect-ratio changes — target wide/landscape
  (the app crops to a 1200px-wide 16:9-ish slot).

## Audit checklist (run on EVERY image before handoff)
- [ ] Style match: cast-iron/pot + warm wood + golden-hour + glossy
      magazine finish; same kitchen as the rest of the set.
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
