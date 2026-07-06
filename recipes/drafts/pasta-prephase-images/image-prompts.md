# Image prompts — pasta pre-phase / phase 1 (Cowork batch)

CLASS: IN-COOK REFERENCE (RECIPE_FORMAT.md §7) — neutral daylight; color
is data at every one of these judgment calls. (Task brief named the warm
spec; reference slots follow the reference class — flag to re-emit warm.)

Base style (append to every prompt): *photorealistic reference photo,
bright even neutral daylight, neutral white balance, no colored shadows,
one subject filling the frame, large stainless pot on a stovetop, light
neutral surface, no garnish, no props, no text, realistic home result.*

PROMOTED (exp-001-overhead-vs-hero, SIMULATED verification run): pot-content
slots use the TOP-DOWN OVERHEAD template — "Top-down overhead photograph
looking straight into a large stainless pot on a stovetop: [STATE]. Bright
even neutral daylight, neutral white balance, no colored shadows, one
subject filling the frame, light neutral surface, no garnish, no props, no
text, realistic home-kitchen result. Square." (45° occludes the surface —
the diagnostic feature — behind the pot wall.)

EXISTING SLOTS being replaced/kept: p1-c1 (butter+garlic, currently shared),
p1-c2 (pasta in), p1-c3 (simmer). NEW: p1-boil (slot already wired in code,
404-safe until generated). Generate as separate singles; condition on one
style anchor.

---

**pasta/onepot-p1-c1.webp — KEEP/REGENERATE ("Melt the butter — MAX heat")**
Top-down into the pot: butter fully melted and FOAMING pale gold — bubbly
white foam, zero browning. Judgment call: "foaming = ready for garlic;
brown = too far." (This slot is currently SHARED with the garlic step —
acceptable reuse: the garlic lands in exactly this foam. Optional upgrade:
a separate garlic frame below.)

**pasta/onepot-p1-garlic.webp — OPTIONAL NEW SLOT ("Add the garlic")**
Top-down: minced garlic just scattered into foaming butter, pieces still
pale ivory-white (NOT golden, NOT brown), a spatula mid-stir. Judgment
call: "pale and fragrant = go to liquid NOW; golden edges = you're late."

**pasta/onepot-p1-c2.webp — KEEP/REGENERATE ("Pasta + liquid in")**
Top-down: dry short pasta and broth just added to the pot, pasta half-
submerged, liquid still clear. Judgment call: "this little liquid is
correct — it's not supposed to cover like boiling water."

**pasta/onepot-p1-boil.webp — NEW (slot wired: "Bring it to a rolling boil")**
Low 20-degree side-angle at the pot rim: a PROPER rolling boil — large
vigorous bubbles breaking the whole surface, visible motion. Judgment
call: rolling boil vs simmer (pairs with p1-c3 as an under/over
comparison set — generate from identical prompts, only the bubble-state
words changed).

**pasta/onepot-p1-c3.webp — KEEP/REGENERATE ("Drop to a simmer")**
Low 20-degree side-angle, same framing as p1-boil: a GENTLE simmer —
small bubbles rising mainly at the edges, surface barely moving, pasta
visible through reduced liquid. Judgment call: simmer vs boil (the other
half of the comparison pair).

**pasta/onepot-p1-gate.webp — NEW SLOT (tenderness gate)**
Top-down close-up: a fork lifting one piece of short pasta bitten in
half, the cross-section showing NO chalky white core, the pot's glossy
clinging sauce behind. Judgment call: the bite test — "no white center =
tender." ⚠️ Validate the cross-section reads clearly at thumbnail size.

REUSE: bouillon/water+butter liquid variants share p1-c2 (state is
identical); the simmer TIMER screen reuses p1-c3.
