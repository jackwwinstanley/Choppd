# THE GRADUATION SYSTEM — design doc

**Skill graph · confidence certificate · next tier**

The promise being kept: nobody hires Choppd for recipes — they hire it to
**become the guy who can cook.** This doc designs the full system, splits it
into what ships **NOW** (authoring metadata + silent instrumentation) vs. what
builds **AT TESTER DATA** (thresholds calibrate against real repeat-cook
behavior, not guesses), and specs the UX against the best existing patterns for
"an app confident enough to let go."

Standing disciplines applied throughout: API-first server state (the
resume/receipts/basket pattern), flag-dark builds gated on founder audit, every
user-facing string DRAFT-PENDING-VOICE-REVIEW, safety gates non-negotiable,
competence-not-confetti.

> **STATUS (2026-07-11):** Phase 1 (§6 NOW) is built and instrumented dark. The
> founder-audit table is in §9 below (awaiting sign-off). Phase 2 (the §4
> surfaces) is unwritten until tester data exists. See §10 "PHASE 1 — AS BUILT".

---

## 1. PRIOR ART — what to borrow, what to refuse

- **Khan Academy — mastery states (BORROW THE SPINE).** Quiet levels
  (Attempted → Familiar → Proficient → Mastered) driven by evidence, shown as
  calm per-skill bars, no confetti economy. Borrow: the 3–4-state ladder,
  evidence-driven advancement, the quiet bar.
- **Nike Run Club — guided → unguided (BORROW THE GRADUATION MECHANIC).**
  Coached runs explicitly build toward uncoached ones; the unguided run is the
  product working, not churn. Borrow: the framing ("you don't need us for this
  one"), the voluntary opt-in, the return path to guided.
- **Aviation's first solo (BORROW THE EMOTIONAL SHAPE).** The instructor steps
  out, BUT the checklist stays in the cockpit and the radio stays on. No-cues
  mode removes the coaching, never the safety systems (the 165°F gate is the
  checklist); an SOS channel stays one tap away without "failing" the solo.
- **Duolingo — test-out (BORROW NARROWLY, REFUSE BROADLY).** Take: "test out"
  lets a confident user skip ahead by demonstrating. Refuse: XP, leagues,
  streak-guilt, gems. Cooked owns collectible gamification; copying it is
  off-brand. Choppd's currency is evidence in plain English, never points.
- **Headspace Basics (BORROW THE CONFIDENT GOODBYE).** The intro course ends by
  telling you you're equipped to go unguided — teaching its own optionality
  builds trust, not churn. "We actually teach you — you won't need us for eggs
  forever" is this pattern said out loud.
- **Belt systems / Yousician tiers (BORROW THE VISIBLE LADDER).** The next belt
  is visible while you earn this one. The tier map renders visible-but-locked
  with the unlock condition in competence terms ("Graduates from Smash
  Burgers"), never grind terms ("Cook 10 more times").
- **Whoop vs. Apple Watch (THE TONE FORK).** Whoop-quiet for the skill panel;
  exactly ONE loud moment reserved — the graduation itself. Scarcity makes the
  celebration land.

---

## 2. THE SKILL TAXONOMY (authoring metadata — founder audits this table)

Ten skills, mapped to the 12 shipped flagships via per-step tags. **Rule of
thumb:** a skill is something transferable BETWEEN recipes (that's what makes
"across 3 recipes" meaningful evidence); a technique unique to one dish is not a
skill, it's a step.

| skill id | plain name | evidenced by (examples across the roster) |
|---|---|---|
| `heat_control` | Heat control | every preheat gate; the cheesesteak medium→HIGH→OFF ladder; ramen's boil→LOW egg drop; pancake report-card adjustments |
| `searing` | Searing | steak; smash; thighs skin-down; fried-rice + teriyaki chicken hands-off browning; cheesesteak beef |
| `doneness` | Doneness judgment | every 165°F/145°F gate; no-pink checks; pancake bubble-read; glaze state; egg just-set |
| `knife_basics` | Knife basics | dicing chicken (fried rice, teriyaki); slicing veg (cheesesteak, tacos onion); slice-your-own beef |
| `seasoning` | Seasoning | tacos blend/packet bloom; chop-seasoning (cheesesteak); taste-and-adjust closers (fried rice, teriyaki) |
| `pan_sauces` | Sauces & glazes | teriyaki glaze; taco simmer-to-saucy; ramen stir-fry toss; pasta emulsion |
| `egg_cookery` | Egg cookery | scrambled; fried-rice push-aside; ramen poach; pancake batter; smash-adjacent none |
| `multitasking` | Kitchen timing | teriyaki broccoli-during-chicken; cheesesteak toast→veg→beef sequencing; pasta water + sauce; basket-week parallel habits |
| `batch_rhythm` | Batch cooking | pancakes (the lesson→reps structure); smash double rounds |
| `boil_craft` | Pots & boils | pasta; ramen (rolling-boil gate, noodle timing); rice handling |

**Authoring rule (recorded in RECIPE_FORMAT.md):** every recipe carries a
`skills` block — per-step (or per-cue) skill tags, e.g.
`skills: { searing: [3,4], doneness: [8] }` (cue indices). Going forward it's
part of the handoff template; the 12 shipped flagships get a one-time retro-tag
pass (founder-auditable as a table — §9).

**Credit rules (server-side, deterministic):**

1. A COMPLETED cook credits **+1 rep** to each skill whose tagged steps were
   passed through (gates confirmed where present).
2. Gate-bearing skills (`doneness`, `searing`) only credit when their gate was
   **CONFIRMED** — tapping through without the gate never counts.
3. Abandoned cooks credit **nothing** (`cook_abandoned` already fires; its step
   index tells us WHERE confidence fails — the calibration data).
4. Cross-recipe evidence is first-class: the display unit is always
   **"N× across M recipes"** because transfer is what distinguishes a skill from
   a memorized recipe.

---

## 3. SKILL STATES + THRESHOLDS (drafted conservative; CALIBRATED at tester data)

Khan-style ladder, plain names, **draft** thresholds:

| state | draft rule | shown as |
|---|---|---|
| Learning | 1–2 reps | "Getting the feel" |
| Comfortable | 3–5 reps | "You've got this in you" |
| Confident | 6+ reps AND across ≥2 different recipes | "Seared 6× across 3 recipes" |

The **no-cues offer** requires BOTH: the recipe's dominant skills at Confident,
AND ≥4 completions of that specific recipe. Two locks because they measure
different things — skill transfer and dish familiarity — and premature freestyle
is the failure mode the doc names. Thresholds are a DRAFT TABLE pending founder
audit **now**, and a CALIBRATION pass at tester data: the repeat-cook curves
(`cook_abandoned`'s inverse — where do 2nd/3rd/4th cooks stop failing?) tell us
where confidence actually forms, and the thresholds move to match reality,
conservative side.

---

## 4. UX SPEC — surface by surface (PHASE 2 — builds at tester data)

**4a. The skill panel (profile/home — Whoop-quiet).** A compact "What you can do
now": one row per skill with reps in plain English, a subtle 3-state bar, no
percentages, no points, no red. Rows sort most-evidenced first; untouched skills
don't render. Tapping a row shows the evidence (which cooks, when).

**4b. The offer moment (finish screen, warm — NRC framing).** Fires ONLY on the
finish screen of a qualifying completion (never mid-cook, never a push in v1): a
card inside the payoff — draft: *"That's 6 scrambles. You don't need us for this
one. Want to try it freestyle next time?"* `[Freestyle next time] [Keep the
cues]`. Declining is first-class, remembered, re-offered gently after +2 more
completions — never nagged.

**4c. No-cues mode — "Freestyle" (the aviation solo).** REMOVED: cue ladder,
timers, voice, step bullets, running clock (elapsed behind a tap). STAYS
NON-NEGOTIABLE: every `safetyCritical` gate at its natural point as the only
interruptions, solo register ("Solo rule: the temp check stays. 165 in the
thickest piece."). STAYS ONE TAP AWAY: a collapsed "peek" drawer (amounts + step
list); peeking is honest and free, the completion still counts. BAIL-OUT: "Back
to cues" resumes guided at the matching step ("Good call — that's what they're
for."). Music: freestyle is the one mode where a wired track can play straight
through (no cue sync) — data-only later, no music code now.

**4d. Graduation (the ONE loud moment).** Completing a freestyle cook =
full-warmth screen, certificate framing — draft: *"You just cooked scrambled
eggs from memory. Nobody can take that away. That's not an app skill. That's a
you skill."* The CERTIFICATE CARD is the third face on the existing share
pipeline (cook card / savings card / now this) — screenshot-first: the dish +
"Cooked freestyle. No cues." + date, Choppd branding small. Skill panel marks it
permanently ("Scrambled eggs — GRADUATED"). Graduated ≠ locked out: guided stays
forever, no gloating.

**4e. The next tier (the belt on the wall).** Graduation unlocks the harder
tier, visible-but-locked before graduation with the condition in competence
terms. DRAFT TIER MAP (founder audits; unbuilt targets double as the authoring
roadmap's demand signal):

- scrambled eggs → **omelette** (UNBUILT — authoring queue)
- smash burgers → **steak** (exists ✓)
- upgraded ramen → **chicken fried rice** (exists ✓ — packet → real wok work)
- fried rice → **teriyaki bowl** (exists ✓ — adds the glaze skill)
- tacos → **philly cheesesteak** (exists ✓ — assembly → the chop)
- pancakes → **(open — candidate: French toast / crêpes, unbuilt)**

Unlock render: "Earned: Steak — you graduated Smash Burgers." Reward is ACCESS
FRAMING, not access gating: v1 does NOT lock recipes (locking content
contradicts the login-gates-nothing spirit) — the tier map renders as a PATH,
the unlock as recognition. Hard-locking becomes a founder decision later if
tester data shows the path drives repeat cooks.

---

## 5. DATA MODEL + API (the resume/receipts/basket discipline)

- **skills metadata:** authored per recipe (RECIPE_FORMAT field), shipped in the
  recipe data. For anti-tamper the **crediting map is server-authoritative** (the
  server holds the recipe→skills mapping; the client cannot send skillIds).
- **SERVER:** `skill_events` derived at cook completion (the receipts POST moment
  — same hook): append-only rows `{account, recipeId, skillId, gateConfirmed,
  ts}`. Aggregation computes states; nothing user-facing stores denormalized
  levels (recompute = thresholds calibrate later WITHOUT rewriting history).
- **API (JWT, account-keyed, schema_version — iOS inherits):** `GET /api/skills`
  (states + evidence), `POST /api/skills/complete` fires server-side derivation
  on completion (no client-writable skill data — evidence can't be tampered),
  `GET /api/skills/offers` (Phase 2 — which no-cues offers are earned).
- **Anonymous:** skill events hold client-side like `pendingReceipt`, flush on
  login — "Sign in to keep your progress" joins the nudge family.

---

## 6. WHAT SHIPS NOW vs. AT TESTER DATA (the gate, honored)

**NOW (authoring + silent instrumentation — no user-facing change):**

1. The `skills` field in RECIPE_FORMAT + the retro-tag pass on all 12 flagships
   (founder audits the taxonomy table + tags — §9).
2. Server-side `skill_events` logging, **dark** — completions start accumulating
   evidence THE DAY TESTERS ARRIVE, so the calibration data the gate demands
   actually exists when it's time. (Instrumentation before feature: same reason
   `scan_miss` shipped early.)
3. The tier map recorded as data (its unbuilt targets fed to the authoring queue).

**AT TESTER DATA (builds behind `SKILLS_ENABLED=false`, founder flips):**

4. The skill panel, the offer, freestyle mode, graduation + certificate card,
   the tier path render — thresholds calibrated from the real repeat-cook curves
   first, drafts audited row-by-row like every table before them.

---

## 7. ANTI-PATTERNS (refusals, recorded)

- **NO** XP, points, streaks, leagues, gems, confetti economy — competence, not
  confetti; Cooked owns that lane and it's off-brand here.
- **NO** skill decay/loss — evidence never shrinks (the receipts-tab rule:
  retroactively shrinking a guy's progress is betrayal).
- **NO** freestyle offers below threshold, ever, including via settings — the
  conservative gate is a safety posture, not a preference.
- **NO** removing safety gates in any mode, ever. *(Recorded verbatim.)*
- **NO** content hard-locks in v1 — the tier map is a path, not a paywall.
- **NO** shame states anywhere: declining the offer, bailing to cues, and peeking
  are all first-class, warmly-copy'd choices.

---

## 8. PROMPT 1 — THE NOW PHASE (the build order that produced §9/§10)

Implement §6 "NOW" only. Three jobs: (1) RECIPE_FORMAT records the skills-block
authoring rule + credit rules verbatim + anti-patterns as standing rules, and
adds the `skills` field to the handoff template; (2) retro-tag the 12 flagships
per §2 and output the full tag table FOR FOUNDER AUDIT (tags ship only after
sign-off; ambiguities flagged, not guessed); (3) dark server-side `skill_events`
at the existing cook-completion hook, derived from the audited tags + gate
confirmations per the §2 credit rules, abandoned cooks write nothing, anonymous
holds+flushes, `GET /api/skills` returns raw evidence. FENCES: no UI, no music
code, no gate changes, no thresholds, no offers. Deploy diff-scoped.

Phase 2's prompt gets written when the tester data exists.

---

## 9. FOUNDER-AUDIT TABLE — the §2 retro-tags (SIGNED OFF 2026-07-11)

> **Sign-off deltas from the draft** (founder row-by-row): **steak −`seasoning`**
> (plain pre-sear salt is a step, not technique — F12 narrow); **pancakes
> −`egg_cookery`** (batter is a step, not egg technique — F12 logic applied over
> the §2 illustrative example); **fried-rice +`multitasking`** (component
> in/out/recombine = the same sequencing skill as philly/teriyaki). F12 line kept
> narrow: `seasoning` credits only as a technique (tacos bloom, fried-rice/pasta
> taste-adjust, philly chop-season) — never plain salting. After the deltas every
> tag survives the "technique-not-step" test catalog-wide. The table below is the
> shipped state (`skills-map.ts`).

Per-recipe skill sets drafted from the §2 taxonomy against each flagship's cue
ladder. **`gated` column** = the subset that only credits on a confirmed gate
(per credit-rule 2 the doc names `searing` + `doneness`). **Prep-evidenced**
skills (knife work before the music) are marked `(prep)`. Flags `F#` are
ambiguities I did NOT silently resolve — your call.

| # | recipe | skills (union) | gated | notes / flags |
|---|---|---|---|---|
| 1 | freebird-medium-rare-steak | heat_control, searing, doneness | searing, doneness | signed off: `seasoning` dropped (plain pre-sear salt — F12). `knife_basics` (final slice) omitted (plating, not prep — F1) |
| 2 | scrambled-eggs | heat_control, egg_cookery, doneness | doneness | preheat gate → heat_control; just-set gate → egg_cookery + doneness. F12: end-salt NOT tagged seasoning |
| 3 | one-pot-garlic-parmesan-pasta | boil_craft, pan_sauces, doneness, seasoning | doneness | pasta-tender gate → boil_craft+doneness; the DROP = "taste & season" → seasoning. F3: `multitasking` **omitted** (one-pot flow is sequential, not parallel); heat_control omitted (off-heat sauce) |
| 4 | crispy-chicken-thighs | heat_control, searing, doneness | searing, doneness | F4: `heat_control` not in §2's list but the crisp→cook-through heat drop is real — recommend **include** |
| 5 | smash-burgers | searing, doneness, batch_rhythm | searing, doneness | F5: `batch_rhythm` is the **double**-stack round-two only — single patty has no rounds (method nuance). heat_control + salting omitted |
| 6 | chicken-fried-rice | searing, heat_control, doneness, knife_basics (prep), egg_cookery, seasoning, multitasking | searing, doneness | signed off: `multitasking` added (chicken-out→veg→egg→recombine = the philly/teriyaki sequencing skill — F6). `pan_sauces` omitted (splash-toss → seasoning) |
| 7 | ground-beef-tacos | heat_control, doneness, seasoning, pan_sauces, knife_basics (prep) | doneness | packet/blend bloom → seasoning; simmer-to-saucy gate → pan_sauces. `searing` omitted (crumble-browning ≠ sear). knife_basics = onion (prep) |
| 8 | pancakes | heat_control, doneness, batch_rhythm | doneness | signed off: `egg_cookery` dropped (batter is a step, not egg technique — F12 logic over the §2 example). bubble-read + report-card → doneness/heat_control; stack → batch_rhythm |
| 9 | teriyaki-chicken-bowl | heat_control, searing, doneness, knife_basics (prep), pan_sauces, multitasking | searing, doneness | glaze gate → pan_sauces; broccoli-during-chicken → multitasking (the §2 exemplar). F8: `seasoning` redundant with the glaze — recommend **omit** |
| 10 | loaded-quesadilla | heat_control, doneness | doneness | F9: **skill-light** (assembly-focused) — only heat_control + doneness credit honestly. Not in the tier map |
| 11 | upgraded-ramen | heat_control, boil_craft, pan_sauces, egg_cookery, doneness | doneness | F10: `pan_sauces` = **stir-fry method only**; `egg_cookery` = **optional egg only**; boil/heat = soup-centric. No searing. Biggest method/opt variance |
| 12 | philly-cheesesteak | heat_control, searing, knife_basics, seasoning, doneness, multitasking | searing, doneness | the medium→HIGH→OFF ladder (heat_control exemplar); THE CHOP (knife_basics + chop-season); toast→veg→beef (multitasking). Richest density — the tacos graduation target |

**Global flags:**

- **F12 — "seasoning as a skill" line.** Tag `seasoning` only where it's a
  *technique* (packet bloom / tacos, chop-season / philly, taste-adjust /
  fried-rice, the pasta DROP) — NOT plain end-salting (eggs, smash, steak).
  This is the disciplined line I drew; confirm or widen.
- **F11 — method/opt precision.** Phase-1 credits the **union by recipeId**
  (method-agnostic). The client already knows `cookMethod` + selected optionals,
  so method-precise crediting (e.g. smash single vs double, ramen soup vs
  stir-fry, optional egg) is available as a one-field refinement if you want it —
  say the word and the POST carries `method`.
- Tags become live recipe data (`cues.js` per-cue `skills` blocks) and Phase-2
  display only **after** you sign off this table. The NOW dark logging already
  runs off the server map below, which is the machine form of this table.

---

## 10. PHASE 1 — AS BUILT (dark instrumentation)

**Flag.** `SKILLS_ENABLED = false` added to `server/src/limits.ts` + mirrored in
`mvp/app.js`. It gates the (unbuilt) Phase-2 **surfaces**. Phase-1 evidence
logging is intentionally NOT gated by it — it runs dark so evidence accumulates
the day testers arrive (the `scan_miss` precedent).

**Server-authoritative map.** `server/src/skills-map.ts` exports `SKILL_TAGS`
(the §9 table in code): `{ [recipeId]: { skills: SkillId[], gated: SkillId[] } }`.
The client never sends skillIds — anti-tamper per §5.

**Table.** `skill_events` (append-only): `id, user_id, recipe_id, skill_id,
gate_confirmed, created_at`, indexed on `user_id`. Added near
`receipt_ledger`/`basket` in `db.ts` migrate (deliberately far from the
`video_matches` block for deploy-strip discipline). Added to the
account-deletion transaction (`routes.ts`) as an FK child — hard-deleted.

**Endpoints (`server/src/skills.ts`, JWT).**
- `POST /api/skills/complete` `{ recipeId, gatesConfirmed }` → looks up
  `SKILL_TAGS[recipeId]`; for each skill writes a row with
  `gate_confirmed = gated.includes(skill) ? gatesConfirmed : true`. Unknown
  recipe → writes nothing. Abandoned cooks never call it.
- `GET /api/skills` → raw evidence for the founder + demand-analyst: per-skill
  `{ reps (credited only), recipes: [...], total, lastAt }`. No thresholds, no
  states, no offers — nothing renders (Phase 1).

**Client (`mvp/app.js`).** A `Skills` controller mirrors `Receipt`: on
`screens.finish` it posts `{ recipeId, gatesConfirmed }` (logged-in) or holds
`pendingSkills` (anonymous, flushed by `afterServerLogin`). `gatesConfirmed` is
`true` on any genuine flagship finish (gates block advancement, so completion ⟹
all confirmed). Fails silent (`.catch`) so a server without the endpoint never
breaks finish. `window.__skills` dev hook mirrors `window.__receipt`.

**Fences honored:** no UI, no music/gate/threshold/offer code; the only runtime
change is one extra fire-and-forget POST on completion (dark, like `scan_miss`).
