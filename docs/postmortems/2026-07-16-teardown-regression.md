# Post-mortem: reason-aware `_nativeTeardown` broke voice + Continue (2026-07-16)

**Status:** reverted (`bc6ee05` reverts `ddb2744`); prod + phone back on `e5dd9db` behavior (app.js?v=228).
Written for scrutiny, not defense. The corrected fix is **not** attempted here — it awaits advisor review.

**Commit that regressed:** `ddb2744` "AM/local: post-confirm muffle … coordinator returns to FULL on confirm".
**Founder-reported symptoms (device, both sources):** (1) voice commands stopped working entirely;
(2) **Continue turns the song OFF**. Both AM and Choppd's-pick.

---

## a. What the change did, mechanically

`ddb2744` changed exactly one behavioral thing: the `VoiceCtrl._nativeTeardown(reason)` coordinator step.
(It also added `playNewQueue`/"Play this" and test-harness probes — all reverted with it; none are
implicated.) The teardown runs every time a native listen (mic) window closes. Its job: (i) tell the
`ChoppdAudio` coordinator what session mode to return to, and (ii) optionally recover the interrupted
music pipeline.

**Reason classification introduced** (`navAway`, exact-match so "back" ≠ "background"):

| reason strings | class | setMode target | recover@350 |
|---|---|---|---|
| `exit`, `jump`, `advance`, `back`, `skip`, `toggle-off`, `stop` | **nav-away** (cook left/advanced the gate) | **`playback` (FULL)** | **skipped** |
| everything else (`start-reset`, `tts`, `background`, `silence`/timeout, `denied`, …) | mid-cook | `playbackDucked` (unchanged) | scheduled (unchanged) |

The crash-serialize from `e5dd9db` was kept: `SP.stop()` (recognizer + `AVAudioEngine` tap teardown) is
awaited (300 ms fallback) **before** `finishCoord()` runs `setMode`.

### Before/after ordering of a confirm (voice "next" AND button tap)

Both paths reach the same teardown: a recognized command calls `stop("advance")`; the button calls
`exitWait → VoiceCtrl.stop("exit")`. The mic window is open at every gate, so a *button* tap also tears
down a live listen window.

```
e5dd9db (WORKED)                          ddb2744 (BROKE)
────────────────                          ───────────────
exitWait/command                          exitWait/command
  VoiceCtrl.stop("exit"/"advance")          VoiceCtrl.stop("exit"/"advance")
    SP.removeAllListeners()                   SP.removeAllListeners()
    await SP.stop()  ── serialize ──          await SP.stop()  ── serialize ──
      finishCoord():                            finishCoord():   [navAway = true]
        setMode(playbackDucked)  ← DUCK           setMode(PLAYBACK)  ← FULL reconfig, setActive
        schedule recover@350ms                    (recover SKIPPED)
  exitWait source resume:                   exitWait source resume:
    AM → releaseDuck (deactivate)             AM → releaseDuck (deactivate)
    local → exitCheckpoint + Music.play       local → exitCheckpoint + Music.play
  …recover@350 fires → _musicRecover        …(no recover)
    → resumeAudio (re-asserts the source)
```

Two independent sub-changes, both in the nav-away branch: **(1) setMode target `playbackDucked` →
`playback`** (a full category/active reconfiguration rather than a duck-level change), and **(2) recover
deleted**. `e5dd9db`'s intent was that `releaseDuck` un-ducks and, because `setMode` still targeted
`playbackDucked` *synchronously before* the serialize existed, ordering didn't bite; the recover was the
safety net that re-asserted the source after any session churn.

---

## b. What broke and why — mechanical hypotheses (labeled as hypotheses)

**H1 — Continue kills the song (highest confidence).** `setMode("playback")` performs a full session
reconfiguration (`setCategory(.playback)…; setActive(true)`), i.e. a deactivate/reactivate of the shared
`AVAudioSession` **under the currently-playing source**. That is precisely the interruption class
`Music.kick()` / the recovery hook were built to repair (see `native-audio-session-recovery`): activating
the session interrupts the WebView/AM pipeline. In `e5dd9db` the recover@350 kicked it back to life; in
`ddb2744` the recover is **deliberately skipped on nav-away**, so nothing re-asserts playback → the song
goes silent on Continue. `exitWait`'s own `releaseDuck` (AM) / `Music.play` (local) is not sufficient
because the *teardown's* `setMode("playback")` lands **after** it (serialized behind `SP.stop()`), so the
last thing to touch the session is an activate with no follow-up kick.

**H2 — voice commands stop working (high confidence).** After a command advances a gate, the next gate
must re-open the mic (`_nativeOpen → await setMode("listen")`). The nav-away `setMode("playback")` is
async (behind the serialize) and can land **concurrently with / after** the next window's
`setMode("listen")`, clobbering the record configuration — a `.playback` category has no input route, so
the recognizer's `AVAudioEngine` input tap has nothing to attach to and the window dies silently. In
`e5dd9db` the teardown targeted `playbackDucked` (still not a record category, but the recover kept the
pipeline coherent and timing was different); the switch to a full `playback` reconfiguration plus the
removed recover appears to wedge the listen setup. Secondary contributor: a recognized command tears down
with reason `"advance"`/`"back"` → nav-away → this same `playback` reconfig fires on *every* successful
command, so the first command can poison the second window.

**H3 — interaction, not either alone.** `e5dd9db` (always `playbackDucked` + recover) "works very well,"
so neither the serialize nor the un-duck intent is inherently broken. The regression is specifically the
nav-away pair: full-`playback` reconfig **and** skipped recover, landing after the serialize.

I did not capture a device stack/log this pass (revert-first, per direction). H1/H2 should be confirmed
against the founder's console: look for a `coord→playback (nav-away)` line, whether a second
`listeningState: started` ever fires after the first command, and whether the source's `ct` freezes at
Continue.

---

## c. Why the 8 locks were green on a broken build (the blind spot, named)

The regression suite runs **headless in the browser**, where `choppdAudioCoord()` (and `choppdAudio()`)
are **null** — Capacitor plugins don't exist on web. Therefore **every `CO.setMode(...)` call in
`_nativeTeardown` is a no-op in the harness.** The nav-away change had *literally zero observable effect*
on any lock: the locks spy on JS method calls and JS state (`localStarts`, `duckReleases`,
`exitCheckpoints`, `mode`, `parkedPaused`), none of which the coordinator branch touches. The entire
native session layer — the thing that actually broke — is absent from the harness.

**This is the second time this exact blind spot bit.** The muffle bug itself (what `ddb2744` tried to fix)
was invisible to the same locks for the same reason: the duck *level* lives in the native session, which
the web harness cannot hear or observe. We "fixed" an unobservable bug with an unobservable change and the
suite stayed green through both the bug and the regression.

---

## d. What locks would have caught it

1. **A JS-level coordinator ordering lock (catches this without a device).** Install a *mock*
   `ChoppdAudio` coordinator in the `?__test=1` harness (a recording stub for `setMode`, `activate`,
   `deactivate`, plus `VoicePlayer.holdDuck/releaseDuck`). Record the exact ordered sequence of
   coordinator calls per path and assert it against a **golden sequence**, e.g.:
   - AM confirm → `[releaseDuck, setMode:playbackDucked]` (or whatever the *approved* fix declares).
   - the recover **is** scheduled on a mid-cook close and **is not** on a confirm — asserted explicitly.
   The nav-away change would have flipped `setMode:playbackDucked` → `setMode:playback` and dropped the
   recover in the recording → **red immediately**, no device needed. (The harness already spies JS calls;
   this just extends the spy to the coordinator seam that is currently null-and-ignored.)
2. **A sim smoke that proves the *next* window opens.** In the iOS sim via `.maestro/flows` +
   `ChoppdSpeech.injectTranscript`: at a gate, inject "next", advance, arrive at the next gate, and assert
   a fresh `listeningState: started` fires (mic re-opened) **and** the source's playback position is still
   advancing after Continue. This directly trips H1 (song dies) and H2 (window doesn't re-open) even
   though attenuation itself can't be "heard" by an assert.
3. **Golden-sequence review gate:** any change to `_nativeTeardown` / `setMode` targets must update the
   golden sequence in the same commit, forcing the ordering to be stated and reviewed rather than moved
   silently.

---

## e. The original problem, restated as a constraint set for the real fix

The muffle bug (why `ddb2744` existed): at a confirm the mic window closes; `_nativeTeardown` returns the
session to a **ducked** mode, and — because `SP.stop()` is serialized ahead of it — that `setMode` lands
**after** `exitWait`'s `releaseDuck`, so the session is **re-ducked** and the song stays quiet (for local,
left in the ducked/`.voicePrompt` record-adjacent state = "messed up"). A correct fix must satisfy **all**
of:

- **C1 (crash):** keep `SP.stop()` (recognizer + tap teardown) serialized before any session reconfig —
  the jump-during-voice crash fix must not regress.
- **C2 (un-duck wins):** the session's post-confirm level must end **un-ducked/full**, and the un-duck must
  land **before or together with** `releaseDuck` — not as a later writer that re-ducks.
- **C3 (don't starve live sources):** the source that is (or should be) playing must be re-asserted after
  any session activate/deactivate — i.e. **do not skip the recover** on a path where a session
  reconfiguration can interrupt the WebView/AM pipeline (H1). If the mode transition is a full
  reconfiguration, a kick/recover must follow.
- **C4 (don't wedge the next window):** whatever mode the teardown leaves must let the next
  `_nativeOpen → setMode("listen")` configure a record session cleanly, with no async collision (H2).

Open question for the advisor: whether the un-duck should be a *level* change on the existing category
(cheap, no route change, likely no interruption — favors C3/C4) versus a full `playback` reconfiguration
(what broke it), and whether `releaseDuck` alone (AM) / `exitCheckpoint` (local) already achieves the
un-duck such that the teardown should target the **least-disruptive** mode rather than `playback`.
