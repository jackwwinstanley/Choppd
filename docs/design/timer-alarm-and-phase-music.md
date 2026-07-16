# All-phase music + the blocking timer alarm (staged spec)

Additive round (2026-07-16). Founder directive, verbatim: **THIS IS ONLY ADDITIVE — DO NOT HURT OR DESTROY
THE EXISTING MUSIC-PHASE FUNCTIONALITY.** Step-0 suite green before and after; the music phase is
byte-identical. Because **C's core value is device-only** (a notification that fires on a *locked* phone)
and it is a **new native plugin**, this lands in stages, each proven on device before the next — the same
discipline that recovered the ddb2744 regression.

---

## Stage 1 — SHIPPED this pass: B (music-only pause + user-pause outranks)

- `🎵` panel gains a top-row **⏸ Pause music / ▶ Resume music** (edit mode). Pauses the **sound only** —
  the cook clock, timers, and cues keep running (`musicPaused`, distinct from the cook `paused`).
- **User music-pause OUTRANKS everything:** `resumeAudio()` returns early while `musicPaused` unless the
  reason is `"user-music-resume"`. Gates run silent, a confirm does not un-pause, voice-teardown recovery
  does not resurrect — only the user's own resume (or "Play this") restarts. Epoch-bumped; `_recoverTimer`
  cancelled on pause. **Lock added** (docs/regression-locks-am.md): pause stops the clock, confirm keeps it
  paused, no local leak, only user-resume restarts.
- Not yet: the `🎵` icon in **all** post-prep phases — that rides on Stage 2 (the panel manages the
  continuous AM queue, which only spans phases once continuity lands).

---

## Stage 2 — NEXT: A (music in all post-prep phases)

Today (unchanged): Prep (no song chosen) → **Phase 1 `screens.preCook`**: `Ambient` plays royalty-free
`PHASE1_TRACKS` (a *separate* `<audio>`), or an own-playlist plays continuously (`phase1MusicPlaying`) →
**Phase 2 `screens.cook`**: `Ambient.fadeOut`, the cook song starts at `musicStartAt`.

The additive change — **AM widens, local is untouched (A3):**
- **Choppd's-pick / local:** LEAVE EXACTLY AS IS. `Ambient` in Phase 1, the per-phase local files, the
  `musicStartAt` drop — all byte-identical. This is the caps fence.
- **Apple Music:** play the **AM queue continuously from leaving prep to cook end** — one queue, no
  `Ambient` in Phase 1 for AM cooks, and the Phase-1→Phase-2 boundary **never stops / restarts / reseeks**
  (the boundary is invisible to the audio). Start the AM queue when the AM cook leaves prep (preCook mount),
  keep it playing across `screens.preCook → screens.cook`; the `musicStartAt` local-drop path stays local-only.
- **Fences that must extend to the new start sites:** no local element ever starts on an AM cook — extend
  the gate/parked/phase sweep to the **phase-transition start sites** (preCook mount, preCook→cook handoff);
  single resume owner; epoch guards; the coordinator golden.
- **New locks:** phase-crossing continuity (no restart / no reseek / no local start on AM across the
  boundary), reusing the mock coordinator + `amT()` continuity check.
- Then the `🎵` icon renders in preCook too (Stage 1's panel, now with a live queue across phases).

---

## Stage 3 — SCAFFOLDING BUILT (DARK behind `FLAG_TIMER_ALARM=false`) · C (the blocking timer alarm)

**Built this pass, inert until the founder's locked-phone battery passes:**
- `ios/App/App/ChoppdNotify.swift` — the `UNUserNotificationCenter` timing authority: `requestPermission`,
  `checkPermission`, `scheduleChain({id,firstDelaySec,count,gapSec,title,body})`, `cancel({id})` (prefix
  match → no leaks), `cancelAll`, `pending()` (the leak-assert's eyes). Registered in
  `MainViewController.capacitorDidLoad` (local plugin, no pod); pbxproj F1/F2. The 2.5.4 fence is commented
  in the source.
- `ChoppdAudio.playAlarmLoop` / `stopAlarmLoop` — the looping alarm under **`.playback`** (mute-switch
  audible; `numberOfLoops = -1`; bundle `alarm.caf`). §C4 commented.
- JS `TimerAlarm` (app.js) — `arm(id,durationSec,opts)` (schedule chain + ask permission at first arm),
  `cancel`, `fire(opts,onDismiss)` (the blocking overlay + looping audio; dark → falls through to the
  caller's normal flow), `dismiss()` (the ONE way out — advances, never auto). Overlay = `.ta-*` in
  styles.css (dark scrim, animated 🔔, orange dismiss+advance). Screenshotted at 390px.
- **Still to wire when the flag flips:** the 5 timer-fire sites call `TimerAlarm.arm()`/`.fire()`, and
  music pause-on-fire / resume-on-dismiss route through the single resume owner. NOT wired yet (dark).

**REMAINS THE FOUNDER'S DEVICE BATTERY (nothing ships true until it passes):** the chain fires on time on a
LOCKED phone, fires with music PAUSED before lock (the suspension case), audible with the MUTE switch on,
the arm/cancel bookkeeping leaves `pending()` at baseline (no leaked chains), and the background-audio
finding (C6) tested empirically.

### Architecture reference — TIMING AUTHORITY = LOCAL NOTIFICATIONS

**C0 — the load-bearing fact:** iOS suspends the WKWebView's JS shortly after background/lock, so a JS
`setTimeout` will **not** fire at zero on a locked phone — it fires late on unlock. Therefore JS timers are
the **display**, never the authority.

**Auto-advance inventory (C3):** every place a step timer reaches zero today calls `Alarm.start(...)` =
**ring-until-dismissed** — advancing always needs a tap (`Alarm.dismiss()` + advance). **ZERO sites
auto-advance on a timer fire.** The step-timer-fire sites that will get the blocking alarm (count = **5**):
`app.js` guided-cook suggested-time (~5274), preCook step timer (~6304), grill preheat (~6338), preCook gate
timer (~6407), cook come-back timer (~6677). The blocking alarm preserves the no-auto-advance contract.

**Architecture:**
1. **Timing authority = a native `ChoppdNotify` plugin** (`UNUserNotificationCenter`). When a step timer is
   ARMED, schedule a local notification for `now + duration` — fires on time in every app state (fg, bg,
   locked, terminated). Cancel the chain when the timer is dismissed, the step advances early, or the cook
   exits. JS keeps the countdown as the display only.
2. **Lock-screen persistence = a chain** (custom sounds cap ~30 s and cannot loop): schedule ~**8**
   notifications ~**30 s** apart per alarm; cancel them all the moment the app opens or the user dismisses.
   iOS caps **64 pending**/app; one active timer → 8/chain is safe. **Lock the arm/cancel bookkeeping so
   pending notifications never leak.**
3. **Foreground (screen on, app open) = the full blocking alert:** dark sheet, orange primary, Choppd color
   system, step-context strings (DRAFT-PENDING-VOICE-REVIEW), a **single** dismiss+advance button, with
   **looping** alarm audio through the native ChoppdAudio path until dismiss. Music pauses on fire, resumes
   on dismiss. Never auto-advances.
4. **Session config — the one line that decides everything:** the alarm clip plays under **`.playback`** so
   it sounds **with the mute switch ON** (`.ambient` would silently fail for every muted user). Volume =
   full app volume; the phone's media slider is the ceiling — **persistence is the lever, don't fight the
   cap.**
5. **Unlock landing:** tapping the notification / unlocking lands on the blocking overlay (looping audio +
   dismiss). The notification is the doorbell; the overlay is the alarm.
6. **Background-audio finding (optimization, NOT foundation):** because music holds an active playback
   session, the app *may* keep running while locked, and a native-side timer could start the looping clip
   on time even before unlock. **TEST empirically on device** (iOS version × minutes locked × music-playing
   vs paused) and report as a finding; if it holds, layer it OVER the notification chain. **Never assume it.**
7. **Permission:** request notification permission at the **first timer armed** (string draft). Honest
   denied-state — the foreground alarm still works; the lock-screen doorbell needs permission, say so in the UI.
8. **⚠️ APP STORE FENCE (2.5.4):** background audio must always be genuinely audible content (music, the
   alarm). **NEVER a silent audio loop to keep JS alive** — that is the exact trick Apple rejects. This must
   be commented in the code where the session lives.

**C9 — RECORD, don't build:**
- **Live Activities (ActivityKit):** a lock-screen / Dynamic-Island live countdown — the **biggest
  perceived-quality upgrade**. Needs a **WidgetKit extension** (new target). **v1.1 candidate**, not this
  feature.
- **Critical Alerts:** would pierce silent/DND, but requires a **special Apple entitlement a cooking app
  will not be granted**. **Door closed — never design around it.**

---

## Verify (each stage)
Full suite + the stage's new locks green · music phase byte-identical (proven by the coordinator goldens) ·
web reference checked (if web auto-advances today, that's a deliberate cross-platform change — implement
both and say so; today web also rings-until-dismissed, so no divergence) · Stage 3 adds **sim screenshots
of the alarm sheet at 390px** + the device battery (locked-phone chain fires on time, mute-switch audible,
music pauses/resumes).
