# Post-mortem: the countdown beep killed Apple Music (2026-07-16)

Short autopsy of a claim my headless proof couldn't test. Last round I wrote that `ChoppdAudio.beep`
"plays on the already-active session without reconfiguring it, so it can't kill AM — the safe bet." The
founder's phone falsified it within one beep: the song died the instant beep #1 sounded, and all four
beeps landed at once.

## What the beep ACTUALLY did (session level)

```swift
if !toneReady {
    toneEngine.attach(tonePlayer)
    toneEngine.connect(tonePlayer, to: toneEngine.mainMixerNode, format: fmt)
    try toneEngine.start()          // ← THE INTERRUPTING CALL
    toneReady = true
}
```

- **`AVAudioEngine.start()` implicitly activates the shared `AVAudioSession`** (starting the IO graph
  requires an active session). I never called `setActive` — but **"I didn't reconfigure anything" ≠ "I
  didn't activate anything."** The engine activated it for me.
- **The category in effect at that moment had no `.mixWithOthers`.** ChoppdAudio's neutral/coordinator
  `playback` config is `.playback, mode:.default, options:[]`. Apple Music plays through the **system music
  player**, which from the app session's perspective is **other audio**. **Activating a `.playback` session
  without `.mixWithOthers` interrupts other audio by default.** So `toneEngine.start()` → implicit
  `setActive(true)` on a non-mixing category → **AM interrupted at beep #1.** (Contrast the voice clips,
  which survive over AM because they activate with `.duckOthers` — duck, don't interrupt.)

**Why the headless proof missed it:** the mock `ChoppdAudio.beep` pushed the frequency to a JS array
(`__beeps`) — it has no `AVAudioSession`, no system music player, no interruption model. The lock proved
"beep() called 4×, zero local `Music.play`" — a true statement about JS that says **nothing** about native
session-activation semantics. Same blind-spot class as the coordinator re-duck: **native session effects
are invisible to a JS-call recorder.** The claim should never have been stated as proven.

## Why all four beeps landed at once (timing)

The JS fires all four in one tick (`_native([...]).forEach` → four `beep()` calls, each with its own
`delayMs` of 0/700/1400/2100). The **native side was supposed to space them** via
`DispatchQueue.main.asyncAfter(deadline: .now() + Double(delayMs)/1000)`. The delay was read with
`call.getInt("delayMs")` — but JS numbers cross the Capacitor bridge as **doubles**, so `getInt` returns
`nil`, the `?? 0` fires, **every deadline collapses to `.now()+0`, and all four play in one burst.** Culprit:
**native** (the delay was dropped), not the JS loop.

## The fix (see the same-day commit)

1. **Session:** the beep sets `.playback` **with `[.mixWithOthers]`** before any activation — mixing can
   never interrupt AM. (The truly-side-effect-free path, `AudioServicesPlaySystemSound`, needs a bundled
   sound asset the repo doesn't have; `.mixWithOthers` is the founder-accepted explicit-activation path.)
   Logs `isOtherAudioPlaying` before/after so the device confirms **other audio true → still true.**
2. **Timing:** the countdown beeps are now driven **one-per-tick from `runCountdown`'s own `setTimeout(tick,
   700)`** — the same source as the visual 3·2·1 — so they're spaced by construction, not scheduled up
   front. (`getInt`→`getDouble` also fixes the dropped delay for chime/alert.)
3. **Lock:** the mock records beep timestamps and asserts they arrive **spaced across the tick timeline**
   (not one burst). The AM-survival invariant is honestly the founder's device battery
   (`isOtherAudioPlaying` stays true) — the headless lock cannot assert native session state, and this
   post-mortem exists because I once pretended it could.

## Addendum — the fix's OWN sequel (Gun 2), same day

The `.mixWithOthers` beep confirmed working on device (otherAudio true→true ×4), but a device log then
showed a **transition voice clip interrupting AM instead of ducking** (`ctx:"interrupted"`, `Session
deactivation failed`, then a frozen-pos "playing" zombie). Root cause = **my own fix's leftover**: the beep
used a **persistent `AVAudioEngine` property** that stayed running, so it **held the session active**, so
the next voice clip's `deactivate` (`setActive(false)`) **failed** → session left dirty → the following
clip's activate interrupted AM. The persistent-engine "optimization" was the sin. Fix: the beep engine is
now created + **fully torn down per tone** (nothing lingers), plus activate/deactivate are **serialized on
one queue** and a failed `deactivate` is **retried, never swallowed** (Gun 2 defense). Lesson repeated:
anything that holds or activates the shared session is a session mutation with consequences, even when it
"works" for its own purpose.

Also this round — **Gun 1**: a device log caught a `ChoppdMusic.pause` landing at the boundary that the
headless trace never records (the harness jumps straight to `screens.cook`, skipping the real
`preCook→launchCook→cook` path). Fix: **caller-tagged transport logging** (`[ChoppdMusic] pause caller=…`,
permanent) so the next device run names it outright, and a harness `__amTransport` recorder. Likely a
consequence of Gun 2 (an interrupted AM auto-pauses); the tag will confirm.
