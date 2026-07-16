# AM / cook-audio regression locks (re-run every round that touches the cook audio path)

The founder's directive: **do not break normal functioning.** These asserts are the contract — run them
**green on HEAD before a fix**, then again **after**. If a fix can't pass without moving an assert, STOP
and report the conflict.

## How to run (headless, web — the cook engine is identical JS in the WebView)

The JS cook engine + `MOCK_AM` transport are the real code; only the native audio plugins differ (those
are the device battery). A `?__test=1` opt-in seam (inert without the flag) exposes a launcher + probe:

- `window.__testCook(recipeId, am)` — launches a cook (`am=true` seeds an Apple Music selection).
- `window.__cook` — `st()` (state: amActive/paused/parkedPaused/waiting/amRepairing/audioEpoch/localStarts/
  duckReleases), `reset()`, `amT()` (mock AM clock), `jump(i)`, `pauseClick()`.
- `localStarts` = count of local `<audio>` `play()`/`fadeIn()` calls (the "no local on an AM cook" invariant).
- `duckReleases` = count of `VoicePlayer.releaseDuck()` calls (the gate-exit session release).

Serve `mvp/` (`python3 serve.py`), open `index.html?__test=1`, set `window.MOCK_AM=true;
window.AM_FORCE_CAPABLE=true`, then drive via `__testCook` + `__cook`. Allow ~4.2s after launch for the
3·2·1 countdown + AM queue/play.

## The matrix (expected AFTER any fix)

| # | Scenario | Assert |
|---|---|---|
| 1 | AM cook start | `amActive` true · AM clock advancing · `localStarts == 0` |
| 2 | AM: pause→resume ×5 | `localStarts == 0` · `amActive` true · AM advancing (FIX 2 single-owner) |
| 3 | AM: jump back + forward | `localStarts == 0` · `duckReleases >= 2` · `parkedPaused` true (FIX 1 duck release) |
| 4 | LOCAL cook: pause→resume | `localStarts >= 1` (local MUST resume) · `paused` false |
| 5 | LOCAL cook: jump | `parkedPaused` true · `duckReleases == 0` (AM-only release) |
| 9 | USER MUSIC-PAUSE outranks (`musicPauseOnly()`) | `amT` stops advancing · a gate `confirm()` keeps it paused · `localStarts == 0` · only `musicResumeOnly()` restarts (`amT` advances) |
| 10 | PHASE-CROSSING continuity — **REAL PATH** (`__testCookContinuous(id, true)` now walks `preCook → launchCook → screens.cook → begin`, NOT a teleport) | from the TRANSITION onward: `__amCalls == []` (zero ChoppdMusic transport) **AND** `__reinitCalls == []` (no `unlock`/`initGraph` — the transition re-init that killed AM; the OLD teleport lock read `[]` here only because it skipped `launchCook`, the new real-path lock reads `[unlock,initGraph]` RED on HEAD) · `amT` advancing · gate confirm works. **Fence:** `__testCookContinuous(id, false)` (LOCAL) MUST still show `[unlock,initGraph,…]` (re-init untouched for local). |
| 11 | SFX carve-out + timing (`__runCountdown()`) | `__beeps.length == 4` on the native path · offsets `≈[0,700,1400,2100]ms` (SPACED one-per-tick, NOT a burst `[0,0,0,0]`) · `localStarts` delta `== 0` (SFX are NOT music). *AM-survival over the beep is native (`isOtherAudioPlaying` true→true) — the founder's device battery; a JS-call recorder cannot assert session state (see the beep post-mortem).* |
| 12 | MUSIC PANEL HOIST (Stage 2b — `window.__musicPanel` module-scope, ctx-bound) | cook binds `ctx.source==="am"`, local binds `source:"local"` `canSkip:false` (skip HIDDEN off-AM) · panel pause = `musicPaused` true, **cook clock/gates unaffected** (`cookRunning` true, `localStarts == 0`) · **SKIP during a PARKED gate leaves it parked** (lock #9 family: `waiting`/`parkedPaused` unchanged, `localStarts == 0`) · preCook `#preAmEdit` renders for AM cooks, opens the SAME sheet (preCtx pause/resume/skip). Fence: the hoist is a delegation — lock #10 continuity + goldens MUST stay byte-identical (they do). |
| 13 | TIMER-ALARM VISIBILITY GATE (`window.__timerAlarm`, `document.hidden` spoofed) | With background audio JS runs while LOCKED, so `fire()` must gate on visibility. **FIRE while `document.hidden`:** ZERO `ChoppdNotify.cancel`, ZERO `stopAlarmLoop`, ZERO music-resume, overlay NOT shown, `active==true` (the native loop + chain own the ring). **onForeground (→ visible):** overlay presented, still zero cancels/stops, `playAlarmLoop` verify (idempotent). **dismiss (user tap):** `stopAlarmLoop` ONCE `caller=dismiss` + chain cancel ONCE `caller=dismiss` + resume ONCE; a 2nd dismiss is a no-op (re-entrancy guard). **FIRE while visible:** overlay immediate, still zero cancels/stops (chain kept until dismiss). **early-advance cancel:** `caller=early-advance`. The chain is cancelled ONLY by dismiss/early-advance/quit — NEVER by fire. |

## Proven deltas (2026-07-16)

- FIX 2 (pause/resume roulette): scenario 2 `localStarts` **5 → 0**. Root cause: the `#pause` resume branch
  called `Music.play()` AND `AppleMusic_.play()` on AM cooks → local leak + multi-path race. Fix: one
  `resumeAudio(reason)` owner + `audioEpoch` voids in-flight retries; AM cooks never touch the local element.
- FIX 1 (transport jump leaves AM ducked): scenario 3 `duckReleases` **0 → 2**. Root cause: `jumpToCue`
  departed a gate without the gate-exit path, so `VoicePlayer.releaseDuck()` never ran. Fix: jump runs the
  same session-release the confirm path runs.
- No-regression: scenarios 4/5 unchanged (local resume starts local; local jump parks).

## Coordinator golden sequences (§d.1 — kills the native blind spot headlessly)

`window.__mockNative()` installs a **recording** `ChoppdAudio`/`ChoppdSpeech` where the real plugin is
null, so `isNativeVoice()`/`useNativeDuck()` are true and every `setMode`/`activate`/`deactivate` is
recorded in order (`__cook.coordLog()`). `ChoppdSpeech.stop()` resolves async so `_nativeTeardown`'s
serialize defers `finishCoord` — the deferred `setMode` lands after `releaseDuck`, exactly as on device.

Drive: `__mockNative()` → `__testCook(recipe, am)` → `enterGate(i)` → `coordReset()` → `confirm()`.

| path | golden (the coordinator's LAST session word must be the un-duck) |
|---|---|
| **AM confirm — HEAD (bug)** | `["deactivate", "setMode:playbackDucked"]` ← the re-duck, RED |
| **AM confirm — FIX** | `["deactivate"]` (the teardown `setMode` is VOIDED by the epoch guard) |
| **LOCAL confirm — FIX** | `["deactivate"]` (fix.3: the local confirm now `releaseDuck`s too; `setMode` voided) |
| **Landed-Continue (jump→checkpoint→Continue) — HEAD (bug)** | trace CONTAINS `setMode:playbackDucked` not voided + `duckReleases 0` — resumes at 40%, RED |
| **Landed-Continue — FIX** | re-duck VOIDED (`indexOf("setMode:playbackDucked") === -1`) + `duckReleases ≥ 1`, both sources |

Drive landed-Continue: `__mockNative()` → `__testCook(recipe, am)` → `jump(gateIdx)` (lands parked at a
checkpoint) → `coordReset()` → `confirm()` (Continue). Assert the trace has no un-voided
`setMode:playbackDucked` and `duckReleases` incremented (the authoritative release fired).

**Red-on-HEAD proof (2026-07-16):** on reverted HEAD the mock recorded `["deactivate",
"setMode:playbackDucked"]` — the muffle is finally VISIBLE headless (the blind spot that bit twice). After
the write-ownership fix both AM and LOCAL confirm record `["deactivate"]`. Local-path audit verdict:
`exitCheckpoint` restores only JS gain — nobody returned the native session to full on a local confirm, so
the stale teardown write was load-bearing; local now gets the AM path's `releaseDuck` discipline
(epoch-bumping, so its own late re-duck is voided).

**Policy (§d.3):** any change to `_nativeTeardown` / `setMode` targets / the `coordEpoch` bumps must update
these goldens in the same commit.

## Device-only (the founder's battery + sim smoke)

Real AM playback (DRM) and the native duck **level**. The sim smoke (`.maestro/flows` +
`ChoppdSpeech.injectTranscript`) is the H1+H2 tripwire without ears: inject "next" at a gate → assert the
cook advances, playback keeps advancing after Continue, and the NEXT gate opens a fresh
`listeningState:started`. The corrected fix has **no Swift change** — the sim runs the existing native
build with the updated web bundle.
