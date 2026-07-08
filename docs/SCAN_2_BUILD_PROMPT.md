SCAN 2.0 — IN-APP LIVE CAMERA, CATEGORIZED REVIEW, TABBED RESULTS,
AND DETECTION ACCURACY AS THE #1 PRIORITY

Rebuild the scan experience to Pantry Pic's UX pattern (in Choppd's logo,
palette, and register — never their copy/branding) with one overriding
priority: DETECTION MUST ACTUALLY FIND THE FOOD. The current single-call
Haiku scan misses too much. Accuracy work is Part 1 and gates everything
else; if trade-offs arise, accuracy wins over polish.

BEFORE CODING — read and report:
- Current /api/scan internals: model, image handling, prompt, the
  single-call-for-all-photos structure, resolution cap (1280px), and the
  confirm-chips flow it feeds.
- The pending Haiku-vs-Sonnet audition state (test photos exist?). This
  build ABSORBS that audition — it becomes Part 1's benchmark.
- The scan vocabulary in scan-data.ts (~90 entries) — Part 3 adds a
  category field.
- The limits build: scan caps/exemption flags, premium waitlist sheet —
  Part 2's locked-slot tile and Part 1's premium model hook plug into
  them.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 1 — DETECTION ACCURACY (the point of this build)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. ONE VISION CALL PER PHOTO, not all photos in one call. Cross-image
   attention dilution is a prime suspect for the misses: three cluttered
   fridge shots in one request means the model skims each. Per-photo
   calls (parallel, Promise.all) mean full attention per image; server
   dedupes the union. Cost triples to ~1.5–3¢/scan — accepted; accuracy
   is the priority. Latency stays flat (parallel).

2. RESOLUTION BUMP: client compression cap rises 1280px → 1568px longest
   edge (re-verify output stays comfortably under the size backstop;
   report typical KB). Fridge shots are label-reading tasks — resolution
   is recall.

3. THE PROMPT REWRITE (per-photo):
   - Systematic sweep instruction: examine the image region by region —
     top shelf, middle shelves, door shelves, drawers, counter — and
     enumerate EVERY distinct food item seen, including items partially
     visible behind others, items in transparent containers, and
     packaged goods (read the labels).
   - THREE OUTPUT TIERS (strict JSON, same defensive parsing):
       matched:   [vocabulary ids] — confident identifications
       uncertain: [{id_or_name, reason}] — partially visible / ambiguous
                  / low confidence. EXPLICIT instruction: "when unsure,
                  put it in uncertain rather than omitting it — a wrong
                  guess in uncertain costs nothing; an omission loses
                  the item."
       other:     [free text] — clearly visible food not in vocabulary
   - Keep: presence-only, no quantities; ignore non-food; quality flag
     per photo.
   - Include the full vocabulary (ids+labels+aliases+NEW categories) as
     before.

4. MODEL LADDER (config constants, per-tier hooks):
   - SCAN_MODEL_DEFAULT: Haiku-class first pass per photo.
   - ESCALATION: if a photo's (matched + uncertain) count < ESCALATION_
     THRESHOLD (start: 4) while quality == "ok", re-run THAT photo on
     SCAN_MODEL_STRONG (Sonnet-class). Merge results (union; Sonnet's
     verdicts win conflicts). Log which photos escalated.
   - SCAN_MODEL_PREMIUM hook: a per-account tier field can route all
     passes straight to SCAN_MODEL_STRONG — or SCAN_MODEL_MAX
     (Opus-class) — skipping escalation. Wire the config + account
     check now; no UI (premium doesn't exist yet). Named constants for
     all three model strings.
   - HONEST BENCHMARK CLAUSE: Part 1's benchmark (item 5) may show
     Haiku+escalation still under-detects vs straight-Sonnet. If
     straight-Sonnet recall exceeds the ladder's by >10 points, REPORT
     IT with the cost delta — flipping SCAN_MODEL_DEFAULT to Sonnet is
     a one-constant change and my call.

5. THE BENCHMARK (this replaces/absorbs the pending audition):
   - Ground truth: I supply 5–6 real photos (normal fridge, dark,
     blurry, near-empty, pantry, non-food) WITH a hand-written item list
     per photo (I'll write what's actually in each). If my earlier test
     photos exist, reuse them; tell me what's missing.
   - Measure RECALL (of ground-truth items, % surfaced in matched OR
     uncertain) and precision (of surfaced items, % actually present)
     for: old pipeline (baseline), new Haiku-per-photo, new ladder,
     straight Sonnet. Report the table. Recall is the star metric —
     uncertain-tier hits count as recall (the ghost chip recovers them).
   - Acceptance bar: new pipeline recall ≥ 85% on the normal-fridge
     photo, and strictly better than baseline on every photo, or Part 1
     iterates before Parts 2–4 ship.

6. Cache key unchanged (canonical confirmed set); per-photo results are
   NOT cached (photos differ every time) — only the downstream concept
   previews keep their cache.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 2 — IN-APP LIVE CAMERA (Pantry Pic's capture UX, Choppd skin)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

7. THE PROGRESS RAIL: a persistent 3-step header across the whole flow —
   ① Capture — ② Ingredients — ③ Recipes — current step in FLAME orange,
   completed steps get the ✓ badge, future steps muted. (Their green
   becomes our orange; violet for the completed-check accents per the
   token system. Choppd wordmark/logo in the header, not theirs.)

8. LIVE CAMERA SCREEN (getUserMedia):
   - Full-bleed viewfinder (facingMode: environment, playsinline,
     HTTPS-only — we have it), corner frame guides, shutter button
     bottom-center, [Gallery] button (native picker as secondary path),
     ✕ close top-left, torch toggle top-right ONLY where the track
     supports it (iOS torch support is spotty — feature-detect, hide
     when absent).
   - Multi-shot: each capture drops a thumbnail into a strip above the
     shutter (their shot-4 pattern) with per-thumbnail ✕. [Done] appears
     once ≥1 photo exists.
   - CAP + PREMIUM INFRA: MAX_SCAN_PHOTOS_FREE = 3 (constant) with a
     per-tier resolver (premium hook, same pattern as the model ladder).
     When 3 are taken, the 4th slot on the review-strip screen renders
     as the locked tile — dashed border, 🔒, "Unlock more" — tapping it
     opens the existing premium waitlist sheet (photo-cap variant copy).
     The tile shows regardless of the limits exemption flag (it
     advertises a real current cap, not a dormant limit).
   - FIRST-TIME COACH DIALOG ("Photo Tips", their shot-5 pattern, our
     copy/register): shown once ever (flag, standing pattern) on first
     camera open — tips: open the fridge wide + get the whole shelf in
     frame; one shot per zone (shelves / door / drawers); pantry and
     counter work too; more light = more found. [Got it].
   - PERMISSION/FAILURE FALLBACKS: camera permission denied, getUserMedia
     unsupported, or stream error → seamless fallback to the native
     picker path (current flow) with a one-line note. The live camera is
     an enhancement; scanning must never be blocked by it. Capture →
     canvas frame grab → same compression pipeline (now 1568px) → same
     upload.
   - Teardown: stream tracks stopped on Done/close/navigation (no camera
     light lingering — assert in tests).

9. SCANNING STATE — THE LIVE COUNTER (real now, thanks to per-photo
   calls): as each photo's response lands, the counter updates —
   "Scanning photo 1 of 3…" → "Found 6 so far…" → "Found 11 so far…" →
   auto-advance to Ingredients. Staged copy between responses keeps
   motion. On any single-photo failure: proceed with the others' results
   + a quiet "one photo couldn't be read" note; all-fail → the standing
   manual-entry fallback.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 3 — CATEGORIZED REVIEW (step ②)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

10. VOCABULARY CATEGORIES: add category to every scan-data.ts entry —
    enum: produce | dairy_eggs | meat_seafood | sauces_condiments |
    pantry | frozen | drinks. Generate the draft assignment for my
    review (founder pass, same as the original vocabulary). New-entry
    template gains the field; format-checker asserts it on future
    vocabulary additions.
11. REVIEW SCREEN LAYOUT (their shot-2 pattern, our components):
    - Sections per category present in results, emoji header (🥦 Produce,
      🥛 Dairy & Eggs, 🥩 Meat & Seafood, 🧂 Sauces & Condiments, 🥫
      Pantry…), per-category [+ Add] opening the autocomplete pre-
      filtered to that category (full search still available).
    - Confirmed items: solid chips, ✕ to remove (their per-row pattern).
    - UNCERTAIN ITEMS — THE GHOST CHIPS (our better-than-them feature):
      a "Did we spot these right?" strip at top — uncertain-tier items
      as dashed/translucent chips with ✓/✕ on each. One tap ✓ confirms
      into its category; ✕ dismisses. This is where the recall gains
      from Part 1's uncertain tier get harvested — a missed-item recovery
      that costs the user one tap instead of typing.
    - "other" free-text items: grey informational chips as today.
    - Staples toggle, retake guidance on bad quality, manual mode:
      unchanged.
    - One-screen rule: the review screen may scroll (it's a list screen,
      not a cook step — the one-screen budget governs cook steps), but
      the ghost strip + first category must be visible without scrolling.
12. [Confirm ingredients →] advances the rail to ③; server-side match +
    concept call as today.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 4 — RESULTS: TABBED THREE SECTIONS (step ③)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

13. SEGMENTED TAB BAR pinned under the rail — the user sees the split
    instantly, per founder requirement:
      [ ✅ Cook now (N) | 🧩 Almost (N) | ✨ AI ideas (N) ]
    Counts live in the labels. Default tab: Cook now if N>0, else
    Almost if N>0, else AI ideas. Tabs with N=0 render disabled-muted,
    not hidden (the structure teaches the product).
14. Card language upgraded to their shot-1 pattern, our palette: title,
    one-line description, ⏱ time badge — catalog cards keep their real
    imagery; CONCEPT cards keep the dashed border + CONCEPT badge and
    their request-sheet behavior (section logic, request loop, missing-
    items list: ALL unchanged — this part is presentation only).
15. Section-3 rules untouched: previews cached, [+ Create new recipe]
    always present, honest empty states per the standing spec.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERIFY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- THE BENCHMARK TABLE (Part 1.5) — the gate. Recall/precision per photo
  per pipeline variant; acceptance bar met or Part 1 iterates.
- Per-photo calls: parallel, dedupe correct, single-photo failure
  degrades gracefully, escalation fires on sparse results and logs.
- Live camera: capture→compress(1568)→upload path byte-compatible with
  the picker path; permission-denied and unsupported both land in the
  picker seamlessly; stream teardown asserted on every exit; coach
  dialog once-ever; cap enforced at 3 with the locked tile → waitlist
  sheet (photo-cap copy).
- Review: categories render per vocabulary field; ghost chips confirm/
  dismiss into the right state; per-category add pre-filters; uncertain
  items reaching confirmed feed the match exactly like detected ones.
- Results: tab counts correct across full/partial/empty permutations;
  default-tab logic; concept cards still can't route into a cook;
  request loop + missing list regression green.
- Telemetry adds: scan_photo_escalated, ghost_chip_confirmed /
  dismissed (the recall-recovery metric), camera_fallback_used,
  photo_cap_tile_tapped. Standing events unchanged.
- Rate limits / weekly-scan limits untouched (a 3-photo scan = ONE scan).
Version bump + commit + rsync deploy per repo norm. Report order: the
benchmark table FIRST, then the model-default recommendation, then the
rest.

ON-DEVICE (mine, iPhone Safari): live camera against my real fridge —
permission prompt, 3 shots with thumbnails, torch if offered, Done →
live counter climbing → categorized review with ghost chips (confirm a
couple) → tabbed results; force the fallback once (deny permission) and
confirm the picker path; tap the locked 4th slot → waitlist sheet.
THE REAL TEST: same fridge that embarrassed Pantry Pic — count what my
scan finds vs what's actually there.
