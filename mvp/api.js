/*
 * Sizle API client (browser). Talks to the backend in server/.
 * Degrades gracefully: if the API is unreachable, window.API.online stays false
 * and the app falls back to its local (localStorage) behavior — so the demo
 * still runs with no backend, while a connected backend makes it a real,
 * multi-device, persistent web app. Same contract the native app will use.
 */
(() => {
  const LS_TOKEN = "seartune_token";
  // NATIVE (Capacitor WKWebView): the page is served from capacitor://localhost, so
  // location.origin is NOT our API and location.protocol isn't http — the old fallback
  // resolved to http://127.0.0.1:8788 (a dev machine only), which on a device is
  // unreachable → API.online=false → the app dropped into OFFLINE/DEMO (dev-like) mode
  // with no real auth. THIS was the "dev shell" bug. Native now defaults to the
  // PRODUCTION API. Web is unchanged: same-origin in prod, localhost:8788 in local dev.
  // Override for deploys / testing via localStorage 'seartune_api_base'.
  const isNativePlatform = () => { try { return !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === "function" && window.Capacitor.isNativePlatform()); } catch (e) { return false; } };
  const PROD_API = "https://getchoppd.app";
  const base = (localStorage.getItem("seartune_api_base") ||
    (isNativePlatform() ? PROD_API
      : (location.protocol.startsWith("http") && location.port !== "4173" ? location.origin : "http://127.0.0.1:8788"))
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
      throw Object.assign(new Error((e && e.error) || "HTTP " + res.status), { status: res.status, data: e || {} });
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
    // BUILD TELL (readable in Safari Web Inspector on-device): confirms which client bundle
    // is running and where it points. On native this MUST read api=https://getchoppd.app,
    // devAuth=false — anything else (e.g. api=http://127.0.0.1:8788) means a STALE bundle.
    try { console.log(`[choppd] api.js v21 · native=${isNativePlatform()} · api=${base} · online=${online} · devAuth=${!!cfg.devAuth}`); } catch (_) {}
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
    deleteAccount: () => req("/api/me", { method: "DELETE" }),   // hard delete; server identifies the user from the JWT
    redeem: (code) => req("/api/entitlement/redeem", { method: "POST", body: JSON.stringify({ code }) }),
    logSession: (s) => req("/api/sessions", { method: "POST", body: JSON.stringify(s) }),
    // Attach a rating to an already-recorded completion (the streak banks at the finish
    // hook; this updates that one session — no second cook_sessions row).
    rateSession: (id, rating, comment, hasPhoto) => req("/api/sessions/rate", { method: "POST", body: JSON.stringify({ id, rating, comment, hasPhoto }) }),
    sessions: () => req("/api/sessions"),
    nutrition: (q) => req("/api/nutrition?q=" + encodeURIComponent(q)),
    recipeStats: () => req("/api/recipes/stats"),
    visit: (visitorId) => req("/api/visit", { method: "POST", body: JSON.stringify({ visitorId }) }),
    event: (type, recipe) => req("/api/event", { method: "POST", body: JSON.stringify({ type, recipe }) }),
    // Filtered catalog from our DB. `params` = {cuisine,difficulty,mealTime,q,limit}.
    recipes: (params = {}) => {
      const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== "")).toString();
      return req("/api/recipes" + (qs ? "?" + qs : ""));
    },
    recipeById: (id) => req("/api/recipes/" + encodeURIComponent(id)),
    // Fridge scan: images mode (vision) or ids mode (match-only / manual)
    scan: (body) => req("/api/scan", { method: "POST", body: JSON.stringify(body) }),
    scanVocab: () => req("/api/scan/vocab"),
    scanLaunched: (scanId, recipeId) => req("/api/scan/launched", { method: "POST", body: JSON.stringify({ scanId, recipeId }) }),
    scanPhoto: (image, scanId) => req("/api/scan/photo", { method: "POST", body: JSON.stringify({ image, scanId }) }),
    scanConceptRequest: (ids, concept, message, instagram) => req("/api/scan/concept-request", { method: "POST", body: JSON.stringify({ ids, concept, message, instagram }) }),
    // Scan-miss demand capture: one tap → concept_requests (source='scan_miss') with the fridge list.
    scanMissRequest: (ids) => req("/api/scan/miss", { method: "POST", body: JSON.stringify({ ids }) }),
    // AI concept previews + the recipe-request loop (fridge-scanner spec §4)
    scanConcepts: (ids, assumeStaples) => req("/api/scan/concepts", { method: "POST", body: JSON.stringify({ ids, assumeStaples }) }),
    scanRequest: (ids, concept) => req("/api/scan/request", { method: "POST", body: JSON.stringify({ ids, concept }) }),
    requestsFulfilled: () => req("/api/scan/requests/fulfilled"),
    requestSeen: (id) => req("/api/scan/requests/seen", { method: "POST", body: JSON.stringify({ id }) }),
    // usage limits (flag-gated; server-authoritative)
    limits: () => req("/api/limits"),
    cookStart: (recipeId) => req("/api/cook/start", { method: "POST", body: JSON.stringify({ recipeId }) }),
    waitlist: (trigger) => req("/api/waitlist", { method: "POST", body: JSON.stringify({ trigger }) }),
    // Cook resume — server-side cook state (one active cook per account, JWT-keyed).
    // Source of truth for resume; the same three endpoints back the future iOS app.
    putCookState: (snapshot) => req("/api/cook-state", { method: "PUT", body: JSON.stringify(snapshot) }),
    getCookState: () => req("/api/cook-state"),
    deleteCookState: () => req("/api/cook-state", { method: "DELETE" }),
    // Money receipt — append a completed-cook receipt + read the running tab (JWT-authed).
    postReceipt: (r) => req("/api/receipts", { method: "POST", body: JSON.stringify(r) }),
    receiptTab: () => req("/api/receipts/tab"),
    // Grocery starter basket — one active basket per account (JWT-authed).
    putBasket: (b) => req("/api/basket", { method: "PUT", body: JSON.stringify(b) }),
    getBasket: () => req("/api/basket"),
    deleteBasket: () => req("/api/basket", { method: "DELETE" }),
    // Skill graph (graduation system, Phase 1 — dark). Server derives the evidence
    // from recipeId; the client never sends skillIds (anti-tamper). Fire on a
    // completed cook; GET is a founder/analyst read (nothing renders yet).
    skillsComplete: (recipeId, gatesConfirmed) => req("/api/skills/complete", { method: "POST", body: JSON.stringify({ recipeId, gatesConfirmed }) }),
    skills: () => req("/api/skills"),
    // Cook History (premium)
    streakCalendar: () => req("/api/profile/streak-calendar"),
    history: (params = {}) => {
      const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== "")).toString();
      return req("/api/profile/history" + (qs ? "?" + qs : ""));
    },
    records: () => req("/api/profile/records"),
  };
})();
