# FRIDGE SCANNER — Pantry Pic Mechanics, Choppd Ending

Spec for evolving Choppd's existing fridge scan into the full Pantry Pic-style
flow, ending with Choppd's two differentiators: (1) matching against the real
choreographed catalog, and (2) a "Create new recipe" path showing AI recipe
previews built from the user's actual fridge — wired into the generation
pipeline and the demand flywheel.

Legal note, once: we copy their **mechanics and flow** (not protectable), never
their copy, branding, screenshots, or assets. All screen copy below is written
in Choppd register.

---

## 1. Pantry Pic's exact mechanics (the reference)

Distilled from their store listings and site — this is the flow we replicate:

1. **Photo-first input.** Camera opens as the primary action. Fridge, pantry,
   freezer, or leftovers. Multi-photo supported (fridge + pantry + countertop)
   for fuller detection. No typing required — that's their entire pitch.
2. **Review screen.** Detected ingredients shown as an editable list —
   add / remove / edit before anything is generated. Detection is never
   trusted blindly; the user confirms.
3. **Personalized results.** Recipes matched to what they have, filtered by
   dietary preference, skill level, and time available.
4. **Missing-items → smart shopping list.** Picking a recipe adds ONLY the
   missing ingredients to a shopping list — no duplicates.
5. **Step-by-step cooking mode.** Hands-free instructions after selection.
6. **Scan-limit monetization.** 4 free scans/month; Pro = unlimited scans.
7. (Out of v1 scope, noted for later: receipt scanning to stock a pantry
   inventory, freshness/expiry tracking, weekly meal planner.)

## 2. What Choppd already has vs. what's new

| Pantry Pic mechanic | Choppd today | Delta |
|---|---|---|
| Photo input, multi-photo | ✅ /api/scan, ≤3 photos, compression, EXIF strip | Camera-first entry polish (§3.1) |
| Review/edit detected list | ✅ confirm chips + autocomplete + staples toggle | Keep as-is |
| Match to recipes | ✅ ready / almost / missing vs catalog | Keep; presentation upgrade (§3.3) |
| Missing → shopping list | ⚠️ "missing: X, Y" text only | Copyable/shareable list (§3.4) |
| Step-by-step cook | ✅ the entire product — better than theirs | Tap-through, zero new work |
| AI-generated recipe results | ❌ | **The new build** (§4) |
| Scan limits | 10/day flat | Optional free/Pro alignment (§6) |

## 3. The flow, screen by screen (Pantry Pic mechanics, Choppd skin)

### 3.1 Entry — camera-first
- Home card stays ("📸 What can I cook right now?") but tapping it opens the
  **capture sheet immediately** — camera/library picker as the first thing
  seen, not a landing page. Pantry Pic's lesson: every screen between intent
  and photo loses users.
- Subline on the sheet: "fridge, pantry, or leftovers — up to 3 shots."
- Manual entry remains one tap away ("or type your ingredients") and stays
  the automatic fallback on scan failure. Unchanged.

### 3.2 Detect → review (exists; unchanged mechanics)
- Chips: detected (removable), other (grey/informational), add-with-
  autocomplete, staples toggle persisted. Quality-flag retake guidance.
- One copy tweak to mirror their framing: header reads "Here's what we
  spotted — fix anything we got wrong." (Confirms the user is the editor.)

### 3.3 Results — three sections now, not two
Order on screen:

1. **"Cook right now"** — ready catalog matches, existing recipe cards,
   ✅ badge. Tap → pan/stove gate → the real cook. Unchanged.
2. **"Almost there"** — missing 1–2 items, with the missing list. Each card
   gains one button: **[Add missing to list]** → §3.4.
3. **"Doesn't exist yet? Make it."** — the new section (§4): 2–3 AI recipe
   preview cards generated from THEIR confirmed ingredient list, plus a
   **[+ Create new recipe]** action. This section renders even when sections
   1–2 are full (discovery), and becomes the hero when both are empty —
   replacing today's honest-but-dead-end empty state with a live path.

### 3.4 Smart missing-items list (small build)
- Tapping [Add missing to list] on any "almost" card assembles a deduped
  list across every card they tapped (their mechanic: only what's missing,
  no duplicates).
- v1 scope: a simple list sheet with copy-to-clipboard and Web Share — NOT a
  persistent shopping-list system. It's a convenience artifact, not a
  feature universe. Persistence can come later if telemetry says people use
  it.

## 4. THE NEW BUILD — AI recipe previews + "Create new recipe"

The core design tension, named up front: **Pantry Pic generates instant,
unverified text recipes. Choppd's promise is verified, choreographed,
stove-safe cooks.** We copy their instant-gratification mechanic at the
PREVIEW layer, and route actual creation through the pipeline that keeps the
promise. Two tiers:

### 4.1 Tier 1 — instant AI previews (cheap, immediate, no commitment)
- After the confirm screen, alongside catalog matching, the server makes ONE
  additional model call (Haiku-class, same key/infra as /api/scan): given the
  confirmed canonical ingredient list + staples flag, return 2–3 **recipe
  concepts** as strict JSON: `{ title, one_line_hook, uses: [ingredient_ids
  from their list], would_need: [≤2 common items], est_minutes,
  difficulty }`.
- Rendered as preview cards in section 3 — visually distinct from real
  catalog cards (dashed border / "concept" badge) so a concept is never
  mistaken for a cookable recipe. Card copy pattern: "Garlic-Butter Chicken
  Rice — uses 6 of your 8 ingredients · ~25 min."
- Constraints in the generation prompt: concepts must lean on THEIR
  ingredients (≥70% coverage), respect the beginner/equipment reality
  (stovetop, one pan/pot bias), and stay within Choppd's zero-shopping
  ethos (would_need ≤2 staples-adjacent items).
- Cost note: one extra Haiku call per scan ≈ same order as the scan itself
  (~half a cent). Cache previews per canonical ingredient-set key so
  identical fridges reuse them (the generate-once discipline, applied to
  previews).

### 4.2 Tier 2 — [Create new recipe] (the pipeline path)
Tapping a preview card (or the bare [+ Create new recipe] button) opens the
request sheet:

- **Copy (sets the expectation honestly):** "We build real cooks — tested
  timing, voice, the works — not a wall of text. Want this one? We'll build
  it and ping you when it's ready to cook."
- **[Request this recipe]** →
  1. Writes a `recipe_requests` row: canonical ingredient set, the chosen
     concept (title/JSON), user_id (nullable, deletion-anonymize pattern),
     timestamp, status: `requested`.
  2. Confirmation state on the card: "Requested ✓ — we'll let you know."
  3. Feeds the existing demand flywheel: /admin/scans gains a REQUESTS tab —
     concepts ranked by request count. This is /new-recipe's input queue,
     now with explicit user intent attached instead of inferred no-match
     counts.
- **Fulfillment loop:** founder runs /new-recipe on top-requested concepts →
  pipeline drafts → verifiers → stove-test → images → ships to catalog →
  every requester gets notified: v1 notification = a home-screen card on
  next open ("The recipe you asked for is live: Garlic-Butter Chicken
  Rice 🔥") driven by a `status: shipped` check; push/email later.
- **Explicit non-goal, stated in code comments and the admin tab:** no
  fully-automated generation-to-catalog. The human gate (stove-test) stays.
  If request volume ever outruns founder throughput, THAT is the signal to
  revisit telemetry-gated automation — with data, per the Five Forces doc.

### 4.3 Why this beats copying Pantry Pic exactly
Their instant generated recipes are the commodity every scan app has; the
graveyard section of that category is apps whose generated recipes were
mediocre text walls. Choppd's version: instant previews scratch the
curiosity itch, the request loop converts curiosity into (a) demand data,
(b) a comeback trigger (the notification is a retention event), and (c) a
catalog that only grows where real fridges asked it to.

## 5. Telemetry (extends the existing scan events)
- `preview_shown` (count, per scan), `preview_tapped` (which concept),
  `recipe_requested` (concept + ingredient-set key), `request_fulfilled_seen`
  (the notification card viewed), `request_to_cook` (requester actually
  cooked the shipped recipe — the golden metric: did generated-on-demand
  drive a real cook?).
- All anonymous-count pattern; user_id nullable with the standing
  deletion-anonymize treatment; add `recipe_requests` to the delete-account
  transaction + its verification checklist.

## 6. Scan limits (optional alignment, founder's call)
- Pantry Pic's mechanic: 4 free scans/month, Pro unlimited. Choppd today:
  10/day flat.
- If/when premium tiers go live: scans are a natural free/Pro lever (e.g.
  free = 6 scans/month + unlimited manual entry, Pro = unlimited scans).
  NOT part of this build — flagging the mechanic so the rate-limit constant
  stays easy to segment by tier later.

## 7. Explicitly NOT copied (v1)
- Receipt scanning / pantry inventory / freshness tracking / weekly meal
  planner — inventory-management surface area that competes with the cook
  experience for attention. Revisit only if scan telemetry shows repeat
  scanning of the same fridge (the signal that users WANT persistent
  inventory).
- Their dietary-filter depth (keto/vegan/10+ diets) — Choppd's catalog is
  too small to filter meaningfully yet; concepts inherit a "no dietary
  claims" rule until the catalog can back them.

## 8. Build order (each independently shippable)
1. **3.1 + 3.3 restructure** — camera-first entry, three-section results,
   concept-card visual language (no AI yet; section 3 shows only the
   [+ Create new recipe] button with the request sheet stubbed to
   demand-logging).
2. **4.1 previews** — the concept-generation call + caching + cards.
3. **4.2 request loop** — recipe_requests table, admin REQUESTS tab,
   fulfillment notification card, deletion-transaction extension.
4. **3.4 missing-items list** — the copy/share sheet.
5. Founder loop begins: fulfill the top request through /new-recipe;
   first `request_to_cook` event is the proof the loop closes.

## 9. Verification highlights (per phase, standing patterns)
- Concept JSON parsed defensively (the scan endpoint's fence-strip/retry
  pattern); preview failure = section 3 shows only the create button —
  never an error, never blocks sections 1–2.
- Concept cards visually distinct in headless screenshots; a concept card
  can never route into the cook flow.
- recipe_requests rows anonymize on account deletion (extend the live
  verification).
- Cache hit on identical canonical ingredient sets (no duplicate concept
  spend).
- One-screen budget check on any screen this touches.
