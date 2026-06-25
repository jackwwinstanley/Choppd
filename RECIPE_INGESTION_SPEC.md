# Recipe Ingestion Spec — what we need from a cookbook to build a cook

> Goal: define exactly what information must be extracted from a cookbook recipe
> to turn it into a **Sizle cook** — i.e. a **cue timeline** (steps + timing +
> readiness signals) that can be mapped onto a song. A standard recipe is **not
> enough on its own**; this spec lists what's there, what's missing, and how it
> maps to the app's data model.

---

## 0. The core problem

A cookbook gives **ingredients + prose steps**. Sizle needs a **time-aware,
sensory, gate-able sequence**. The gap we must fill for every recipe:

| Cookbooks usually give | Sizle also needs |
|---|---|
| "Sear 3–4 minutes until browned" | a **typical**, **min**, and **max** duration (for the elastic clock) |
| "until golden brown" | a machine-usable **readiness signal** (sensory cue + optional temp) |
| ordered prose | discrete **actions** with a verb, an active/passive flag, and ordering |
| final doneness | **per-step checkpoints** + which steps are **safety-critical** |
| serves 4 | what scales the **timing** (thickness/weight matter more than servings) |
| — | an **intensity arc** so we can pick/sync a song |

---

## 1. Recipe-level metadata (the header)

Extract from the recipe header/intro:

- `title`, `cuisine`, `technique` (e.g. pan-sear, sauté, roast, boil)
- `difficulty` (or infer), `beginnerFriendly` (bool)
- `servings` / `yield`
- **`activeTimeMin`** — hands-on time (drives song length) — *distinct from* total time
- `totalTimeMin` (incl. passive: marinating, resting, chilling)
- `donenessTarget` (e.g. medium-rare) where applicable
- `tags` (vibe/mood, dietary, occasion) — for the Gen-Z "browse by vibe" UX
- `sourceAttribution` (book, author, page, license status — **see §8**)

---

## 2. Ingredients

For each ingredient:
- `name`, `quantity`, `unit`, `prep` ("smashed", "room temperature", "patted dry")
- `optional` (bool), `substitutions` (if given)
- **`stateAtStart`** — flags that imply *pre-cook timing*, e.g. "room-temp steak"
  → a 30-min pre-step; "softened butter" → plan-ahead note.

These become the **prep checklist** (already in the MVP) and feed pre-cook timing.

---

## 3. Equipment

- `requiredEquipment` (pan type, oven, thermometer, tongs, board)
- `equipmentAffectsTiming` — e.g. cast iron vs nonstick changes sear time → this is
  what we use to **personalize pacing** (PLAN.md equipment check + auto-tune).

---

## 4. Steps → actions (the heart)

Decompose the prose into discrete **actions**. For **each** action capture:

| Field | Meaning | Example (steak) |
|---|---|---|
| `order` | sequence index | 4 |
| `verb` | the action | "flip" |
| `instruction` | plain text | "Flip the steak once" |
| `beginnerInstruction` | reassuring/explanatory variant | "Lift a corner; if deep brown, flip once" |
| `active` | does the cook *do* something now, or wait? | true |
| `attentionLevel` | glance / hands-on / critical | critical |
| `timing` | `{ typicalSec, minSec, maxSec }` | `{210→flip window}` |
| `readiness` | how to know it's ready (**§5**) | "deep brown crust" |
| `checkpoint` | must pass before continuing? (gate) | true |
| `safetyCritical` | raw-meat / burn / temp risk? | true (temp) |
| `hapticImportance` | none / normal / strong (→ buzz pattern) | strong |
| `tools` | tools used this step | tongs |

> One prose sentence often = **multiple actions** ("add oil, then lay the steak in"
> = 2). Splitting correctly is the main authoring skill.

This maps directly onto the existing **cue schema** (`at`, `type`, `title`,
`body`, `beginner`, `voice`, `haptic`, `gate`).

---

## 5. Readiness signals (so steps can gate, not just tick)

For every step, capture **how you know it's done** — this powers Phase A/B/C/D
gates. Three flavours, in priority order:

1. **Quantitative** — temperature, time, visual measurable
   - `internalTempF` / `panTempF`, `targetTime`, etc. → `sensor`/`timed` gates.
2. **Sensory** — sight/sound/smell/touch ("deep brown crust", "foaming butter",
   "loud sizzle", "springs back"). → `confirm` gates + coaching copy.
3. **Negative cues** — what *wrong* looks like ("grey not brown", "smoking = too
   hot") → the **"not yet" coaching** lines.

Each readiness object:
```jsonc
{ "type": "sensory", "signal": "deep golden-brown crust",
  "notReady": "still pale/grey — give it ~30s more",
  "tempF": null, "thermometerOptional": true }
```

---

## 6. Timing model (cookbook range → elastic clock)

Cookbooks give ranges ("3–4 min"). Convert to:
- `typicalSec` (authoring default → the `at` on the timeline),
- `minSec` / `maxSec` (bounds the stretch/loop in Phases B–C),
- `scalesWith` — what changes it: **thickness/weight** (not servings), pan, heat,
  starting temperature. Capture the recipe's reference (e.g. "1-inch steak").

> Rule of thumb: **active, gate-able steps** get tight `min/max`; **passive waits**
> (rest, marinate) are `timed` and can be exact.

---

## 7. Song-mapping requirements

To pick/sync a song we need, from the recipe:
- **`activeTimeMin`** — total hands-on cook length → choose a song of similar length.
- **`intensityArc`** — a coarse curve of how the cooking energy rises/falls
  (calm prep → searing peak → rest), so cues can land on matching song sections
  (e.g. flip on the solo). Author as `{ stepOrder: intensity 0–1 }`.
- **`peakMoment`** — the single most dramatic action (the flip / the plate-up) to
  align with the song's biggest moment.
- count + spacing of **active cues** — so the timeline isn't lopsided vs the song.

(Song-side data — bars, sections, loop regions — lives in `song_timing`, see
ADAPTIVE_CUES_ROADMAP.md.)

---

## 8. Safety, allergens, legal

- `safetyNotes` (raw meat handling, hot oil, knife) → inline safety cues.
- `allergens`, `dietaryFlags`.
- **Attribution & licensing** — a recipe's *method* isn't copyrightable, but the
  *expression* (exact wording, photos) is. For shipped content: **rewrite steps in
  our own voice**, credit the source/technique, and confirm rights for any images.
  Track `sourceAttribution` + `rightsStatus` per recipe.

---

## 9. What cookbooks usually DON'T give (we must add)

Author/estimate these — they don't come from the page:
- `minSec`/`maxSec` bounds (only a range or single time is given).
- machine-usable **readiness signals** + **negative cues** ("grey not brown").
- **per-step haptic importance** and **attention level**.
- **intensity arc / peak moment** for song mapping.
- **beginner-variant** copy and reassurance lines.
- equipment-based timing adjustments.
- which steps are **hard checkpoints** vs nice-to-confirm.

This is why every recipe needs a **test cook** to validate timing (the steak
timeline was proven this way).

---

## 10. Extraction → app mapping (cheat sheet)

| From cookbook | App field |
|---|---|
| Header (technique, doneness, active time) | `recipes.*`, `experiences.*` |
| Ingredients + prep | `prep[]` checklist, pre-cook timing |
| Equipment | `recipes.requiredEquipment`, personalization |
| Each action | one `cue` ( `at`, `type`, `title`, `body`, `beginner`, `voice`, `haptic` ) |
| Readiness signal | `cue.gate` ( `confirm` / `sensor` ) + coaching copy |
| Timing range | `cue.at` + `minSec`/`maxSec` |
| Doneness/temp | `temp`/`sensor` checkpoint cue |
| Safety notes | `tip`/`checkpoint` cues + disclaimer |
| Active time + arc | song selection + section alignment |

---

## 11. Authoring workflow (recommended)

1. **Extract** structured fields above (manual, or an LLM extraction pass over the
   recipe text → the JSON template).
2. **Rewrite** copy in Sizle's beginner-friendly voice (+ beginner variants).
3. **Estimate** missing fields (bounds, signals, haptics, arc).
4. **Test cook** in real time → record actual step durations & extend points.
5. **Map to a song** (length + arc + peak), author `at` timestamps.
6. **QA** with a beginner tester; capture `stepStats`.
7. **Version & publish** via the `cue_timelines` table (no app update needed).

---

## 12. Minimal JSON template (per recipe)

```jsonc
{
  "title": "", "technique": "", "doneness": "", "difficulty": "",
  "activeTimeMin": 0, "totalTimeMin": 0, "servings": 0,
  "sourceAttribution": "", "rightsStatus": "rewrite-required",
  "ingredients": [ { "name": "", "qty": "", "unit": "", "prep": "", "stateAtStart": "" } ],
  "equipment": [ { "item": "", "affectsTiming": false } ],
  "steps": [
    {
      "order": 1, "verb": "", "instruction": "", "beginnerInstruction": "",
      "active": true, "attentionLevel": "glance|hands-on|critical",
      "timing": { "typicalSec": 0, "minSec": 0, "maxSec": 0, "scalesWith": "thickness" },
      "readiness": { "type": "quantitative|sensory|time", "signal": "", "notReady": "", "tempF": null },
      "checkpoint": false, "safetyCritical": false, "hapticImportance": "none|normal|strong"
    }
  ],
  "songMapping": { "intensityArc": [], "peakStepOrder": 0 },
  "safetyNotes": [], "allergens": []
}
```

Fill this for any recipe and it drops straight into the cue-timeline pipeline.
