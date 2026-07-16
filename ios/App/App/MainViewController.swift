//
//  MainViewController.swift
//
//  Capacitor 7 discovers native plugins from the GENERATED capacitor.config.json's `packageClassList`
//  (pod plugins from node_modules only) — NOT the ObjC runtime. A LOCAL, app-target plugin like the
//  dev-only DuckTest is never in that list, so `registerPlugins()` never loads it. The documented fix
//  is to register local plugins explicitly in `capacitorDidLoad()` (called right after the bridge
//  loads). Main.storyboard's root view controller is set to this subclass.
//
//  DEV-ONLY & PROD-SAFE: the DuckTest registration is `#if DEBUG`, and DuckTest itself is `#if DEBUG`
//  (absent from Release). In a Release build this VC ships with an empty `capacitorDidLoad()` and no
//  DuckTest reference at all — nothing to strip, nothing to review.
//
import Capacitor

class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        // PRODUCTION: ChoppdAudio is the native duck/clip mechanism (local + Apple Music + after).
        bridge?.registerPluginInstance(ChoppdAudio())
        // AM PILOT: ChoppdMusic = native Apple Music playback (ApplicationMusicPlayer). Capability-gated
        // in JS (AM_PILOT + AppleMusic_.capable()); registering it is what makes capable() true on device.
        bridge?.registerPluginInstance(ChoppdMusic())
        // NATIVE VOICE v2: ChoppdSpeech = native checkpoint-window recognition (SFSpeechRecognizer). Its
        // session windows go through ChoppdAudio.setMode (the coordinator) — it never touches the session.
        bridge?.registerPluginInstance(ChoppdSpeech())
        // STAGE 3 (DARK): ChoppdNotify = local-notification timing authority for the blocking step-timer
        // alarm. Inert until FLAG_TIMER_ALARM flips true in JS + the founder's locked-phone battery passes.
        bridge?.registerPluginInstance(ChoppdNotify())
        #if DEBUG
        // DEV-ONLY: the iOS system-ducking test harness.
        bridge?.registerPluginInstance(DuckTest())
        #endif
    }
}
