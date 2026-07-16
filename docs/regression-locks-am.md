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

## Proven deltas (2026-07-16)

- FIX 2 (pause/resume roulette): scenario 2 `localStarts` **5 → 0**. Root cause: the `#pause` resume branch
  called `Music.play()` AND `AppleMusic_.play()` on AM cooks → local leak + multi-path race. Fix: one
  `resumeAudio(reason)` owner + `audioEpoch` voids in-flight retries; AM cooks never touch the local element.
- FIX 1 (transport jump leaves AM ducked): scenario 3 `duckReleases` **0 → 2**. Root cause: `jumpToCue`
  departed a gate without the gate-exit path, so `VoicePlayer.releaseDuck()` never ran. Fix: jump runs the
  same session-release the confirm path runs.
- No-regression: scenarios 4/5 unchanged (local resume starts local; local jump parks).

## Device-only (the founder's battery — not reproducible headless)

Real AM playback (DRM), the native voice-teardown/coordinator crash on a jump (fixed by serializing
`ChoppdSpeech.stop()` → `ChoppdAudio.setMode()` in `_nativeTeardown`), and the native duck **level** on
resume. `injectTranscript` voice-ladder asserts run in the iOS sim via `.maestro/flows`.
