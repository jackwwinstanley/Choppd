/*
 * Sizle API client (browser). Talks to the backend in server/.
 * Degrades gracefully: if the API is unreachable, window.API.online stays false
 * and the app falls back to its local (localStorage) behavior — so the demo
 * still runs with no backend, while a connected backend makes it a real,
 * multi-device, persistent web app. Same contract the native app will use.
 */
(() => {
  const LS_TOKEN = "seartune_token";
  // Override for deploys: localStorage 'seartune_api_base', else same-origin /api host, else local dev.
  const base = (localStorage.getItem("seartune_api_base") ||
    (location.protocol.startsWith("http") && location.port !== "4173" ? location.origin : "http://127.0.0.1:8788")
  ).replace(/\/$/, "");

  let online = false;
  let cfg = { googleClientId: null, devAuth: true }; // discovered from /api/auth/config
  const token = () => localStorage.getItem(LS_TOKEN) || "";
  const setToken = (t) => (t ? localStorage.setItem(LS_TOKEN, t) : localStorage.removeItem(LS_TOKEN));

  async function req(path, opts = {}) {
    const res = await fetch(base + path, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        ...(token() ? { Authorization: "Bearer " + token() } : {}),
        ...(opts.headers || {}),
      },
    });
    if (!res.ok) {
      let e = null; try { e = await res.json(); } catch (_) {}
      throw Object.assign(new Error((e && e.error) || "HTTP " + res.status), { status: res.status });
    }
    return res.status === 204 ? null : res.json();
  }

  async function init() {
    try {
      const r = await fetch(base + "/api/health", { cache: "no-store" });
      online = r.ok;
      if (online) {
        try { cfg = await (await fetch(base + "/api/auth/config", { cache: "no-store" })).json(); } catch (_) {}
      }
    } catch (_) { online = false; }
    return online;
  }

  window.API = {
    get online() { return online; },
    get base() { return base; },
    get googleClientId() { return cfg.googleClientId; },
    get devAuth() { return cfg.devAuth; },
    isLoggedIn: () => !!token(),
    setToken,
    logout: () => setToken(""),
    init,
    google: (idToken) => req("/api/auth/google", { method: "POST", body: JSON.stringify({ idToken }) }),
    requestCode: (email) => req("/api/auth/request", { method: "POST", body: JSON.stringify({ email }) }),
    verify: (email, code) => req("/api/auth/verify", { method: "POST", body: JSON.stringify({ email, code }) }),
    me: () => req("/api/me"),
    saveProfile: (p) => req("/api/me", { method: "PUT", body: JSON.stringify(p) }),
    redeem: (code) => req("/api/entitlement/redeem", { method: "POST", body: JSON.stringify({ code }) }),
    logSession: (s) => req("/api/sessions", { method: "POST", body: JSON.stringify(s) }),
    sessions: () => req("/api/sessions"),
    nutrition: (q) => req("/api/nutrition?q=" + encodeURIComponent(q)),
  };
})();
