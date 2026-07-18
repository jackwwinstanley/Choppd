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
        CAPPluginMethod(name: "checkPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "injectTranscript", returnType: CAPPluginReturnPromise),   // DEBUG-only sim hook (no-op in Release)
    ]

    private var recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))   // var: recreated on a 1101 wedge
    private let audioEngine = AVAudioEngine()
    // FREEZE FIX (Native Voice v2): the tap-install + audioEngine.start() are synchronous calls that can
    // block while the WebView track holds the audio pipeline. They MUST NOT run on the CAPPlugin caller
    // (main) thread. This serial queue owns them; a global-queue timebox (below) guarantees JS is never
    // left hanging even if the engine wedges — so the main thread is structurally unable to block on init.
    private let startQueue = DispatchQueue(label: "app.getchoppd.choppdspeech.start")
    private let startTimeoutSec = 3.0
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var generation = 0        // bumped on every teardown/start — a stale task's late callbacks drop (kills the 1101 flood)
    private var onDeviceFails = 0     // consecutive on-device 1101s this session
    private var forceServer = false   // after the ladder trips: SERVER recognition for the rest of the session

    private func log(_ msg: String) { NSLog("[ChoppdSpeech] %@", msg) }

    @objc func available(_ call: CAPPluginCall) {
        call.resolve(["available": recognizer?.isAvailable ?? false])
    }

    // NON-PROMPTING permission read for the Settings status panel (checkPermissions is a base CAPPlugin
    // method → public override). requestPermissions (below) is the one that prompts.
    @objc public override func checkPermissions(_ call: CAPPluginCall) {
        let speech: String
        switch SFSpeechRecognizer.authorizationStatus() {
        case .authorized: speech = "granted"
        case .denied, .restricted: speech = "denied"
        default: speech = "prompt"
        }
        let mic: String
        switch AVAudioSession.sharedInstance().recordPermission {
        case .granted: mic = "granted"
        case .denied: mic = "denied"
        default: mic = "prompt"
        }
        call.resolve(["speechRecognition": speech, "microphone": mic])
    }

    // Live status for the self-diagnosing Settings row: which engine is active + availability.
    @objc func status(_ call: CAPPluginCall) {
        call.resolve([
            "engine": forceServer ? "server" : "on-device",
            "available": recognizer?.isAvailable ?? false,
            "onDeviceFails": onDeviceFails,
        ])
    }

    // One grant covers mic + speech. Returns {speechRecognition, microphone} — the shape VoiceCtrl reads.
    // requestPermissions is a base CAPPlugin method (@objc open) → this must be `public override` (the
    // class is public, so the override must be as accessible). ChoppdAudio/ChoppdMusic don't hit this
    // because they never declare a permissions method. Still listed in pluginMethods (Capacitor convention).
    @objc public override func requestPermissions(_ call: CAPPluginCall) {
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
    //
    // FREEZE FIX: the heavy init (tap + audioEngine.start + recognitionTask) runs on `startQueue`, NEVER
    // the main thread, under a `startTimeoutSec` timebox. Whichever fires first — success, engine throw,
    // or the timeout — answers the CAPPluginCall EXACTLY ONCE; the rest no-op. Any failure REJECTS (the JS
    // `_nativeOpen` try/catch consumes a reject → the proven touch fallback). The recognizer-unavailable
    // guard is a cheap main-thread read, so it stays synchronous.
    @objc func start(_ call: CAPPluginCall) {
        guard let rec = recognizer, rec.isAvailable else {
            call.reject("recognizer unavailable"); return
        }
        let partial = call.getBool("partialResults") ?? true
        // resolve-once: the first of {success, engine-fail, timeout} wins; the others are no-ops.
        let answerLock = NSLock()
        var answered = false
        func claim() -> Bool { answerLock.lock(); defer { answerLock.unlock() }; if answered { return false }; answered = true; return true }

        startQueue.async { [weak self] in
            guard let self = self else { return }
            self.teardown()            // end any prior session cleanly (bumps generation)
            let gen = self.generation  // THIS window's id — the task's callbacks are ignored once it changes
            let req = SFSpeechAudioBufferRecognitionRequest()   // SINGLE-USE — a fresh request+task EVERY window
            req.shouldReportPartialResults = partial
            if #available(iOS 13.0, *), rec.supportsOnDeviceRecognition, !self.forceServer {
                req.requiresOnDeviceRecognition = true          // on-device preferred until the 1101 ladder forces server
            }
            self.request = req
            let input = self.audioEngine.inputNode
            let fmt = input.outputFormat(forBus: 0)
            input.installTap(onBus: 0, bufferSize: 1024, format: fmt) { [weak self] buffer, _ in
                self?.request?.append(buffer)
            }
            self.audioEngine.prepare()
            do {
                try self.audioEngine.start()
            } catch {
                self.log("start FAILED (engine): \(error)")
                self.teardown()
                if claim() { call.reject("audioEngine start failed: \(error.localizedDescription)") }
                return
            }
            let onDevice = req.requiresOnDeviceRecognition
            self.log("start gen=\(gen) engine=\(onDevice ? "on-device" : "server")")
            self.notifyListeners("listeningState", data: ["status": "started", "onDevice": onDevice])
            self.task = rec.recognitionTask(with: req) { [weak self] result, error in
                guard let self = self, gen == self.generation else { return }   // stale task → DROP (no "Ignoring subsequent" flood)
                if let result = result {
                    self.notifyListeners("partialResults", data: ["matches": [result.bestTranscription.formattedString]])
                    if result.isFinal { self.finishSession(gen, "final") }
                }
                if let error = error {
                    let ns = error as NSError
                    let is1101 = (ns.code == 1101) || "\(error)".contains("1101")   // the local-service wedge (device AND sim)
                    if is1101 && onDevice { self.handle1101() }
                    self.notifyListeners("error", data: ["message": "\(error)"])
                    self.finishSession(gen, "error")
                }
            }
            if claim() { call.resolve(["ok": true]) }
        }

        // TIMEBOX — on the GLOBAL queue (NOT startQueue: a timeout scheduled behind a wedged serial task
        // would never fire). If init hasn't answered in `startTimeoutSec`, report unavailable + tear down;
        // JS reads the reject and falls back to touch. The main thread has already returned — it never waits.
        DispatchQueue.global().asyncAfter(deadline: .now() + startTimeoutSec) { [weak self] in
            if claim() {
                self?.log("start TIMEOUT (>\(self?.startTimeoutSec ?? 3)s) → unavailable; tearing down")
                self?.startQueue.async { self?.teardown() }
                call.reject("timeout")
            }
        }
    }

    private func finishSession(_ gen: Int, _ reason: String) {
        guard gen == self.generation else { return }
        teardown()
        notifyListeners("listeningState", data: ["status": "stopped", "reason": reason])
    }

    // 1101 DEGRADATION LADDER — voice DEGRADES, never dies. 1st 1101 → recreate the SFSpeechRecognizer (a
    // fresh instance clears a wedged local service). 2nd+ → force SERVER recognition for the rest of the
    // session (the spec permits network fallback). JS's storm guard limits the reopen rate; this makes the
    // reopens land on a healthy engine instead of re-wedging.
    private func handle1101() {
        onDeviceFails += 1
        if onDeviceFails == 1 {
            log("1101 #1 → recreating SFSpeechRecognizer")
            recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
        } else {
            forceServer = true
            log("1101 #\(onDeviceFails) → SERVER recognition for the session")
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        teardown()
        notifyListeners("listeningState", data: ["status": "stopped"])
        call.resolve(["ok": true])
    }

    // TEARDOWN ORDER (the flood fix): bump generation FIRST so any in-flight task's late callbacks drop,
    // THEN cancel the task, end the request's audio, remove the tap, stop the engine — in that order. A
    // dead task must never keep erroring.
    private func teardown() {
        generation += 1
        task?.cancel()
        request?.endAudio()
        if audioEngine.isRunning {
            audioEngine.inputNode.removeTap(onBus: 0)
            audioEngine.stop()
        }
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
