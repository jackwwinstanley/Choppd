/*
 * NATIVE FULL-BLEED detection (Capacitor).
 *
 * The web client is the real product AND exactly what Capacitor wraps for iOS
 * (see CLAUDE.md). On the desktop demo we show a phone-frame; inside the native
 * WebView the app must fill the ENTIRE physical screen — no frame, no chrome.
 *
 * This runs SYNCHRONOUSLY in <head>, before the body paints, so the desktop
 * phone-frame never flashes on-device. It only sets a class on <html>; all the
 * layout lives in CSS (html.native ... in styles.css). In a plain browser
 * window.Capacitor is undefined → the class is never added → framed demo, unchanged.
 *
 * Detection order (design constraint: build portable, degrade gracefully):
 *   1. Capacitor.isNativePlatform() — the canonical API once @capacitor/core is injected.
 *   2. Capacitor.getPlatform()/isNative — older/edge Capacitor shapes.
 *   3. capacitor:// | ionic:// origin — the native WebView scheme, as a last-resort
 *      fallback if the class must be set before the Capacitor bridge is ready.
 */
(function () {
  function isNativePlatform() {
    try {
      var C = window.Capacitor;
      if (C) {
        if (typeof C.isNativePlatform === "function") return !!C.isNativePlatform();
        if (typeof C.getPlatform === "function") return C.getPlatform() !== "web";
        if (C.isNative === true) return true;
      }
    } catch (e) { /* ignore — fall through to protocol check */ }
    var proto = (location.protocol || "").toLowerCase();
    return proto === "capacitor:" || proto === "ionic:";
  }
  try {
    if (isNativePlatform()) document.documentElement.classList.add("native");
  } catch (e) { /* never let detection break boot */ }
})();
