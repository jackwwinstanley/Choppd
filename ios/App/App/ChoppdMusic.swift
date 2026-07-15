//
//  ChoppdMusic.swift — native Apple Music playback for the AM PILOT (§2).  ⚠️ READY, NOT YET WIRED.
//
//  STATUS: written for key-ready day. NOT added to the Xcode target / NOT registered yet — it is not
//  compiled into the current build (which ships the §0 local-spine fix to the founder's device). On
//  key-ready day: (1) register MusicKit on the DEVELOPER PORTAL — App ID → Capabilities/App Services →
//  tick "MusicKit" (this is PORTAL-SIDE ONLY; there is NO "MusicKit" row in Xcode's Signing &
//  Capabilities list), then Download Manual Profiles + clean build. NSAppleMusicUsageDescription is in
//  Info.plist already. (2) add
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
        CAPPluginMethod(name: "userPlaylists", returnType: CAPPluginReturnPromise),
    ]

    private var stateTimer: Timer?

    // A1 instrumentation — every step logs natively (NSLog → Xcode console + `log` device console) AND
    // emits a `log` event so the Eye/JS sees it on a silent run. THROWN ERRORS ARE LOGGED VERBATIM.
    private func log(_ msg: String) {
        NSLog("[ChoppdMusic] %@", msg)
        notifyListeners("log", data: ["msg": msg])
    }

    // authorize → MusicKit permission + subscription capability. Any failure resolves (not rejects) with
    // authorized/subscribed=false so JS falls back to the local spine silently-seamlessly (never an error
    // the user must resolve). NO paywall gates this — AM is free to subscribers (MusicKit no-charge rule).
    @objc func authorize(_ call: CAPPluginCall) {
        #if canImport(MusicKit)
        if #available(iOS 16.0, *) {
            Task {
                let status = await MusicAuthorization.request()
                var subscribed = false
                var subErr = "n/a"
                if status == .authorized {
                    do { let sub = try await MusicSubscription.current; subscribed = sub.canPlayCatalogContent }
                    catch { subErr = "\(error)" }   // A1: verbatim subscription-check error (entitlement gaps surface here)
                }
                self.log("authorize status=\(status) subscribed=\(subscribed) subErr=\(subErr)")
                call.resolve([
                    "authorized": status == .authorized,
                    "subscribed": subscribed,
                    "storefront": "us",   // catalog search is storefront-scoped; refine via MusicDataRequest later
                ])
            }
            return
        }
        #endif
        log("authorize UNAVAILABLE (pre-iOS-16 / no MusicKit) → local spine")
        call.resolve(["authorized": false, "subscribed": false])   // pre-iOS-16 / MusicKit unavailable → local spine
    }

    // queue(ids) → resolve each pick (catalog SONG id OR library PLAYLIST id) to songs, FLATTEN in pick
    // order, set the app queue, and LOOP it (repeatMode .all — the AM queue repeats until the cook ends;
    // end-of-queue never reaches JS's fallback ladder, which is for FAILURES only). Does NOT auto-play.
    // ⚠️ MusicKit generics (the Track enum extraction, MusicLibraryRequest.filter, nextBatch pagination,
    // Queue(for: [Song])) are written to intent but UNVERIFIED here — compile on device; minor API tweaks
    // may be needed. A resolution failure resolves ok:false with the verbatim error → JS maps it + falls
    // back to local + toasts (never silence).
    @objc func queue(_ call: CAPPluginCall) {
        let ids = call.getArray("ids", String.self) ?? []
        #if canImport(MusicKit)
        if #available(iOS 16.0, *) {
            Task {
                self.log("queue: \(ids.count) pick(s), sample=\(ids.first ?? "none")")
                do {
                    var songs: [Song] = []   // flattened, in pick order
                    for id in ids {
                        let mid = MusicItemID(id)
                        // 1) catalog song?
                        if let song = try? await MusicCatalogResourceRequest<Song>(matching: \.id, memberOf: [mid]).response().items.first {
                            songs.append(song); continue
                        }
                        // 2) library playlist? → its songs IN ORDER, paginated for long playlists.
                        var lib = MusicLibraryRequest<Playlist>()
                        lib.filter(matching: \.id, equalTo: mid)
                        if let pl = try? await lib.response().items.first,
                           let full = try? await pl.with([.tracks]), var batch = full.tracks {
                            var added = 0
                            while true {
                                for t in batch { if case let .song(s) = t { songs.append(s); added += 1 } }
                                guard batch.hasNextBatch, let next = try? await batch.nextBatch() else { break }
                                batch = next
                            }
                            self.log("queue: playlist \(pl.name) → \(added) songs")
                            continue
                        }
                        self.log("queue: id \(id) resolved to nothing")
                    }
                    if songs.isEmpty {
                        self.log("queue: 0 songs resolved (bad ids / unavailable)")
                        call.resolve(["ok": false, "error": "no_catalog_songs", "count": 0]); return
                    }
                    ApplicationMusicPlayer.shared.queue = ApplicationMusicPlayer.Queue(for: songs)
                    ApplicationMusicPlayer.shared.state.repeatMode = .all   // C: LOOP until the cook ends
                    self.log("queue: SET \(songs.count) songs, repeat=all")
                    call.resolve(["ok": true, "count": songs.count])
                } catch {
                    self.log("queue FAILED verbatim: \(error)")   // A1: verbatim
                    call.resolve(["ok": false, "error": "\(error)"])   // never break the cook
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
                self.log("play() called")
                do { try await ApplicationMusicPlayer.shared.play(); self.startStateTimer(); self.log("play() OK — state=\(ApplicationMusicPlayer.shared.state.playbackStatus)"); call.resolve(["ok": true]) }
                catch { self.log("play() FAILED verbatim: \(error)"); call.resolve(["ok": false, "error": "\(error)"]) }   // A1: verbatim; JS triggers the fallback
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

    // The user's OWN library playlists (rides the same MusicKit authorization — no extra prompt).
    // NOTE (follow-up): queueing a PLAYLIST for playback needs queue() to resolve a playlist id to its
    // entries; today queue() resolves catalog SONG ids, so a picked playlist currently falls back to the
    // local track on device (silent-seamless). Songs from Search play fine. Wire playlist-resolve next.
    @objc func userPlaylists(_ call: CAPPluginCall) {
        #if canImport(MusicKit)
        if #available(iOS 16.0, *) {
            Task {
                do {
                    let req = MusicLibraryRequest<Playlist>()
                    let resp = try await req.response()
                    let items: [[String: Any]] = resp.items.prefix(50).map { ["id": $0.id.rawValue, "label": $0.name] }
                    call.resolve(["playlists": items])
                } catch { self.log("userPlaylists FAILED: \(error)"); call.resolve(["playlists": []]) }
            }
            return
        }
        #endif
        call.resolve(["playlists": []])
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
