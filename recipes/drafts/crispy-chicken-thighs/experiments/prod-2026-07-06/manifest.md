# manifest — prod-2026-07-06 (crispy chicken thighs, PRODUCTION)

Prompt-scope convention (founder-confirmed 2026-07-06): each row's prompt is
the slot's SCENE DESCRIPTION + the bracketed style block, verbatim. The ⚠️
class flags and `Judgment:` criteria in the brief are operator/review
annotations and are NOT pasted. Style block (identical every slot, appended to
each scene): `[photorealistic reference photo, bright even neutral daylight,
neutral white balance, no colored shadows, one subject filling the frame,
cast-iron skillet where a pan appears, light neutral surface, no garnish, no
props beyond what the step names, no text, realistic home-kitchen result.
Square.]`

Generation: Gemini web UI (Flash), N=1, 1024×1024, re-encoded to webp q0.92.
Web-UI images may carry the UI watermark — founder audit is the gate.

| slot | prompt (verbatim as pasted) | file | note |
|---|---|---|---|
| chicken-prep-1 | Top-down: raw bone-in skin-on chicken thighs on their own cutting board, a hand pressing a folded paper towel firmly onto the skin, used damp towels beside ON THE SAME BOARD. [style block] | chicken-prep-1.webp | clean gen; raw thighs isolated on board, cast-iron in corner, neutral daylight. Note: connection dropped after gen; image re-saved from chat history on reconnect (not regenerated). |
| chicken-prep-2 | Top-down: the dried thighs on the same board with an even scatter of salt, pepper, and a dusting of paprika visible on the skin, a hand sprinkling from high. [style block] | chicken-prep-2.webp | clean gen, 1024². Retyped once (first type didn't register in input). |
| chicken-prep-3 | Low 15° angle at a sink: soapy hands under running water, the cutting board and knife propped in the sink behind. No chicken in frame. [style block] | chicken-prep-3.webp | clean gen, 1024². Slower render (~45s). |
| chicken-prep-4 | Top-down staging: empty cast-iron skillet (off-heat), tongs, and an instant-read thermometer arranged together. [style block] | chicken-prep-4.webp | clean gen, 1024². ~60s render. |
| chicken-prep-5 | **Generate an image:** Close 30° angle: an instant-read thermometer probe inserted into the thickest part of a COOKED golden-brown thigh right beside the bone, display visible but UNREADABLE (no legible digits — the no-text rule; copy carries the numbers). [style block] | chicken-prep-5.webp | TWEAK: verbatim prompt returned a TEXT answer (temperature explanation), not an image — prepended `Generate an image:` to force gen (recorded per brief rule). ⚠️ AUDIT FLAGS (food-safety slot): thermometer display shows legible digits (~"88.0") and "ThermoPro" brand text is visible → violates no-text rule, likely REJECT/re-roll at audit. Downloaded via UI button (PNG→webp) since reloaded image was cross-origin. |
| chicken-c0-cold-pan | Top-down into a cast-iron skillet: raw thighs arranged skin-side down in a clearly COLD, dry pan (no oil sheen, no sizzle, burner off-glow absent). [style block] | chicken-c0-cold-pan.webp | clean gen, 1024². (Also the REUSE source for cue at:45.) ~70s render. |
| chicken-c160-render | Low 20° side angle at the pan rim: gentle steady sizzle around the thighs, a shallow pool of rendered fat forming, skin edges just starting to color. [style block] | chicken-c160-render.webp | clean gen, 1024². Extension disconnected during render; reconnected, image still a live blob, saved directly (not regenerated). |
| chicken-c230-golden | Top-down: the skin edges visibly deep golden while centers are still lighter, fat pool established. [style block] | chicken-c230-golden.webp | clean gen, 1024². ~90s render. |
| chicken-c260-release | Close low angle: tongs lifting one thigh's corner, the skin DEEP golden brown and cleanly RELEASED from the pan surface (visible gap, no sticking strands), fat pool below. [style block] | chicken-c260-release.webp | clean gen, 1024². LOAD-BEARING #1 ref — inspected: tongs lifting thigh, deep golden-brown crackly skin, clean release with fat pool below, neutral light, no text. Strong match for flip-gate; confirm color at audit. |
| chicken-c300-skin-up | Top-down: all thighs flipped skin-side UP, crisp golden skin facing camera, second side down in a now-shallow fat layer. [style block] | chicken-c300-skin-up.webp | clean gen, 1024². Slow render (~130s — image generations slowing as session runs long). |
| chicken-c355-temp | Close 30° angle: thermometer probe into the thickest part next to the bone of a thigh in the pan, skin-up. Display visible but unreadable (no digits). [style block] | chicken-c355-temp.webp | Generated on retry after the rate limit cleared (verbatim prompt, no tweak needed this time — image, not text). 1024². LOAD-BEARING temp gate + food-safety. ⚠️ AUDIT: (1) probe reads into the central/top of the thigh, not clearly "next to the bone"; (2) round dial face may show a faint readout — check legibility vs the no-text rule. Validate cooked appearance vs a real reference. |
| chicken-c375-rest | Top-down: the thighs skin-up on a plate/board beside the stove, the cast-iron pan visibly OFF the burner on a folded towel on the counter, burner clearly unoccupied. (The towel-on-counter off-heat pattern.) [style block] | chicken-c375-rest.webp | clean gen, 1024². (Also the REUSE source for cue at:366.) |
| chicken-c388-serve | Top-down: plated thighs, skin shatteringly crisp and deep golden, one thigh cut open showing juicy fully-cooked meat at the bone — NO pink. [style block] | chicken-c388-serve.webp | clean gen, 1024². Food-safety — inspected: cut piece shows white fully-cooked meat at the bone, NO pink (✓); skin crisp deep golden. ⚠️ AUDIT: shown IN-PAN rather than "plated," and the cut piece reads more like a bone-in leg than a thigh cross-section — confirm at audit. |

## REUSE (recorded pointers — NOT generated)
| target | source |
|---|---|
| cue at:45 | chicken-c0-cold-pan.webp |
| cue at:366 | chicken-c375-rest.webp |

## AUDIT FLAGS SUMMARY (for /experiment-review — read these first)
- **chicken-prep-5** (food-safety): legible thermometer digits (~"88.0") + "ThermoPro" brand text → violates no-text rule; likely REJECT/re-roll.
- **chicken-c355-temp** (food-safety + LOAD-BEARING temp gate): probe placement reads central/top rather than clearly at the bone; dial face may show a faint readout — check legibility.
- **chicken-c388-serve** (food-safety): no-pink ✓, but shown IN-PAN not "plated," and cut piece reads more like a bone-in leg than a thigh cross-section.
- **chicken-c260-release** (LOAD-BEARING flip gate): looks strong (deep golden, clean release) — audit color confirms.

SESSION: 2026-07-06 (resumed + completed 2026-07-07) · generations: 13 of 13 slots saved (N=1 each; +1 extra image-gen retry on prep-5, +1 rate-limited attempt on c355-temp) · rate-limit: hit once on c355-temp then cleared on retry · prompt tweaks: 1 (prep-5 prepended `Generate an image:` after it returned text) · STATUS: **COMPLETE — all 13 in results/**. REUSE pointers recorded, not generated (cue at:45 → c0-cold-pan ✓, cue at:366 → c375-rest ✓).

NEXT STEP: run `/experiment-review crispy-chicken-thighs prod-2026-07-06` in Claude Code. All Gemini web-UI images may carry the UI watermark — founder audit is the gate.

CONCLUDED: 10 of 13 PROMOTED · 2026-07-08 · Founder audit: ACCEPT prep-1/2/3/4, c0-cold-pan, c160-render, c230-golden, c260-release (load-bearing flip ref confirmed deep-golden), c300-skin-up, c388-serve (no-pink teaching outweighs in-pan staging). REJECT prep-5 (legible "88.0" + ThermoPro text — no-text violation), c355-temp (probe reads top/center, not next-to-bone — the load-bearing placement lesson misses), c375-rest (thighs read RAW — wrong state for the rest step; NEW flag found at audit, also the at:366 reuse source). Re-roll requested for the three rejects.
