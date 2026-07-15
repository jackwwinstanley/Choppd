# Native Voice Control v2 — full spec

> **"It behaves exactly like the web app" — that sentence is the acceptance bar.**

**Status:** spec-complete · build starts **after** the DuckTest matrix verdict (its `.playAndRecord`
row directly feeds §4) · ships **dark** behind `NATIVE_VOICE_V2` with its own device battery.

---

## 1. Why the old way failed (recorded so we don't rebuild it)

The v1 attempt bolted `@capacitor-community/speech-recognition` onto an audio session it didn't own.
The plugin silently flipped the shared `AVAudioSession` to a record category, fought the WebView's
playback session, and the start/stop choreography around TTS produced the stop cascades and freezes
the caller-tag logs documented. The plugin also gave us no session options (no `.mixWithOthers`, no
`.duckOthers`, no deactivation control) — the exact knobs the coexistence problem needs. v1 is dark
on native today (`supportState` "native-off"); the pod stays inert until this replaces it.

## 2. Architecture — a minimal Swift plugin WE own: "ChoppdSpeech"

- `SFSpeechRecognizer` + `AVAudioEngine` input tap. Nothing else — no third-party speech code.
- **The point of owning it:** the plugin explicitly configures the shared `AVAudioSession` per §4
  (category/options/mode from the DuckTest verdict), activates on mic-open, and deactivates with
  `.notifyOthersOnDeactivation` on close — the WebView's audio is a first-class design constraint,
  not a casualty.
- Recognition: prefer **on-device** (`requiresOnDeviceRecognition` where the locale/device supports
  it — no network lag mid-cook); permit the network recognizer as fallback; report which engaged in
  the debug log. en-US, partial results on.
- **JS API surface = EXACTLY the existing VoiceCtrl backend contract:** `available()` /
  `requestPermissions()` / `start({language, partialResults})` / `stop()` / events: `partialResults`,
  `listeningState`, `error`. VoiceCtrl gains this as its native backend with **ZERO changes** to
  grammar, matching, dispatch, or UI — the grammar (next / back / repeat + filler-stripping) stays in
  JS `matchVoiceCommand`, one source of truth.
- All v1 hardening retained verbatim: session-token discipline (stale events ignored), caller-tagged
  `VOICE:` logs, the 4-opens-per-second storm guard, the ≥3-fast-failures honest state.

## 3. Checkpoint-window listening (makes this tractable — and the web-parity claim honest)

The mic opens **ONLY**:
- while the cook is **PARKED** at a checkpoint/gate, **AND**
- after that cue's voice line has fully finished (the existing post-TTS gap + echo guard).

It closes on: confirm/advance (the command's own effect), back/forward transport, TTS starting,
screen exit, background.

Why this matters doubly on native: with the transport-lands-paused rule and gate behavior, PARKED
means the video is already paused (or system-ducked, per the DuckTest verdict) — so the historic
mic-vs-music session war is mostly **designed out** rather than fought.

**Web comparison note:** this IS the web lifecycle (web's mic opens at checkpoints after the voice
line, closes on advance/TTS) — so checkpoint-window listening isn't a native compromise, it's the
parity.

**Explicitly OUT OF SCOPE (not-build, recorded):** wake word, always-on / continuous listening,
dictation, any new voice commands (a spoken "pause" is a separate founder decision for another day).

## 4. Session choreography (the DuckTest dependency)

The DuckTest matrix answers two questions this spec consumes:
- **(a)** Does `.playAndRecord` activation duck/kill the WebView's YouTube audio, and does the orange
  mic indicator's privacy cost apply? → decides whether mic-open needs the video strictly **PAUSED
  first** (hard precondition) or merely parked-per-gate-behavior.
- **(b)** Do `[.duckOthers]` / `[.mixWithOthers]` reach WebView audio at all? → decides the configured
  options set, and whether the native GATE behavior can upgrade from pause to system-duck in the same
  pass.

The choreography, parameterized on those answers:
1. Checkpoint parked + voice line ends → (precondition per (a)) → plugin activates the session
   (options per (b)) → tap installed → recognizer starts → `listeningState: live`.
2. Command recognized → dispatch (same JS path as web) → stop + `deactivate(.notifyOthersOnDeactivation)`
   → the cook's audio resumes per the gate/confirm behavior (never left broken).
3. No-speech timeouts inside the window → silent reopen with backoff (web's `_restart` semantics),
   storm guard capping the rate.
4. Errors map to web's classes: `not-allowed` → the denied path + Settings-pointer line;
   service-unavailable (the 1101 family) → honest "voice isn't available right now — tapping works"
   state; anything else → degrade-to-touch, never a stuck mic, never a freeze.

## 5. Permissions + rehearsal (reuse, don't redesign)

- The existing enable-time rehearsal flow and its approved strings are the front door: OS prompts
  (mic + speech) fire at explicit user enable, never during onboarding browsing (the amended rule
  stands).
- The rehearsal's mic-open deliberately happens post-TTS — it remains the permanent regression test
  for the session handoff.
- Deny path, persist-across-relaunch, never-re-prompt: unchanged from the approved v1 flows.

## 6. The acceptance bar (founder's sentence, made testable)

"Behaves the same as the web app" =
- Same grammar, same commands, same dispatch effects (web Playwright recordings are the reference
  transcripts).
- Same lifecycle beats (open after voice line at checkpoints, close on the same events) — assert via
  the caller-tag logs matching web's sequence for an identical scripted cook.
- Same failure honesty (denied / unavailable / no-speech render the same UI states as web).
- **PLUS** the standing coexistence bar, unchanged: music never stops or fails to resume because of
  the mic; ducking while the mic is open is acceptable; voice clips always audible and clear.

## 7. Verification ladder

- **SIM** (state machine — no speech service; never debug recognition there): a debug
  transcript-injection hook on the plugin bridge (dev builds only) drives `matchVoiceCommand`
  end-to-end; Maestro flow asserts the checkpoint-window open/close ladder via the Eye logs;
  storm/thrash guards asserted; web regression untouched.
- **DEVICE** (founder battery — the only place recognition is real): rehearsal grant path (two
  prompts, say "next", success) → a full eggs cook driven by next/back/repeat at gates → deny path →
  persist across relaunch → the coexistence listen (pilot video + mic, per the §4 verdict) → the
  soak: 10 min of mixed voice/transport/gate abuse, zero freezes.
- **Rollout:** `NATIVE_VOICE_V2=false` committed until the device battery passes; `supportState`
  flips from "native-off" only under the flag; v1 plugin removed (pod + package) in the same pass
  the flag ships true — one speech system in the build, ever.

## 8. Build order

1. DuckTest matrix run (founder ears + log panel) → the §4 parameters land as recorded values, not
   assumptions.
2. ChoppdSpeech plugin + VoiceCtrl backend wiring + the injection hook.
3. Sim ladder green → flag-dark commit → founder device battery → flag true + v1 removal.

---

*Saved 2026-07-15 from the founder's spec. Build does NOT start until the DuckTest verdict lands
(§4 parameters). See the DuckTest harness spec + run-sheet for that dependency.*
