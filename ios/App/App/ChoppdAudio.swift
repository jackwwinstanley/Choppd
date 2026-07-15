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
    ]

    private var player: AVAudioPlayer?
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

    // Activate → duck config ON, then activate. The cook's music (WebView local track / Apple Music)
    // ducks to the system floor for the clip.
    @objc func activate(_ call: CAPPluginCall) {
        do {
            try configureDuck()
            try AVAudioSession.sharedInstance().setActive(true)
            call.resolve(["ok": true])
        } catch { call.reject("activate failed: \(error.localizedDescription)") }
    }

    // Deactivate → release the session AND drop the duck config back to neutral so the WebView track
    // recovers to full. .notifyOthersOnDeactivation so other sessions ramp back.
    @objc func deactivate(_ call: CAPPluginCall) {
        do {
            try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
            configureNeutral()
            call.resolve(["ok": true])
        } catch {
            // A deactivate that throws must never break the cook — still drop to neutral, still resolve.
            configureNeutral()
            call.resolve(["ok": false, "error": error.localizedDescription])
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
        let s = AVAudioSession.sharedInstance()
        do {
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
            call.resolve(["ok": true, "mode": mode])
        } catch {
            call.resolve(["ok": false, "mode": mode, "error": error.localizedDescription])
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
