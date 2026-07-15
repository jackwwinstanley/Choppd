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
        #if DEBUG
        bridge?.registerPluginInstance(DuckTest())
        #endif
    }
}
