/*
 * THE EYE — dev/sim-only console tap.
 *
 * Forwards console.{log,warn,error} (which carries every VOICE: / YT-VOL / HELD instrumentation
 * line the app already emits) to the local seam server's POST /debug/log, so a simulator run is
 * SELF-READING: Maestro drives the app, we tail the appended log file. No device ferrying.
 *
 * STRUCTURALLY INERT off a local server, three ways:
 *   1. api.js only injects this <script> when the resolved API base is a loopback/private host
 *      (dev/sim). In prod the base is https://getchoppd.app, so this file is never even loaded.
 *   2. This file re-checks the base itself (belt-and-braces) and arms ONLY if it's local.
 *   3. The server /debug/log route is gated by testOtpEnabled() — dead in prod regardless.
 * So it mirrors the TEST-OTP seam's off-prod lockout: present in the repo, never live on the box.
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

  let armed = null;        // null = undecided (base not resolved yet), then true/false once
  let base = "";
  const buf = [];
  let timer = null, sending = false;
  const orig = { log: console.log, warn: console.warn, error: console.error };

  const flush = () => {
    timer = null;
    if (sending || !buf.length || !base) return;
    const lines = buf.splice(0, buf.length);
    sending = true;
    try {
      fetch(base + "/debug/log", {
        method: "POST", keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines }),
      }).catch(() => { /* server may be down — drop silently */ })
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
    if (armed === null) { const b = resolveBase(); if (b) { base = b; armed = LOCAL_RE.test(b); } }
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
