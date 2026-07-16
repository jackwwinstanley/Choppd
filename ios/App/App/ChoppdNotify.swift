//
//  ChoppdNotify.swift — timing authority for the blocking step-timer alarm (Stage 3, DARK).  ⚠️ compile-on-device.
//
//  THE LOAD-BEARING FACT (docs/design/timer-alarm-and-phase-music.md §C0): iOS suspends the WKWebView's JS
//  shortly after background/lock, so a JS setTimeout will NOT fire at zero on a locked phone. This plugin is
//  the timing authority: when a step timer is armed, JS schedules a UNUserNotificationCenter local
//  notification for now+duration — it fires on time in EVERY app state (fg, bg, locked, terminated). The JS
//  countdown stays the DISPLAY, never the authority.
//
//  LOCK-SCREEN PERSISTENCE = A CHAIN (§C2): custom notification sounds cap at ~30s and cannot loop, so
//  persistence is approximated by scheduling a chain (~8 notifications, ~30s apart) per alarm, cancelled the
//  moment the app opens or the user dismisses. iOS caps 64 pending/app; with one active timer at a time,
//  8/chain is safe. `pending()` exposes the count so JS can assert the arm/cancel bookkeeping never leaks.
//
//  ⚠️ APP STORE FENCE (2.5.4) — see also ChoppdAudio: background audio must always be genuinely audible
//  content (the music, or the ringing alarm). This plugin NEVER schedules silent audio and NEVER exists to
//  keep JS alive; it schedules user-facing alert+sound notifications only. The looping ALARM AUDIO plays
//  through ChoppdAudio under .playback (audible with the mute switch on) — this plugin is only the doorbell.
//
//  Local Swift plugin (no pod, no npm dep): registered via MainViewController.capacitorDidLoad, exactly like
//  ChoppdAudio/ChoppdMusic/ChoppdSpeech. Dark until the founder's locked-phone battery passes.
//
import Foundation
import Capacitor
import UserNotifications
import UIKit

@objc(ChoppdNotify)
public class ChoppdNotify: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ChoppdNotify"
    public let jsName = "ChoppdNotify"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "checkPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "scheduleChain", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancelAll", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pending", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openSettings", returnType: CAPPluginReturnPromise),   // A2: honest denied-state path to iOS Settings
    ]

    private func log(_ msg: String) { NSLog("[ChoppdNotify] %@", msg) }

    // Permission requested at the FIRST timer armed (§C7). Honest denied-state is a JS concern: the
    // foreground alarm still works without this; only the lock-screen doorbell needs it.
    @objc func requestPermission(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { granted, err in
            self.log("permission=\(granted ? "granted" : "denied")\(err != nil ? " err=\(err!.localizedDescription)" : "")")
            call.resolve(["granted": granted])
        }
    }

    @objc func checkPermission(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().getNotificationSettings { s in
            let st: String
            switch s.authorizationStatus {
            case .authorized, .provisional, .ephemeral: st = "granted"
            case .denied: st = "denied"
            default: st = "prompt"
            }
            self.log("checkPermission status=\(st)")
            call.resolve(["status": st])
        }
    }

    // Schedule a CHAIN of `count` notifications for a single alarm: the first at now+firstDelaySec, then
    // every gapSec after. All share the id prefix so cancel() removes the whole chain. `sound` names a
    // bundled ≤30s clip (falls back to the default alert sound); the LOOPING alarm is ChoppdAudio's job.
    @objc func scheduleChain(_ call: CAPPluginCall) {
        let id = call.getString("id") ?? "choppd.timer"
        let first = call.getDouble("firstDelaySec") ?? 0
        let count = max(1, min(call.getInt("count") ?? 8, 12))     // clamp — one active timer, ≤12 keeps well under the 64 cap
        let gap = max(1, call.getDouble("gapSec") ?? 30)
        let title = call.getString("title") ?? "Timer done"
        let body = call.getString("body") ?? "Tap to open Choppd."
        let soundName = call.getString("sound")
        // MISS 2 diagnostic: UNNotificationSound(named:) resolves a custom sound ONLY from the main bundle
        // root or Library/Sounds. A silent notification with the ringer ON usually means the file wasn't
        // found there → iOS drops to NO sound. Log whether it's bundled + the exact sound we attach, so a
        // locked run names the miss. If it's missing, fall back to .default (audible) rather than silence.
        var sound: UNNotificationSound = .default
        var soundDesc = "default"
        if let name = soundName {
            let base = (name as NSString).deletingPathExtension
            let ext = (name as NSString).pathExtension
            let bundled = Bundle.main.url(forResource: base, withExtension: ext.isEmpty ? nil : ext) != nil
            if bundled { sound = UNNotificationSound(named: UNNotificationSoundName(name)); soundDesc = "\(name) (bundled)" }
            else { soundDesc = "\(name) NOT FOUND in bundle → .default" }
            log("sound resolve: name=\(name) bundled=\(bundled)")
        }
        let center = UNUserNotificationCenter.current()
        var scheduled = 0
        for i in 0..<count {
            let delay = first + Double(i) * gap
            if delay <= 0 { continue }                              // a fired notification can't be in the past
            let content = UNMutableNotificationContent()
            content.title = title
            content.body = body
            content.sound = sound
            content.interruptionLevel = .timeSensitive              // best-effort surfacing; NOT critical (no entitlement)
            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: delay, repeats: false)
            let req = UNNotificationRequest(identifier: "\(id).\(i)", content: content, trigger: trigger)
            center.add(req) { err in if let e = err { self.log("schedule \(id).\(i) FAILED: \(e)") } }
            scheduled += 1
        }
        log("chain scheduled n=\(scheduled) first=\(first) gap=\(gap) sound=\(soundDesc) id=\(id)")
        call.resolve(["ok": true, "scheduled": scheduled])
    }

    // Cancel the whole chain for an id (prefix match) — called the MOMENT the app opens or the user
    // dismisses, so pending notifications never leak. Also clears anything already delivered.
    @objc func cancel(_ call: CAPPluginCall) {
        let id = call.getString("id") ?? "choppd.timer"
        let caller = call.getString("caller") ?? "?"                 // caller-tagged: a cancel at FIRE-time (not a user action) is the bug that destroyed the backstop chain
        let center = UNUserNotificationCenter.current()
        center.getPendingNotificationRequests { reqs in
            let ids = reqs.map { $0.identifier }.filter { $0 == id || $0.hasPrefix("\(id).") }
            center.removePendingNotificationRequests(withIdentifiers: ids)
            center.removeDeliveredNotifications(withIdentifiers: ids)
            self.log("cancel id=\(id) caller=\(caller) removed=\(ids.count)")
            call.resolve(["ok": true, "removed": ids.count])
        }
    }

    @objc func cancelAll(_ call: CAPPluginCall) {
        let center = UNUserNotificationCenter.current()
        center.removeAllPendingNotificationRequests()
        center.removeAllDeliveredNotifications()
        log("cancelAll")
        call.resolve(["ok": true])
    }

    // The leak assert's eyes: how many notifications are still pending. After every arm→cancel cycle this
    // must return to its prior value (no orphaned chains).
    @objc func pending(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().getPendingNotificationRequests { reqs in
            call.resolve(["count": reqs.count])
        }
    }

    // A2 — the honest denied-state path: deep-link to this app's iOS Settings so the user can flip
    // Notifications back on. The foreground alarm + the C6 audio loop work without this; only the
    // lock-screen chain needs it.
    @objc func openSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let url = URL(string: UIApplication.openSettingsURLString), UIApplication.shared.canOpenURL(url) {
                UIApplication.shared.open(url)
            }
        }
        call.resolve(["ok": true])
    }
}
