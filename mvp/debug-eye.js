/*
 * THE EYE — dev/sim-only console tap.
 *
 * Forwards console.{log,warn,error} (which carries every VOICE: / YT-VOL / HELD instrumentation
 * line the app already emits) to the local seam server's POST /debug/log, so a simulator run is
 * SELF-READING: Maestro drives the app, we tail the appended log file. No device ferrying.
 *
 * SINK (where logs go), in priority order:
 *   1. localStorage `choppd_eye_url` — an explicit DEVICE-MODE opt-in (set via the hidden debug
 *      gesture: 7 taps on the Settings header). Points at a dev/seam server on the LAN, e.g.
 *      http://192.168.x.y:8788/debug/log. This is how a DEVICE session (api base = prod) is captured
 *      WITHOUT ever enabling an endpoint in prod — the log goes to your Mac's seam server, not the box.
 *   2. else, if the resolved API base is loopback/private (sim / local web dev) → base + /debug/log.
 *   3. else → no sink → the tap never arms.
 *
 * PROD-SAFE BY CONSTRUCTION, three ways (mirrors the TEST-OTP seam's off-prod lockout):
 *   1. api.js only injects this <script> when a sink exists (loopback base OR choppd_eye_url set);
 *      a real user on a prod build has neither, so the file is never even loaded.
 *   2. This file re-derives the sink itself and arms ONLY if one exists.
 *   3. Every /debug/log endpoint (sim seam server AND any dev server) is gated by testOtpEnabled();
 *      prod (getchoppd.app) has no such route. The device sink is a LAN dev machine, never prod.
 *
 * Batched + throttled (flush every ~400ms or every 40 lines) so the tap can't perturb the very
 * timing it measures. Real console is always called first — nothing is swallowed.
 */
(() => {
  "use strict";
  const LOCAL_RE = /^https?:\/\/(127\.0\.0\.1|localhost|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;
  const resolveBase = () => {
    try {
      if (window.API && window.API.base) return window.API.base;
      const o = localStorage.getItem("seartune_api_base");
      if (o) return o;
    } catch (e) { /* ignore */ }
    return "";
  };
  // The sink URL: explicit device opt-in first, then a loopback base, then none.
  const resolveSink = () => {
    try {
      const dev = localStorage.getItem("choppd_eye_url");
      if (dev && /^https?:\/\//.test(dev)) return dev.replace(/\/$/, "");
    } catch (e) { /* ignore */ }
    const b = resolveBase();
    if (LOCAL_RE.test(b)) return b + "/debug/log";
    return "";
  };

  let armed = null;        // null = undecided (sink not resolved yet), then true/false once
  let sink = "";
  const buf = [];
  let timer = null, sending = false;
  const orig = { log: console.log, warn: console.warn, error: console.error };

  const flush = () => {
    timer = null;
    if (sending || !buf.length || !sink) return;
    const lines = buf.splice(0, buf.length);
    sending = true;
    try {
      fetch(sink, {
        method: "POST", keepalive: true, mode: "cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines }),
      }).catch(() => { /* server may be down / unreachable — drop silently */ })
        .finally(() => { sending = false; if (buf.length) schedule(); });
    } catch (e) { sending = false; }
  };
  const schedule = () => { if (!timer) timer = setTimeout(flush, 400); };

  const push = (level, args) => {
    let msg = "";
    try {
      msg = Array.prototype.map.call(args, (a) =>
        typeof a === "string" ? a
          : (a instanceof Error ? (a.stack || a.message)
            : (() => { try { return JSON.stringify(a); } catch (e) { return String(a); } })())
      ).join(" ");
    } catch (e) { try { msg = String(args); } catch (_) { msg = "[unserializable]"; } }
    if (level !== "log") msg = "[" + level + "] " + msg;
    buf.push({
      t: Math.round((window.performance && performance.now) ? performance.now() : Date.now()),
      wall: Date.now(),
      msg: msg.length > 2000 ? msg.slice(0, 2000) : msg,
    });
    if (buf.length >= 40) flush(); else schedule();
  };

  const wrap = (level) => function () {
    orig[level].apply(console, arguments);   // the real console FIRST — never swallow a line
    if (armed === null) { const s = resolveSink(); if (s) { sink = s; armed = true; } }
    if (armed) push(level, arguments);
  };
  console.log = wrap("log");
  console.warn = wrap("warn");
  console.error = wrap("error");

  // flush on teardown so the tail of a run isn't lost
  try { window.addEventListener("pagehide", flush); window.addEventListener("beforeunload", flush); } catch (e) { /* ignore */ }

  // one boot marker so the file always has a header for the run
  try { console.log("[eye] tap loaded @ " + new Date().toISOString()); } catch (e) { /* ignore */ }
})();
