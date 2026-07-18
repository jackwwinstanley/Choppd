//
//  ChoppdAudio.swift — production native audio-ducking + clip playback (source-agnostic).
//
//  THE mechanism for ducking the cook's music under a voice cue, on native, for EVERY source:
//  local/hosted tracks (the TestFlight spine), Apple Music (later), anything after. It owns the
//  shared AVAudioSession (.playback + [.duckOthers] + .voicePrompt — the DuckTest-recorded values,
//  founder-accepted fixed level) and plays the Kokoro cue clip via a NATIVE AVAudioPlayer — native
//  routing is REQUIRED, because iOS system ducking never fires from WebView-played audio (the
//  DuckTest lesson). Activating the session ducks whatever else is playing (the WebView local track,
//  or Apple Music); deactivating with .notifyOthersOnDeactivation restores it.
//
//  Registered explicitly via MainViewController.capacitorDidLoad (Capacitor 7 only auto-loads pod
//  plugins from packageClassList — an app-target plugin must be registered by hand). PRODUCTION:
//  NOT #if DEBUG. Behavior is gated on the JS side by a dark flag until the founder's ears pass.
//
import Foundation
import Capacitor
import AVFoundation
import UIKit

@objc(ChoppdAudio)
public class ChoppdAudio: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ChoppdAudio"
    public let jsName = "ChoppdAudio"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "configure", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "activate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deactivate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "playClip", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopClip", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "sessionState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setMode", returnType: CAPPluginReturnPromise),   // Native Voice v2 coordinator
        CAPPluginMethod(name: "playAlarmLoop", returnType: CAPPluginReturnPromise),   // Stage 3: looping timer alarm (immediate — foreground fire)
        CAPPluginMethod(name: "armAlarmLoop", returnType: CAPPluginReturnPromise),    // C6: schedule the ring at now+delaySec (fires while LOCKED if the session's alive)
        CAPPluginMethod(name: "stopAlarmLoop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "beep", returnType: CAPPluginReturnPromise),           // Stage 2 fix B: SFX audible over AM
    ]

    private var player: AVAudioPlayer?
    private var alarmPlayer: AVAudioPlayer?   // Stage 3: separate looping player for the blocking timer alarm
    private var alarmArmWork: DispatchWorkItem?   // C6: the scheduled "start the ring at zero" work item (fires while locked because background audio keeps the app un-suspended); cancelled by stopAlarmLoop
    // Stage 2 fix B (beep). GUN 2 autopsy: a PERSISTENT engine kept the AVAudioSession active, so the next
    // voice clip's deactivate (setActive(false)) FAILED → the session was left dirty → the following clip
    // activate INTERRUPTED Apple Music instead of ducking. So the beep engine is created + FULLY torn down
    // per tone (retained here only during playback) — nothing lingers to hold the session.
    private var toneNodes: [(AVAudioEngine, AVAudioPlayerNode)] = []
    private var currentToken = 0   // the token of the clip currently playing — echoed on clipEnd so JS can ignore a superseded clip's end (mirrors the web _playToken guard)

    // §0 RELEASE FIX — the shared AVAudioSession must NOT sit in the ducking config between clips. The
    // old ensureConfigured() set `.playback + .voicePrompt + [.duckOthers]` ONCE and left it — so the
    // WebView's own local track (the launch spine) played the WHOLE cook under a voice-prompt/duck
    // session and read "generally quiet" (founder ears). Now the config is NON-STICKY:
    //   • configureDuck()   — set on activate (the founder-accepted DuckTest level, for the clip only).
    //   • configureNeutral() — reset on deactivate → plain `.playback`, no duck/voicePrompt, so the
    //     WebView track returns to FULL between clips. The duck LEVEL during a clip is unchanged.
    private func configureDuck() throws {
        try AVAudioSession.sharedInstance().setCategory(.playback, mode: .voicePrompt, options: [.duckOthers])
    }
    private func configureNeutral() {
        // never throws into the cook — a failed reset just leaves the previous (duck) category, which
        // the next activate/deactivate corrects; the music still recovers via the JS kick().
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [])
    }

    @objc func configure(_ call: CAPPluginCall) {
        do { try configureDuck(); configureNeutral(); call.resolve(["ok": true]) }   // prove both transitions work at boot; leaves the session neutral
        catch { call.reject("configure failed: \(error.localizedDescription)") }
    }

    // GUN 2 fix: activate/deactivate run on ONE serial queue so an activate can never land while the
    // previous deactivate is still in flight (that race left the session dirty → the next clip interrupted
    // Apple Music instead of ducking).
    private let sessionQueue = DispatchQueue(label: "app.getchoppd.choppdaudio.session")

    // Activate → duck config ON, then activate. The cook's music (WebView local track / Apple Music)
    // ducks (.duckOthers) to the system floor for the clip — duck, never interrupt.
    @objc func activate(_ call: CAPPluginCall) {
        sessionQueue.async {
            do {
                try self.configureDuck()
                try AVAudioSession.sharedInstance().setActive(true)
                call.resolve(["ok": true])
            } catch { NSLog("[ChoppdAudio] activate failed: %@", error.localizedDescription); call.resolve(["ok": false, "error": error.localizedDescription]) }
        }
    }

    // Deactivate → release the session AND drop the duck config back to neutral so the WebView track
    // recovers to full. .notifyOthersOnDeactivation so other sessions ramp back. GUN 2: a failed deactivate
    // must be RETRIED, never swallowed — a swallowed failure leaves the session dirty and the NEXT clip
    // interrupts Apple Music.
    @objc func deactivate(_ call: CAPPluginCall) {
        sessionQueue.async {
            var ok = false
            for attempt in 0..<3 {
                do { try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation); ok = true; break }
                catch { NSLog("[ChoppdAudio] deactivate attempt %d failed: %@", attempt, error.localizedDescription); Thread.sleep(forTimeInterval: 0.08) }   // retry, never swallow
            }
            self.configureNeutral()
            call.resolve(["ok": ok])
        }
    }

    // COORDINATOR (Native Voice v2 §3): ChoppdAudio is the ONE code that owns AVAudioSession. ChoppdSpeech
    // REQUESTS a listen window through here and never touches the session itself (the v1 killer, solved).
    //   playback       — neutral (music at full)
    //   playbackDucked — the clip/gate duck (.playback + .voicePrompt + .duckOthers — today's behavior)
    //   listen         — the §0-MEASURED record window (.playAndRecord + [.mixWithOthers, .defaultToSpeaker,
    //                    .allowBluetooth]): Outcome A — both music sources stay ALIVE (deeply attenuated)
    //                    while the mic is open. Never rejects (a failed transition must not break the cook).
    @objc func setMode(_ call: CAPPluginCall) {
        let mode = call.getString("mode") ?? "playback"
        // NATIVE VOICE v2 FREEZE FIX: the session transition — especially entering `listen`
        // (.playAndRecord + setActive) while the WebView track is playing — is a HEAVYWEIGHT
        // AVAudioSession reconfiguration that can BLOCK. It ran synchronously on the CAPPlugin
        // caller thread (the MAIN thread) → whole-app no-recovery freeze. Move it onto the SAME
        // serial sessionQueue that activate/deactivate already use, so the main thread is
        // STRUCTURALLY unable to block on the session, whatever it does. JS still `await`s the
        // resolve, so start() (called after) still sees the session already in listen mode.
        sessionQueue.async {
            let s = AVAudioSession.sharedInstance()
            // LISTEN EXIT RECOVERY (voice-teardown bug): leaving the .playAndRecord record window must
            // release it the way the VR harness's stopRecordWindow did — deactivate with
            // .notifyOthersOnDeactivation FIRST, so iOS signals the interrupted music (WebView track / Apple
            // Music) to resume. Without this the pipeline stays interrupted and the music goes silent (JS then
            // runs the kick + explicit AM resume to finish the recovery).
            let leavingRecord = (s.category == .playAndRecord && mode != "listen")
            do {
                if leavingRecord { try? s.setActive(false, options: .notifyOthersOnDeactivation) }
                switch mode {
                case "listen":
                    try s.setCategory(.playAndRecord, mode: .measurement, options: [.mixWithOthers, .defaultToSpeaker, .allowBluetooth])
                    try s.setActive(true)
                case "playbackDucked":
                    try s.setCategory(.playback, mode: .voicePrompt, options: [.duckOthers])
                    try s.setActive(true)
                default:
                    try s.setCategory(.playback, mode: .default, options: [])
                    try s.setActive(true)
                }
                call.resolve(["ok": true, "mode": mode, "recovered": leavingRecord])
            } catch {
                call.resolve(["ok": false, "mode": mode, "error": error.localizedDescription])
            }
        }
    }

    // §0 Eye instrumentation: the shared session's live config, so a device run can SEE whether the
    // WebView track sits under a duck/voicePrompt session at a mid-cue-gap (the "generally quiet" cause).
    @objc func sessionState(_ call: CAPPluginCall) {
        let s = AVAudioSession.sharedInstance()
        call.resolve([
            "category": s.category.rawValue,
            "mode": s.mode.rawValue,
            "options": s.categoryOptions.rawValue,        // bitmask; .duckOthers = 2
            "otherAudioPlaying": s.isOtherAudioPlaying,    // is anything else (incl. the WebView?) sounding
        ])
    }

    // Play a Kokoro cue clip natively (base64). Fires clipStart on play + clipEnd on finish so the JS
    // voice state machine (VoiceDuck / VoiceCtrl / _playToken) drives off the SAME events as the web
    // <audio> element. The session must already be active (JS orchestrates the runway).
    @objc func playClip(_ call: CAPPluginCall) {
        let volume = Float(call.getDouble("volume") ?? 1.0)
        let token = call.getInt("token") ?? 0
        guard let b64 = call.getString("base64"), let data = Data(base64Encoded: b64) else {
            call.reject("playClip needs base64 audio"); return
        }
        do {
            let p = try AVAudioPlayer(data: data)
            p.volume = volume
            p.delegate = self
            p.prepareToPlay()
            self.player = p
            self.currentToken = token
            let ok = p.play()
            notifyListeners("clipStart", data: ["token": token, "duration": p.duration])
            call.resolve(["ok": ok, "duration": p.duration])
        } catch { call.reject("playClip failed: \(error.localizedDescription)") }
    }

    @objc func stopClip(_ call: CAPPluginCall) {
        player?.stop(); player = nil
        call.resolve(["ok": true])
    }

    // STAGE 3 (dark) — the BLOCKING timer alarm's looping audio. §C4, the one line that decides everything:
    // the alarm plays under category .playback (NOT .ambient), so it SOUNDS WITH THE MUTE SWITCH ON —
    // .ambient would silently fail for every muted user. numberOfLoops = -1 loops until stopAlarmLoop.
    // Volume = full app volume; the phone's media slider is the ceiling — persistence is the lever, we
    // don't fight the cap. ⚠️ APP STORE 2.5.4: this is a genuinely-audible RINGING alarm, never a silent
    // keep-alive loop. Bundle a short alarm clip as `alarm.caf` in the app target (base64 also accepted).
    @objc func playAlarmLoop(_ call: CAPPluginCall) {   // IMMEDIATE — the foreground fire() path
        alarmArmWork?.cancel(); alarmArmWork = nil     // a foreground fire supersedes any scheduled ring (same player)
        do { try startAlarmLoopNow(base64: call.getString("base64")); call.resolve(["ok": true]) }
        catch { call.resolve(["ok": false, "error": "\(error.localizedDescription)"]) }
    }
    // C6 — schedule the ring at now+delaySec WITHOUT touching the session now (no continuity risk at arm-time).
    // While the cook's music plays, the app is NOT suspended on lock, so this DispatchWorkItem fires on time
    // even locked; startAlarmLoopNow then takes the session for the genuinely-audible ring. If the music has
    // stopped (app suspended), this won't fire — that's exactly why the notification chain is the backstop.
    // ⚠️ 2.5.4: nothing audible plays until the scheduled ring; the session stays alive because of the MUSIC.
    @objc func armAlarmLoop(_ call: CAPPluginCall) {
        let delay = max(0, call.getDouble("delaySec") ?? 0)
        let b64 = call.getString("base64")
        alarmArmWork?.cancel()
        let work = DispatchWorkItem { [weak self] in
            self?.alarmArmWork = nil
            NSLog("[ChoppdAudio] alarm ring: C6 native timer FIRED (app was alive at zero) — starting the loop")   // absent from a locked log ⇒ app was SUSPENDED, only the notification can ring
            do { try self?.startAlarmLoopNow(base64: b64) }
            catch { NSLog("[ChoppdAudio] alarm ring: C6 start FAILED: %@", error.localizedDescription) }
        }
        alarmArmWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: work)
        NSLog("[ChoppdAudio] armAlarmLoop scheduled in %.0fs (locked-ring; chain is the backstop)", delay)
        call.resolve(["ok": true, "delaySec": delay])
    }
    // Shared start (idempotent): if the loop is already ringing, leave it (foreground fire + the scheduled
    // ring can race at zero — never double-play). Reconfigures to .playback so it SOUNDS with the mute switch
    // on; this deliberately takes the session from the music (the alarm is now the point).
    private func startAlarmLoopNow(base64: String?) throws {
        let session = AVAudioSession.sharedInstance()
        if let a = alarmPlayer, a.isPlaying { NSLog("[ChoppdAudio] alarm ring: already playing — no-op"); return }
        let otherBefore = session.isOtherAudioPlaying
        do {
            try session.setCategory(.playback, mode: .default, options: [])
            try session.setActive(true)
            // Main Thread Checker fix: UIApplication.applicationState is main-thread-only. This runs from the
            // main-queue work item (locked ring) AND from playAlarmLoop on the plugin queue — only read it on main.
            let appState = Thread.isMainThread ? String(UIApplication.shared.applicationState.rawValue) : "off-main"
            NSLog("[ChoppdAudio] alarm ring: session ACTIVE ok, category=.playback, appState=\(appState), otherAudio before=\(otherBefore) after=\(session.isOtherAudioPlaying)")
        } catch {
            NSLog("[ChoppdAudio] alarm ring: session activation FAILED: %@ (otherAudio before=\(otherBefore))", error.localizedDescription)
            throw error
        }
        let p: AVAudioPlayer
        if let b64 = base64, let data = Data(base64Encoded: b64) {
            p = try AVAudioPlayer(data: data)
        } else if let url = Bundle.main.url(forResource: "alarm", withExtension: "caf") ?? Bundle.main.url(forResource: "alarm", withExtension: "mp3") {
            p = try AVAudioPlayer(contentsOf: url)
        } else { NSLog("[ChoppdAudio] alarm ring: NO alarm clip bundled"); throw NSError(domain: "ChoppdAudio", code: 1, userInfo: [NSLocalizedDescriptionKey: "no alarm clip bundled"]) }
        p.numberOfLoops = -1            // loop until stopAlarmLoop (custom notification sounds can't loop; this can)
        p.volume = 1.0
        p.prepareToPlay()
        self.alarmPlayer = p
        let started = p.play()
        NSLog("[ChoppdAudio] alarm ring: play()=\(started) dur=\(String(format: "%.1f", p.duration))s vol=\(p.volume)")
    }
    @objc func stopAlarmLoop(_ call: CAPPluginCall) {
        let caller = call.getString("caller") ?? "?"                 // caller-tagged: names who stopped the ring (must be a USER action, never fire-time)
        let wasRinging = alarmPlayer?.isPlaying ?? false
        let hadArmed = alarmArmWork != nil
        alarmArmWork?.cancel(); alarmArmWork = nil     // cancel a scheduled-but-not-yet-rung alarm (early advance / dismiss)
        alarmPlayer?.stop(); alarmPlayer = nil
        NSLog("[ChoppdAudio] stopAlarmLoop caller=\(caller) wasRinging=\(wasRinging) hadArmed=\(hadArmed)")
        call.resolve(["ok": true])
    }

    // STAGE 2 FIX B — SFX ARE NOT MUSIC. A short synthesized tone for the countdown / UI beeps, audible over
    // Apple Music. Deliberately DOES NOT touch the AVAudioSession category/active state — it plays on
    // whatever session is already up (the music's .playback), so it MIXES and can never interrupt AM
    // (the WebAudio path went silent precisely because no WebView audio held the session; this doesn't).
    // Ducks nothing; brief by nature. `delayMs` schedules it (the countdown fires 3·2·1·go as one call each).
    @objc func beep(_ call: CAPPluginCall) {
        let freq = call.getDouble("freq") ?? 660
        // getDouble, NOT getInt: JS numbers cross the bridge as doubles, so getInt returned nil → ?? 0 →
        // every delay collapsed to 0 → all four beeps burst at once. (autopsy: 2026-07-16-beep-killed-...)
        let ms = Int(max(20, call.getDouble("ms") ?? 200))
        let delayMs = max(0, call.getDouble("delayMs") ?? 0)
        DispatchQueue.main.asyncAfter(deadline: .now() + delayMs / 1000.0) { [weak self] in self?.playTone(freq: freq, ms: ms) }
        call.resolve(["ok": true])
    }
    private func playTone(freq: Double, ms: Int) {
        let sr = 44100.0
        guard let fmt = AVAudioFormat(standardFormatWithSampleRate: sr, channels: 1) else { return }
        // THE FIX (autopsy): AVAudioEngine.start() implicitly activates the session; activating .playback
        // WITHOUT .mixWithOthers interrupts "other audio" (the system music player = Apple Music) by default
        // — that killed AM at beep #1. Set .mixWithOthers FIRST so activation MIXES over AM and can NEVER
        // interrupt it. This is the ONLY session touch (mix, never duck, never interrupt). Log otherAudio so
        // the device confirms it stays true.
        let session = AVAudioSession.sharedInstance()
        let beforeOther = session.isOtherAudioPlaying
        do { try session.setCategory(.playback, mode: .default, options: [.mixWithOthers]); try session.setActive(true) } catch { return }
        NSLog("[ChoppdAudio] beep freq=%.0f otherAudio before=%@ after=%@", freq, beforeOther ? "true" : "false", session.isOtherAudioPlaying ? "true" : "false")
        let frames = AVAudioFrameCount(sr * Double(ms) / 1000.0)
        guard let buf = AVAudioPCMBuffer(pcmFormat: fmt, frameCapacity: frames) else { return }
        buf.frameLength = frames
        guard let ch = buf.floatChannelData?[0] else { return }
        let w = 2.0 * Double.pi * freq / sr
        let n = Int(frames), atk = Double(frames) * 0.05, rel = Double(frames) * 0.35
        for i in 0..<n {
            var a = 0.4
            if Double(i) < atk { a *= Double(i) / atk }                              // brief attack
            else if Double(i) > Double(n) - rel { a *= max(0, (Double(n) - Double(i)) / rel) }   // decay
            ch[i] = Float(sin(w * Double(i)) * a)
        }
        // Per-tone engine, torn down when the tone ends — NEVER left running (Gun 2 fix).
        let engine = AVAudioEngine(); let node = AVAudioPlayerNode()
        engine.attach(node); engine.connect(node, to: engine.mainMixerNode, format: fmt)
        do { try engine.start() } catch { return }
        toneNodes.append((engine, node))          // retain during playback
        node.scheduleBuffer(buf, at: nil, options: [], completionHandler: nil)
        node.play()
        DispatchQueue.main.asyncAfter(deadline: .now() + Double(ms) / 1000.0 + 0.15) { [weak self] in
            node.stop(); engine.stop()            // release the session hold so the next voice clip can duck/deactivate cleanly
            self?.toneNodes.removeAll { $0.0 === engine }
        }
    }
}

extension ChoppdAudio: AVAudioPlayerDelegate {
    public func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        let tk = currentToken
        DispatchQueue.main.async { self.notifyListeners("clipEnd", data: ["ok": flag, "token": tk]) }
    }
    public func audioPlayerDecodeErrorDidOccur(_ player: AVAudioPlayer, error: Error?) {
        let tk = currentToken
        DispatchQueue.main.async { self.notifyListeners("clipEnd", data: ["ok": false, "token": tk]) }
    }
}
