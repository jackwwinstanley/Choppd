//
//  ChoppdMusic.swift — native Apple Music playback for the AM PILOT (§2).  ⚠️ READY, NOT YET WIRED.
//
//  STATUS: written for key-ready day. NOT added to the Xcode target / NOT registered yet — it is not
//  compiled into the current build (which ships the §0 local-spine fix to the founder's device). On
//  key-ready day: (1) add MusicKit capability + NSAppleMusicUsageDescription to the App target, (2) add
//  this file to project.pbxproj (4 entries, same as ChoppdAudio/DuckTest), (3) register it in
//  MainViewController.capacitorDidLoad via `bridge?.registerPluginInstance(ChoppdMusic())`, (4) bump the
//  iOS deployment target to 16.0 if lower. See docs/design/apple-music-pilot.md + the key-ready checklist.
//
//  Wraps MusicKit's ApplicationMusicPlayer — app-scoped queue (never hijacks the system Music queue),
//  exposes playbackTime, backgrounds with the audio entitlement. The JS seam is window.AppleMusic_
//  (applemusic.js); catalog SEARCH is REST (server-minted token), so this plugin does PLAYBACK only:
//  authorize + subscription check, queue by catalog id, play/pause/seek/stop, and playbackTime/state
//  events. RATIFIED FENCE: AM is ambient on the cook clock — JS never slaves songPos to playbackTime.
//  Ducking under the voice is the SAME ChoppdAudio .duckOthers session (system duck reaches AM audio;
//  verify via the DuckTest AM-1 row).
//
import Foundation
import Capacitor
#if canImport(MusicKit)
import MusicKit
#endif

@objc(ChoppdMusic)
public class ChoppdMusic: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ChoppdMusic"
    public let jsName = "ChoppdMusic"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "authorize", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "queue", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "play", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pause", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "seek", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
    ]

    private var stateTimer: Timer?

    // authorize → MusicKit permission + subscription capability. Any failure resolves (not rejects) with
    // authorized/subscribed=false so JS falls back to the local spine silently-seamlessly (never an error
    // the user must resolve). NO paywall gates this — AM is free to subscribers (MusicKit no-charge rule).
    @objc func authorize(_ call: CAPPluginCall) {
        #if canImport(MusicKit)
        if #available(iOS 16.0, *) {
            Task {
                let status = await MusicAuthorization.request()
                var subscribed = false
                if status == .authorized {
                    if let sub = try? await MusicSubscription.current { subscribed = sub.canPlayCatalogContent }
                }
                call.resolve([
                    "authorized": status == .authorized,
                    "subscribed": subscribed,
                    "storefront": "us",   // catalog search is storefront-scoped; refine via MusicDataRequest later
                ])
            }
            return
        }
        #endif
        call.resolve(["authorized": false, "subscribed": false])   // pre-iOS-16 / MusicKit unavailable → local spine
    }

    // queue(ids) → resolve the catalog songs and set the app player's queue (does NOT auto-play).
    @objc func queue(_ call: CAPPluginCall) {
        let ids = call.getArray("ids", String.self) ?? []
        #if canImport(MusicKit)
        if #available(iOS 16.0, *) {
            Task {
                do {
                    let itemIDs = ids.map { MusicItemID($0) }
                    var req = MusicCatalogResourceRequest<Song>(matching: \.id, memberOf: itemIDs)
                    req.limit = 25
                    let response = try await req.response()
                    ApplicationMusicPlayer.shared.queue = ApplicationMusicPlayer.Queue(for: response.items)
                    call.resolve(["ok": true, "count": response.items.count])
                } catch {
                    call.resolve(["ok": false, "error": error.localizedDescription])   // never break the cook
                }
            }
            return
        }
        #endif
        call.resolve(["ok": false])
    }

    @objc func play(_ call: CAPPluginCall) {
        #if canImport(MusicKit)
        if #available(iOS 16.0, *) {
            Task {
                do { try await ApplicationMusicPlayer.shared.play(); startStateTimer(); call.resolve(["ok": true]) }
                catch { call.resolve(["ok": false, "error": error.localizedDescription]) }
            }
            return
        }
        #endif
        call.resolve(["ok": false])
    }

    @objc func pause(_ call: CAPPluginCall) {
        #if canImport(MusicKit)
        if #available(iOS 16.0, *) { ApplicationMusicPlayer.shared.pause(); pushState("paused"); call.resolve(["ok": true]); return }
        #endif
        call.resolve(["ok": false])
    }

    @objc func seek(_ call: CAPPluginCall) {
        let t = call.getDouble("time") ?? 0
        #if canImport(MusicKit)
        if #available(iOS 16.0, *) { ApplicationMusicPlayer.shared.playbackTime = t; pushState("seek"); call.resolve(["ok": true]); return }
        #endif
        call.resolve(["ok": false])
    }

    @objc func stop(_ call: CAPPluginCall) {
        #if canImport(MusicKit)
        if #available(iOS 16.0, *) { ApplicationMusicPlayer.shared.stop(); stopStateTimer(); pushState("stopped"); call.resolve(["ok": true]); return }
        #endif
        call.resolve(["ok": false])
    }

    // playbackTime pushed ~4×/sec while playing — READ-ONLY for JS (now-playing/attribution + drift
    // checks); JS must NOT drive songPos off it (the sync fence). Mirrors the YT bridge's time push.
    private func startStateTimer() {
        stopStateTimer()
        DispatchQueue.main.async {
            self.stateTimer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in
                self?.pushState("playing")
            }
        }
    }
    private func stopStateTimer() { stateTimer?.invalidate(); stateTimer = nil }
    private func pushState(_ status: String) {
        #if canImport(MusicKit)
        if #available(iOS 16.0, *) {
            notifyListeners("state", data: ["status": status, "pos": ApplicationMusicPlayer.shared.playbackTime])
            return
        }
        #endif
        notifyListeners("state", data: ["status": status, "pos": 0])
    }
}
