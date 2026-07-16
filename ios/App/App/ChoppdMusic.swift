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

    // #6 DEDUPE: concurrent authorize calls (the log showed ×3 back-to-back) share ONE in-flight task.
    private var _authTask: Task<[String: Any], Never>?

    // authorize → MusicKit permission + subscription capability. Any failure resolves (not rejects) with
    // authorized/subscribed=false so JS falls back to the local spine silently-seamlessly (never an error
    // the user must resolve). NO paywall gates this — AM is free to subscribers (MusicKit no-charge rule).
    @objc func authorize(_ call: CAPPluginCall) {
        #if canImport(MusicKit)
        if #available(iOS 16.0, *) {
            let task: Task<[String: Any], Never>
            if let existing = _authTask {
                task = existing   // a request is already in flight — reuse it (dedupe the ×3)
            } else {
                task = Task { await self.doAuthorize() }
                _authTask = task
                Task { _ = await task.value; self._authTask = nil }   // clear the slot once it completes
            }
            Task { call.resolve(await task.value) }
            return
        }
        #endif
        log("authorize UNAVAILABLE (pre-iOS-16 / no MusicKit) → local spine")
        call.resolve(["authorized": false, "subscribed": false])   // pre-iOS-16 / MusicKit unavailable → local spine
    }
    @available(iOS 16.0, *)
    private func doAuthorize() async -> [String: Any] {
        let status = await MusicAuthorization.request()
        var subscribed = false
        var subErr = "n/a"
        if status == .authorized {
            do { let sub = try await MusicSubscription.current; subscribed = sub.canPlayCatalogContent }
            catch { subErr = "\(error)" }   // A1: verbatim subscription-check error (entitlement gaps surface here)
        }
        self.log("authorize status=\(status) subscribed=\(subscribed) subErr=\(subErr)")
        return ["authorized": status == .authorized, "subscribed": subscribed, "storefront": "us"]
    }

    // queue(ids) → resolve picks (catalog SONG or library PLAYLIST) and set the LOOPED app queue. The
    // device log showed this HANGING the main thread (12s + ping-did-not-pong): playlist resolution
    // (MusicLibraryRequest + .with([.tracks]) + pagination) ran on the main actor and froze the WebView.
    // FIXES: (#4) log at ENTRY, synchronously, BEFORE any Task so a hang is visible mid-story; (#1)
    // resolve OFF the main actor via Task.detached — the WKWebView bridge returns immediately; (#5) a hard
    // 10s cap so "nothing plays + freeze" is impossible — timeout → ok:false → JS maps it + toast + local;
    // (#2) a single playlist pick is queued DIRECTLY (no track extraction/pagination). ⚠️ the MusicKit
    // player APIs (direct-playlist Queue, Track-enum extraction) are UNVERIFIED here — compile on device.
    @objc func queue(_ call: CAPPluginCall) {
        let ids = call.getArray("ids", String.self) ?? []
        let shuffle = call.getBool("shuffle") ?? false
        self.log("queue: ENTER ids=\(ids.count) sample=\(ids.first ?? "none") shuffle=\(shuffle)")   // #4: SYNC, before any Task
        #if canImport(MusicKit)
        if #available(iOS 16.0, *) {
            Task.detached(priority: .userInitiated) { [weak self] in     // #1: OFF the main actor
                guard let self = self else { call.resolve(["ok": false]); return }
                let out = await self.queueWithTimeout(ids, shuffle)      // #5: 10s cap
                call.resolve(out)
            }
            return
        }
        #endif
        call.resolve(["ok": false])
    }

    @available(iOS 16.0, *)
    private func queueWithTimeout(_ ids: [String], _ shuffle: Bool) async -> [String: Any] {
        await withTaskGroup(of: [String: Any].self) { group in
            group.addTask { await self.doResolveAndQueue(ids, shuffle) }
            group.addTask {
                // JOB D: on SUCCESS the group cancels this task — Task.sleep then THROWS. The old `try?`
                // swallowed it but kept running, so "TIMEOUT" logged + fired spuriously after a good queue.
                // Now cancellation returns quietly (its result is discarded by group.next); only a real 10s
                // elapse logs + fires the timeout.
                do { try await Task.sleep(nanoseconds: 10_000_000_000) }
                catch { return ["ok": false, "error": "cancelled"] }
                self.log("queue: TIMEOUT after 10s → fallback")
                return ["ok": false, "error": "timeout"]
            }
            let first = await group.next() ?? ["ok": false, "error": "timeout"]
            group.cancelAll()
            return first
        }
    }

    @available(iOS 16.0, *)
    private func doResolveAndQueue(_ ids: [String], _ shuffle: Bool) async -> [String: Any] {
        self.log("queue: resolving \(ids.count) pick(s), shuffle=\(shuffle)…")
        do {
            // #2 SIMPLE API FIRST — a single playlist pick → queue the Playlist ENTITY directly (loops via
            // repeatMode, preserves the playlist's own order, no extraction/pagination on the hot path).
            if ids.count == 1, let pl = await self.libraryPlaylist(ids[0]) {
                try await self.applyPlaylistQueue(pl, shuffle)
                self.log("queue: playlist \(pl.name) → direct queue, repeat=all shuffle=\(shuffle)")
                return ["ok": true, "count": -1, "kind": "playlist", "shuffle": shuffle]
            }
            // else: flatten songs (+ any playlist tracks) in pick order (the extraction path).
            var songs: [Song] = []
            for id in ids {
                if let s = await self.catalogSong(id) { songs.append(s); continue }
                if let pl = await self.libraryPlaylist(id) {
                    let n = await self.appendPlaylistSongs(pl, into: &songs)
                    self.log("queue: playlist \(pl.name) → \(n) songs")
                    continue
                }
                self.log("queue: id \(id) → nothing")
            }
            if songs.isEmpty { self.log("queue: 0 songs resolved"); return ["ok": false, "error": "no_catalog_songs", "count": 0] }
            try await self.applySongQueue(songs, shuffle)
            self.log("queue: SET \(songs.count) songs, repeat=all shuffle=\(shuffle)")
            return ["ok": true, "count": songs.count, "shuffle": shuffle]
        } catch {
            self.log("queue FAILED verbatim: \(error)")
            return ["ok": false, "error": "\(error)"]
        }
    }

    // ---- resolution helpers (OFF main) -----------------------------------------------------------
    @available(iOS 16.0, *)
    private func catalogSong(_ id: String) async -> Song? {
        try? await MusicCatalogResourceRequest<Song>(matching: \.id, memberOf: [MusicItemID(id)]).response().items.first
    }
    @available(iOS 16.0, *)
    private func libraryPlaylist(_ id: String) async -> Playlist? {
        var req = MusicLibraryRequest<Playlist>()
        req.filter(matching: \.id, equalTo: MusicItemID(id))
        return try? await req.response().items.first
    }
    @available(iOS 16.0, *)
    private func appendPlaylistSongs(_ pl: Playlist, into songs: inout [Song]) async -> Int {
        guard let full = try? await pl.with([.tracks]), var batch = full.tracks else { return 0 }
        var n = 0
        while true {
            for t in batch { if case let .song(s) = t { songs.append(s); n += 1 } }
            guard batch.hasNextBatch, let next = try? await batch.nextBatch() else { break }
            batch = next
        }
        return n
    }
    // ---- the ONLY MainActor player touches, kept minimal (the queue set + repeat + shuffle) -----------
    // B: native shuffleMode composes with repeatMode .all — the player RESHUFFLES each loop cycle (no
    // homemade array shuffle that would repeat identically). shuffle OFF = the queue's given order.
    @available(iOS 16.0, *) @MainActor
    private func applyPlaylistQueue(_ pl: Playlist, _ shuffle: Bool) async throws {
        let p = ApplicationMusicPlayer.shared
        p.queue = ApplicationMusicPlayer.Queue(for: [pl])   // ⚠️ direct playlist queue — verify on device
        p.state.repeatMode = .all
        p.state.shuffleMode = shuffle ? .songs : .off
    }
    @available(iOS 16.0, *) @MainActor
    private func applySongQueue(_ songs: [Song], _ shuffle: Bool) async throws {
        let p = ApplicationMusicPlayer.shared
        p.queue = ApplicationMusicPlayer.Queue(for: songs)
        p.state.repeatMode = .all
        p.state.shuffleMode = shuffle ? .songs : .off
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
        if #available(iOS 16.0, *) { ApplicationMusicPlayer.shared.pause(); stopStateTimer(); pushState("paused"); call.resolve(["ok": true]); return }   // #3: a paused player must not keep emitting "playing"; pause only ever emits "paused" (never "error") — a transport park can't be recorded as a failure
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
