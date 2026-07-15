//
//  DuckTest.swift — iOS system-ducking test harness (dev-only)
//
//  Spec: docs/design/ (Choppd iOS System-Ducking Test Harness). Answers, on a REAL DEVICE, whether
//  activating a native AVAudioSession with .duckOthers ducks the WebView's YouTube music while an AI
//  voice cue plays — and to what level. This is NOT a feature; it exists to get a by-ear + measured
//  answer before deciding system-duck vs. hosted-audio.
//
//  EXCLUSION: the ENTIRE plugin is wrapped in `#if DEBUG`. A Release/Archive build compiles this file
//  to nothing → the DuckTest plugin is never registered → the bridge has no receiver. Combined with
//  the JS side (gated behind FLAG_DUCK_TEST, false in shipped bundles) this can never ride to a
//  reviewer. Prove it: the Release plugin manifest contains no "DuckTest" (see the deploy check).
//
//  The production music path and the Web-Audio voice path are UNTOUCHED — this is an isolated plugin.
//
#if DEBUG
import Foundation
import Capacitor
import AVFoundation

@objc(DuckTest)
public class DuckTest: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "DuckTest"
    public let jsName = "DuckTest"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "configureSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "activate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deactivate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "playVoice", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startControlMusic", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopControlMusic", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "effectiveSession", returnType: CAPPluginReturnPromise),
    ]

    private let t0 = Date()
    private var voicePlayer: AVAudioPlayer?

    // Control-case music: a native AVAudioEngine so we can TAP the output and measure RMS/dB — the
    // measurable baseline (a null WebView result is uninterpretable without it).
    private var engine: AVAudioEngine?
    private var controlPlayerNode: AVAudioPlayerNode?
    private var controlBuffer: AVAudioPCMBuffer?
    private var lastRmsEmit = Date(timeIntervalSince1970: 0)

    // ── helpers ────────────────────────────────────────────────────────────────
    private func ts() -> Double { return Date().timeIntervalSince(t0) * 1000.0 }   // ms since plugin load

    private func log(_ msg: String) {
        let line = String(format: "t=%.0f %@", ts(), msg)
        NSLog("[DuckTest] %@", line)
        DispatchQueue.main.async { self.notifyListeners("log", data: ["line": line, "t": self.ts()]) }
    }

    private func effectiveString() -> String {
        let s = AVAudioSession.sharedInstance()
        var opts: [String] = []
        let o = s.categoryOptions
        if o.contains(.duckOthers) { opts.append("duckOthers") }
        if o.contains(.mixWithOthers) { opts.append("mixWithOthers") }
        if o.contains(.interruptSpokenAudioAndMixWithOthers) { opts.append("interruptSpokenAudioAndMixWithOthers") }
        if o.contains(.allowBluetooth) { opts.append("allowBluetooth") }
        return "category=\(s.category.rawValue) mode=\(s.mode.rawValue) options=[\(opts.joined(separator: ","))]"
    }

    // ── §3 configureSession(category, mode, options) ─────────────────────────────
    @objc func configureSession(_ call: CAPPluginCall) {
        let categoryStr = call.getString("category") ?? "playback"
        let modeStr = call.getString("mode") ?? "voicePrompt"
        let optionStrs = call.getArray("options", String.self) ?? ["duckOthers"]

        let category: AVAudioSession.Category = (categoryStr == "playAndRecord") ? .playAndRecord : .playback
        let mode: AVAudioSession.Mode = {
            switch modeStr {
            case "voicePrompt": return .voicePrompt
            case "spokenAudio": return .spokenAudio
            default: return .default
            }
        }()
        var options: AVAudioSession.CategoryOptions = []
        for o in optionStrs {
            switch o {
            case "duckOthers": options.insert(.duckOthers)
            case "mixWithOthers": options.insert(.mixWithOthers)
            case "interruptSpokenAudioAndMixWithOthers": options.insert(.interruptSpokenAudioAndMixWithOthers)
            case "allowBluetooth": options.insert(.allowBluetooth)
            default: break
            }
        }
        do {
            try AVAudioSession.sharedInstance().setCategory(category, mode: mode, options: options)
            // WATCH-OUT (§3): log the EFFECTIVE category right after setting — another plugin can
            // overwrite the shared session. If effective != requested, that's the confound.
            log("configureSession requested category=\(categoryStr) mode=\(modeStr) options=\(optionStrs) → EFFECTIVE \(effectiveString())")
            call.resolve(["ok": true, "effective": effectiveString()])
        } catch {
            log("configureSession FAILED \(error.localizedDescription)")
            call.reject("configureSession failed: \(error.localizedDescription)")
        }
    }

    // ── §3 activate / deactivate ─────────────────────────────────────────────────
    @objc func activate(_ call: CAPPluginCall) {
        do {
            try AVAudioSession.sharedInstance().setActive(true)
            log("ACTIVATE → \(effectiveString())")   // music should begin ducking HERE (§5)
            call.resolve(["ok": true, "effective": effectiveString(), "t": ts()])
        } catch {
            log("activate FAILED \(error.localizedDescription)")
            call.reject("activate failed: \(error.localizedDescription)")
        }
    }

    @objc func deactivate(_ call: CAPPluginCall) {
        do {
            try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
            log("DEACTIVATE(.notifyOthersOnDeactivation) → music should recover")
            call.resolve(["ok": true, "t": ts()])
        } catch {
            log("deactivate FAILED \(error.localizedDescription)")
            call.reject("deactivate failed: \(error.localizedDescription)")
        }
    }

    // ── §3 playVoice({ base64, volume }) — NATIVE player (required: session ducking never fires from
    // WebView-played audio). Fires voiceStart/voiceEnd events with timestamps. ─────────────────────
    @objc func playVoice(_ call: CAPPluginCall) {
        let volume = Float(call.getDouble("volume") ?? 1.0)
        guard let b64 = call.getString("base64"), let data = Data(base64Encoded: b64) else {
            call.reject("playVoice needs base64 audio"); return
        }
        do {
            let p = try AVAudioPlayer(data: data)
            p.volume = volume
            p.delegate = self
            p.prepareToPlay()
            self.voicePlayer = p
            let ok = p.play()
            log("VOICE start vol=\(volume) dur=\(String(format: "%.2f", p.duration))s ok=\(ok)")
            notifyListeners("voiceStart", data: ["t": ts(), "duration": p.duration])
            call.resolve(["ok": ok, "duration": p.duration, "t": ts()])
        } catch {
            log("playVoice FAILED \(error.localizedDescription)")
            call.reject("playVoice failed: \(error.localizedDescription)")
        }
    }

    // ── §3/§7 startControlMusic({ base64 }) — native AVAudioEngine + output TAP → RMS/dB, the
    // measurable baseline. Loops the buffer so there's steady-state to duck. ────────────────────────
    @objc func startControlMusic(_ call: CAPPluginCall) {
        guard let b64 = call.getString("base64"), let data = Data(base64Encoded: b64) else {
            call.reject("startControlMusic needs base64 audio"); return
        }
        do {
            let tmp = FileManager.default.temporaryDirectory.appendingPathComponent("ducktest-control.\(call.getString("ext") ?? "mp3")")
            try data.write(to: tmp)
            let file = try AVAudioFile(forReading: tmp)
            let fmt = file.processingFormat
            let buf = AVAudioPCMBuffer(pcmFormat: fmt, frameCapacity: AVAudioFrameCount(file.length))!
            try file.read(into: buf)
            self.controlBuffer = buf

            let eng = AVAudioEngine()
            let node = AVAudioPlayerNode()
            eng.attach(node)
            eng.connect(node, to: eng.mainMixerNode, format: fmt)
            // TAP the main mixer output → compute RMS per buffer, emit dB (throttled ~4/s).
            eng.mainMixerNode.installTap(onBus: 0, bufferSize: 1024, format: eng.mainMixerNode.outputFormat(forBus: 0)) { [weak self] (buffer, _) in
                guard let self = self, let ch = buffer.floatChannelData else { return }
                let n = Int(buffer.frameLength)
                if n == 0 { return }
                var sum: Float = 0
                let data = ch[0]
                for i in 0..<n { let v = data[i]; sum += v * v }
                let rms = sqrt(sum / Float(n))
                let db = 20.0 * log10(max(rms, 1e-7))
                let now = Date()
                if now.timeIntervalSince(self.lastRmsEmit) > 0.25 {
                    self.lastRmsEmit = now
                    DispatchQueue.main.async {
                        self.notifyListeners("rms", data: ["db": Double(db), "rms": Double(rms), "t": self.ts()])
                    }
                }
            }
            try eng.start()
            node.scheduleBuffer(buf, at: nil, options: .loops, completionHandler: nil)
            node.play()
            self.engine = eng
            self.controlPlayerNode = node
            log("CONTROL music start (native engine + RMS tap)")
            call.resolve(["ok": true])
        } catch {
            log("startControlMusic FAILED \(error.localizedDescription)")
            call.reject("startControlMusic failed: \(error.localizedDescription)")
        }
    }

    @objc func stopControlMusic(_ call: CAPPluginCall) {
        engine?.mainMixerNode.removeTap(onBus: 0)
        controlPlayerNode?.stop()
        engine?.stop()
        engine = nil; controlPlayerNode = nil; controlBuffer = nil
        log("CONTROL music stop")
        call.resolve(["ok": true])
    }

    @objc func effectiveSession(_ call: CAPPluginCall) {
        call.resolve(["effective": effectiveString(), "t": ts()])
    }
}

extension DuckTest: AVAudioPlayerDelegate {
    public func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        log("VOICE end ok=\(flag)")
        DispatchQueue.main.async { self.notifyListeners("voiceEnd", data: ["t": self.ts(), "ok": flag]) }
    }
}
#endif
