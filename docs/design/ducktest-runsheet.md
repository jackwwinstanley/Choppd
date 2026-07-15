# DuckTest — device run-sheet

**Your ears + the log panel render the verdict.** The verdict picks the native gate behavior
(system-duck vs mute vs pause-stands) and unblocks native-voice-v2 §4.

## Setup (once)
1. `git pull` (get the plugin + its registration), then in `mvp/app.js` confirm
   `const FLAG_DUCK_TEST = true;` (already true on the branch; never *deploy* it true to web).
2. `npx cap sync ios` → open in Xcode → build **Debug** to your device (the plugin is `#if DEBUG`;
   a Release build has no plugin — that's the point). *(The plugin auto-registers via
   MainViewController.capacitorDidLoad — no manual step.)*
3. On device: **Settings → 🔊 Duck Test (dev)**.
4. **First, read the status line at the top:** it must say **`harness v4 · plugin registered ✓`**.
   If it says **MISSING** → your build is stale (didn't pull / didn't cap-sync / built Release). If the
   version isn't **v4**, you're on an old bundle. The log panel names it too.
5. Defaults are pre-set: preRoll 200 ms, postRoll 400 ms, voice vol 100, mode `.voicePrompt`,
   options `[duckOthers]`. Built-in 900 ms tone plays as the "voice" unless you paste a clip URL.
   (Note: `.voicePrompt` makes iOS report EFFECTIVE options `[duckOthers,mixWithOthers]` — the log
   shows requested → EFFECTIVE so you always see what actually took.)
6. **Cross-app source:** use the preinstalled **Podcasts** app (or anything that truly plays in the
   background) — a backgrounded YouTube video is killed by iOS on app-switch, so it's silent.
7. **Runway:** start music, let it play ≥ 8 s (steady-state), *then* Fire the cue. Judge YT-WebView
   rows **by ear** (+ record device output on a second phone for A/B); read the **RMS dB** lines for
   the hosted-control row. The healthy log line that means Fire worked:
   `→ DEACTIVATED · cycle complete` at the end of a run.

## Pre-flight (do first — proves `.duckOthers` is even live)
| Do | Listen for | Log |
|---|---|---|
| Play the preinstalled **Podcasts** app in the background (truly plays backgrounded; no Apple Music needed). In Duck Test: options `[duckOthers]`, mode `.playback`, tap **Fire** (any source; the tone is enough). | Podcasts **ducks** when the tone fires, **recovers** after. | `ACTIVATE → … options=[duckOthers]` then `DEACTIVATE`. |

If Podcasts does **not** duck here, `.duckOthers` isn't working at all — stop and fix before trusting any WebView row.

## The matrix (§6) — one row per run
| # | Source · Mode · Options | What to do | Listen for | Log lines |
|---|---|---|---|---|
| **1** | **YT WebView · .playback · duckOthers** (the real target) | source = YouTube WebView, Start music, wait ≥8 s, **Fire** | Does the YT music **duck to ~20%**? Voice clear above the bed? | `configureSession … EFFECTIVE category=playback options=[duckOthers]` · `ACTIVATE t=…` · `voiceStart`/`voiceEnd` · `DEACTIVATE`. **By ear** (no buffer access). |
| **2** | YT WebView · .playback · duckOthers **+ mixWithOthers** | check `mixWithOthers`, Fire | Music **survive + duck** (mix), or get interrupted? | `EFFECTIVE options=[duckOthers,mixWithOthers]` · ear |
| **3** | YT WebView · **.playAndRecord** · duckOthers | mode = `.playAndRecord`, Fire | Does the record category **catch** the WebView (duck)? **Orange mic dot?** Or does music pause? | `EFFECTIVE category=playAndRecord` · **note the orange mic (your eyes)** · ear |
| **4** | **Hosted control · .playback · duckOthers** (measurable) | source = Hosted control, paste an mp3 URL, Start, Fire | A clear, measurable drop | **RMS dB lines**: before ≈ *X*, **during ≈ *X* − 18…−22 dB**, after back to *X* (full recovery). Pass = that drop + recovery, no pop/pause. |
| **5** | **— no session** (negative control) | check **NO SESSION**, Start YT (or control), Fire | Music must **NOT** change | No `ACTIVATE` line; music unchanged. |

## Fail signals (all are valid, recorded results — not bugs)
- **Music pauses instead of ducking** → category conflict.
- **Music doesn't change at all** (rows 1–3) → WebView is on the app's *own* session; `.duckOthers` can't reach it → fall back to binary `mute()`/`unMute()` on the YT player, or move music to hosted audio.
- **Duck far above 20% (too subtle)** → the system floor doesn't match the target → hosted-audio + manual gain for a precise 20%.
- **Pop / lurch at the boundaries** → tune pre-roll / post-roll.
- **Orange mic on `.playAndRecord`** → note the privacy cost of that path.

## What each outcome decides
- **Row 1 ducks cleanly at ~20%** → native gate can upgrade from *pause* to *system-duck*; voice-v2 §4 uses `.playback + .duckOthers`, no mic-pause precondition.
- **Row 1 doesn't duck, Row 3 does** → `.playAndRecord` reaches it but at the orange-mic cost → §4 weighs the mic indicator vs. keeping the pause behavior.
- **Neither ducks the WebView** → system ducking is out; the transport-lands-paused / gate-pause behavior stands, and voice-v2 opens the mic only while the video is already paused.

*The `.playAndRecord + .duckOthers` row (3) is double-duty: it directly parameterizes native-voice-v2 §4.*
