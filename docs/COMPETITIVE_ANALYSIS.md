# Sizle — Competitive Analysis & SWOT

> Positioning: **music-synced, Gen-Z-first, beginner cooking.** MVP = cook a
> medium-rare steak to the Choppd soundtrack. There is currently **no
> direct "cook-to-music" competitor**, so this compares against the categories
> Sizle actually competes with for attention and retention.

---

## 1. Competitive landscape

Sizle sits at the intersection of three markets, each with a different rival:

| Category | Who | What they do well | Where they leave a gap |
|---|---|---|---|
| **Guided recipe apps** | SideChef, Kitchen Stories, Tasty, Cookpad, Samsung Food | Huge catalogs (1,000s of recipes), step-by-step mode, some voice control | Utilitarian, millennial-coded UI; no music; not built for the *fear* of cooking |
| **Smart/sensor cooking** | Meater (smart thermometer), Hestan Cue, Anova | Guarantee doneness via hardware — directly nails "medium-rare" | Require a $50–250 device; niche; not fun/social |
| **Free content (real rival for attention)** | TikTok, IG Reels, YouTube Shorts | Free, infinite, native to Gen Z, already where they "learn" cooking | Unstructured, no timing/guidance, not hands-free, easy to lose your place |
| **Music-synced activity (concept's only cousin)** | Peloton, Weav Run, (Spotify's dead running feature) | Proven that music sync drives engagement & emotion | Nobody has applied it to cooking |

**Key insight:** no direct competitor combines music + cooking cues. That is the
whole thesis — and also the core risk (see Threats).

---

## 2. Feature comparison

| | **Sizle** | SideChef / Kitchen Stories | Tasty | TikTok/Reels | Meater |
|---|---|---|---|---|---|
| Music-synced cues | ✅ **unique** | ❌ | ❌ | ❌ | ❌ |
| Hands-free voice + haptics | ✅ | partial | ❌ | ❌ | ✅ (alerts) |
| Built for beginners' *anxiety* | ✅ | ❌ | partial | ❌ | ❌ |
| Gen-Z native UX | ✅ | ❌ | partial | ✅ | ❌ |
| Shareable result loop | ✅ | weak | weak | ✅ (it *is* the platform) | ❌ |
| Catalog depth | ❌ **1 recipe** | ✅ 1,000s | ✅ 1,000s | ✅ ∞ | n/a |
| Doneness accuracy | ⚠️ timeline-based | ⚠️ | ⚠️ | ❌ | ✅ guaranteed |
| Price to user | freemium | free/freemium | free | free | $$ hardware |

---

## 3. SWOT

### 🟢 Strengths
- **Genuinely novel, ownable concept** — music + cooking is a strong "wait, what?" hook with built-in virality. First-mover in a blue ocean.
- **Solves a pain incumbents ignore:** beginners aren't short on *recipes*, they're short on *confidence and timing*. The rhythm framing makes timing feel effortless and fun.
- **Hands-free by design** (voice + haptics + glanceable timeline) beats a greasy-thumb recipe scroll — and beats TikTok at the actual stove.
- **Native shareability** ("I cooked a steak to the soundtrack" card) creates an organic TikTok/IG growth loop — the product *is* the marketing channel.
- **No music licensing cost** by leaning on the user's own Spotify subscription (SDK).
- **Monetization + scalable cloud architecture designed in from day one** (freemium, ads, premium, EC2/RDS, stateless scaling).

### 🔴 Weaknesses
- **Catalog is one recipe.** Retention past novelty is unproven vs. apps with thousands.
- **Hard Spotify-Premium dependency** for full sync shrinks the addressable audience — many Gen Z use *free* Spotify or Apple Music.
- **Content doesn't scale yet:** cue timelines are hand-authored; audio-analysis auto-generation is unproven and hard.
- **The "cooking isn't a metronome" problem** — real heat/pan/thickness vary, so a fixed song timeline can tell someone to flip before the crust is ready. Directly threatens the core promise (addressed in §5).
- **No accuracy guarantee** on doneness vs. sensor-based rivals (Meater).
- **Early-stage:** no brand, content team, community, or distribution yet.

### 🔵 Opportunities
- **Create and own a category** — "cook to music" as a defensible brand if first and fast.
- **Cheap, native growth** via UGC on the exact platforms Gen Z lives on.
- **Partnerships as a moat:** artists/labels, Spotify, cookware & meal-kit brands, food creators. Co-branded "cook this to my song" drops.
- **Premium upsell with real willingness-to-pay:** "cook to *your own* playlist."
- **Expand to shareable beginner techniques** (eggs, pancakes, pasta) — each a viral moment.
- **De-risk music** with a licensed/royalty-free tier so free users aren't blocked by Spotify Premium.
- **Retention via gamification** (Duolingo-style streaks/badges) — already scaffolded.

### ⚠️ Threats
- **Fast-follower risk is high.** The concept is copyable. Spotify, Tasty, SideChef, Apple, or TikTok could bolt "cook to music" onto a bigger catalog + distribution overnight. **The only durable moat is brand + community + content velocity, not the feature itself.**
- **Platform dependency:** Spotify has a history of killing/restricting APIs (deprecated running-tempo; tightened audio-analysis access). A terms change could break the core.
- **Licensing landmines** if any shortcut is taken on audio.
- **App Store economics:** 15–30% subscription cut, ATT limiting ad targeting/revenue, rejection risk.
- **Novelty churn:** cooking apps have notoriously low retention; "free and good enough" YouTube/TikTok is one tab away.

---

## 4. Bottom line / strategic read

Strong, differentiated *concept* with a real wedge (beginner anxiety + Gen-Z
shareability) that no current app occupies — but the moat is shallow because the
feature is copyable and the experience leans on Spotify. Win or lose on **three
things, not on the cooking:**

1. **Defensibility** — build brand, community, and content velocity *fast*; lock artist/Spotify partnerships before an incumbent copies you.
2. **De-risk the Spotify dependency** — add "bring-your-own-playback" + a licensed-music free tier so free users aren't gated.
3. **Prove retention and fix the metronome problem** — adaptive cues / "I'm not ready yet" pacing / optional smart-thermometer integration so the core promise holds in a real kitchen (see §5).

Nail those and the novelty becomes a category. Skip them and it's a viral demo
that incumbents absorb.

---

## 5. Implementing adaptive cues / "I'm not ready yet" pacing

This is the fix for the **"cooking isn't a metronome"** weakness. The core idea:
**decouple the cue timeline from the song's literal playback clock.** Cues should
fire on *cooking readiness*, and the music should flex to match — not the other
way around.

### 5.1 The core model: an elastic clock

Today the cook clock = song position (`audio.currentTime`). Introduce a layer:

```
cookProgress  →  (mapping)  →  songPosition
```

- **cookProgress** = where the user actually is in the recipe (advances only when steps are confirmed done).
- The mapping stretches/compresses so the *song* lines up with the *cook*, instead of forcing the cook to obey the song.

Three pieces make this work: **gates**, **elastic time**, and **musical seams**.

### 5.2 Gates — cues wait for readiness

Tag each cue with a `gate` describing what must be true before the cook advances:

```js
{
  at: 210, type: "flip", title: "Flip it — once",
  gate: {
    kind: "confirm",            // user taps "Ready / Done"
    prompt: "Deep brown crust underneath?",
    autoAdvanceAfterSec: 45,    // optional safety: nudge if no input
    canExtend: true             // user can say "not yet"
  },
  // ...
}
```

`gate.kind` options:
- **`timed`** — fires purely on time (today's behavior; fine for "rest 2 min").
- **`confirm`** — fires, then *waits* for the user to tap **Done / Flip / Ready** before advancing. This is the "I'm not ready yet" hook.
- **`sensor`** — fires when a reading is met (e.g., Meater temp ≥ 130°F). Optional, hardware tier.
- **`checkpoint`** — a hard gate that must pass before continuing (safety/temp).

### 5.3 "I'm not ready yet" interaction

When a `confirm` cue lands, the step card shows two actions:

- **✅ Done — next** → advance `cookProgress`.
- **⏳ Not yet (+30s)** → hold this step, extend its window, re-coach.

On "Not yet":
1. **Hold the cook clock** at the current step (stop advancing `cookProgress`).
2. **Keep the music going** but enter a **loop/vamp** (see §5.4) so it doesn't run past the moment.
3. Offer **adaptive micro-coaching**: e.g., on the flip step → *"No worries — give it another 30 seconds and check again. Looking for deep golden brown, not grey."*
4. After the extension, re-prompt the gate. Repeat as needed (cap with gentle escalation: after N extensions, suggest raising the heat or checking the pan).

```js
function onNotReady(cue) {
  holdProgress = true;
  extendBySec(cue.id, 30);
  speak(cue.notReadyCoach || "No rush — give it a bit longer, then check again.");
  Music.enterVamp();          // loop a safe section instead of marching on
  scheduleReprompt(cue, 30);
}
function onDone(cue) {
  holdProgress = false;
  Music.exitVamp();           // resume normal playback at the next seam
  advanceTo(nextCue);
}
```

### 5.4 Making the *music* flex (the hard, magical part)

If a step runs long, the song shouldn't blow past it. Options, cheapest → richest:

1. **Pause/duck-and-hold (MVP-simple).** When holding, fade the track down and
   loop an ambient/percussive bed, or just lower volume and hold position.
   Trivial to build; least musical.
2. **Section looping / vamping (recommended).** Pre-mark **loop regions** in the
   song (e.g., a rhythm section that can repeat seamlessly). While a step is held,
   loop that region; when the user taps Done, **exit on the next bar/beat** so it
   sounds intentional. Requires per-song loop metadata but no audio editing.
3. **Beat-aware seams (premium feel).** Store the song's **beat grid / bar lines**
   (downbeats). Only ever transition cues and loops **on a downbeat**, so stretching
   time still feels rhythmic. This is what makes it feel produced rather than
   glitchy.
4. **Stem/adaptive audio (future).** Layered stems that add/drop intensity with the
   cook (calm while waiting, build into the sear). Most immersive, most work.

> With the **Spotify SDK** you control `seek`/play position, so looping a region =
> seeking back to the region start at its end. Beat/bar timing can come from
> Spotify's **Audio Analysis** (bars, beats, sections) *where still available*, or
> from your own analysis pass — store it as **per-song timing metadata** so you're
> not dependent on a live API call mid-cook.

### 5.5 Data model additions

Extend the cue/timeline schema from PLAN.md:

```
cue:
  gate { kind, prompt, autoAdvanceAfterSec, canExtend }
  notReadyCoach            # adaptive coaching line
  minSec / maxSec          # earliest / latest this step should take (bounds the stretch)

song_timing (per song):
  bars[]                   # downbeat timestamps  (for beat-aware seams)
  sections[]               # intro / verse / solo / outro
  loopRegions[]            # { startMs, endMs, label }  safe vamp zones
```

This keeps timelines **versioned and decoupled** (already a plan principle), so
adaptive metadata is added per song without reworking the cue engine.

### 5.6 Closing the loop with feedback (gets smarter over time)

Every `confirm`/extend is a signal. Log per cook:
- how long each step *actually* took vs. authored `at`,
- number of "not yet" extensions per step,
- final outcome rating + (optional) temp reading.

Aggregate this to **re-tune the authored timeline** (e.g., if 70% of users extend
the sear, the default is too short) and later to **personalize pacing** by the
user's equipment (cast iron vs. nonstick) and `isBeginner` flag — beginners get
longer default windows and more "still going" reassurance.

### 5.7 Phasing (don't build it all at once)

- **Phase A (now / cheap):** add `confirm` gates + "✅ Done / ⏳ Not yet" buttons; on hold, **duck-and-hold** the music. This alone fixes the metronome problem for the MVP.
- **Phase B:** add per-song **loopRegions** + exit-on-bar so holds sound musical.
- **Phase C:** full **beat grid** seams + feedback-driven auto-tuning of timelines.
- **Phase D (premium/hardware):** **sensor gates** (Meater-style thermometer) for guaranteed doneness.

### 5.8 How this maps onto the current MVP demo

In the local demo (`mvp/app.js`), the cook loop already fires cues from a clock
(`songPos`). To prototype Phase A:
- add `gate: { kind: "confirm" }` to the flip/rest/temp cues in `cues.js`;
- when such a cue fires, **stop advancing `nextIdx`** and render Done / Not-yet buttons on the step card;
- on **Not yet**, keep `songPos` parked (and call `Music.duck()` / lower volume) and re-speak a coaching line;
- on **Done**, resume the loop and continue.

That turns the rigid timeline into a responsive one with a few hours of work —
and is the single highest-leverage change to make the core promise hold in a real
kitchen.
