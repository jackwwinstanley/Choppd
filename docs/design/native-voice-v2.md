# Native Voice v2 — checkpoint-window speech (REVISED)

**Supersedes the original §4.** Acceptance bar: **behaves exactly like the web app.** Hard constraint
(founder, final): **music NEVER goes silent because of the mic — at all costs.**

> ## ✅ SHIPPED — 2026-07-16. The war is over.
> The device soak passed on the founder's phone: **10 minutes of mixed voice / transport / gate / pause
> abuse on Apple Music AND the local track — zero freezes, zero crashes, music survived every command, no
> `VOICE` cascade.** `NATIVE_VOICE_V2` is now the **shipped behavior** (no longer a dark flag; kept as a
> named `const true`), `supportState` is `"ok"` unconditionally on a capable device, and the **v1
> community speech plugin (`@capacitor-community/speech-recognition`) has been DELETED** in the same
> commit — the pod (`CapacitorCommunitySpeechRecognition`), the npm dependency, the packageClassList
> registration, and every JS reference. **One speech system in the build, ever: ChoppdSpeech**
> (`SFSpeechRecognizer` + the ChoppdAudio session coordinator, a local Swift plugin registered via
> `capacitorDidLoad` — no pod, no dependency). The Cap-7 pin that the third-party plugin forced is lifted.
> The muffle/coordinator hardening that landed alongside the rollout is locked by the coordinator
> golden-sequence suite (`docs/regression-locks-am.md`, `__mockNative`).

**Status:** ~~spec-complete · build order = measurement rows FIRST, then the plugin per the decision tree ·
ships dark behind `NATIVE_VOICE_V2` · the v1 plugin is deleted the same pass the flag ships true.~~
**DONE — all of it. See the SHIPPED banner above.**

---

## 0. Why this version wins where v1 died

v1 bolted a community plugin onto an audio session it didn't own; the session fights froze the app.
Since then the project built and proved: **ChoppdAudio** (session control + native clips — the duck),
**ChoppdMusic** (Apple Music), the **capacitorDidLoad** registration path, the **Eye**, the storm
guards, and the caller-tagged `VOICE:` logs. **ChoppdSpeech is the third sibling in a proven family,
not a new bet.** The one genuinely open question is **physics** — what an open mic does to each music
source — and this spec measures it before building on it.

---

## 1. Measurement first — three VR DuckTest rows  ✅ BUILT (this pass)

Extend the `#if DEBUG` DuckTest harness (`FLAG_DUCK_TEST`) with a REAL record window. Founder runs these
in one 10-minute sitting **before any ChoppdSpeech code**. Built: `DuckTest.startRecordWindow({options})`
/ `stopRecordWindow()` — activates `.playAndRecord` + the option set AND installs a **real
`AVAudioEngine` input tap** for the window (a record session without a live tap can behave differently),
logs the effective session config + `isOtherAudioPlaying`. Harness screen: **Settings → Duck Test →
VR rows** (`harness v5`).

| Row | Config | Source | Question |
|---|---|---|---|
| **VR-1** | `.playAndRecord + [.mixWithOthers, .defaultToSpeaker, .allowBluetooth]` | WebView local track | Does the music survive? Full or attenuated? (Row 3 measured `+.duckOthers` → WebView audio to **ZERO**; `mixWithOthers` was never measured — the hopeful cell.) |
| **VR-2** | same config | Apple Music song | Same, on a **different audio pipe** (never measured under record). |
| **VR-3** | `.playAndRecord + [.duckOthers, .mixWithOthers]` | both sources | **"ducked but alive" is a PASS** (ducked ≠ silent; gate music is already ducked when the mic opens). |

Each row: real input tap during the window, effective config logged, orange mic indicator **expected and
acceptable** (honest privacy UI, not a bug). To run: `FLAG_DUCK_TEST=true` (currently on for the sitting),
`cap sync ios`, Debug build → the VR buttons: start a source → open a mic window → **listen** → close.

---

## 2. The decision tree (silence never ships)

- **OUTCOME A** — both sources survive (full or ducked) under some VR config → ship checkpoint-window
  listening directly on that config. Simplest world.
- **OUTCOME B** — Apple Music survives but the WebView local track dies → do NOT ship per-source
  silence. Escalate to **Plan C** for the local track; AM keeps the measured config.
- **PLAN C — THE GUARANTEE** (deterministic, no measurement can break it): move native local-track
  playback INTO the app's own session — extend **ChoppdAudio** with `playTrack()/pauseTrack()/
  seekTrack()/setTrackVolume()` (AVAudioPlayer, the exact pattern its clip player already uses). An
  app's own session audio is **immune to its own record activation by definition** (`.playAndRecord`
  plays AND records simultaneously). Consequences, priced in:
  - gate muffle on native local becomes **volume-based** (`0.40` via `player.volume`) — the lowpass
    character was already a known native gap (volume-only ducking accepted at the YT pilot);
  - the engine's `Music` seam gains a **third backend** (webaudio / AM / native-track) behind the SAME
    API — the seam was built for exactly this;
  - **web is byte-identical** (web keeps the WebAudio graph + lowpass).
- **NEVER-SHIP RULE:** if listening would silence music and Plan C is not yet in place, voice stays
  dark. Silent-while-listening is not a shippable state under any framing.

---

## 3. Architecture — ChoppdSpeech + one session owner

**ChoppdSpeech** (Swift, ~200 lines): `SFSpeechRecognizer` + `AVAudioEngine` input tap. On-device
recognition preferred (`requiresOnDeviceRecognition` where supported; network fallback permitted, log
which engaged). `en-US`, `partialResults` on. Registered via `MainViewController.capacitorDidLoad` (the
proven local-plugin path).

**THE SESSION COORDINATOR** (the v1 killer, solved structurally): **ChoppdAudio becomes the ONLY code
that touches `AVAudioSession`.** It exposes modes: `playback` (default) · `playbackDucked` (clip/gate
duck, today's behavior) · `listen` (the VR-measured record config). ChoppdSpeech **requests** a listen
window through the coordinator and never calls `setCategory`/`setActive` itself. One owner, zero fights
— enforced by code review + a debug assert if any other class touches the session.

**JS surface = the existing VoiceCtrl backend contract, byte-for-byte:** `available()` /
`requestPermissions()` / `start({language, partialResults})` / `stop()` · events `partialResults` /
`listeningState` / `error`. ChoppdSpeech streams transcripts; `matchVoiceCommand` in JS decides what was
said — the grammar (next / back / repeat + filler tolerance) is **literally the same code as web.** No
new commands, no wake word, no always-on (founder, final).

---

## 4. Lifecycle — checkpoint-window listening (= the web lifecycle)

Mic opens **ONLY**: parked at a checkpoint/gate AND after that cue's voice clip fully ended (the
existing post-TTS gap + echo guard — the clip plays in `playbackDucked`, THEN the coordinator
transitions to `listen`). Mic closes on: command recognized · transport · TTS starting · screen exit ·
background.

Per-window choreography: `gate parked → clip ends → coordinator playbackDucked→listen → recognizer
starts (listeningState: live) → transcript → JS matches → stop + coordinator listen→playbackDucked (gate
still held) → confirm path runs exactly as today (source-aware: local rewind / AM swell)`. A no-speech
timeout → silent reopen with backoff. All v1 hardening carries verbatim: session tokens (stale events
ignored), caller-tagged `VOICE:` logs, the 4-opens/sec storm guard, the ≥3-fast-failures honest state,
minimum listen window. **Music behavior during the window = whatever §1 measured (never silence, per
§2).** The transition runway reuses the DuckTest pre/post-roll values (200/400 ms).

---

## 5. Front door — the rehearsal, reused verbatim

The v1 enable-time rehearsal (approved strings + flow): explicit enable → OS prompts (mic + speech) →
"Let's check your mic. After I finish talking, say 'next'." → clip via ChoppdAudio → coordinator to
`listen` → one recognized "next" → success → toggle ON. Honest failure path unchanged (retry →
double-fail → toggle stays OFF + Settings pointer). **The rehearsal's post-clip mic-open is the permanent
regression test for the coordinator handoff.** Deny path, persistence, never-re-prompt: unchanged.

---

## 6. Verification ladder

- **1101 CORRECTION (device log, 2026-07-15):** `kAFAssistantErrorDomain Code=1101` from
  `com.apple.speech.localspeechrecognition` is the **on-device local-speech service wedging** — it happens
  on **real hardware too**, NOT just the sim (the old "sim-only signature" note was wrong). ChoppdSpeech
  handles it: single-use request/task per window + a generation guard (a dead task's late errors are
  dropped, killing the "Ignoring subsequent" flood), then a ladder — 1st 1101 recreates the recogniser,
  2nd+ forces **server recognition** for the rest of the session. Voice **degrades, never dies**; the JS
  storm-guard auto-disable is **per-cook** (a new cook or the Settings toggle re-arms).
- **SIM** (state machine only — no speech service): a dev-only transcript-injection hook on ChoppdSpeech drives `matchVoiceCommand`
  end-to-end; Maestro + Eye assert the coordinator ladder (playback→ducked→listen→ducked ordering,
  tokens, storm guard), the rehearsal state machine, web-byte-identical.
- **DEVICE** (founder — the only place recognition + coexistence are real): the **VR rows verdict first
  (§1)** · rehearsal grant · a full eggs cook driven by next/back/repeat at gates on **BOTH sources**
  (local track + an AM song) with the bar: **music never silent, never stuck ducked, never fails to
  resume** · deny path · relaunch persistence · the soak (10 min mixed voice/transport/gate abuse, zero
  freezes, no `VOICE` cascade).
- **ROLLOUT:** `NATIVE_VOICE_V2=false` committed until the device battery passes → flag true + **DELETE
  the v1 plugin** (pod, package.json, Cap-7 pin note) in the same pass — one speech system in the build,
  ever. `supportState` flips from "native-off" only under the flag.

---

## 7. Build order

1. **VR-1/2/3 rows into DuckTest** ✅ → founder's 10-minute sitting → record the verdict as §2's outcome
   (values, not assumptions). ← **we are here**
2. If Outcome B/C: **Plan C's native-track backend lands FIRST** + its own mini ears-pass (local cook
   sounds identical).
3. ChoppdSpeech + coordinator + VoiceCtrl backend + injection hook → sim ladder green → dark commit.
4. Founder device battery (§6) → flag true + v1 deletion.

**Compile caveat (standing):** Speech/AVAudioEngine generics can't compile in the agent environment —
the first device build may need one error-paste round, same as ChoppdMusic.
