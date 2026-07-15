//
//  ChoppdSpeech.swift — native checkpoint-window speech (Native Voice v2, §3). ⚠️ compile-on-device.
//
//  SFSpeechRecognizer + AVAudioEngine input tap. The THIRD sibling in the proven family (ChoppdAudio /
//  ChoppdMusic / ChoppdSpeech), registered via MainViewController.capacitorDidLoad. It does the
//  RECOGNITION ONLY — it NEVER touches AVAudioSession (setCategory/setActive). The session is owned
//  entirely by ChoppdAudio's coordinator (setMode: playback / playbackDucked / listen); JS transitions
//  to `listen` BEFORE calling start() here, so the tap installs on an already-configured record session.
//  That single-owner rule is what killed v1's session fights.
//
//  JS contract (byte-for-byte the existing VoiceCtrl native backend): available() · requestPermissions()
//  · start({language,partialResults}) · stop(). Events: partialResults {matches:[String]} ·
//  listeningState {status} · error {message}. The grammar (next/back/repeat + fillers) stays in JS
//  matchVoiceCommand — web parity by construction.
//
//  Dark behind NATIVE_VOICE_V2 in JS until the founder's device battery passes.
//
import Foundation
import Capacitor
import AVFoundation
import Speech

@objc(ChoppdSpeech)
public class ChoppdSpeech: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ChoppdSpeech"
    public let jsName = "ChoppdSpeech"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "available", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "injectTranscript", returnType: CAPPluginReturnPromise),   // DEBUG-only sim hook (no-op in Release)
    ]

    private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    private let audioEngine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?

    private func log(_ msg: String) { NSLog("[ChoppdSpeech] %@", msg) }

    @objc func available(_ call: CAPPluginCall) {
        call.resolve(["available": recognizer?.isAvailable ?? false])
    }

    // One grant covers mic + speech. Returns {speechRecognition, microphone} — the shape VoiceCtrl reads.
    @objc func requestPermissions(_ call: CAPPluginCall) {
        SFSpeechRecognizer.requestAuthorization { auth in
            AVAudioSession.sharedInstance().requestRecordPermission { micOk in
                let sp = (auth == .authorized) ? "granted" : "denied"
                let mic = micOk ? "granted" : "denied"
                self.log("permissions speech=\(sp) mic=\(mic)")
                call.resolve(["speechRecognition": sp, "microphone": mic])
            }
        }
    }

    // start(): the session is ALREADY in listen mode (ChoppdAudio coordinator). Install the input tap +
    // start recognition. On-device preferred (network fallback permitted — log which engaged).
    @objc func start(_ call: CAPPluginCall) {
        guard let recognizer = recognizer, recognizer.isAvailable else {
            call.reject("recognizer unavailable"); return
        }
        teardown()   // one live session at a time
        let req = SFSpeechAudioBufferRecognitionRequest()
        req.shouldReportPartialResults = call.getBool("partialResults") ?? true
        if #available(iOS 13.0, *), recognizer.supportsOnDeviceRecognition {
            req.requiresOnDeviceRecognition = true
        }
        self.request = req
        let input = audioEngine.inputNode
        let fmt = input.outputFormat(forBus: 0)
        input.installTap(onBus: 0, bufferSize: 1024, format: fmt) { [weak self] buffer, _ in
            self?.request?.append(buffer)
        }
        audioEngine.prepare()
        do {
            try audioEngine.start()
        } catch {
            log("start FAILED (engine): \(error)")
            teardown()
            call.reject("audioEngine start failed: \(error.localizedDescription)"); return
        }
        let onDevice = (recognizer.supportsOnDeviceRecognition && req.requiresOnDeviceRecognition)
        log("start onDevice=\(onDevice)")
        notifyListeners("listeningState", data: ["status": "started", "onDevice": onDevice])
        self.task = recognizer.recognitionTask(with: req) { [weak self] result, error in
            guard let self = self else { return }
            if let result = result {
                let t = result.bestTranscription.formattedString
                self.notifyListeners("partialResults", data: ["matches": [t]])
                if result.isFinal {
                    self.teardown()
                    self.notifyListeners("listeningState", data: ["status": "stopped"])
                }
            }
            if let error = error {
                self.notifyListeners("error", data: ["message": "\(error)"])
                self.teardown()
                self.notifyListeners("listeningState", data: ["status": "stopped"])
            }
        }
        call.resolve(["ok": true])
    }

    @objc func stop(_ call: CAPPluginCall) {
        teardown()
        notifyListeners("listeningState", data: ["status": "stopped"])
        call.resolve(["ok": true])
    }

    private func teardown() {
        if audioEngine.isRunning {
            audioEngine.inputNode.removeTap(onBus: 0)
            audioEngine.stop()
        }
        request?.endAudio()
        task?.cancel()
        request = nil
        task = nil
    }

    // DEBUG-only: the sim has no speech service (error 1101), so a transcript-injection hook drives
    // matchVoiceCommand end-to-end through the SAME partialResults event the real recognizer emits.
    @objc func injectTranscript(_ call: CAPPluginCall) {
        #if DEBUG
        let t = call.getString("transcript") ?? ""
        log("injectTranscript(\(t))")
        notifyListeners("partialResults", data: ["matches": [t]])
        call.resolve(["ok": true])
        #else
        call.resolve(["ok": false, "error": "release"])
        #endif
    }
}
