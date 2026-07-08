# Choppd — "Make Every Recipe Cue A+" Voice Upgrade Prompt

**Paste this to the build agent, pointed at one recipe's cue set at a time** (e.g. `window.FREEBIRD_STEAK`, `window.SCRAMBLED_EGGS`). It works on any recipe. Give the agent this prompt + the recipe's cue file + the Choppd Brand Voice Guide.

---

## ROLE & GOAL

You are upgrading the **user-facing copy of one Choppd recipe's cues** to an **A+ brand-voice standard**. Choppd is a music-synced cooking app for broke 18–24 year old guys who can't really cook, living alone for the first time, tired of expensive mediocre takeout. The voice is **"the funny friend who actually has your back"** — dry, confident, irreverent by default, with genuine warmth at the emotional beats.

This is a **copy-only** pass. You are rewriting text so the recipe *sounds* unmistakably like Choppd — not a neutral recipe app — while every instruction stays crystal clear. You will grade your own work against the rubric in this prompt and keep revising until the whole recipe hits A+.

---

## NON-NEGOTIABLE GUARDRAILS

1. **Text only.** Do NOT change any `at` timing, `type`, `heat`, `haptic`, gate structure, buttons, `opt` logic, image refs, portion/scaling math, or preheat/rest durations. You only rewrite: `title`, `body`, `beginner`, `voice`, gate coaches (`notReadyCoach` / `checkCoach` / `doneCoach` / `doneLabel`), `warning`, `fadeTips`, and any `custom` (bring-your-own-track) copy.
2. **RULE 1 — never tease the user.** Punch at the food, the situation, food snobbery, pretension, and takeout — NEVER at the person cooking. If a line could make a tired 19-year-old feel dumb, slow, or judged, rewrite it to aim at the food/situation instead. Shared "we've all been there" humor is fine; the user is a co-conspirator, never the punchline.
3. **RULE 3 — clarity wins during the cook.** In live cook-step cues and doneness gates, the instruction must be unmistakable FIRST. Humor is a garnish on top of a clear instruction; it must never bury or blur what to do. **If a joke could be mistaken for part of the instruction, or obscures the action, cut the joke.**
4. **Feel masculine through confidence, not "bro" energy.** Short, punchy, direct. No "bruh," "let's get this bread," gym-bro caricature, or beer-commercial masculinity. Dry over zany.
5. **No copyrighted-lyric copy.** Do not write song lyrics or lean on quoted lines from the named track into any cue. Any `custom` (bring-your-own-track) variant must be fully song-agnostic — no references to the specific song, artist, or its parts.
6. **No unsubstantiated health/nutrition claims** and **no dangerous cooking advice.** Keep it safe and appropriate for a young audience.
7. **Preserve every actionable detail** already in the copy (heat level, "don't stir," "off the heat," temps, "one flip," "don't cut yet"). Losing a safety/technique detail is an automatic fail regardless of how good the voice is.

---

## THE REGISTER MAP → APPLIED TO CUE TYPES

Assign each cue a register **before** rewriting it. The humor/warmth dial shifts by moment — an A+ recipe is NOT uniform joke-density; it's an arc.

| Cue moment / `type` | Register | How it should read |
|---|---|---|
| Prep / mise en place (prep wizard, gather list) | **Clear + light edge** | Clarity first, one dry beat as seasoning. Confident, anti-pretension. |
| Live action cue where the user is *actively doing a critical move* (heat change, `flip`, laying meat in, `off the heat`, pour) | **Clear, dry edge — CLARITY WINS** | Instruction is 100% clean. At most a trailing dry line that can't be confused for the instruction. Often best left clean. **(See FENCED CUES below.)** |
| `tip` / observation cue (what to look for, "still glossy", "building crust") | **Clear, dry edge** | Lower stakes → safe to carry a real dry line. These are your best in-cook humor slots. |
| Waiting / dead-time (preheat, simmer, the REST, any long pause) | **Humor — entertain them** | Nothing's happening; fill it. Tease the food/impulse/situation and give them a micro-action. **(See DEAD-TIME below.)** |
| Doneness / safety **gates** (`flip` gate, `temp` gate, "is it done?") | **Warm + reassuring** | The anxious moment. Reassure and guide. NO joke at the user's expense. "You've got this" energy. |
| Failure / not-ready coach lines | **Humor on top, warmth under** | Disarm the embarrassment, then have their back. Never "you failed." |
| The signature beat-sync cue (action/tip synced to the song's solo/drop) | **Clear + a moment** | This is the brand's whole promise — make it *feel* like a moment. Name the sync doing its job, keep it dry. Strip song refs in the `custom` variant. |
| Completion / `finish` cue | **Warm payoff** | The single most important line in the recipe. Carry the OUTCOME. **(See FINISH FORMULA below.)** |
| First-cook-ever framing (if applicable) | **Warm, encouraging** | Everyone starts here. Lower the barrier. |

---

## THE HIGHEST-LEVERAGE MOMENTS (get these to A first)

### 1. The FINISH cue — the payoff formula

The `finish` cue is where retention and the "made with Choppd" share are won. "Nice work" alone is a **fail**. Build it as:

**[clear final instruction] + ONE warm payoff beat naming the OUTCOME + a forward/encouraging close.**

The OUTCOME is 1–2 of these (market the outcome, not the feature):
- **Capability / identity:** they *made that*, themselves, with no skill three weeks ago.
- **Money vs the RIGHT enemy** (recipe-specific — see table below): the dollar gap between this and what they'd have ordered.
- **Impress someone:** this is a plate you could put in front of a person.

Close on encouragement/forward motion ("nice work," "first of many," "that's the new normal now"). 
**Do NOT** use lines that tease the user even affectionately (e.g. "look at you, a functioning adult") — the guide explicitly cut those. The warmth is sincere, dry-edged, one beat — not a greeting card.

### 2. The longest WAIT — entertain the dead time

Find the longest pause(s) in the recipe (preheat, simmer, the 5-min steak REST). These are dead air with a hungry guy staring at the phone. Keep any hard instruction dead clear (e.g. "do NOT cut yet," "keep the pan empty"), then **fill the silence**: a dry line teasing the impulse/food/situation, plus a micro-action to do while waiting ("plate up, pour something, let it ride"). A silent functional wait screen is a missed A+.

### 3. Gates — warm and reassuring, never clever

Doneness/safety gates are anxious moments. The `checkCoach`, `notReadyCoach`, and `doneCoach` should reassure and guide with warmth ("No rush — back on for a few seconds, you're close" / "Perfect — now it rests"). Never joke at the user's expense here.

---

## PER-RECIPE OUTCOME HOOK (market to the SITUATION, not a class)

Every recipe has a different **money enemy** to name in the finish (and optionally a prep intro). Use real, defensible numbers — this audience *knows* what things cost, so never oversell.

| Recipe | The enemy it replaces | Money beat (defensible) |
|---|---|---|
| Steak | The steakhouse | ~$45 out → ~$12 at home |
| Scrambled eggs | The deli / bodega egg sandwich | ~$6 out → ~$1 at home |
| Pasta / comfort food | The Wednesday-night DoorDash cart | ~$23 out → ~$4 at home |
| **(new recipe)** | Pick the closest real takeout/restaurant version the audience would've ordered | Use a defensible delta; round the home cost UP, not down |

The line to hit constantly (per the guide): **the DIG at takeout + the WARMTH of feeding yourself well, together.** That's the voice.

Achievement names to wire the finish into where a system exists (do NOT build the system — leave a `// TODO` if it doesn't): "Didn't Order Takeout" (first cook), "Certified Egg Guy," "Steak Whisperer," "The Anti-DoorDash," "On a Roll" (streak).

---

## FENCED CUES — leave clean

Do NOT add humor to a live cue whose instruction is a critical, get-it-wrong-and-ruin-it move: the flip, the heat change, laying the steak in, "off the heat," the temp pull, "don't cut yet." A trailing dry line is allowed ONLY if it sits clearly after the complete instruction and cannot be read as part of it. When unsure, leave it clean. Clarity is safety.

---

## FIELD-BY-FIELD

- **`body`** — the short on-screen instruction. Clear first, one optional dry beat.
- **`beginner`** — the expanded, reassuring version. This is where warmth and the fuller voice live; still clear.
- **`voice`** — spoken by TTS. Keep it clean and natural to *hear* — shorter, no visual-only jokes, no punctuation gags. A garnish that works spoken is fine ("we're not making rubber"); one that only works read is not.
- **Gate coaches** — warm, guiding, reassuring (see Gates above).

---

## PROCESS

1. Read the whole recipe's cues end to end first, so you build a voice **arc**, not 14 isolated jokes.
2. For each cue: assign its register (table above) → rewrite `body`/`beginner`/`voice` (and coaches) to that register → run the SELF-CHECK → grade it.
3. Do the FINISH, the longest WAIT, and the GATES first — they carry the most weight.
4. Respect the FENCED CUES.
5. **Vary the humor density.** If three cues in a row all have a wisecrack, cut one — "all-jokes-no-heart" reads as trying too hard and flattens the payoff.
6. Output every change as an exact **before → after** pair (find the current string, replace with the new one), grouped by cue, so it's drop-in. For any recipe with method variants (e.g. pan + grill) or `custom` track copy, mirror the change across all of them.
7. **Show the full change list for review before finalizing.** Do not silently ship.

---

## A+ GRADING RUBRIC (self-score; keep revising until it passes)

Grade each cue, then the recipe as a whole. **Ship bar: every cue ≥ A−, and the FINISH + every GATE = A. Any user-insult, any buried instruction, or any lost safety detail = automatic F, revise immediately.**

**A+ cue:**
- Instruction is 100% clear (for any live/action/gate cue).
- Register is correct for the moment (humor vs. warm vs. clean).
- Carries exactly the right amount of voice — one well-placed beat, or intentionally clean — never over-seasoned.
- Sounds like a dry, confident friend talking TO them, not a brand talking AT them.
- Passes all six self-check questions below.

**A+ recipe (the arc):**
- Reads as a shift: light edge in prep → entertain the wait → clean/clear on the critical moves → warm + reassuring at the gates → warm outcome payoff at the finish.
- Humor density varies across the cook; the warm beats are allowed to land.
- The finish carries the OUTCOME (capability + money vs the right enemy + optionally impress), not "nice work."
- The longest wait entertains and gives a micro-action.
- The signature beat-sync cue feels like a moment.
- Zero corporate-speak, zero forced bro energy, zero lines that tease the user.

---

## SELF-CHECK (run every rewritten line through these)

1. Does this insult the USER or make them feel dumb? → If yes, aim it at the food / situation / snobbery / takeout instead.
2. Is this a live cooking step? → Is the instruction crystal clear despite the humor? If the joke obscures the action, cut the joke.
3. Is this an emotional payoff moment (finish, first cook, milestone)? → Dial warmth UP, jokes DOWN.
4. Does it punch at pretension / takeout / the situation rather than the person? → It should.
5. Does it feel masculine through confidence, not announced "bro" energy? → It should.
6. Would a tired, broke 19-year-old feel laughed WITH, never laughed AT? → Must be yes, every time.

**One-line summary:** Rewrite every cue as the funny friend who has your back — dry and confident by default, genuinely warm at the payoff — clarity always wins during the cook, punch at takeout and pretension and never the user, and don't stop until the whole recipe reads as one Choppd voice arc that ends on the outcome, not "nice work."
