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
    ]

    private var player: AVAudioPlayer?
    private var configured = false
    private var currentToken = 0   // the token of the clip currently playing — echoed on clipEnd so JS can ignore a superseded clip's end (mirrors the web _playToken guard)

    // .playback + [.duckOthers] + .voicePrompt — the recorded, founder-accepted config. Idempotent.
    private func ensureConfigured() throws {
        if configured { return }
        try AVAudioSession.sharedInstance().setCategory(.playback, mode: .voicePrompt, options: [.duckOthers])
        configured = true
    }

    @objc func configure(_ call: CAPPluginCall) {
        do { try ensureConfigured(); call.resolve(["ok": true]) }
        catch { call.reject("configure failed: \(error.localizedDescription)") }
    }

    // Activate → the cook's music (WebView local track / Apple Music) ducks to the system floor.
    @objc func activate(_ call: CAPPluginCall) {
        do {
            try ensureConfigured()
            try AVAudioSession.sharedInstance().setActive(true)
            call.resolve(["ok": true])
        } catch { call.reject("activate failed: \(error.localizedDescription)") }
    }

    // Deactivate → the music recovers. .notifyOthersOnDeactivation so the other session ramps back.
    @objc func deactivate(_ call: CAPPluginCall) {
        do {
            try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
            call.resolve(["ok": true])
        } catch {
            // A deactivate that throws must never break the cook — the music recovers on its own.
            call.resolve(["ok": false, "error": error.localizedDescription])
        }
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
