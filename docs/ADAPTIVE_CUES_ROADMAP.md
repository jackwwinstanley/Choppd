# Adaptive Cues — Roadmap (Phases B, C, D)

> **Phase A is implemented** in the MVP (`mvp/`): `confirm` gates on the flip &
> temp-check cues, **Done / Not-yet** buttons that park the cook clock and hold
> the song, a 30s re-prompt nudge, and a "READY WHEN YOU ARE" state.
>
> This doc specs the remaining phases. The throughline: **decouple the cue
> timeline from the song's literal clock** so cues fire on *cooking readiness*
> and the music flexes to match. Each phase is independently shippable.

---

## Recap: the elastic-clock model

```
cookProgress  →  (mapping)  →  songPosition
```

- **cookProgress** advances only when steps are confirmed/ready (gates).
- The **mapping** stretches/compresses so the *song* lines up with the *cook*.
- Phase A handled the *holding*. B/C/D make the *music* and *accuracy* graceful.

---

## Phase B — Section looping / "vamping"

**Goal:** when a step runs long, the song shouldn't blow past it or fall dead
silent (Phase A pauses it). Instead, **loop a safe musical region** until the
cook is ready, then exit cleanly.

### B.1 Data: per-song loop regions
Add to the `song_timing` metadata (authored once per song):

```jsonc
"loopRegions": [
  { "id": "verse-vamp",  "startMs": 78000,  "endMs": 96000,  "label": "rhythm bed" },
  { "id": "solo-build",  "startMs": 250000, "endMs": 268000, "label": "pre-solo" }
]
```

Each cue with a gate references which region to vamp on while held:

```jsonc
"gate": { "kind": "confirm", "vampRegion": "verse-vamp", "...": "..." }
```

### B.2 Engine behavior
- On `enterWait(cue)` **instead of pausing**:
  - if `cue.gate.vampRegion` exists → seek to region start, set a "loop fence":
    when `playbackPos >= region.endMs`, seek back to `region.startMs`.
  - duck slightly (optional) so any voice coaching sits on top.
- On `exitWait` (Done):
  - **don't cut immediately** — set `exitPending = true` and let the loop play to
    `region.endMs`, then resume normal playback from the cue's real position.
  - keeps transitions from sounding like a hard jump.

```js
// pseudo
function enterVamp(region) {
  Music.seek(region.startMs / 1000);
  loopFence = region;            // checked every tick
}
function tickLoop() {
  if (loopFence && Music.pos() * 1000 >= loopFence.endMs) {
    if (exitPending) { loopFence = null; exitPending = false; resumeCook(); }
    else Music.seek(loopFence.startMs / 1000);
  }
}
```

### B.3 With Spotify SDK
`seek` + position polling do the looping (no audio editing). The SDK exposes the
player's position; the loop fence is just a comparison each tick. Store
`loopRegions` in your DB so you never depend on a live analysis call mid-cook.

### B.4 Tasks
- [ ] Add `loopRegions` to song-timing schema + admin tool to author them.
- [ ] Add `vampRegion` to gate schema.
- [ ] Implement loop-fence + `exitPending` in the cook engine.
- [ ] Crossfade polish (short volume ramp on seek) to hide the loop seam.
- [ ] Fallback to Phase A pause if a song has no `loopRegions`.

**Effort:** medium. **Risk:** seams can sound abrupt without beat alignment → that's Phase C.

---

## Phase C — Beat-aware seams + feedback auto-tuning

**Goal:** make every transition feel *produced*, and make the default timeline
get smarter over time.

### C.1 Beat-aware seams
Add a **beat/bar grid** to song timing:

```jsonc
"bars":  [ 1200, 2400, 3600, ... ],   // downbeat timestamps (ms)
"beats": [ 600, 1200, 1800, ... ],
"sections": [ { "start": 0, "label": "intro" }, { "start": 270000, "label": "solo" } ]
```

Rules:
- **Cue transitions** and **loop seams** snap to the **next downbeat** (`bars`),
  not to an arbitrary millisecond. Stretching time then still feels rhythmic.
- Big moments (flip, "off the heat") can be authored to land on a **section
  boundary** (e.g., the flip hits as the solo kicks in) for emotional payoff.

```js
function nextBarAfter(ms, bars) { return bars.find(b => b >= ms) ?? ms; }
// when resuming/looping, seek/advance to nextBarAfter(targetMs)
```

**Source of the grid:** Spotify **Audio Analysis** (bars/beats/sections) *where
still available*, or your own offline analysis pass (e.g., a beat-tracking lib).
Either way **persist it** as song metadata — don't call the API mid-cook.

### C.2 Feedback-driven auto-tuning
Every gate interaction is a signal. Log per `cook_session`:

```jsonc
"stepStats": [
  { "cueId": "flip", "authoredAt": 210, "actualSec": 268, "extends": 2, "outcome": "good" }
]
```

Use the aggregate to:
- **Re-tune authored `at`/`minSec`/`maxSec`** (if the median sear runs 25% long,
  bump the default and the song mapping).
- **Personalize pacing** by `equipment` (cast iron vs nonstick), `isBeginner`,
  and altitude/region later. Beginners get longer windows + more reassurance.
- **Flag bad cues** (high extend counts or poor outcomes) for re-authoring.

This is a batch job (nightly aggregation) feeding new timeline versions — fits the
**versioned `cue_timelines`** design already in PLAN.md (ship new versions without
app updates).

### C.3 Tasks
- [ ] Add `bars`/`beats`/`sections` to song-timing schema + ingestion of Spotify analysis (or own pass).
- [ ] Snap-to-bar in resume/loop/transition logic.
- [ ] Author key cues to section boundaries.
- [ ] Log `stepStats` per session; build aggregation job.
- [ ] Auto-propose timeline version bumps from aggregates (human-approved at first).

**Effort:** high. **Payoff:** the "magic," produced feel + a data moat.

---

## Phase D — Sensor gates (guaranteed doneness)

**Goal:** close the accuracy gap vs. hardware rivals (Meater) for users who want
it. Premium / hardware tier.

### D.1 New gate kind
```jsonc
"gate": {
  "kind": "sensor",
  "metric": "internalTempF",
  "target": 130,
  "tolerance": 3,
  "fallback": "confirm"        // if no device connected, degrade to Phase A
}
```

### D.2 Engine behavior
- Subscribe to a live reading stream (BLE thermometer via the app's native layer,
  or a paired smart device API).
- The gate **auto-advances** when `reading >= target - tolerance` (with debounce).
- Live UI: show the current temp climbing toward target on the step card.
- **Always provide the `confirm` fallback** so non-hardware users aren't blocked.

### D.3 Integration notes
- React Native BLE (e.g., a BLE library) for thermometers like Meater/Combustion;
  or vendor cloud APIs where offered.
- Keep it **optional and additive** — the core experience must work with zero
  hardware. Sensor data also makes Phase C's auto-tuning far more accurate.

### D.4 Tasks
- [ ] `sensor` gate schema + `fallback`.
- [ ] Native BLE bridge + device pairing flow (Premium onboarding).
- [ ] Live reading UI on the step card.
- [ ] Debounce + safety clamps; degrade gracefully when device drops.
- [ ] Feed readings into `stepStats` for tuning.

**Effort:** high (native + hardware). **Payoff:** trust + a real moat + upsell.

---

## Suggested order & dependencies

```
A (done) ──> B (looping) ──> C (beat seams + auto-tune) ──> D (sensors)
                    \________________________________________/
                     C's auto-tuning improves once D adds real temp data
```

- **B** is the next highest-leverage step (kills dead-air, low risk).
- **C** is where it starts to feel like a product, not a demo.
- **D** is a premium/hardware bet — do it once retention is proven.

All phases reuse the **versioned, decoupled cue-timeline** schema from PLAN.md, so
none require re-architecting the engine — they extend the gate + song-timing data.
