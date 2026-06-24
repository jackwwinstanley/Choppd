/* ============================================================
   SearTune MVP — front-end demo of the core loop.
   Backend (Cognito/Spotify/RDS) is mocked; the cook engine is real.
   ============================================================ */
(function () {
  "use strict";

  const app = document.getElementById("app");
  const EXPERIENCES = window.EXPERIENCES || [window.FREEBIRD_STEAK];
  let EXP = EXPERIENCES[0];                 // the currently selected music cook
  let portionCount = null;                  // e.g. # of eggs, chosen on the prep screen

  // gently scale timing for portion size (e.g. more eggs = a bit longer); clamped so it never gets wild
  function portionFactor() {
    const p = EXP.portion;
    if (!p) return 1;
    const n = portionCount || p.base;
    const f = 1 + (n - p.base) * p.perUnit;
    return Math.max(p.clamp[0], Math.min(p.clamp[1], f));
  }

  // ---- session state (would live server-side / in secure storage) ----
  const state = {
    email: "",
    isBeginner: null,        // derived from `experience` for cook-session verbosity
    experience: null,        // one of EXPERIENCE_LEVELS ids
    equipment: { pans: [], heat: null }, // pans = the pan types they OWN (≥1); heat = gas|electric
    cookPan: null,            // the single pan they chose for THIS cook (one of equipment.pans)
    spotifyConnected: false,
    tier: "free",
    musicPlatform: null,     // 'spotify' | 'apple' once connected (Premium)
    customAudio: null,       // chosen bundled track to play during a cook (Premium)
    spotifyUri: null,        // real Spotify track/playlist uri chosen as soundtrack
    spotifyLabel: null,      // its display name
    spotifyKind: null,       // 'playlist' | 'track' | 'queue'
    spotifyShuffle: false,   // shuffle a chosen playlist
    spotifyLoop: false,      // loop a single chosen track
    spotifyQueue: [],        // [{uri,label}] queued songs to play in order
    prefs: { voice: true, haptics: true, checkpoints: true, theme: "dark", speed: 8, voiceURI: null, engine: "webspeech", kokoroVoice: "af_heart" }, // speed = demo multiplier
    streak: 0,
  };

  // ---- entitlement (premium + connected music platform), persisted ----
  const DEV_CODE = "Dev123";
  const PLAT_LABEL = { spotify: "Spotify", apple: "Apple Music" };
  // Inline brand marks (no network / deps) — official-style Spotify + Apple Music logos.
  const SPOTIFY_SVG = `<svg class="brand-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#1DB954"/><path fill="#000" d="M17.6 10.9c-3-1.8-7.9-1.9-10.7-1.1-.46.14-.94-.12-1.08-.58-.14-.46.12-.94.58-1.08 3.27-.99 8.66-.8 12.12 1.26.41.24.55.78.3 1.2-.24.41-.78.55-1.24.31zm-.1 2.6c-.21.34-.65.45-.99.24-2.5-1.54-6.32-1.98-9.27-1.08-.38.11-.78-.1-.9-.48-.11-.38.1-.78.48-.9 3.37-1.02 7.58-.53 10.45 1.23.34.21.45.65.23.99zm-1.12 2.5c-.17.27-.52.36-.79.19-2.19-1.34-4.94-1.64-8.18-.9-.31.07-.62-.12-.69-.43-.07-.31.12-.62.43-.69 3.55-.81 6.6-.46 9.05 1.04.27.16.36.52.18.79z"/></svg>`;
  const APPLE_MUSIC_SVG = `<svg class="brand-ico" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="amgrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FB5C74"/><stop offset="1" stop-color="#FA233B"/></linearGradient></defs><rect width="24" height="24" rx="6" fill="url(#amgrad)"/><path fill="#fff" d="M16.6 6.18c-.13-.11-.31-.15-.51-.11l-6.07 1.23c-.35.07-.6.38-.6.74v6.49c-.32-.2-.71-.31-1.13-.31-1.13 0-2.04.79-2.04 1.76s.91 1.76 2.04 1.76 2.04-.79 2.04-1.76V10.7l5.13-1.04v3.86c-.32-.2-.71-.31-1.13-.31-1.13 0-2.04.79-2.04 1.76s.91 1.76 2.04 1.76 2.04-.79 2.04-1.76V6.76c0-.23-.1-.44-.24-.58z"/></svg>`;
  const isPremium = () => state.tier === "premium";
  const isConnected = () => isPremium() && !!state.musicPlatform;
  function loadEnt() {
    try {
      const e = JSON.parse(localStorage.getItem("seartune_ent") || "{}");
      if (e.tier) state.tier = e.tier;
      if (e.platform) { state.musicPlatform = e.platform; state.spotifyConnected = e.platform === "spotify"; }
      if (e.spotifyUri) { state.spotifyUri = e.spotifyUri; state.spotifyLabel = e.spotifyLabel || null; }
    } catch (e) {}
    // Real Spotify login survives reloads — but only wire it up if they're already Premium.
    if (isPremium() && window.Spotify_ && Spotify_.isLoggedIn()) { state.musicPlatform = "spotify"; state.spotifyConnected = true; Spotify_.loadSdk(); }
  }
  function saveEnt() {
    try { localStorage.setItem("seartune_ent", JSON.stringify({ tier: state.tier, platform: state.musicPlatform, spotifyUri: state.spotifyUri, spotifyLabel: state.spotifyLabel })); } catch (e) {}
  }

  // ---- backend (server/) integration ----
  // When window.API.online, the app uses the real backend for accounts, profile,
  // entitlement and the session flywheel; otherwise it falls back to localStorage.
  const backendOn = () => !!(window.API && API.online);
  let pendingDevCode = null; // login OTP the API returns in dev mode
  function applyServerUser(u) {
    if (!u) return;
    if (u.email) state.email = u.email;
    if (u.experience) setExperience(u.experience);
    if (u.equipment) state.equipment = { pans: u.equipment.pans || [], heat: u.equipment.heat || null };
    if (u.prefs && typeof u.prefs === "object") Object.assign(state.prefs, u.prefs);
    if (u.tier) state.tier = u.tier;
    if (u.musicPlatform) { state.musicPlatform = u.musicPlatform; state.spotifyConnected = u.musicPlatform === "spotify"; }
    if (typeof u.streak === "number") state.streak = u.streak;
    saveEnt();
  }

  // Shared post-login routing for both Google OAuth and email-OTP sign-in.
  function afterServerLogin(user) {
    applyServerUser(user);
    if (user.experience) { toast("Welcome back 🍳"); screens.home(); } // already onboarded
    else screens.disclaimer();
  }

  // Render the Google Identity Services button into #<id> and handle the
  // credential (a Google ID token) by exchanging it for our JWT via the backend.
  function mountGoogleSignIn(id) {
    const el = document.getElementById(id);
    if (!el) return;
    if (!(window.google && google.accounts && google.accounts.id)) {
      setTimeout(() => mountGoogleSignIn(id), 300); // GIS script still loading
      return;
    }
    google.accounts.id.initialize({
      client_id: API.googleClientId,
      callback: async (resp) => {
        try {
          const { token, user } = await API.google(resp.credential);
          API.setToken(token); afterServerLogin(user);
        } catch (e) { toast("Google sign-in failed — try again"); }
      },
    });
    google.accounts.id.renderButton(el, { theme: "filled_black", size: "large", text: "continue_with", shape: "pill", width: 300 });
  }

  // ---- profile persistence (so a returning login can skip onboarding) ----
  // Mirrors to the backend when connected; localStorage keeps the offline demo working.
  function saveProfile() {
    try { localStorage.setItem("seartune_profile", JSON.stringify({ email: state.email, experience: state.experience, isBeginner: state.isBeginner, equipment: state.equipment, onboarded: true })); } catch (e) {}
    if (backendOn() && API.isLoggedIn()) {
      API.saveProfile({ experience: state.experience, isBeginner: state.isBeginner, equipment: state.equipment, prefs: state.prefs, streak: state.streak }).catch(() => {});
    }
  }
  function loadProfile() {
    try {
      const p = JSON.parse(localStorage.getItem("seartune_profile") || "null");
      if (!p) return false;
      if (p.email && !state.email) state.email = p.email;
      if (p.experience) setExperience(p.experience);
      if (p.equipment) {
        state.equipment = { ...state.equipment, ...p.equipment };
        // migrate old single-pan profiles to the multi-pan model
        if (!Array.isArray(state.equipment.pans)) state.equipment.pans = state.equipment.pan ? [state.equipment.pan] : [];
        delete state.equipment.pan;
      }
      return !!p.onboarded;
    } catch (e) { return false; }
  }
  const hasProfile = () => { try { const p = JSON.parse(localStorage.getItem("seartune_profile") || "null"); return !!(p && p.onboarded); } catch (e) { return false; } };
  let returningLogin = false; // true when the user chose "Log in" rather than "Create account"

  // editable profile option sets
  const EXPERIENCE_LEVELS = [
    { id: "beginner", label: "Beginner", emoji: "🌱", blurb: "Just starting out — we'll explain every step." },
    { id: "some", label: "Finding my feet", emoji: "🍳", blurb: "A few cooks in, still learning the basics." },
    { id: "decent", label: "Comfortable cook", emoji: "🧑‍🍳", blurb: "I can handle most everyday recipes." },
    { id: "seasoned", label: "Seasoned cook", emoji: "🔥", blurb: "Very experienced — keep the cues brief." },
  ];
  const PAN_OPTIONS = [
    { id: "cast-iron", label: "Cast iron", emoji: "🍳" },
    { id: "stainless", label: "Stainless steel", emoji: "🪙" },
    { id: "nonstick", label: "Non-stick", emoji: "⚫️" },
  ];
  const HEAT_OPTIONS = [
    { id: "gas", label: "Gas", emoji: "🔥" },
    { id: "electric", label: "Electric / induction", emoji: "♨️" },
  ];
  const optLabel = (opts, id) => { const o = opts.find((x) => x.id === id); return o ? o.label : "—"; };
  // least-experienced two levels get extra in-cook guidance
  const setExperience = (id) => { state.experience = id; state.isBeginner = (id === "beginner" || id === "some"); };

  // ---- behavioral telemetry (the data-flywheel seed) ----
  // Logs each cook session: per-step authored vs. actual time, "not yet"
  // extensions, outcome/rating, equipment, and skill. Persists to the backend
  // when connected (the real flywheel); always keeps a local copy too.
  let pendingSession = null;
  const Telemetry = {
    read() { try { return JSON.parse(localStorage.getItem("seartune_sessions") || "[]"); } catch (e) { return []; } },
    save(s) {
      try { const log = this.read(); log.push(s); localStorage.setItem("seartune_sessions", JSON.stringify(log.slice(-200))); } catch (e) {}
      if (backendOn() && API.isLoggedIn()) API.logSession(s).catch(() => {});
    },
    clear() { try { localStorage.removeItem("seartune_sessions"); } catch (e) {} },
  };

  // ---- parametric timing + heuristic skill detection ----
  // A simple formula (base × skill × equipment), refined by observed behavior —
  // NOT thousands of authored variants and NOT a trained model.
  const SKILL_FACTOR = { beginner: 1.25, some: 1.1, decent: 1.0, seasoned: 0.9 };
  const PAN_FACTOR = { "cast-iron": 0.95, stainless: 1.0, nonstick: 1.05 };
  const HEAT_FACTOR = { gas: 1.0, electric: 1.1 };   // electric is slower → a touch more time

  // the pan actually used for the current cook (chosen pre-cook), with fallbacks
  function activePan() { return state.cookPan || (state.equipment.pans && state.equipment.pans[0]) || null; }

  // ---- heat level guidance (high/medium/low) tuned for gas vs electric ----
  // Each cook step can carry a `heat` level; we translate it to a concrete dial
  // setting + a behavior note that differs for gas (responsive) vs electric (holds heat).
  const HEAT_LEVELS = {
    high:          { label: "HIGH HEAT",     flames: "🔥🔥🔥", gas: "full flame",         electric: "8–9 / 10" },
    "medium-high": { label: "MED-HIGH HEAT", flames: "🔥🔥",   gas: "just under full",     electric: "6–7 / 10" },
    medium:        { label: "MEDIUM HEAT",   flames: "🔥🔥",   gas: "middle flame",        electric: "5 / 10" },
    "medium-low":  { label: "MED-LOW HEAT",  flames: "🔥",     gas: "low-middle flame",    electric: "3–4 / 10" },
    low:           { label: "LOW HEAT",      flames: "🔥",     gas: "low flame",           electric: "2 / 10" },
  };
  function heatGuidance(level) {
    const h = HEAT_LEVELS[level];
    if (!h) return null;
    const electric = state.equipment.heat === "electric";
    return {
      level, label: h.label, flames: h.flames,
      source: electric ? "electric" : "gas",
      dial: electric ? h.electric : h.gas,
      note: electric
        ? "Electric holds heat — preheat a little longer, and dial down a notch ~30s before you need the change."
        : "Gas reacts instantly — nudge the flame up or down as you go.",
    };
  }
  // Infer a heat level from a TheMealDB step's text (no authored data for those).
  function inferHeat(text) {
    const t = (text || "").toLowerCase();
    if (/\b(deep[- ]?fry|sear|broil|char|high heat|rolling boil|smoking)\b/.test(t)) return "high";
    if (/\b(fry|sauté|saute|stir[- ]?fry|brown|boil|griddle)\b/.test(t)) return "medium-high";
    if (/\b(simmer|poach|sweat|cook through|medium heat|reduce)\b/.test(t)) return "medium";
    if (/\b(melt|warm|gentle|low heat|keep warm|steep|rest)\b/.test(t)) return "low";
    return null;
  }
  // A compact one-line heat hint for a level, used in step copy + the JSON report.
  function heatHintText(level) {
    const g = heatGuidance(level);
    return g ? `${g.flames} ${g.label} — ${g.source}: ${g.dial}` : "";
  }

  // ---- optional ingredients / components (default ON; user can deselect) ----
  // Keyed by recipe id so toggles survive screen re-renders. An id in the set =
  // DESELECTED (removed from the cook); absent = included.
  const optOut = {};
  const optSet = (key) => (optOut[key] || (optOut[key] = new Set()));
  const optActive = (key, id) => !(optOut[key] && optOut[key].has(id)); // true = included
  function toggleOpt(key, id) { const s = optSet(key); s.has(id) ? s.delete(id) : s.add(id); }

  // ---- recipe equipment requirements (inferred from the steps) ----
  // TheMealDB has no structured equipment data, so infer the suitable pan
  // material(s) + other tools a recipe needs from its instruction text.
  let cookNeeds = { panSuitable: null, panReason: "", tools: [] }; // set per recipe before render
  function recipeNeeds(r) {
    const text = (((r.steps || []).map((s) => s.text).join(" ")) + " " + (r.title || "") + " " + (r.category || "")).toLowerCase();
    const has = (re) => re.test(text);
    let panSuitable = null, panReason = "";
    if (has(/\bsear|blacken|\bchar\b|smoking hot|screaming hot|high heat|carameli[sz]e the\b/)) {
      panSuitable = ["cast-iron", "stainless"]; panReason = "high-heat searing — non-stick can't take the heat";
    } else if (has(/\bomelet|omelette|scrambl|pancake|cr[eê]pe|frittata|fish fillet\b/) || /\beggs?\b/.test(text)) {
      panSuitable = ["nonstick", "cast-iron"]; panReason = "delicate — non-stick works best";
    } else if (has(/\b(tomato|wine|vinegar|lemon|lime|citrus)\b/) && has(/\b(simmer|stew|braise|sauce)\b/)) {
      panSuitable = ["stainless", "nonstick"]; panReason = "acidic simmer — avoid cast iron (it reacts)";
    }
    const tools = [], add = (re, label) => { if (has(re)) tools.push(label); };
    add(/\bbake|roast|oven|preheat|gas mark|°c|°f|\bgrill\b|broil\b/, "Oven");
    add(/\bblend|pur[eé]e|food processor|blitz|liquidi[sz]e\b/, "Blender / food processor");
    add(/\bboil|simmer|saucepan|\bpot\b|stock|\bsoup\b|pasta|noodle|stew|braise\b/, "Pot / saucepan");
    add(/\bwhisk\b/, "Whisk");
    add(/\b(barbecue|\bbbq\b|griddle)\b/, "Grill / griddle");
    add(/\bdeep[- ]?fry|deep fryer\b/, "Deep-fry pot + plenty of oil");
    add(/\bbaking (tray|sheet|dish|tin)|casserole dish|ovenproof\b/, "Baking dish / tray");
    return { panSuitable, panReason, tools };
  }

  // ---- pre-cook pan choice (recipe-aware: gray out unsuitable / unowned pans) ----
  const panSuitable = (id) => !cookNeeds.panSuitable || cookNeeds.panSuitable.includes(id);
  const selectablePans = () => (state.equipment.pans || []).filter(panSuitable); // owned AND suitable
  const noSuitablePan = () => selectablePans().length === 0;
  function validCookPan() { const sel = selectablePans(); return state.cookPan && sel.includes(state.cookPan) ? state.cookPan : null; }
  const needsPanChoice = () => selectablePans().length > 1 && !validCookPan();

  function panChoiceHTML() {
    const owned = state.equipment.pans || [];
    const req = cookNeeds.panSuitable;
    const toolsHTML = cookNeeds.tools.length
      ? `<p class="muted" style="font-size:11px;margin:12px 2px 0">🧰 You'll also need: <b>${cookNeeds.tools.map(esc).join(" · ")}</b></p>` : "";
    if (!owned.length && !req) return toolsHTML;
    // a chip per pan material; selectable only if owned AND suitable, else grayed with a reason
    const chips = PAN_OPTIONS.map((p) => {
      const own = owned.includes(p.id), suit = panSuitable(p.id);
      if (own && suit) return `<button class="pchip ${state.cookPan === p.id ? "on" : ""}" data-pan="${p.id}">${p.label}</button>`;
      const why = !suit ? "not ideal" : "you don't have";
      return `<button class="pchip disabled" data-pan="${p.id}" disabled>${p.label} <span class="pchip-why">· ${why}</span></button>`;
    }).join("");
    const reqPill = req
      ? `<span class="pill" style="font-size:10px">needs ${req.map((id) => optLabel(PAN_OPTIONS, id)).join(" / ")}</span>`
      : `<span class="pill" style="font-size:10px">pick one</span>`;
    const reason = cookNeeds.panReason ? `<p class="muted" style="font-size:11px;margin:-4px 2px 8px">🔥 ${esc(cookNeeds.panReason)}</p>` : "";
    const warn = noSuitablePan()
      ? `<p class="muted" style="font-size:11px;color:#ffb86b;margin:6px 2px 0">⚠️ You don't own a suitable pan for this recipe${req ? ` (need ${req.map((id) => optLabel(PAN_OPTIONS, id)).join(" or ")})` : ""}. Add one in your profile to cook it.</p>` : "";
    return `<p class="section-title" style="margin-top:18px">Which pan today? ${reqPill}</p>${reason}<div class="portion" id="cookPanPick">${chips}</div>${warn}${toolsHTML}`;
  }
  // wire the chips; onChange fires after a pick so the caller can re-enable Start
  function wirePanChoice(onChange) {
    const sel = selectablePans();
    if (state.cookPan && !sel.includes(state.cookPan)) state.cookPan = null; // invalid for this recipe
    if (sel.length === 1) state.cookPan = sel[0];                            // only one option → auto
    $$("#cookPanPick .pchip:not(.disabled)").forEach((b) => b.onclick = () => {
      state.cookPan = b.dataset.pan;
      $$("#cookPanPick .pchip").forEach((x) => x.classList.toggle("on", !x.classList.contains("disabled") && x.dataset.pan === state.cookPan));
      if (onChange) onChange();
    });
  }

  // observed pace = median(actual/authored) across guided steps; null if too little data
  function detectedPace() {
    const ratios = [];
    Telemetry.read().forEach((s) => { if (s.mode === "guided") (s.steps || []).forEach((st) => { if (st.authoredSec > 5 && st.actualSec > 0) ratios.push(st.actualSec / st.authoredSec); }); });
    if (ratios.length < 5) return null;
    ratios.sort((a, b) => a - b);
    return Math.max(0.6, Math.min(1.8, ratios[Math.floor(ratios.length / 2)]));
  }
  function paceLabel(p) { return p == null ? "Learning your pace" : p < 0.9 ? "Brisk" : p <= 1.15 ? "On pace" : "Relaxed"; }

  function paceFactor() {
    const sf = SKILL_FACTOR[state.experience] || 1.1;
    const d = detectedPace();
    return d != null ? (0.5 * sf + 0.5 * d) : sf;   // blend self-report with observed behavior
  }
  function equipFactor() {
    return (PAN_FACTOR[activePan()] || 1.0) * (HEAT_FACTOR[state.equipment.heat] || 1.0);
  }
  function adjustedSec(base) { return Math.max(5, Math.round(base * paceFactor() * equipFactor())); }
  function humanSec(s) { const m = Math.floor(s / 60), x = s % 60; return m && x ? `~${m}m ${x}s` : m ? `~${m} min` : `~${x}s`; }

  function cookStats() {
    const done = Telemetry.read().filter((x) => x.completed);
    const ratings = done.map((x) => x.rating).filter((v) => v != null);
    return { count: done.length, avgRating: ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length) : null, pace: detectedPace() };
  }

  // ---- tiny helpers ----
  const h = (html) => { app.innerHTML = ""; const w = document.createElement("div"); w.innerHTML = html; while (w.firstChild) app.appendChild(w.firstChild); };
  const $ = (sel) => app.querySelector(sel);
  const $$ = (sel) => Array.from(app.querySelectorAll(sel));
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const screenEl = (cls, inner) => `<section class="screen ${cls} fade">${inner}</section>`;
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function toast(msg) {
    let t = app.querySelector(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; app.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 1400);
  }

  function vibrate(pattern) {
    if (!state.prefs.haptics) return;
    const map = { tap: 35, double: [30, 60, 30], strong: [60, 50, 120] };
    if (navigator.vibrate) navigator.vibrate(map[pattern] || 35);
  }

  // styled yes/no confirm dialog (prevents accidental quits mid-cook)
  function confirmDialog(message, yesLabel, onYes) {
    const wrap = document.createElement("div");
    wrap.className = "confirm-scrim";
    // Confirm (e.g. "Yes, quit") on the LEFT, "No" on the RIGHT.
    wrap.innerHTML = `<div class="confirm-box"><p>${message}</p><div class="btn-row"><button class="btn" data-yes>${yesLabel}</button><button class="btn secondary" data-no>No</button></div></div>`;
    // Append to the phone frame (fixed-size, non-scrolling) so the overlay always
    // covers the whole screen and centers — not anchored to the scrolled content.
    (document.querySelector(".phone") || app).appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add("show"));
    const close = () => { wrap.classList.remove("show"); setTimeout(() => wrap.remove(), 200); };
    wrap.querySelector("[data-no]").onclick = close;
    wrap.querySelector("[data-yes]").onclick = () => { close(); onYes(); };
    wrap.onclick = (e) => { if (e.target === wrap) close(); };
  }

  // ---- YouTube IFrame player (free-tier embed: licensed playback via YT) ----
  const Yt = {
    player: null, ready: false, apiLoading: false, vol: 100, onPlaying: null, onError: null,
    loadApi(cb) {
      if (window.YT && window.YT.Player) { cb(); return; }
      if (!this.apiLoading) {
        this.apiLoading = true;
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(tag);
      }
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (prev) try { prev(); } catch (e) {} cb(); };
    },
    create(elId, videoId, onReady) {
      this.destroy();
      this.loadApi(() => {
        try {
          this.player = new window.YT.Player(elId, {
            width: "100%", height: "100%", videoId,
            host: "https://www.youtube.com",
            // autoplay off — playback (and the whole cook) starts on the user's tap.
            // origin = our real web origin (legit API config, not a spoofed domain).
            playerVars: { autoplay: 0, playsinline: 1, modestbranding: 1, rel: 0, controls: 1, enablejsapi: 1, origin: location.origin },
            events: {
              onReady: (e) => { this.ready = true; try { e.target.setVolume(this.vol); } catch (_) {} if (onReady) onReady(); },
              onStateChange: (e) => { if (e.data === 1 && this.onPlaying) this.onPlaying(); }, // 1 = PLAYING
              onError: (e) => { if (this.onError) this.onError(e.data); }, // 101/150 = embedding blocked
            },
          });
        } catch (e) {}
      });
    },
    play() { try { this.player && this.player.playVideo(); } catch (e) {} },
    pause() { try { this.player && this.player.pauseVideo(); } catch (e) {} },
    seek(t) { try { this.player && this.player.seekTo(t, true); } catch (e) {} },
    setVol(v) { this.vol = v; try { this.player && this.player.setVolume(v); } catch (e) {} },
    setRate(r) { try { this.player && this.player.setPlaybackRate(Math.max(1, Math.min(r, 2))); } catch (e) {} },
    time() { try { return this.player ? this.player.getCurrentTime() : 0; } catch (e) { return 0; } },
    destroy() { try { if (this.player && this.player.destroy) this.player.destroy(); } catch (e) {} this.player = null; this.ready = false; },
  };

  // ---- music engine ----
  // Free-tier cooks play the official YouTube video (Music.usingYt). The
  // bring-your-own-file path remains for local dev. Either way the song plays
  // continuously; the cook timer is independent.
  const Music = {
    el: null,
    loaded: false,
    usingYt: false,
    bg: false,
    init() {
      if (this.el) return;
      this.el = new Audio();
      this.el.preload = "auto";
    },
    setSrc(src) { this.init(); this.el.src = src; this.loaded = true; },
    loadFile(file) { this.setSrc(URL.createObjectURL(file)); },
    async tryBundled() {
      try {
        const r = await fetch("audio/freebird.mp3", { method: "HEAD" });
        if (r.ok && !this.loaded) { this.setSrc("audio/freebird.mp3"); return true; }
      } catch (e) { }
      return this.loaded;
    },
    has() { return this.usingYt || this.loaded; },
    play() { if (this.usingYt) { Yt.play(); return; } if (this.el) this.el.play().catch(() => { }); },
    pause() { if (this.usingYt) { Yt.pause(); return; } if (this.el) this.el.pause(); },
    stop() { if (this.usingYt) { Yt.destroy(); this.usingYt = false; return; } if (this.el) { this.el.pause(); try { this.el.currentTime = 0; } catch (e) { } } },
    seek(t) { if (this.usingYt) { Yt.seek(t); return; } if (this.el) try { this.el.currentTime = t; } catch (e) { } },
    rate(r) {
      if (this.usingYt) { Yt.setRate(r); return; }
      if (!this.el) return;
      this.el.preservesPitch = this.el.mozPreservesPitch = this.el.webkitPreservesPitch = true;
      this.el.playbackRate = Math.max(0.5, Math.min(r, 4));
    },
    pos() { return this.usingYt ? Yt.time() : (this.el ? this.el.currentTime : 0); },
    duck() { if (this.usingYt) Yt.setVol(this.bg ? 8 : 18); else if (this.el) this.el.volume = this.bg ? 0.12 : 0.22; },
    unduck() { if (this.usingYt) Yt.setVol(this.bg ? 40 : 100); else if (this.el) this.el.volume = this.bg ? 0.40 : 1; },
    background(on) { this.bg = on; this.unduck(); },
  };

  // ---- voice (browser SpeechSynthesis) ----
  // We rank the system voices and auto-pick the most natural one. macOS/Chrome
  // expose much better voices than the default (Google natural, Apple "Enhanced"/
  // Siri). Production would swap this for a cloud neural TTS (e.g. ElevenLabs).
  const speech = window.speechSynthesis || null;

  // novelty/robotic macOS voices to hide
  const NOVELTY = /(albert|bad news|bahh|bells|boing|bubbles|cellos|wobble|deranged|good news|jester|organ|superstar|trinoids|whisper|zarvox|junior|ralph|fred|kathy|princess|bruce|agnes|grandma|grandpa|rocko|sandy|shelley|flo|eddy|reed|rishi|sangeet|trinoids)/i;

  function voiceScore(v) {
    const n = (v.name + " " + (v.voiceURI || "")).toLowerCase();
    let s = 0;
    if (/premium/.test(n)) s += 120;
    if (/enhanced/.test(n)) s += 100;
    if (/siri/.test(n)) s += 95;
    if (/(natural|neural)/.test(n)) s += 85;
    if (/google/.test(n)) s += 70;          // Chrome's Google US English — natural, no download
    if (/microsoft/.test(n)) s += 55;
    if (/(samantha|ava|allison|serena|zoe|karen|moira|tessa|nicky|aaron|evan|joelle)/.test(n)) s += 45;
    if (/(en-us|united states|us english)/.test((v.lang + " " + n))) s += 12;
    if (v.localService) s += 4;
    return s;
  }

  const VoiceBank = {
    voices: [],
    load() {
      const all = (speech && speech.getVoices) ? speech.getVoices() : [];
      const en = all.filter((v) => /^en(-|_|$)/i.test(v.lang));
      const clean = en.filter((v) => !NOVELTY.test(v.name));
      this.voices = (clean.length ? clean : en).sort((a, b) => voiceScore(b) - voiceScore(a));
      if (!state.prefs.voiceURI && this.voices[0]) state.prefs.voiceURI = this.voices[0].voiceURI;
      return this.voices;
    },
    selected() { return this.voices.find((v) => v.voiceURI === state.prefs.voiceURI) || this.voices[0] || null; },
  };

  if (speech) {
    VoiceBank.load();
    // voices (incl. remote Google voices) often load async — refresh + repaint picker
    speech.onvoiceschanged = () => { VoiceBank.load(); if (app.querySelector("#voiceSel")) fillVoiceSelect(); };
  }

  // ---- Kokoro (on-device neural voice) state ----
  let kokoroReady = false, kokoroLoading = false;
  let kokoroAudio = null;
  const kokoroCache = new Map();                 // "voice|text" -> objectURL
  const ck = (t) => state.prefs.kokoroVoice + "|" + t;
  const isKokoro = () => state.prefs.engine === "kokoro" && !!window.Kokoro;

  // unified speak — dispatches to Kokoro or the browser's SpeechSynthesis
  function speak(text) {
    if (!state.prefs.voice || !text) return;
    if (isKokoro()) { speakKokoro(text); return; }
    speakWeb(text);
  }

  function speakWeb(text) {
    if (!speech) return;
    try {
      speech.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const v = VoiceBank.selected();
      if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = "en-US"; }
      u.rate = 0.95;   // a touch slower = warmer, easier to follow at the stove
      u.pitch = 1.06;  // slightly brighter
      u.volume = 1;
      u.onstart = () => Music.duck();   // dip the music while speaking
      u.onend = () => Music.unduck();
      u.onerror = () => Music.unduck();
      speech.speak(u);
    } catch (e) { /* ignore */ }
  }

  async function speakKokoro(text) {
    try {
      stopVoice();
      let url = kokoroCache.get(ck(text));
      if (!url) {
        const blob = await window.Kokoro.synth(text, state.prefs.kokoroVoice);
        url = URL.createObjectURL(blob);
        kokoroCache.set(ck(text), url);
      }
      if (state.prefs.engine !== "kokoro" || !state.prefs.voice) return; // changed while generating
      if (!kokoroAudio) kokoroAudio = new Audio();
      kokoroAudio.src = url;
      kokoroAudio.onplay = () => Music.duck();
      kokoroAudio.onended = kokoroAudio.onpause = () => Music.unduck();
      await kokoroAudio.play().catch(() => { });
    } catch (e) {
      speakWeb(text); // graceful fallback
    }
  }

  function stopVoice() {
    try { speech && speech.cancel(); } catch (e) { }
    if (kokoroAudio) { try { kokoroAudio.pause(); } catch (e) { } }
    Music.unduck();
  }

  // load the model once (with progress into the picker hint)
  async function ensureKokoroLoaded() {
    if (kokoroReady || kokoroLoading || !window.Kokoro) return kokoroReady;
    kokoroLoading = true;
    const setHint = (msg) => { const el = app.querySelector("#voiceHint"); if (el) el.textContent = msg; };
    setHint("Loading Kokoro voice model… (first time only)");
    try {
      await window.Kokoro.load((p) => {
        if (p && (p.status === "progress" || p.progress != null)) {
          const pct = p.total ? Math.round((p.loaded / p.total) * 100) : (p.progress != null ? Math.round(p.progress) : null);
          setHint("Downloading Kokoro voice… " + (pct != null ? pct + "%" : ""));
        }
      });
      kokoroReady = true;
      setHint("✨ Kokoro ready — natural on-device voice.");
    } catch (e) {
      state.prefs.engine = "webspeech"; // fall back
      setHint("Kokoro couldn't load here — using a system voice (try Chrome/Edge).");
      toast("Kokoro unavailable — using system voice");
    } finally { kokoroLoading = false; }
    return kokoroReady;
  }

  // pre-synthesize all cue lines so playback is instant during the cook
  async function pregenKokoro() {
    if (!isKokoro()) return;
    if (!(await ensureKokoroLoaded())) return;
    const lines = EXP.cues.map((c) => c.voice).filter(Boolean);
    for (const t of lines) {
      if (kokoroCache.has(ck(t))) continue;
      try {
        const b = await window.Kokoro.synth(t, state.prefs.kokoroVoice);
        kokoroCache.set(ck(t), URL.createObjectURL(b));
      } catch (e) { break; }
    }
  }

  // refresh the picker if Kokoro loads after a screen already rendered
  window.addEventListener("kokoro-available", () => { if (app.querySelector("#voiceSel")) fillVoiceSelect(); });

  // ---- reusable voice picker (used on prep + connect screens) ----
  function voicePickerHTML() {
    return `
      <div class="voicepick">
        <p class="section-title" style="margin:0 0 8px">🎙 Cooking voice</p>
        <div class="vp-row">
          <select class="field vp-select" id="voiceSel" aria-label="Cooking voice"></select>
          <button class="icon-btn" id="voicePrev" title="Preview voice">▶</button>
        </div>
        <p class="muted" id="voiceHint" style="font-size:11px;margin-top:6px"></p>
      </div>`;
  }

  // free Google voices exposed by the browser (Chrome/Edge), English only
  function googleVoices() {
    return VoiceBank.voices.filter((v) => /google/i.test(v.name) && /^en(-|_|$)/i.test(v.lang));
  }

  // the OS's built-in voices (Apple, Microsoft, etc.) — these are what make voice
  // work in Safari / Firefox, where Google voices and sometimes Kokoro aren't available
  function systemVoices() {
    return VoiceBank.voices.filter((v) => !/google/i.test(v.name));
  }

  function fillVoiceSelect() {
    const sel = app.querySelector("#voiceSel");
    if (!sel) return;
    const googles = googleVoices();
    let html = "";
    if (window.Kokoro) {
      html += `<optgroup label="✨ Kokoro — open-source, natural">` +
        window.Kokoro.voices().map((v) => `<option value="kokoro:${v.id}">${v.label}</option>`).join("") +
        `</optgroup>`;
    }
    if (googles.length) {
      html += `<optgroup label="Google">` +
        googles.map((v) => `<option value="${v.voiceURI}">${v.name.replace(/^Google\s*/i, "")}</option>`).join("") +
        `</optgroup>`;
    }
    const systems = systemVoices();
    if (systems.length) {
      html += `<optgroup label="System voices — works in any browser">` +
        systems.map((v) => `<option value="${v.voiceURI}">${v.name}</option>`).join("") +
        `</optgroup>`;
    }
    if (!html) html = `<option value="">System default</option>`; // last resort (no voices reported yet)
    sel.innerHTML = html;

    // sensible default: Google (Chrome) → system voice (Safari/Firefox) → Kokoro
    if (state.prefs.engine === "webspeech" && !state.prefs.voiceURI) {
      if (googles.length) state.prefs.voiceURI = googles[0].voiceURI;
      else if (systems.length) state.prefs.voiceURI = systems[0].voiceURI;
      else if (window.Kokoro) { state.prefs.engine = "kokoro"; }
    }
    sel.value = state.prefs.engine === "kokoro" ? "kokoro:" + state.prefs.kokoroVoice : (state.prefs.voiceURI || "");

    const hint = app.querySelector("#voiceHint");
    if (hint && !hint.textContent) hint.textContent = window.Kokoro
      ? "✨ Kokoro = most natural (downloads once, runs on-device). System voices work in any browser."
      : "System voices work in any browser. Google voices appear in Chrome/Edge.";
  }

  function previewVoice() {
    const saved = state.prefs.voice;
    state.prefs.voice = true;
    speak("Hi there, lets start cooking!");
    state.prefs.voice = saved;
  }

  function wireVoicePicker() {
    const sel = app.querySelector("#voiceSel");
    if (!sel) return;
    fillVoiceSelect();
    // voices can populate a beat later on first load
    if (VoiceBank.voices.length === 0) {
      let tries = 0;
      const t = setInterval(() => {
        VoiceBank.load(); fillVoiceSelect();
        if (VoiceBank.voices.length || ++tries > 6) clearInterval(t);
      }, 350);
    }
    sel.onchange = () => {
      const val = sel.value;
      if (val.indexOf("kokoro:") === 0) {
        state.prefs.engine = "kokoro";
        state.prefs.kokoroVoice = val.slice(7);
        state.prefs.voiceURI = val;
        ensureKokoroLoaded().then((ok) => { if (ok) previewVoice(); });
      } else {
        state.prefs.engine = "webspeech";
        state.prefs.voiceURI = val;
        previewVoice();
      }
    };
    const prev = app.querySelector("#voicePrev");
    if (prev) prev.onclick = previewVoice;
  }

  // ---- reusable song picker (dev tool: play a file you own) ----
  function musicPickerHTML() {
    return `
      <div class="voicepick" id="musicBox">
        <p class="section-title" style="margin:0 0 8px">🎵 Song · ${EXP.song.title}</p>
        <div class="vp-row">
          <div style="flex:1" id="musicStatus"></div>
          <button class="icon-btn" id="songPrev" title="Preview 6s">▶</button>
        </div>
        <label class="btn secondary" style="margin-top:10px;display:flex;align-items:center;justify-content:center">
          <span id="songBtnLabel">Load your ${EXP.song.title} file (.mp3)</span>
          <input type="file" id="songFile" accept="audio/*" hidden>
        </label>
        <p class="muted" style="font-size:11px;margin-top:8px">Plays a file <b>you own</b>, synced to the cues (local dev only — we can't ship the track). Otherwise it runs on a simulated timer. The real app streams it via the Spotify Premium SDK.</p>
      </div>`;
  }

  function refreshMusicStatus() {
    const s = app.querySelector("#musicStatus");
    const lbl = app.querySelector("#songBtnLabel");
    if (s) s.innerHTML = Music.loaded
      ? `<span style="color:var(--pop);font-weight:700">✅ Loaded — plays with the cues</span>`
      : `<span class="muted">No file — using simulated timer</span>`;
    if (lbl) lbl.textContent = Music.loaded ? "Replace song file" : `Load your ${EXP.song.title} file (.mp3)`;
  }

  function wireMusicPicker() {
    refreshMusicStatus();
    Music.tryBundled().then((ok) => { if (ok) refreshMusicStatus(); });
    const inp = app.querySelector("#songFile");
    if (inp) inp.onchange = (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) { Music.loadFile(f); refreshMusicStatus(); toast("Song loaded ✓"); }
    };
    const prev = app.querySelector("#songPrev");
    if (prev) prev.onclick = () => {
      if (!Music.loaded) { toast("Load a song file first"); return; }
      Music.rate(1); Music.seek(0); Music.play();
      setTimeout(() => Music.pause(), 6000);
    };
    // drag & drop onto the box
    const box = app.querySelector("#musicBox");
    if (box) {
      box.addEventListener("dragover", (e) => { e.preventDefault(); box.style.borderColor = "var(--flame-2)"; });
      box.addEventListener("dragleave", () => { box.style.borderColor = ""; });
      box.addEventListener("drop", (e) => {
        e.preventDefault(); box.style.borderColor = "";
        const f = e.dataTransfer.files && e.dataTransfer.files[0];
        if (f && f.type.startsWith("audio")) { Music.loadFile(f); refreshMusicStatus(); toast("Song loaded ✓"); }
      });
    }
  }

  // ============================================================
  // SCREENS
  // ============================================================
  const screens = {};

  // ---- Welcome ----
  screens.welcome = () => {
    h(screenEl("center", `
      <div style="text-align:center">
        <img class="hero-logo" src="assets/logo.png" alt="SearTune logo" />
        <p class="brand gradient-text" style="margin-top:14px">SearTune</p>
        <h1 style="margin-top:10px">Learn to cook<br>to the <span class="gradient-text">music</span>.</h1>
        <p class="lead" style="margin-top:14px">No experience needed. Press play, follow the cues, and cook your first real meal — in rhythm.</p>
      </div>
      <div class="mt-auto" style="margin-top:34px">
        <button class="btn" id="login">Back to the kitchen 🍳</button>
        <button class="btn ghost" id="create" style="margin-top:10px;color:var(--muted)">Create account</button>
      </div>
    `));
    $("#login").onclick = () => { returningLogin = true; screens.login(); };
    $("#create").onclick = () => { returningLogin = false; screens.login(); };
  };

  // ---- Sign in (Google OAuth, with email-OTP fallback for dev/offline) ----
  screens.login = () => {
    const googleReady = backendOn() && !!API.googleClientId;
    const showEmail = !backendOn() || API.devAuth; // OTP only offline (demo) or in dev mode
    h(screenEl("", `
      <img class="login-logo" src="assets/logo.png" alt="SearTune logo" />
      <p class="eyebrow">Step 1 · Sign in</p>
      <h1 style="margin-top:10px">${googleReady ? "Welcome to SearTune" : "What's your email?"}</h1>
      <p class="lead" style="margin-top:10px">${googleReady ? "Sign in to save your cooks, streak, and Premium." : "We'll send a 6-digit code. No passwords, ever."}</p>
      <div class="stack" style="margin-top:24px">
        ${googleReady ? `<div id="gbtn" style="display:flex;justify-content:center;min-height:44px"></div>` : ""}
        ${googleReady && showEmail ? `<p class="muted" style="text-align:center;font-size:12px;margin:2px 0">or</p>` : ""}
        ${showEmail ? `
        <input class="field" id="email" type="email" placeholder="you@email.com" autocomplete="email" />
        <button class="btn ${googleReady ? "ghost" : ""}" id="send">${googleReady ? "Continue with email" : "Send code"}</button>` : ""}
      </div>
      ${!googleReady && !showEmail ? `<p class="muted" style="margin-top:14px">Sign-in is temporarily unavailable. Please try again shortly.</p>` : ""}
      <p class="muted" style="font-size:12px;margin-top:14px">${!backendOn() ? "Demo: any email works, code is pre-filled." : (API.devAuth ? "Test mode — the email code is shown on the next screen." : "")}</p>
    `));
    if (googleReady) mountGoogleSignIn("gbtn");
    if (!showEmail) return;
    $("#send").onclick = async () => {
      const v = $("#email").value.trim();
      if (!v || !v.includes("@")) { toast("Enter a valid email"); return; }
      state.email = v;
      pendingDevCode = null;
      if (backendOn()) {
        const btn = $("#send"); btn.disabled = true; btn.textContent = "Sending…";
        try { const r = await API.requestCode(v); pendingDevCode = r.devCode || null; }
        catch (e) { toast("Couldn't reach server — using demo mode"); }
      }
      screens.otp();
    };
  };

  screens.otp = () => {
    const prefill = backendOn() ? (pendingDevCode || "") : "481516";
    h(screenEl("", `
      <p class="eyebrow">Step 1 · Verify</p>
      <h1 style="margin-top:10px">Enter your code</h1>
      <p class="lead" style="margin-top:10px">Sent to <b style="color:var(--text)">${state.email}</b></p>
      <div class="stack" style="margin-top:24px">
        <input class="field" id="code" inputmode="numeric" maxlength="6" value="${prefill}"
          style="letter-spacing:10px;text-align:center;font-size:24px;font-weight:700" />
        <button class="btn" id="verify">Verify & continue</button>
        <button class="btn ghost" id="back">Use a different email</button>
      </div>
      ${backendOn() && pendingDevCode ? `<p class="muted" style="font-size:11px;margin-top:10px;text-align:center">Test mode — your code is <b>${pendingDevCode}</b></p>` : ""}
    `));
    $("#verify").onclick = async () => {
      if (backendOn()) {
        const code = $("#code").value.trim();
        const btn = $("#verify"); btn.disabled = true; btn.textContent = "Verifying…";
        try {
          const { token, user } = await API.verify(state.email, code);
          API.setToken(token); afterServerLogin(user);
        } catch (e) { btn.disabled = false; btn.textContent = "Verify & continue"; toast("Invalid or expired code"); }
        return;
      }
      // offline demo: returning user with a saved profile skips onboarding
      if (returningLogin && hasProfile()) { loadProfile(); toast("Welcome back 🍳"); screens.home(); }
      else screens.disclaimer();
    };
    $("#back").onclick = () => screens.login();
  };

  // ---- Safety disclaimer ----
  screens.disclaimer = () => {
    h(screenEl("", `
      <p class="eyebrow">Step 2 · Stay safe</p>
      <h1 style="margin-top:10px">Quick safety check 🔪🔥</h1>
      <div class="card" style="margin-top:20px">
        <p class="lead" style="color:var(--text)">Cooking involves <b>high heat, hot oil, sharp knives, and raw meat</b>. SearTune gives guidance, but you're in charge of your kitchen.</p>
        <ul class="lead" style="margin:14px 0 0 18px;line-height:1.8">
          <li>Keep a clear, dry workspace.</li>
          <li>Wash hands & surfaces after raw meat.</li>
          <li>Never leave a hot pan unattended.</li>
        </ul>
      </div>
      <label class="choice" id="agree" style="margin-top:18px">
        <span class="emoji">⬜️</span>
        <span>I understand and agree to cook safely.</span>
      </label>
      <div class="mt-auto" style="margin-top:18px">
        <button class="btn" id="next" disabled>Agree & continue</button>
      </div>
    `));
    let agreed = false;
    $("#agree").onclick = () => {
      agreed = !agreed;
      $("#agree").classList.toggle("selected", agreed);
      $("#agree .emoji").textContent = agreed ? "✅" : "⬜️";
      $("#next").disabled = !agreed;
    };
    $("#next").onclick = () => screens.onboardBeginner();
  };

  // ---- Onboarding: experience level ----
  screens.onboardBeginner = () => {
    h(screenEl("", `
      <div class="dots"><span class="on"></span><span></span><span></span></div>
      <p class="eyebrow">Step 3 · About you</p>
      <h1 style="margin-top:10px">How much have<br>you cooked?</h1>
      <p class="lead" style="margin-top:10px">No judgment — this just sets how much we guide you.</p>
      <div class="stack" style="margin-top:24px">
        ${EXPERIENCE_LEVELS.map((e) => `<button class="choice" data-v="${e.id}"><span class="emoji">${e.emoji}</span><span>${e.label}<small>${e.blurb}</small></span></button>`).join("")}
      </div>
    `));
    $$(".choice").forEach((c) => c.onclick = () => {
      setExperience(c.dataset.v);
      screens.onboardEquipment();
    });
  };

  // ---- Onboarding: fast equipment check ----
  screens.onboardEquipment = () => {
    h(screenEl("", `
      <div class="dots"><span class="on"></span><span class="on"></span><span></span></div>
      <p class="eyebrow">Step 3 · Your kit</p>
      <h1 style="margin-top:10px">What are you<br>cooking with?</h1>
      <p class="section-title" style="margin-top:18px">Pans you own <span class="muted" style="text-transform:none;letter-spacing:0;font-weight:500">· pick all that apply</span></p>
      <div class="stack" data-group="pans">
        ${PAN_OPTIONS.map((p) => `<button class="choice ${state.equipment.pans.includes(p.id) ? "selected" : ""}" data-v="${p.id}"><span class="emoji">${p.emoji}</span> ${p.label}</button>`).join("")}
      </div>
      <p class="section-title">Heat source</p>
      <div class="stack" data-group="heat">
        ${HEAT_OPTIONS.map((o) => `<button class="choice ${state.equipment.heat === o.id ? "selected" : ""}" data-v="${o.id}"><span class="emoji">${o.emoji}</span> ${o.label}</button>`).join("")}
      </div>
      <div class="mt-auto" style="margin-top:20px">
        <button class="btn" id="next" disabled>Continue</button>
      </div>
    `));
    const check = () => $("#next").disabled = !(state.equipment.pans.length && state.equipment.heat);
    // pans: multi-select (toggle) — at least one required
    $$('[data-group="pans"] .choice').forEach((c) => c.onclick = () => {
      const v = c.dataset.v;
      const i = state.equipment.pans.indexOf(v);
      if (i > -1) state.equipment.pans.splice(i, 1); else state.equipment.pans.push(v);
      c.classList.toggle("selected", state.equipment.pans.includes(v));
      check();
    });
    // heat: single-select
    $$('[data-group="heat"] .choice').forEach((c) => c.onclick = () => {
      $$('[data-group="heat"] .choice').forEach((x) => x.classList.remove("selected"));
      c.classList.add("selected");
      state.equipment.heat = c.dataset.v;
      check();
    });
    check();
    $("#next").onclick = () => { saveProfile(); screens.connect(); };
  };

  // ---- Connect Spotify (mocked) ----
  screens.connect = () => {
    h(screenEl("", `
      <div class="dots"><span class="on"></span><span class="on"></span><span class="on"></span></div>
      <p class="eyebrow">Step 4 · Music</p>
      <h1 style="margin-top:10px">Connect your<br>music 🎧</h1>
      <p class="lead" style="margin-top:10px">SearTune syncs cooking cues to the song. The free Free Bird steak cook is on us.</p>
      <div class="stack" style="margin-top:24px">
        <button class="btn" id="spotify" style="background:#1DB954;box-shadow:0 10px 24px rgba(29,185,84,.3)">Connect Spotify</button>
        <button class="btn secondary" id="skip">Skip for now (use demo audio)</button>
      </div>
      <div style="margin-top:22px">${voicePickerHTML()}</div>
      <div class="ad">
        <p>FREE TIER · <b>ad placement</b></p>
        <p style="margin-top:4px">Your sponsored banner runs here between actions.</p>
      </div>
    `));
    wireVoicePicker();
    $("#spotify").onclick = () => screens.premium();
    $("#skip").onclick = () => screens.home();
  };

  // ---- Home ----
  screens.home = () => {
    const name = state.email ? state.email[0].toUpperCase() : "S";
    const feat = EXPERIENCES[0];
    h(screenEl("", `
      <div class="topbar">
        <div style="display:flex;align-items:center;gap:12px">
          <button class="icon-btn" id="hamburger" aria-label="Open menu" aria-haspopup="true">☰</button>
          <div>
            <p class="muted" style="font-size:13px">${greeting()}</p>
            <div class="brand-lockup"><img class="brand-logo" src="assets/logo.png" alt="" aria-hidden="true" /><span class="brand gradient-text">SearTune</span></div>
          </div>
        </div>
        <div class="avatar">${name}</div>
      </div>

      <p class="lead">${state.isBeginner ? "First cook? Let's make it a good one." : "Pick tonight's vibe."}</p>

      <p class="section-title">Tonight's cook</p>
      <div class="exp-card" id="featured">
        <div class="glow"></div>
        <div class="big-emoji">${feat.recipe.emoji}</div>
        <span class="pill free" style="position:relative;align-self:flex-start">★ FREE · MUSIC-SYNCED</span>
        <h2 style="margin-top:auto">${feat.recipe.title}</h2>
        <p class="song">🎸 ${feat.song.title} · ${feat.song.artist}</p>
        <div class="row">
          <span class="pill">⏱ ~${Math.round(feat.durationSec / 60)} min</span>
          <span class="pill">${feat.recipe.technique}</span>
          <span class="pill">🟢 Beginner-proof</span>
        </div>
      </div>
      <p class="muted" style="font-size:12px;margin-top:8px">🔥 1,204 people cooked this · 4.8★</p>

      ${EXPERIENCES.length > 1 ? `
      <p class="section-title">🎵 More music cooks</p>
      <div class="catalog">
        ${EXPERIENCES.slice(1).map((x, i) => `
          <button class="rcard mexp" data-mexp="${i + 1}">
            <div class="rthumb" style="display:grid;place-items:center;font-size:34px;background:linear-gradient(160deg,#2a1410,#1a0f1a)">${x.recipe.emoji}</div>
            <div class="rinfo">
              <b>${x.recipe.title}</b>
              <small>🎸 ${x.song.title} · ${x.song.artist}</small>
              <div class="rrow"><span class="pill diff-easy">MUSIC-SYNCED</span><span class="pill">⏱ ~${Math.round(x.durationSec / 60)} min</span></div>
            </div>
          </button>`).join("")}
      </div>` : ""}

      ${isPremium() ? `
      <div class="section-title" style="display:flex;justify-content:space-between;align-items:center">
        <span>✅ Easy picks to start</span><span class="pill">Guided mode</span>
      </div>
      <p class="muted" style="font-size:12px;margin:-6px 2px 10px">Beginner-friendly cooks with conservative timing & safety checks.</p>
      <div id="easyPicks" class="catalog"><p class="muted" style="font-size:13px">Loading recipes…</p></div>

      <p class="section-title">🔍 Find any recipe</p>
      <p class="muted" style="font-size:12px;margin:-6px 2px 10px">Search the full TheMealDB catalog — easy, medium & hard.</p>
      <div class="searchrow">
        <input class="field" id="rsearch" placeholder="Search all of TheMealDB… e.g. curry, pasta" autocomplete="off" />
        <button class="icon-btn" id="rsearchBtn" title="Search">🔍</button>
      </div>
      <div id="searchResults" class="catalog"><p class="muted" style="font-size:12px">Search above to find more recipes.</p></div>
      ` : `
      <p class="section-title">Unlock with Premium</p>
      <button class="prem-cta" id="premLock">
        <div class="prem-emoji">🍝</div>
        <span class="pill premium">🔒 PREMIUM</span>
        <h2>Unlock the full recipe library</h2>
        <p>100s of recipes from TheMealDB, plus cook to your own Spotify songs &amp; playlists.</p>
        <span class="prem-go">Go Premium →</span>
      </button>
      `}

      <div class="ad"><p>FREE TIER · <b>ad placement</b> · upgrade to remove ads</p></div>
      <p class="attribution" id="attr"></p>
      <div style="height:18px"></div>
    `));
    $("#featured").onclick = () => { EXP = EXPERIENCES[0]; screens.prep(); };
    $$(".mexp").forEach((b) => b.onclick = () => { EXP = EXPERIENCES[+b.dataset.mexp]; screens.prep(); });
    $("#hamburger").onclick = () => Sidebar.open();
    Sidebar.setActive("home");
    const lock = $("#premLock"); if (lock) lock.onclick = () => screens.premium();

    if (isPremium()) {
      renderEasyPicks();
      // live search across all of TheMealDB
      const si = app.querySelector("#rsearch"), sb = app.querySelector("#rsearchBtn");
      const run = () => doSearch(si.value.trim());
      if (sb) sb.onclick = run;
      if (si) si.onkeydown = (e) => { if (e.key === "Enter") run(); };
    }
  };

  function greeting() {
    const hr = new Date().getHours();
    return hr < 12 ? "Good morning 👋" : hr < 18 ? "Good afternoon 👋" : "Good evening 👋";
  }

  // in-app playable demo tracks (royalty-free). "Any song" via the platform opens externally.
  const MUSIC_LIBRARY = [
    { id: "audio/steak-music.mp3", label: "Funk / Breakbeat" },
    { id: "audio/eggs-music.mp3", label: "Calm / Sunrise" },
  ];

  // ---- Premium: payment coming soon → dev code → connect Spotify (real) / Apple ----
  let premiumTab = "spotify";
  let spLibTab = "search"; // which library sub-tab is open (search any song by default)
  let spForceIdEntry = false; // advanced: show the "use your own Spotify app" Client ID entry

  screens.premium = () => {
    Sidebar.setActive("premium");
    const spLoggedIn = !!(window.Spotify_ && Spotify_.isLoggedIn());
    h(screenEl("", `
      <div class="topbar">
        <button class="btn ghost" id="back" style="width:auto;padding-left:0">← Back</button>
        <button class="icon-btn" id="hamburger" aria-label="Open menu">☰</button>
      </div>
      <h1 style="margin-top:6px">⭐ Premium</h1>

      ${!isPremium() ? `
        <div class="card" style="margin-top:14px">
          <p class="eyebrow" style="color:var(--flame-2);margin-bottom:6px">Coming soon</p>
          <h2>🔒 Purchase link coming soon</h2>
          <p class="lead" style="margin-top:8px">Premium unlocks the full TheMealDB recipe library and lets you cook to your own Spotify or Apple Music. We'll notify you when it launches.</p>
        </div>
        <p class="section-title" style="margin-top:20px">Developer / tester access</p>
        <div class="card">
          <p class="muted" style="font-size:13px;margin-bottom:12px">Have a developer code? Enter it below to unlock Premium for testing.</p>
          <div class="searchrow">
            <input class="field" id="devcode" placeholder="Developer code" autocomplete="off" autocapitalize="none" />
            <button class="icon-btn" id="redeem" title="Unlock" style="width:auto;padding:0 16px;font-weight:800;color:#fff">Unlock</button>
          </div>
        </div>
      ` : `
        <div class="card" style="margin-top:14px;border-color:var(--pop)">
          <h2>✓ Premium active</h2>
          <p class="lead" style="margin-top:8px">No ads · full recipe library · cook to any song or playlist.</p>
        </div>
        <p class="section-title" style="margin-top:20px">Connect your music</p>
        <p class="muted" style="font-size:12px;margin:-8px 2px 12px">Connect a platform to cook to your own songs. You must connect to use custom music.</p>
        <div class="stack">
          <button class="choice ${premiumTab === "spotify" ? "selected" : ""}" data-tab="spotify">${SPOTIFY_SVG}<span>Spotify${spLoggedIn ? " — connected ✓" : ""}</span></button>
          <button class="choice ${premiumTab === "apple" ? "selected" : ""}" data-tab="apple">${APPLE_MUSIC_SVG}<span>Apple Music${state.musicPlatform === "apple" ? " — connected ✓" : ""}</span></button>
        </div>
        <div id="connectArea" style="margin-top:14px"></div>
      `}
    `));
    $("#back").onclick = () => screens.home();
    $("#hamburger").onclick = () => Sidebar.open();
    if (!isPremium()) {
      $("#redeem").onclick = async () => {
        const code = $("#devcode").value.trim();
        if (backendOn() && API.isLoggedIn()) {
          try { const { user } = await API.redeem(code); applyServerUser(user); toast("Premium unlocked 🎉 — now connect your music below."); screens.premium(); }
          catch (e) { toast("Invalid developer code"); }
          return;
        }
        if (code === DEV_CODE) { state.tier = "premium"; saveEnt(); toast("Premium unlocked 🎉 — now connect your music below."); screens.premium(); }
        else toast("Invalid developer code");
      };
      $("#devcode").onkeydown = (e) => { if (e.key === "Enter") $("#redeem").click(); };
      return;
    }
    $$(".choice[data-tab]").forEach((b) => b.onclick = () => { premiumTab = b.dataset.tab; renderConnectArea(); $$(".choice[data-tab]").forEach((x) => x.classList.toggle("selected", x.dataset.tab === premiumTab)); });
    renderConnectArea();
  };

  function renderConnectArea() {
    const box = $("#connectArea");
    if (!box) return;

    // ---- Apple Music ----
    if (premiumTab === "apple") {
      box.innerHTML = `
        <p class="muted" style="font-size:12px;line-height:1.5">Apple Music requires a <b>paid Apple Developer account</b> ($99/yr) to generate a developer token (MusicKit JS). This is the next step once that account is set up.</p>`;
      return;
    }

    // ---- Spotify ----
    const sp = window.Spotify_;
    if (!sp) { box.innerHTML = `<p class="muted">Spotify module failed to load.</p>`; return; }

    // Advanced: let a power user point SearTune at their own Spotify app.
    if (spForceIdEntry) {
      box.innerHTML = `
        <p class="muted" style="font-size:12px;line-height:1.5">Paste your own app's <b>Client ID</b> (create one free at <a href="https://developer.spotify.com/dashboard" target="_blank" style="color:var(--flame-2)">developer.spotify.com/dashboard</a>).</p>
        <div class="searchrow" style="margin-top:12px">
          <input class="field" id="spClient" placeholder="Paste Client ID…" autocomplete="off" autocapitalize="none" />
          <button class="icon-btn" id="spSave" style="width:auto;padding:0 16px;font-weight:800;color:#fff">Save</button>
        </div>
        <button class="btn ghost" id="spUseDefault" style="margin-top:8px;font-size:12px">← Use the built-in SearTune app instead</button>`;
      $("#spSave").onclick = () => { const v = $("#spClient").value.trim(); if (!v) return toast("Paste your Client ID first"); sp.setClientId(v); spForceIdEntry = false; toast("Saved ✓"); renderConnectArea(); };
      $("#spUseDefault").onclick = () => { sp.setClientId(""); spForceIdEntry = false; renderConnectArea(); };
      return;
    }

    if (!sp.isLoggedIn()) {
      box.innerHTML = `
        <p class="muted" style="font-size:12px;line-height:1.5;margin-bottom:12px">Just log in with your Spotify account to connect your library. In-app streaming requires <b>Spotify Premium</b>.</p>
        <button class="btn" id="spLogin" style="background:#1DB954;box-shadow:0 8px 20px rgba(29,185,84,.3)">Log in with Spotify</button>
        <button class="btn ghost" id="spReset" style="margin-top:8px;font-size:12px">Use your own Spotify app</button>`;
      $("#spLogin").onclick = () => sp.login().catch(() => toast("Could not start Spotify login"));
      $("#spReset").onclick = () => { spForceIdEntry = true; renderConnectArea(); };
      return;
    }

    // ---- Logged in: show library panel ----
    state.musicPlatform = "spotify"; state.spotifyConnected = true; saveEnt();
    sp.loadSdk(); // eagerly create + connect the player so it's ready before the cook starts
    box.innerHTML = `
      <div class="sp-header">
        <p class="lead" id="spWho" style="font-size:14px;margin:0">✓ Spotify connected</p>
        <button class="btn ghost" id="spLogout" style="width:auto;font-size:12px;padding:4px 10px">Disconnect</button>
      </div>
      ${state.spotifyLabel ? `<p class="muted" style="font-size:12px;margin:6px 0 0">Selected: <b>${esc(state.spotifyLabel)}</b></p>` : ""}
      <div class="row" style="display:flex;gap:8px;margin-top:10px">
        <button class="btn secondary" id="spTest" style="flex:1;font-size:13px">▶ Test playback</button>
        <button class="btn secondary" id="spStop" style="width:auto;font-size:13px;padding:0 14px" title="Stop the test playback">⏹ Stop</button>
        <button class="btn ghost" id="spReconnect" style="width:auto;font-size:12px;padding:0 12px" title="Log in again to refresh permissions">↻ Reconnect</button>
      </div>
      <p class="muted" id="spDiag" style="font-size:11px;line-height:1.5;margin:8px 2px 0"></p>

      <div class="sp-tabs" style="margin-top:14px">
        <button class="sp-tab ${spLibTab === "search" ? "active" : ""}" data-lib="search">🔍 Search any song</button>
        <button class="sp-tab ${spLibTab === "playlists" ? "active" : ""}" data-lib="playlists">Your playlists</button>
        <button class="sp-tab ${spLibTab === "top" ? "active" : ""}" data-lib="top">Top tracks</button>
      </div>
      <div id="spLibPanel" style="margin-top:10px"><p class="muted" style="font-size:12px">Loading…</p></div>
      <button class="btn ghost" id="spClear" style="margin-top:10px;font-size:12px;display:${state.spotifyUri ? "block" : "none"}">✕ Clear selection</button>`;

    sp.me().then((m) => { const w = $("#spWho"); if (w && m) w.textContent = `✓ Connected as ${m.display_name || m.email}`; }).catch(() => {});
    const testBtn = $("#spTest");
    if (testBtn) testBtn.onclick = async () => {
      const diag = $("#spDiag");
      testBtn.disabled = true; testBtn.textContent = "Testing…";
      try { await sp.activate(); } catch (e) {}
      const s = await sp.status();
      const lines = [
        `player ready: ${s.deviceId ? "yes" : "no"}${s.deviceId ? "" : " — SDK device not registered"}`,
        `web API search: ${s.searchErr ? "❌ " + esc(s.searchErr) : (s.searchCount + " results")}`,
      ];
      if (s.meErr) lines.push(`/me: ❌ ${esc(s.meErr)}`);
      if ((s.meErr && /403/.test(s.meErr)) || (s.searchErr && /403/.test(s.searchErr))) {
        lines.push(`⚠️ <b>403 on every Web API call</b> = the account you logged in with is NOT on this app's <b>User Management</b> allowlist. Verify the app + email below match exactly, then ↻ Reconnect.`);
        lines.push(`• Client ID in use: <code style="font-size:10px">${esc(s.clientId || "(none)")}</code> — this MUST be the app whose User Management you edited.`);
        lines.push(`• Redirect URI: <code style="font-size:10px">${esc(s.redirectUri)}</code>`);
        lines.push(`• Tip: log out of Spotify in your browser first if you may be signed into a different account than the one you allowlisted.`);
      }
      if ((s.meErr && /401/.test(s.meErr)) || (s.searchErr && /401/.test(s.searchErr)))
        lines.push(`⚠️ 401 = token rejected. Hit <b>Reconnect</b> below to log in again.`);
      if (s.product && s.product !== "premium") lines.push(`⚠️ in-app playback needs Spotify Premium (you're "${s.product}")`);
      if (!state.spotifyUri) lines.push(`ℹ️ no track selected — search & pick a song below, then Test again`);
      if (state.spotifyUri) {
        try { await sp.play(state.spotifyUri); lines.push("✅ play command accepted — you should hear audio"); }
        catch (e) { lines.push(`❌ play failed: ${esc(e.message || "error")}${e.status ? " (HTTP " + e.status + ")" : ""}${e.code ? " · " + esc(e.code) : ""}`); }
      }
      if (s.lastError) lines.push(`SDK: ${esc(s.lastError)}`);
      if (diag) diag.innerHTML = lines.join("<br>");
      testBtn.disabled = false; testBtn.textContent = "▶ Test playback again";
    };
    const reconnBtn = $("#spReconnect");
    if (reconnBtn) reconnBtn.onclick = () => { sp.login().catch(() => toast("Could not start Spotify login")); };
    const stopBtn = $("#spStop");
    if (stopBtn) stopBtn.onclick = () => { try { sp.stop(); } catch (e) {} toast("Playback stopped ⏹"); };
    $$(".sp-tab").forEach((b) => b.onclick = () => { spLibTab = b.dataset.lib; $$(".sp-tab").forEach((x) => x.classList.toggle("active", x.dataset.lib === spLibTab)); renderLibPanel(); });
    const clearBtn = $("#spClear"); if (clearBtn) clearBtn.onclick = () => { state.spotifyUri = null; state.spotifyLabel = null; saveEnt(); toast("Selection cleared"); renderConnectArea(); };
    $("#spLogout").onclick = () => { sp.logout(); state.spotifyUri = null; state.spotifyLabel = null; state.musicPlatform = null; state.spotifyConnected = false; saveEnt(); toast("Disconnected"); screens.premium(); };
    renderLibPanel();
  }

  function renderLibPanel() {
    const panel = $("#spLibPanel");
    if (!panel) return;
    const sp = window.Spotify_;

    const pickItem = (uri, label) => {
      state.spotifyUri = uri; state.spotifyLabel = label; state.customAudio = null; saveEnt();
      toast("Set as cooking music ✓"); renderConnectArea();
    };

    const smallImg = (imgs) => (imgs && imgs.length) ? imgs[imgs.length - 1].url : null; // smallest variant
    const itemsHTML = (items) => items.length
      ? items.map((it) => `<button class="choice sp-item ${state.spotifyUri === it.uri ? "selected" : ""}" data-uri="${it.uri}" data-label="${esc(it.label)}">${it.img ? `<img class="sp-art" src="${esc(it.img)}" alt="" loading="lazy">` : `<span class="emoji">${it.kind}</span>`}<span>${esc(it.label)}</span></button>`).join("")
      : `<p class="muted" style="font-size:12px">Nothing found.</p>`;

    const errHTML = (e) => {
      const code = e && e.status;
      let hint = "";
      if (code === 403) hint = "Your Spotify app is in <b>Development Mode</b> — add your account under <b>User Management</b> in the dashboard, or hit ↻ Reconnect above.";
      else if (code === 401) hint = "Session expired — hit ↻ Reconnect above to log in again.";
      else hint = "Check your connection, or hit ↻ Reconnect above.";
      return `<p class="muted" style="font-size:12px">❌ ${esc((e && e.message) || "Request failed")}${code ? " (HTTP " + code + ")" : ""}<br>${hint}</p>`;
    };
    const wireItems = (root) => Array.from(root.querySelectorAll(".sp-item")).forEach((b) => b.onclick = () => pickItem(b.dataset.uri, b.dataset.label));

    if (spLibTab === "playlists") {
      panel.innerHTML = `<p class="muted" style="font-size:12px">Loading your playlists…</p>`;
      sp.myPlaylists().then((d) => {
        const items = ((d && d.items) || []).filter(Boolean).map((p) => ({ uri: p.uri, label: p.name + (p.tracks ? ` · ${p.tracks.total} tracks` : ""), kind: "🎧", img: smallImg(p.images) }));
        panel.innerHTML = itemsHTML(items);
        wireItems(panel);
      }).catch((e) => { panel.innerHTML = errHTML(e); });

    } else if (spLibTab === "top") {
      panel.innerHTML = `<p class="muted" style="font-size:12px">Loading your top tracks…</p>`;
      sp.myTopTracks().then((d) => {
        const items = ((d && d.items) || []).filter(Boolean).map((t) => ({ uri: t.uri, label: `${t.name} — ${t.artists.map((a) => a.name).join(", ")}`, kind: "🎵", img: smallImg(t.album && t.album.images) }));
        panel.innerHTML = itemsHTML(items);
        wireItems(panel);
      }).catch((e) => { panel.innerHTML = errHTML(e); });

    } else {
      panel.innerHTML = `
        <div class="searchrow">
          <input class="field" id="spq" placeholder="Search any song, artist, or playlist…" autocomplete="off" autofocus />
          <button class="icon-btn" id="spgo" title="Search">🔍</button>
        </div>
        <p class="muted" style="font-size:11px;margin:6px 2px 0">Pick any track on Spotify to cook to.</p>
        <div id="spResults" class="stack" style="margin-top:10px"></div>`;
      const runSp = async () => {
        const q = $("#spq").value.trim(); if (!q) return;
        const res = $("#spResults"); res.innerHTML = `<p class="muted" style="font-size:12px">Searching…</p>`;
        try {
          const data = await sp.search(q);
          const items = [
            ...((data.tracks && data.tracks.items) || []).filter(Boolean).map((t) => ({ uri: t.uri, label: `${t.name} — ${t.artists.map((a) => a.name).join(", ")}`, kind: "🎵", img: smallImg(t.album && t.album.images) })),
            ...((data.playlists && data.playlists.items) || []).filter(Boolean).map((p) => ({ uri: p.uri, label: `${p.name} · playlist`, kind: "🎧", img: smallImg(p.images) })),
            ...((data.albums && data.albums.items) || []).filter(Boolean).map((a) => ({ uri: a.uri, label: `${a.name} — ${a.artists.map((x) => x.name).join(", ")} · album`, kind: "💿", img: smallImg(a.images) })),
          ];
          res.innerHTML = items.length ? itemsHTML(items) : `<p class="muted" style="font-size:12px">No results for “${esc(q)}”.</p>`;
          wireItems(res);
        } catch (e) { res.innerHTML = errHTML(e); }
      };
      $("#spgo").onclick = runSp;
      $("#spq").onkeydown = (e) => { if (e.key === "Enter") runSp(); };
    }
  }

  // ============================================================
  // In-cook Spotify music picker (steak/eggs prep) — playlists/top/search,
  // with shuffle (playlists), play-&-loop or queue (songs). No external redirect.
  // ============================================================
  const spotifyReady = () => isPremium() && state.musicPlatform === "spotify" && window.Spotify_ && Spotify_.isLoggedIn();

  function clearSpotifySel() {
    state.spotifyKind = null; state.spotifyUri = null; state.spotifyLabel = null;
    state.spotifyQueue = []; state.spotifyShuffle = false; state.spotifyLoop = false; saveEnt();
  }
  function pickPlaylist(uri, label) {
    state.spotifyKind = "playlist"; state.spotifyUri = uri; state.spotifyLabel = label;
    state.spotifyQueue = []; state.spotifyLoop = false; state.customAudio = null; saveEnt();
  }
  function pickTrackLoop(uri, label) {
    state.spotifyKind = "track"; state.spotifyUri = uri; state.spotifyLabel = label;
    state.spotifyLoop = true; state.spotifyQueue = []; state.customAudio = null; saveEnt();
  }
  function queueItem(uri, label, kind, img) {
    if (state.spotifyKind !== "queue") state.spotifyQueue = [];
    state.spotifyQueue.push({ uri, label, kind: kind || "track", img: img || null });
    state.spotifyKind = "queue"; state.spotifyUri = null; state.spotifyLabel = null; state.customAudio = null;
  }
  function cookSelectionLabel() {
    if (state.spotifyKind === "queue" && state.spotifyQueue.length) return `Queue · ${state.spotifyQueue.length} item${state.spotifyQueue.length > 1 ? "s" : ""}`;
    if (state.spotifyKind === "playlist" && state.spotifyLabel) return state.spotifyLabel + (state.spotifyShuffle ? " · 🔀" : "");
    if (state.spotifyKind === "track" && state.spotifyLabel) return state.spotifyLabel + (state.spotifyLoop ? " · 🔁" : "");
    return null;
  }
  // the sel object handed to Spotify_.playSelection on Start
  function currentSpotifySel() {
    if (!spotifyReady()) return null;
    if (state.spotifyKind === "queue" && state.spotifyQueue.length) return { kind: "queue", queue: state.spotifyQueue.slice() };
    if (state.spotifyKind === "playlist" && state.spotifyUri) return { kind: "playlist", uri: state.spotifyUri, shuffle: !!state.spotifyShuffle };
    if (state.spotifyKind === "track" && state.spotifyUri) return { kind: "track", uri: state.spotifyUri, loop: !!state.spotifyLoop };
    return null;
  }

  let cookPickTab = "search";
  const cookErrHTML = (e) => `<p class="muted" style="font-size:12px">❌ ${esc((e && e.message) || "Request failed")}${e && e.status ? ` (HTTP ${e.status})` : ""}. Reconnect in the Premium tab.</p>`;

  function mountCookMusicPicker(rootSel, opts) {
    const hasDemo = !!(opts && opts.hasDemo); // steak/eggs have a bundled demo track; TheMealDB recipes don't
    const root = document.querySelector(rootSel);
    if (!root || !window.Spotify_) return;
    const sp = window.Spotify_;
    sp.loadSdk(); // warm the player so Start is instant

    const smallImg = (imgs) => (imgs && imgs.length) ? imgs[imgs.length - 1].url : null; // smallest variant
    const artHTML = (url, fallback) => url ? `<img class="sp-art" src="${esc(url)}" alt="" loading="lazy">` : `<span class="sp-art ph">${fallback}</span>`;
    const trackRow = (uri, label, img) => `<div class="sp-trackrow">${artHTML(img, "🎵")}<span class="sp-tname">${esc(label)}</span><span class="sp-tacts">
      <button class="mini" data-loop data-uri="${uri}" data-label="${esc(label)}" data-img="${esc(img || "")}" title="Play this on loop">🔁 Loop</button>
      <button class="mini" data-queue data-uri="${uri}" data-label="${esc(label)}" data-img="${esc(img || "")}" title="Add to the queue">＋ Queue</button></span></div>`;
    const plRow = (uri, label, img) => `<div class="sp-trackrow">${artHTML(img, "🎧")}<span class="sp-tname">${esc(label)}</span><span class="sp-tacts">
      <button class="mini" data-play data-uri="${uri}" data-label="${esc(label)}" data-img="${esc(img || "")}" title="Play this playlist">▶ Play</button>
      <button class="mini" data-qpl data-uri="${uri}" data-label="${esc(label)}" data-img="${esc(img || "")}" title="Add this playlist to the queue">＋ Queue</button></span></div>`;
    const wireTracks = (box) => {
      box.querySelectorAll("[data-loop]").forEach((b) => b.onclick = () => { pickTrackLoop(b.dataset.uri, b.dataset.label); toast("Will play & loop ✓"); summary(); refreshPanelSel(); });
      box.querySelectorAll("[data-queue]").forEach((b) => b.onclick = () => { queueItem(b.dataset.uri, b.dataset.label, "track", b.dataset.img || null); toast("Added to queue ✓"); summary(); });
    };
    const wirePlaylists = (box) => {
      box.querySelectorAll("[data-play]").forEach((b) => b.onclick = () => { pickPlaylist(b.dataset.uri, b.dataset.label); toast("Playlist set ✓"); summary(); refreshPanelSel(); });
      box.querySelectorAll("[data-qpl]").forEach((b) => b.onclick = () => { queueItem(b.dataset.uri, b.dataset.label, "playlist", b.dataset.img || null); toast("Playlist added to queue ✓"); summary(); });
    };
    const refreshPanelSel = () => { root.querySelectorAll(".sp-item").forEach((b) => b.classList.toggle("selected", b.dataset.uri === state.spotifyUri)); };

    function summary() {
      const box = root.querySelector("#cookSelSummary");
      if (!box) return;
      const label = cookSelectionLabel();
      if (!label) { box.innerHTML = `<p class="muted" style="font-size:11px;margin:0">${hasDemo ? "No Spotify pick — the free demo track will play." : "No Spotify pick — the cook runs without music."} Choose a song/playlist above and it starts automatically on Start.</p>`; return; }
      let html = `<div class="card" style="padding:12px"><p style="font-size:12px;margin:0;color:var(--text)">▶ On Start: <b>${esc(label)}</b></p>`;
      if (state.spotifyKind === "playlist") html += `<label class="sp-toggle"><input type="checkbox" id="ckShuffle" ${state.spotifyShuffle ? "checked" : ""}/> 🔀 Shuffle this playlist</label>`;
      if (state.spotifyKind === "queue" && state.spotifyQueue.length) {
        html += `<p class="muted" style="font-size:10px;margin:8px 2px 2px">Plays in this order — drag ⠿ to reorder.</p>`;
        html += `<ul class="qlist">${state.spotifyQueue.map((q, i) => `<li draggable="true" data-i="${i}"><span class="qhandle" title="Drag to reorder">⠿</span>${q.img ? `<img class="sp-art" src="${esc(q.img)}" alt="">` : `<span class="sp-art ph">${q.kind === "playlist" ? "🎧" : "🎵"}</span>`}<span class="qname">${esc(q.label)}</span><button class="qx" data-i="${i}" title="Remove">✕</button></li>`).join("")}</ul>`;
      }
      html += `<button class="btn ghost" id="ckClear" style="margin-top:8px;font-size:12px">✕ Clear selection</button></div>`;
      box.innerHTML = html;
      const sh = box.querySelector("#ckShuffle"); if (sh) sh.onchange = () => { state.spotifyShuffle = sh.checked; saveEnt(); summary(); };
      const cl = box.querySelector("#ckClear"); if (cl) cl.onclick = () => { clearSpotifySel(); summary(); refreshPanelSel(); };
      box.querySelectorAll(".qx").forEach((b) => b.onclick = () => { state.spotifyQueue.splice(+b.dataset.i, 1); if (!state.spotifyQueue.length) state.spotifyKind = null; summary(); });
      // drag-to-reorder the queue
      let dragFrom = null;
      box.querySelectorAll(".qlist li").forEach((li) => {
        li.ondragstart = (e) => { dragFrom = +li.dataset.i; li.classList.add("dragging"); try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(dragFrom)); } catch (_) {} };
        li.ondragend = () => { li.classList.remove("dragging"); box.querySelectorAll(".qlist li").forEach((x) => x.classList.remove("dragover")); };
        li.ondragover = (e) => { e.preventDefault(); try { e.dataTransfer.dropEffect = "move"; } catch (_) {} li.classList.add("dragover"); };
        li.ondragleave = () => li.classList.remove("dragover");
        li.ondrop = (e) => {
          e.preventDefault();
          const to = +li.dataset.i;
          if (dragFrom != null && dragFrom !== to) { const a = state.spotifyQueue; const [m] = a.splice(dragFrom, 1); a.splice(to, 0, m); summary(); }
          dragFrom = null;
        };
      });
    }

    function panel() {
      const box = root.querySelector("#cookPickPanel");
      if (!box) return;
      if (cookPickTab === "playlists") {
        box.innerHTML = `<p class="muted" style="font-size:12px">Loading your playlists…</p>`;
        sp.myPlaylists().then((d) => {
          const items = ((d && d.items) || []).filter(Boolean);
          box.innerHTML = items.length ? items.map((p) => plRow(p.uri, p.name + (p.tracks ? ` · ${p.tracks.total} tracks` : ""), smallImg(p.images))).join("") : `<p class="muted" style="font-size:12px">No playlists found.</p>`;
          wirePlaylists(box);
        }).catch((e) => box.innerHTML = cookErrHTML(e));
      } else if (cookPickTab === "top") {
        box.innerHTML = `<p class="muted" style="font-size:12px">Loading your top tracks…</p>`;
        sp.myTopTracks().then((d) => {
          const items = ((d && d.items) || []).filter(Boolean);
          box.innerHTML = items.length ? items.map((t) => trackRow(t.uri, `${t.name} — ${t.artists.map((a) => a.name).join(", ")}`, smallImg(t.album && t.album.images))).join("") : `<p class="muted" style="font-size:12px">No top tracks yet.</p>`;
          wireTracks(box);
        }).catch((e) => box.innerHTML = cookErrHTML(e));
      } else {
        box.innerHTML = `
          <div class="searchrow">
            <input class="field" id="ckq" placeholder="Search any song…" autocomplete="off" />
            <button class="icon-btn" id="ckgo" title="Search">🔍</button>
          </div>
          <div id="ckResults" class="stack" style="margin-top:10px"></div>`;
        const res = box.querySelector("#ckResults");
        const closeResults = () => { res.innerHTML = ""; const i = box.querySelector("#ckq"); if (i) { i.value = ""; i.focus(); } };
        const run = async () => {
          const q = box.querySelector("#ckq").value.trim(); if (!q) return;
          res.innerHTML = `<p class="muted" style="font-size:12px">Searching…</p>`;
          try {
            const data = await sp.search(q);
            const tracks = ((data.tracks && data.tracks.items) || []).filter(Boolean);
            const pls = ((data.playlists && data.playlists.items) || []).filter(Boolean);
            let inner = tracks.map((t) => trackRow(t.uri, `${t.name} — ${t.artists.map((a) => a.name).join(", ")}`, smallImg(t.album && t.album.images))).join("");
            if (pls.length) inner += `<p class="muted" style="font-size:11px;margin:12px 2px 4px">Playlists</p>` + pls.map((p) => plRow(p.uri, p.name, smallImg(p.images))).join("");
            res.innerHTML = inner
              ? `<div class="searchhead">Results for “${esc(q)}”<button id="ckClose" title="Close results">✕ close</button></div>` + inner
              : `<div class="searchhead">No results for “${esc(q)}”<button id="ckClose" title="Close results">✕ close</button></div>`;
            wireTracks(res);
            wirePlaylists(res);
            const cl = res.querySelector("#ckClose"); if (cl) cl.onclick = closeResults;
          } catch (e) { res.innerHTML = cookErrHTML(e); }
        };
        box.querySelector("#ckgo").onclick = run;
        box.querySelector("#ckq").onkeydown = (e) => { if (e.key === "Enter") run(); };
      }
    }

    root.innerHTML = `
      <div class="sp-tabs">
        <button class="sp-tab ${cookPickTab === "search" ? "active" : ""}" data-ct="search">🔍 Search</button>
        <button class="sp-tab ${cookPickTab === "playlists" ? "active" : ""}" data-ct="playlists">Playlists</button>
        <button class="sp-tab ${cookPickTab === "top" ? "active" : ""}" data-ct="top">Top tracks</button>
      </div>
      <div id="cookPickPanel" style="margin-top:10px"></div>
      <div id="cookSelSummary" style="margin-top:10px"></div>
      <button class="btn ghost" id="ckDemo" style="margin-top:8px;font-size:12px">${hasDemo ? "🎵 Use the free demo track instead" : "🔇 Cook without music"}</button>`;
    root.querySelectorAll(".sp-tab").forEach((b) => b.onclick = () => { cookPickTab = b.dataset.ct; root.querySelectorAll(".sp-tab").forEach((x) => x.classList.toggle("active", x.dataset.ct === cookPickTab)); panel(); });
    const demoBtn = root.querySelector("#ckDemo");
    if (demoBtn) demoBtn.onclick = () => { clearSpotifySel(); summary(); refreshPanelSel(); toast(hasDemo ? "Using the free demo track 🎵" : "No music selected"); };
    panel(); summary();
  }

  // ---- TheMealDB catalog (imported via tools/import_themealdb.py) ----
  let CATALOG = null;
  async function loadCatalog() {
    if (CATALOG) return CATALOG;
    try { CATALOG = await (await fetch("recipes.json?v=3", { cache: "no-store" })).json(); }
    catch (e) { CATALOG = { recipes: [], attribution: "" }; }
    return CATALOG;
  }

  function diffBadge(d) {
    const map = { easy: ["EASY", "diff-easy"], medium: ["MEDIUM", "diff-medium"], hard: ["HARD", "diff-hard"] };
    const [label, cls] = map[d] || map.medium;
    return `<span class="pill ${cls}">${label}</span>`;
  }

  // render a list of recipe objects into a target box, wiring clicks from that list
  function renderCards(list, headerHTML, sel) {
    const box = app.querySelector(sel || "#searchResults");
    if (!box) return;
    const cards = list.map((r) => `
      <button class="rcard" data-id="${r.id}">
        <div class="rthumb" style="background-image:url('${r.thumb}')">
          ${r.hasSafetyGate ? `<span class="rsafety" title="Has doneness safety checks">🌡️</span>` : ""}
        </div>
        <div class="rinfo">
          <b>${r.emoji} ${r.title}</b>
          <small>${[r.area, r.category].filter(Boolean).join(" · ")}</small>
          <div class="rrow">${diffBadge(r.difficulty)}<span class="pill">📋 ${r.stepCount} steps</span><span class="pill">⏱ ~${r.estimatedTimeMin}m</span></div>
        </div>
      </button>`).join("");
    box.innerHTML = (headerHTML || "") + cards;
    box.querySelectorAll(".rcard").forEach((c) => c.onclick = () => {
      const r = list.find((x) => x.id === c.dataset.id);
      if (r) screens.recipeDetail(r);
    });
    const clear = box.querySelector("#clearSearch");
    if (clear) clear.onclick = clearSearch;
  }

  function clearSearch() {
    const si = app.querySelector("#rsearch"); if (si) si.value = "";
    const box = app.querySelector("#searchResults");
    if (box) box.innerHTML = `<p class="muted" style="font-size:12px">Search above to find more recipes.</p>`;
  }

  // Easy picks section — only the EASY, beginner-friendly recipes
  async function renderEasyPicks() {
    const data = await loadCatalog();
    const box = app.querySelector("#easyPicks");
    if (!box) return; // navigated away
    if (!data.recipes.length) { box.innerHTML = `<p class="muted" style="font-size:13px">No recipes loaded. Run tools/import_themealdb.py.</p>`; return; }
    let easy = data.recipes.filter((r) => r.difficulty === "easy");
    if (!easy.length) easy = data.recipes.filter((r) => r.difficulty === "medium"); // fall back to medium, never hard
    renderCards(easy, `<p class="muted" style="font-size:12px;margin:0 2px 8px"><span class="pill diff-easy">EASY</span> beginner-friendly picks</p>`, "#easyPicks");
    const attr = app.querySelector("#attr");
    if (attr) attr.textContent = (data.attribution || "");
  }

  async function doSearch(q) {
    const box = app.querySelector("#searchResults");
    if (!box) return;
    if (!q) { clearSearch(); return; }
    box.innerHTML = `<p class="muted" style="font-size:13px">Searching TheMealDB for “${q}”…</p>`;
    try {
      const res = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(q)}`);
      const data = await res.json();
      const meals = data.meals || [];
      const recipes = meals.map((m) => window.RecipeMap.mapMeal(m)).filter((r) => r.stepCount >= 1);
      if (!recipes.length) {
        box.innerHTML = `<p class="muted" style="font-size:13px">No recipes found for “${q}”. Try another word (it searches by dish name).</p>
          <button class="btn ghost" id="clearSearch" style="margin-top:8px">← Clear</button>`;
        box.querySelector("#clearSearch").onclick = clearSearch;
        return;
      }
      renderCards(recipes, `<div class="searchhead">Results for “${q}” · ${recipes.length}<button id="clearSearch">✕ clear</button></div>`, "#searchResults");
    } catch (e) {
      box.innerHTML = `<p class="muted" style="font-size:13px">Search failed (network?). <button class="btn ghost" id="clearSearch">← Clear</button></p>`;
      const c = box.querySelector("#clearSearch"); if (c) c.onclick = clearSearch;
    }
  }

  // ---- rough measure → grams (to scale nutrition to actual usage) ----
  // TheMealDB measures are free-text ("1 cup", "2 tbsp", "200g", "to taste"),
  // so this is a best-effort estimate, clearly labeled as such in the UI.
  function parseQty(s) {
    s = s.trim();
    const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)/); if (mixed) return +mixed[1] + +mixed[2] / +mixed[3];
    const frac = s.match(/^(\d+)\/(\d+)/); if (frac) return +frac[1] / +frac[2];
    const dec = s.match(/^(\d+(?:\.\d+)?)/); if (dec) return parseFloat(dec[1]);
    return null;
  }
  function itemWeight(name) {
    const n = (name || "").toLowerCase();
    if (/\begg/.test(n)) return 50;
    if (/garlic|clove/.test(n)) return 5;
    if (/onion|potato|tomato|apple|pepper|banana|carrot/.test(n)) return 110;
    return 60; // generic small item
  }
  function measureToGrams(measure, name) {
    if (!measure) return 0;
    const s = String(measure).toLowerCase()
      .replace(/½/g, "1/2").replace(/¼/g, "1/4").replace(/¾/g, "3/4").replace(/⅓/g, "1/3").replace(/⅔/g, "2/3").trim();
    const qty = parseQty(s);
    const q = qty == null ? 1 : qty;
    if (/\bkg\b|kilogram/.test(s)) return q * 1000;
    if (/gram|\bg\b|\bgr\b/.test(s)) return q * 1;
    if (/\bml\b|millilit/.test(s)) return q * 1;          // ~1 g/ml
    if (/\b(l|litre|liter)s?\b/.test(s)) return q * 1000;
    if (/\bcups?\b/.test(s)) return q * 240;
    if (/tbsp|tablespoon/.test(s)) return q * 15;
    if (/tsp|teaspoon/.test(s)) return q * 5;
    if (/\boz\b|ounce/.test(s)) return q * 28;
    if (/\blbs?\b|pound/.test(s)) return q * 454;
    if (/clove/.test(s)) return q * 5;
    if (/slices?/.test(s)) return q * 20;
    if (/pinch|dash|to taste|sprinkle|handful|garnish/.test(s)) return 1;
    if (qty != null) return qty * itemWeight(name); // bare number → that many items
    return 0; // unparseable ("to taste") → don't count
  }

  // ---- Recipe detail ----
  screens.recipeDetail = (r) => {
    cookNeeds = recipeNeeds(r); // what this recipe needs (pan material + tools)
    h(screenEl("", `
      <button class="btn ghost" id="back" style="width:auto;align-self:flex-start;padding-left:0">← Back</button>
      <div class="detail-hero" style="background-image:url('${r.thumb}')"></div>
      <h1 style="margin-top:14px">${r.title}</h1>
      <p class="lead" style="margin-top:6px">${[r.area, r.category].filter(Boolean).join(" · ")}</p>
      <div class="row" style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
        ${diffBadge(r.difficulty)}
        <span class="pill">📋 ${r.stepCount} steps</span>
        <span class="pill">⏱ ~${r.estimatedTimeMin}m (generous est.)</span>
        ${r.hasSafetyGate ? `<span class="pill" style="color:#ffd56b">🌡️ doneness checks</span>` : ""}
      </div>

      <p class="section-title">Ingredients</p>
      <div class="card"><ul class="ing">
        ${r.ingredients.map((i) => i.optional
          ? `<li class="opt-ing ${optActive(r.id, i.name) ? "" : "off"}"><label class="opt-ing-label"><input type="checkbox" data-optname="${esc(i.name)}" ${optActive(r.id, i.name) ? "checked" : ""}/><span>${i.name} <em class="opt">(optional)</em></span></label><span class="muted">${i.measure || ""}</span></li>`
          : `<li><span>${i.name}</span><span class="muted">${i.measure || ""}</span></li>`).join("")}
      </ul></div>
      ${backendOn() ? `<button class="btn ghost" id="nutriBtn" style="margin-top:10px;font-size:13px">📊 Show nutrition</button><div id="nutriBox"></div>` : ""}

      <p class="muted" style="font-size:11px;margin-top:14px">${(CATALOG && CATALOG.attribution) || ""}${r.sourceUrl ? ` · <a href="${r.sourceUrl}" target="_blank" style="color:var(--flame-2)">source</a>` : ""}${r.youtube ? ` · <a href="${r.youtube}" target="_blank" style="color:var(--flame-2)">video</a>` : ""}</p>

      ${panChoiceHTML()}

      <div style="margin-top:24px">
      ${spotifyReady() ? `
      <p class="section-title" style="margin-top:0">🎵 Your music <span class="pill premium" style="font-size:10px">PREMIUM</span></p>
      <p class="muted" style="font-size:11px;margin:-4px 2px 8px">Choose any Spotify song or playlist — it starts automatically when you start the cook.</p>
      <div id="cookMusicPicker"></div>`
      : isPremium() ? `
      <button class="connect-music-btn have-premium" id="connectMusic">🎧 Connect Spotify to pick your song</button>`
      : `
      <button class="connect-music-btn" id="connectMusic">⭐ Connect your music <span class="cm-prem">PREMIUM</span></button>`}
      </div>

      <p class="section-title">Cooking voice</p>
      ${voicePickerHTML()}

      <div class="mt-auto" style="margin-top:18px">
        <p class="muted" style="font-size:12px;text-align:center;margin-bottom:10px">Guided mode: tap through steps. Doneness steps need a safe-temp check before you continue.</p>
        <button class="btn" id="cook">▶ Start guided cook</button>
      </div>
    `));
    $("#back").onclick = () => screens.home();
    // optional-ingredient toggles (default ON) — deselect to drop from the list + nutrition
    $$(".opt-ing input[data-optname]").forEach((cb) => cb.onchange = () => {
      toggleOpt(r.id, cb.dataset.optname);
      cb.closest(".opt-ing").classList.toggle("off", !optActive(r.id, cb.dataset.optname));
    });
    const nutriBtn = $("#nutriBtn");
    if (nutriBtn) nutriBtn.onclick = async () => {
      nutriBtn.disabled = true;
      const box = $("#nutriBox");
      const items = r.ingredients.slice(0, 16).filter((i) => !i.optional || optActive(r.id, i.name));
      const results = [];
      for (let i = 0; i < items.length; i++) {
        nutriBtn.textContent = `Loading nutrition… ${i + 1}/${items.length}`;
        try { const d = await API.nutrition(items[i].name); results.push({ name: items[i].name, measure: items[i].measure, n: d.nutrition }); }
        catch (e) { results.push({ name: items[i].name, measure: items[i].measure, n: null }); }
      }
      // Scale each ingredient's per-100g values by the amount actually used.
      let totK = 0, totP = 0, totF = 0, totC = 0, counted = 0, partial = false;
      const rows = results.map(({ name, measure, n }) => {
        if (!n) { partial = true; return `<li><span>${esc(name)}</span><span class="muted" style="font-size:11px">no data</span></li>`; }
        const grams = measureToGrams(measure, name);
        if (!grams) { partial = true; return `<li><span>${esc(name)}${measure ? ` <em class="opt">${esc(measure)}</em>` : ""}</span><span class="nutri">${n.kcal != null ? `${n.kcal}/100g` : ""}</span></li>`; }
        const f = grams / 100;
        const k = n.kcal != null ? Math.round(n.kcal * f) : null;
        const p = n.protein != null ? Math.round(n.protein * f) : null;
        const ft = n.fat != null ? Math.round(n.fat * f) : null;
        const c = n.carbs != null ? Math.round(n.carbs * f) : null;
        if (k != null) { totK += k; counted++; }
        if (p != null) totP += p; if (ft != null) totF += ft; if (c != null) totC += c;
        return `<li><span>${esc(name)}${measure ? ` <em class="opt">${esc(measure)}</em>` : ""}</span><span class="nutri">${k != null ? `<b>${k}</b> kcal` : ""}${p != null ? ` · P${p}` : ""}${ft != null ? ` · F${ft}` : ""}${c != null ? ` · C${c}` : ""}</span></li>`;
      }).join("");
      const totalRow = counted ? `<li class="nutri-total"><span><b>Total (estimated)</b></span><span class="nutri"><b>${totK} kcal</b> · P${totP} · F${totF} · C${totC}</span></li>` : "";
      box.innerHTML = `
        <div class="card" style="margin-top:10px"><ul class="ing nutri-list">${rows}${totalRow}</ul></div>
        <p class="muted" style="font-size:10px;margin-top:6px">Rough estimate — each ingredient's nutrition is scaled from the listed amount${partial ? " (items marked “no data”/“/100g” aren't in the total)" : ""}. Data: curated staples + <a href="https://world.openfoodfacts.org" target="_blank" style="color:var(--flame-2)">Open Food Facts</a>. Measures are free-text, so treat the total as a ballpark.</p>`;
      nutriBtn.style.display = "none";
    };
    if (spotifyReady()) mountCookMusicPicker("#cookMusicPicker", { hasDemo: false });
    const cm = $("#connectMusic"); if (cm) cm.onclick = () => screens.premium();
    wireVoicePicker();
    if (isKokoro()) ensureKokoroLoaded();
    const cookBtn = $("#cook");
    const refreshCook = () => {
      if (noSuitablePan()) { cookBtn.disabled = true; cookBtn.textContent = "Need the right pan ↑"; }
      else if (needsPanChoice()) { cookBtn.disabled = true; cookBtn.textContent = "Pick a pan first ↑"; }
      else { cookBtn.disabled = false; cookBtn.textContent = "▶ Start guided cook"; }
    };
    wirePanChoice(refreshCook);
    refreshCook();
    cookBtn.onclick = async () => {
      if (noSuitablePan()) { toast("You don't own a suitable pan — add one in your profile"); return; }
      if (needsPanChoice()) { toast("Pick the pan you're using first"); return; }
      // activate() must run inside the user gesture to unlock audio in the browser
      if (currentSpotifySel()) { try { await Spotify_.activate(); } catch (e) {} }
      screens.guidedCook(r);
    };
  };

  // ---- Guided cook (tap-through; conservative timing + safety gates) ----
  screens.guidedCook = (r) => {
    let idx = 0;
    let timer = null, remain = 0;
    const session = { mode: "guided", recipe: r.title, category: r.category, difficulty: r.difficulty, equipment: { ...state.equipment }, heatSource: state.equipment.heat, pan: activePan(), pansOwned: [...(state.equipment.pans || [])], experience: state.experience, startedAt: Date.now(), steps: [], totalExtends: 0, completed: false };
    let stepStart = 0, stepExtends = 0;

    function render() {
      const step = r.steps[idx];
      const isDone = !!step.gate;
      const total = r.steps.length;
      const adj = adjustedSec(step.timing.typicalSec);   // personalized to skill + equipment
      const hLevel = step.heat || inferHeat(step.text);   // authored heat, else inferred from the text
      const hg = hLevel ? heatGuidance(hLevel) : null;
      h(`<section class="cook fade" id="gcook">
        <div class="cook-top">
          <button class="icon-btn" id="gquit" title="Quit">✕</button>
          <div class="now-playing"><b>${r.emoji} ${r.title}</b></div>
          <button class="icon-btn ${state.prefs.voice ? "" : "off"}" id="gvoice" title="Voice">🔊</button>
        </div>
        ${useSpotify ? `<div class="sp-bar" id="gspnow">
          <span class="sp-track">🎵 ${esc(cookSelectionLabel() || "Spotify")}</span>
          <button class="icon-btn sp-playbtn" id="gsppause" title="Pause/resume">⏸</button>
        </div>` : ""}

        <div class="gprogress"><div class="gfill" style="width:${(idx / total) * 100}%"></div></div>
        <p class="muted" style="text-align:center;font-size:12px;margin:8px 0 0">Step ${idx + 1} of ${total} · ⏱ ${humanSec(adj)} timed for you</p>

        <div class="stepcard ${isDone ? "" : ""}" id="gstepcard" style="margin:14px 20px 0">
          <span class="pill type ${isDone ? "temp" : "action"}">${isDone ? "DONENESS CHECK" : step.active ? "DO THIS" : "WAIT"}</span>
          ${hg ? `<div class="heat-badge ${hLevel}"><b>${hg.flames} ${hg.label}</b><span>${hg.source}: ${esc(hg.dial)} · ${esc(hg.note)}</span></div>` : ""}
          <div class="ring-wrap" style="padding:10px 0 0">
            <div class="ring-label" style="position:static">
              <div class="cd" id="gcd" style="font-size:34px">${fmtClock(adj)}</div>
              <div class="next">${isDone ? "CHECK BEFORE CONTINUING" : "SUGGESTED TIME"}</div>
            </div>
          </div>
          <p id="gtext" style="font-size:19px;margin-top:8px">${step.text}</p>
          ${isDone ? `<div class="safetybox">🌡️ ${step.gate.prompt}</div>` : ""}
        </div>

        <div class="cook-controls" style="flex-direction:column;gap:10px">
          ${isDone
          ? `<button class="btn" id="gnext">✅ ${step.gate.doneLabel}</button>
               <button class="btn secondary" id="gwait">⏳ Not yet</button>`
          : `<button class="btn" id="gnext">${idx === total - 1 ? "🎉 Finish" : "Next step →"}</button>`}
          ${idx > 0 ? `<button class="btn ghost" id="gback">← Previous</button>` : ""}
        </div>
      </section>`);

      speak(step.text + (hg ? ` Use ${hg.label.toLowerCase()}.` : "") + (isDone ? " " + step.gate.prompt : ""));
      startTimer(adj);
      stepStart = performance.now(); stepExtends = 0;

      $("#gquit").onclick = () => confirmDialog("Quit this cook? Your progress will be lost.", "Yes, quit", () => { stopTimer(); stopVoice(); stopBg(); screens.recipeDetail(r); });
      $("#gvoice").onclick = (e) => {
        state.prefs.voice = !state.prefs.voice;
        e.currentTarget.classList.toggle("off", !state.prefs.voice);
        if (!state.prefs.voice) stopVoice();
      };
      $("#gnext").onclick = () => advance();
      const wait = $("#gwait"); if (wait) wait.onclick = () => { stepExtends++; session.totalExtends++; vibrate("tap"); speak(step.gate.notReadyCoach); toast("Take your time ⏳"); startTimer(60); };
      const back = $("#gback"); if (back) back.onclick = () => { idx = Math.max(0, idx - 1); render(); };
      const sppb = $("#gsppause"); if (sppb) sppb.onclick = () => { sppb.textContent === "⏸" ? Spotify_.pause() : Spotify_.resume(); };
    }

    function advance() {
      stopTimer(); vibrate("tap");
      const step = r.steps[idx];
      const hl = step.heat || inferHeat(step.text);
      session.steps.push({ i: idx, title: step.text.slice(0, 40), authoredSec: step.timing.typicalSec, actualSec: Math.round((performance.now() - stepStart) / 1000), extends: stepExtends, heat: hl || null, heatHint: hl ? heatHintText(hl) : null });
      if (idx >= r.steps.length - 1) {
        stopVoice(); stopBg(); session.completed = true; session.durationSec = Math.round((Date.now() - session.startedAt) / 1000);
        pendingSession = session; screens.guidedFinish(r); return;
      }
      idx++; render();
    }

    function startTimer(sec) {
      stopTimer(); remain = sec;
      const cd = $("#gcd");
      timer = setInterval(() => {
        remain--;
        if (cd) {
          if (remain > 0) { cd.textContent = fmtClock(remain); }
          else { cd.textContent = "⏱ check it"; cd.classList.add("go"); }
        }
        if (remain <= 0) stopTimer();
      }, 1000);
    }
    function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

    // Premium: optional background music while cooking a TheMealDB recipe.
    // A chosen Spotify selection (song/playlist/queue) takes precedence over a bundled track.
    const spSel = currentSpotifySel();
    const useSpotify = !!spSel;
    const bgMusic = !useSpotify && isConnected() && state.customAudio;
    function stopBg() {
      if (useSpotify) { try { Spotify_.stop(); } catch (e) {} }
      else if (bgMusic && Music.el) { Music.el.loop = false; Music.stop(); }
    }
    if (useSpotify) {
      (async () => {
        try {
          const isPrem = await Spotify_.isPremiumAccount();
          if (!isPrem) {
            toast("Spotify Premium required for in-app playback — cooking without music.");
            return;
          }
          await Spotify_.playSelection(spSel);
        } catch (e) {
          toast("Couldn't start Spotify (" + (e.message || "error") + ") — cooking without music.");
        }
      })();
      // Wire state listener to update the now-playing bar as track/pause state changes
      Spotify_.onState((s) => {
        const bar = document.getElementById("gspnow");
        if (!bar) return;
        const track = s && s.track_window && s.track_window.current_track;
        const name = track ? track.name : (state.spotifyLabel || "Spotify");
        bar.querySelector(".sp-track").textContent = "🎵 " + name;
        const pb = bar.querySelector(".sp-playbtn");
        if (pb) pb.textContent = s && s.paused ? "▶" : "⏸";
      });
    } else if (bgMusic) {
      Music.setSrc(state.customAudio); if (Music.el) { Music.el.loop = true; Music.el.volume = 0.5; } Music.play();
    }

    render();
  };

  function fmtClock(s) { const m = Math.floor(s / 60), x = s % 60; return m ? `${m}:${String(x).padStart(2, "0")}` : `0:${String(x).padStart(2, "0")}`; }

  screens.guidedFinish = (r) => {
    h(screenEl("center", `
      <div class="finish-hero">
        <div class="medal">🎉</div>
        <p class="eyebrow" style="margin-top:8px">Guided cook complete</p>
        <h1 style="margin-top:8px">You made<br><span class="gradient-text">${r.title}.</span></h1>
        <div class="streak">🔥 nice work, chef</div>
      </div>
      ${feedbackBlockHTML()}

      <div class="stack" style="margin-top:16px">
        <button class="btn" id="again">Cook it again</button>
        <button class="btn secondary" id="more">Explore more recipes</button>
        <button class="btn ghost" id="home">Back home</button>
      </div>
    `));
    const exitBtns = ["#again", "#more", "#home"];
    exitBtns.forEach((s) => { const e = $(s); if (e) e.disabled = true; });
    const save = wireFeedback(r.title, (ready) => exitBtns.forEach((s) => { const e = $(s); if (e) e.disabled = !ready; }));
    $("#again").onclick = () => { save(); screens.guidedCook(r); };
    $("#more").onclick = () => { save(); screens.home(); };
    $("#home").onclick = () => { save(); screens.home(); };
  };

  // ---- Prep checklist ----
  screens.prep = () => {
    const pn = EXP.portion ? (portionCount || EXP.portion.base) : null;
    const sub = (txt) => pn != null ? txt.replace("{n}", String(pn)) : txt.replace("{n}", String(EXP.portion ? EXP.portion.base : ""));
    // pan/tool needs for the authored music cooks (sear/crisp → cast-iron/stainless; eggs → non-stick)
    const et = ((EXP.recipe.technique || "") + " " + EXP.recipe.title).toLowerCase();
    cookNeeds = /sear|crispy|crisp |pan-fr|chicken/.test(et) ? { panSuitable: ["cast-iron", "stainless"], panReason: "high heat + a crisp crust — non-stick can't take it", tools: [] }
      : /scramble|egg|omelet/.test(et) ? { panSuitable: ["nonstick", "cast-iron"], panReason: "delicate — non-stick works best", tools: ["Whisk"] }
      : { panSuitable: null, panReason: "", tools: [] };
    h(screenEl("", `
      <button class="btn ghost" id="back" style="width:auto;align-self:flex-start;padding-left:0">← Back</button>
      <p class="eyebrow">${EXP.song.title} · ${EXP.recipe.title}</p>
      <h1 style="margin-top:8px">Before we press<br>play ${EXP.recipe.emoji}</h1>
      ${EXP.portion ? `
      <p class="section-title" style="margin-top:14px">${EXP.portion.label}</p>
      <div class="portion" id="portion">
        ${EXP.portion.options.map((n) => `<button class="pchip ${n === pn ? "on" : ""}" data-n="${n}">${n}</button>`).join("")}
      </div>
      <p class="muted" style="font-size:12px;margin-top:6px">We'll gently adjust the timing for ${pn} ${EXP.portion.unit}.</p>` : ""}
      <p class="lead" style="margin-top:14px">Get these ready. Tap each as you go.</p>
      <div class="stack" style="margin-top:18px" id="prep">
        ${EXP.prep.map((p, i) => `<label class="choice" data-i="${i}"><span class="emoji">⬜️</span><span>${sub(p)}</span></label>`).join("")}
      </div>
      ${(EXP.optionalGroups && EXP.optionalGroups.length) ? `
      <p class="section-title" style="margin-top:20px">Optional <span class="pill" style="font-size:10px">on by default — tap to skip</span></p>
      <div class="stack" id="optGroups">
        ${EXP.optionalGroups.map((g) => { const on = optActive(EXP.id, g.id); return `<label class="choice opt-toggle ${on ? "selected" : ""}" data-opt="${g.id}"><span class="emoji">${on ? "✅" : "⬜️"}</span><span>${g.emoji} ${g.label}<small>${g.note}</small></span></label>`; }).join("")}
      </div>` : ""}
      ${panChoiceHTML()}
      <div style="margin-top:28px">
      ${spotifyReady() ? `
      <p class="section-title" style="margin-top:0">🎵 Your music <span class="pill premium" style="font-size:10px">PREMIUM</span></p>
      <p class="muted" style="font-size:11px;margin:-4px 2px 8px">Choose any Spotify song or playlist — it starts automatically when you press Start.</p>
      <div id="cookMusicPicker"></div>
      `
      : isPremium() ? `<button class="connect-music-btn have-premium" id="connectMusic">🎧 Connect Spotify to pick your song</button>`
      : `<button class="connect-music-btn" id="connectMusic">⭐ Connect your music <span class="cm-prem">PREMIUM</span></button>`}
      </div>
      ${EXP.song.audioFile
        ? `<div class="voicepick" style="margin-top:20px"><p class="section-title" style="margin:0 0 6px">🎵 Music</p><p class="muted" style="font-size:12px">${currentSpotifySel() ? "Your Spotify pick plays during the cook." : "Royalty-free demo track plays automatically when you start."} ${EXP.song.audioCredit || ""}</p></div>`
        : EXP.song.youtubeId
        ? `<div class="voicepick" style="margin-top:20px"><p class="section-title" style="margin:0 0 6px">🎬 Music</p><p class="muted" style="font-size:12px">Plays the official <b>${EXP.song.title}</b> video on YouTube, right above your timer.</p></div>`
        : `<div style="margin-top:20px">${musicPickerHTML()}</div>`}
      <div style="margin-top:14px">${voicePickerHTML()}</div>
      <div class="mt-auto" style="margin-top:18px">
        <p class="muted" style="font-size:12px;text-align:center;margin-bottom:10px">Cues sync to the song. Voice & haptics on — adjust anytime.</p>
        <button class="btn" id="start">▶ Start cooking</button>
      </div>
    `));
    $("#back").onclick = () => screens.home();
    $$("#portion .pchip").forEach((b) => b.onclick = () => { portionCount = +b.dataset.n; screens.prep(); });
    $$("#prep .choice").forEach((c) => c.onclick = () => {
      c.classList.toggle("selected");
      c.querySelector(".emoji").textContent = c.classList.contains("selected") ? "✅" : "⬜️";
    });
    $$("#optGroups .opt-toggle").forEach((c) => c.onclick = () => {
      toggleOpt(EXP.id, c.dataset.opt);
      const on = optActive(EXP.id, c.dataset.opt);
      c.classList.toggle("selected", on);
      c.querySelector(".emoji").textContent = on ? "✅" : "⬜️";
    });
    if (!EXP.song.youtubeId && !EXP.song.audioFile) wireMusicPicker();
    if (spotifyReady()) mountCookMusicPicker("#cookMusicPicker", { hasDemo: true });
    const cm2 = $("#connectMusic"); if (cm2) cm2.onclick = () => screens.premium();
    wireVoicePicker();
    if (isKokoro()) pregenKokoro(); // warm up the model + cache cue lines while they prep
    const startBtn = $("#start");
    const refreshStart = () => {
      if (noSuitablePan()) { startBtn.disabled = true; startBtn.textContent = "Need the right pan ↑"; }
      else if (needsPanChoice()) { startBtn.disabled = true; startBtn.textContent = "Pick a pan first ↑"; }
      else { startBtn.disabled = false; startBtn.textContent = "▶ Start cooking"; }
    };
    wirePanChoice(refreshStart);
    refreshStart();
    startBtn.onclick = async () => {
      if (noSuitablePan()) { toast("You don't own a suitable pan — add one in your profile"); return; }
      if (needsPanChoice()) { toast("Pick the pan you're using first"); return; }
      // activate() must run inside the Start gesture to unlock Spotify audio
      if (currentSpotifySel()) { try { await Spotify_.activate(); } catch (e) {} }
      screens.cook();
    };
  };

  // ============================================================
  // COOK SESSION — the hero
  // ============================================================
  screens.cook = () => {
    // scale cue times + total to the chosen portion (e.g. # of eggs)
    const pf = portionFactor();
    // drop cues belonging to any deselected optional component (e.g. garlic butter)
    const active = EXP.cues.filter((c) => !c.opt || optActive(EXP.id, c.opt));
    const cues = pf === 1 ? active : active.map((c) => ({ ...c, at: Math.round(c.at * pf) }));
    const dur = Math.round(EXP.durationSec * pf);
    // A chosen Spotify song/playlist plays as live background music (via the SDK);
    // otherwise fall back to the bundled royalty-free track, then YouTube.
    const spSel = currentSpotifySel();
    const audioFile = spSel ? null : (EXP.song.audioFile || null);
    const ytId = (spSel || audioFile) ? null : (EXP.song.youtubeId || null);
    Music.usingYt = !!ytId;
    if (audioFile) Music.setSrc(audioFile);
    const R = ytId ? 60 : 92, SV = 2 * R + 36, C = 2 * Math.PI * R;
    // real audio (YouTube or file) plays in real time — don't run it at demo speed
    if (Music.has() && state.prefs.speed > 2) state.prefs.speed = 1;
    // PHASE C: beat grid for musical seams
    const bpm = EXP.bpm || 100;
    const beatLen = 60 / bpm;
    const barLen = beatLen * 4;
    const alignToBar = (t) => Math.round(t / barLen) * barLen;

    h(`<section class="cook fade ${ytId ? "has-video" : ""}" id="cook">
      <div class="cook-top">
        <div class="now-playing">
          <span class="eq">${[0, 0, 0, 0].map(() => `<i style="animation-duration:${beatLen}s"></i>`).join("")}</span>
          <span><b>${spSel ? esc(cookSelectionLabel()) : EXP.song.title}</b><br><span class="muted">${spSel ? "🎧 Spotify" : EXP.song.artist + " · " + bpm + " BPM" + (Music.has() ? "" : " · demo")}</span></span>
        </div>
        <div class="cook-icons">
          <button class="icon-btn ${state.prefs.voice ? "" : "off"}" id="tVoice" title="Voice">🔊</button>
          <button class="icon-btn ${state.prefs.haptics ? "" : "off"}" id="tHaptic" title="Haptics">📳</button>
          <button class="icon-btn" id="tSpeed" title="Demo speed">${state.prefs.speed}×</button>
        </div>
      </div>

      ${ytId ? `<div class="cook-video"><div id="ytplayer"></div><button class="video-tap" id="videoTap"><span class="play">▶</span><small>Tap to start the music</small></button></div>` : ""}

      <div class="ring-wrap">
        <svg class="ring" width="${SV}" height="${SV}" viewBox="0 0 ${SV} ${SV}">
          <defs><linearGradient id="flameGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#ff6b35"/><stop offset="1" stop-color="#c44dff"/></linearGradient></defs>
          <circle class="track" cx="${SV / 2}" cy="${SV / 2}" r="${R}" fill="none" stroke-width="10"/>
          <circle class="prog" id="ring" cx="${SV / 2}" cy="${SV / 2}" r="${R}" fill="none" stroke-width="10"
            stroke-dasharray="${C}" stroke-dashoffset="${C}"/>
        </svg>
        <div class="ring-label">
          <div class="next" id="nextLabel">NEXT STEP</div>
          <div class="cd" id="cd">--</div>
        </div>
      </div>

      <div class="stepcard" id="stepcard">
        <span class="pill type prep" id="stepType">GET READY</span>
        <div class="heat-badge" id="heatBadge" hidden></div>
        <h2 id="stepTitle">Press play and let's cook</h2>
        <p id="stepBody">Your first cue lands in a moment. Keep the phone where you can see it.</p>
        <div class="beginner-tag" id="beginnerTag" style="${state.isBeginner ? "" : "display:none"}">🌱 Beginner mode: extra guidance on</div>
        <div class="gate-actions" id="gateActions" hidden></div>
      </div>

      <div class="timeline">
        <div class="tl-track">
          <div class="tl-fill" id="tlFill"></div>
          ${cues.map((c) => `<div class="tl-mark ${c.type === "flip" ? "flip" : ""}" data-at="${c.at}" style="left:${(c.at / dur) * 100}%"></div>`).join("")}
        </div>
        <div class="tl-times"><span id="tElapsed">0:00</span><span>${fmt(dur)}</span></div>
      </div>

      <div class="cook-controls">
        <button class="btn secondary" id="pause">⏸ Pause</button>
        <button class="btn ghost" id="quit" style="flex:0 0 auto">Quit</button>
      </div>
    </section>`);

    // ---- engine ----
    const ring = $("#ring");
    let songPos = 0;             // simulated playback position (sec, in song-time)
    let lastTs = performance.now();
    let paused = false;
    let waiting = false;         // PHASE A: parked on a checkpoint, waiting for the cook
    let nudgeTimer = null;
    let parkPos = 0;             // cook position parked during a checkpoint
    let curGate = null;          // the active checkpoint's gate (real doneness or default "Continue")
    let raf = null;
    let fired = new Set();
    let nextIdx = 0;

    const cookEl = $("#cook");

    // ---- telemetry for this session ----
    const session = { mode: "music", recipe: EXP.recipe.title, song: EXP.song.title, portion: EXP.portion ? (portionCount || EXP.portion.base) : undefined, equipment: { ...state.equipment }, heatSource: state.equipment.heat, pan: activePan(), pansOwned: [...(state.equipment.pans || [])], experience: state.experience, startedAt: Date.now(), steps: [], totalExtends: 0, completed: false };
    let curStep = null, waitStart = 0, waitExtends = 0;

    // ---- PHASE A: gate handling (cues wait for readiness) ----
    function clearNudge() { if (nudgeTimer) { clearTimeout(nudgeTimer); nudgeTimer = null; } }

    // every cue is a checkpoint: real doneness gates keep their copy; others get a default "Continue"
    const DEFAULT_GATE = { doneLabel: "Continue", notReadyCoach: "No rush — take your time. Tap continue when you're ready for the next step.", checkCoach: "Ready for the next step? Tap continue when you are.", nudgeSec: 0 };

    function enterWait(cue) {
      waiting = true;
      parkPos = songPos;                        // remember where the cook is
      waitStart = performance.now(); waitExtends = 0;
      const isDoneness = !!cue.gate;
      curGate = cue.gate || DEFAULT_GATE;
      $("#stepcard").classList.add("waiting");
      Music.background(true);                   // keep the song PLAYING, ducked to background
      $("#pause").disabled = true;              // pause is meaningless while held
      const g = $("#gateActions");
      g.hidden = false;
      g.innerHTML =
        `<button class="btn" id="gDone">${isDoneness ? "✅ " : "▶ "}${curGate.doneLabel}</button>` +
        `<button class="btn secondary" id="gWait">⏳ Not yet</button>`;
      $("#gDone").onclick = () => exitWait(cue);
      $("#gWait").onclick = () => notReady(cue);
      if (curGate.nudgeSec) scheduleNudge(cue, curGate.nudgeSec);
    }

    function notReady(cue) {
      waitExtends++;
      toast("Take your time ⏳");
      speak(curGate.notReadyCoach || "No rush. Tap continue when you're ready.");
      if (curGate.nudgeSec) scheduleNudge(cue, curGate.nudgeSec);
    }

    function scheduleNudge(cue, sec) {
      clearNudge();
      nudgeTimer = setTimeout(() => {
        if (waiting) { speak(curGate.checkCoach || "Ready? Tap continue when you are."); }
      }, sec * 1000);
    }

    function exitWait(cue) {
      clearNudge();
      waiting = false;
      if (curStep) { curStep.waitSec = Math.round((performance.now() - waitStart) / 1000); curStep.extends = waitExtends; }
      session.totalExtends += waitExtends;
      $("#stepcard").classList.remove("waiting");
      const g = $("#gateActions"); g.hidden = true; g.innerHTML = "";
      $("#pause").disabled = false;
      Music.background(false);                  // back to full volume — song never stopped or rewound
      if (Music.has() && !paused) Music.play();
      lastTs = performance.now();
      if (curGate && curGate.doneCoach) speak(curGate.doneCoach);  // only doneness gates speak on continue
    }

    function applyCue(cue, idx) {
      // Playing their own Spotify track? Use the cue's generic copy (no Free Bird /
      // "the solo" references); otherwise the song-specific lines for the demo track.
      const src = (spSel && cue.custom) ? { ...cue, ...cue.custom } : cue;
      const body = (state.isBeginner && src.beginner) ? src.beginner : src.body;
      $("#stepType").className = "pill type " + cue.type;
      $("#stepType").textContent = cue.type.toUpperCase();
      $("#stepTitle").textContent = src.title;
      $("#stepBody").textContent = body;
      // heat level for this cue → concrete dial setting tuned to gas/electric
      const hb = $("#heatBadge"); const hg = cue.heat ? heatGuidance(cue.heat) : null;
      if (hb) {
        if (hg) { hb.hidden = false; hb.className = "heat-badge " + cue.heat; hb.innerHTML = `<b>${hg.flames} ${hg.label}</b><span>${hg.source}: ${esc(hg.dial)} · ${esc(hg.note)}</span>`; }
        else { hb.hidden = true; hb.innerHTML = ""; }
      }
      const sc = $("#stepcard");
      sc.classList.remove("flash"); void sc.offsetWidth; sc.classList.add("flash");
      vibrate(cue.haptic);
      speak(src.voice + (hg ? ` Use ${hg.label.toLowerCase()}.` : ""));
      const mark = app.querySelector(`.tl-mark[data-at="${cue.at}"]`);
      if (mark) mark.classList.add("done");
      if (cue.haptic && !navigator.vibrate) toast("📳 buzz");
      session.steps.push({ title: src.title, type: cue.type, atSec: cue.at, firedSec: Math.round(songPos), waitSec: 0, extends: 0, heat: cue.heat || null, heatHint: cue.heat ? heatHintText(cue.heat) : null });
      curStep = session.steps[session.steps.length - 1];
      if (cue.type === "finish") finish();
    }

    function loop(now) {
      const dt = (now - lastTs) / 1000; lastTs = now;
      // The cook TIMER pauses at checkpoints; the song plays continuously
      // underneath (never rewound). songPos is the cook clock, independent of
      // the audio's actual position.
      if (!waiting && !paused) songPos += dt * state.prefs.speed;
      songPos = Math.min(songPos, dur);

      // fire cues whose time has arrived. Every cue is a checkpoint EXCEPT the
      // very first step (auto-starts) and the finish cue.
      while (!waiting && nextIdx < cues.length && songPos >= cues[nextIdx].at) {
        const cue = cues[nextIdx];
        if (!fired.has(nextIdx)) { fired.add(nextIdx); applyCue(cue, nextIdx); }
        nextIdx++;
        // doneness gates always wait; generic checkpoints only when enabled; never the first step or finish
        if (cue.type !== "finish" && nextIdx > 1 && (cue.gate || state.prefs.checkpoints)) { enterWait(cue); break; }
      }

      // countdown ring + label
      if (waiting) {
        $("#nextLabel").textContent = "READY WHEN YOU ARE";
        const cd = $("#cd"); cd.textContent = "⏳"; cd.classList.remove("go");
        ring.style.strokeDashoffset = 0;
      } else {
        const upcoming = cues[fired.size] || null; // next unfired
        if (upcoming) {
          const remain = Math.max(0, upcoming.at - songPos);
          $("#nextLabel").textContent = "NEXT: " + upcoming.title.replace(/[🥩🎸🔥🌡️]/g, "").trim().toUpperCase();
          const cd = $("#cd");
          cd.textContent = remain > 1 ? Math.ceil(remain) : "GO";
          cd.classList.toggle("go", remain <= 1);
          // ring shows progress toward next cue (segment-based)
          const prevAt = fired.size ? cues[fired.size - 1].at : 0;
          const seg = Math.max(1, upcoming.at - prevAt);
          const frac = Math.min(1, (songPos - prevAt) / seg);
          ring.style.strokeDashoffset = C * (1 - frac);
        } else {
          $("#nextLabel").textContent = "FINISHED";
          $("#cd").textContent = "🎸";
          ring.style.strokeDashoffset = 0;
        }
      }

      // timeline fill + elapsed
      $("#tlFill").style.width = (songPos / dur) * 100 + "%";
      $("#tElapsed").textContent = fmt(songPos);

      if (songPos < dur) raf = requestAnimationFrame(loop);
    }

    function stop() { if (raf) cancelAnimationFrame(raf); raf = null; clearNudge(); stopVoice(); Music.stop(); if (spSel) { try { Spotify_.stop(); } catch (e) {} } if (navigator.vibrate) navigator.vibrate(0); }

    function finish() {
      stop(); state.streak += 1;
      session.completed = true; session.durationSec = Math.round((Date.now() - session.startedAt) / 1000);
      pendingSession = session;
      setTimeout(screens.finish, 900);
    }

    // The whole cook (video + timer + voice) starts on the user's tap of the player.
    let started = false;
    const greeting = spSel
      ? (state.isBeginner ? "Alright — I've got you. Your music's rolling, let's cook." : "Let's cook. Your music's rolling.")
      : (state.isBeginner ? `Alright — I've got you. ${EXP.song.title} is rolling, let's cook.` : `Let's cook. ${EXP.song.title} is rolling.`);

    function begin() {
      if (started) return;
      started = true; paused = false;
      const t = $("#videoTap"); if (t) t.style.display = "none";
      if (ytId) { Yt.setVol(100); Yt.play(); }
      else if (spSel) { Spotify_.playSelection(spSel).catch((e) => toast("Couldn't start Spotify (" + (e.message || "error") + ") — cooking without music.")); }
      else if (Music.loaded) { Music.rate(state.prefs.speed); Music.seek(0); Music.play(); }
      speak(greeting);
      lastTs = performance.now();
      raf = requestAnimationFrame(loop);
    }

    // YouTube blocked this track → let them cook anyway + watch on YT, showing the code
    const YT_ERR = { 2: "invalid video ID", 5: "HTML5 player error", 100: "video not found / private", 101: "embedding disabled by owner", 150: "embedding disabled by owner" };
    function showWatchFallback(code) {
      const t = $("#videoTap"); if (!t) return;
      const meaning = YT_ERR[code] || "playback error";
      t.style.display = "flex";
      t.innerHTML = `<span class="play">▶</span><small>${started ? "Can't embed this track" : "Couldn't embed — tap to start cooking"}` +
        `<br><span class="yt-err">YouTube error ${code != null ? code : "?"} · ${meaning}</span></small>` +
        `<a class="yt-link" href="https://www.youtube.com/watch?v=${ytId}" target="_blank" rel="noopener">Watch on YouTube ↗</a>`;
      t.onclick = (e) => { if (e.target.closest(".yt-link")) return; if (!started) begin(); };
    }

    if (ytId) {
      Yt.onError = (code) => showWatchFallback(code);
      Yt.create("ytplayer", ytId, () => Yt.setRate(state.prefs.speed));
      const tap = $("#videoTap");
      if (tap) { const s = tap.querySelector("small"); if (s) s.textContent = "Tap to start cooking"; tap.onclick = () => begin(); }
    } else {
      begin(); // no video to gate behind
    }

    // ---- controls ----
    $("#pause").onclick = (e) => {
      paused = !paused;
      cookEl.classList.toggle("paused", paused);
      e.target.textContent = paused ? "▶ Resume" : "⏸ Pause";
      if (paused) { stopVoice(); Music.pause(); if (spSel) Spotify_.pause(); } else { Music.play(); if (spSel) Spotify_.resume(); }
      lastTs = performance.now();
    };
    $("#quit").onclick = () => confirmDialog("Quit this cook? Your progress will be lost.", "Yes, quit", () => { stop(); screens.home(); });
    $("#tVoice").onclick = (e) => {
      state.prefs.voice = !state.prefs.voice;
      e.currentTarget.classList.toggle("off", !state.prefs.voice);
      if (!state.prefs.voice) stopVoice(); else speak("Voice on.");
      toast("Voice " + (state.prefs.voice ? "on" : "off"));
    };
    $("#tHaptic").onclick = (e) => {
      state.prefs.haptics = !state.prefs.haptics;
      e.currentTarget.classList.toggle("off", !state.prefs.haptics);
      toast("Haptics " + (state.prefs.haptics ? "on" : "off"));
      vibrate("tap");
    };
    $("#tSpeed").onclick = (e) => {
      const opts = Music.has() ? [1, 2] : [8, 4, 2, 1]; // real audio stays near real-time
      const i = (opts.indexOf(state.prefs.speed) + 1) % opts.length;
      state.prefs.speed = opts[i];
      if (Music.has()) Music.rate(state.prefs.speed);
      e.currentTarget.textContent = state.prefs.speed + "×";
      toast(state.prefs.speed === 1 ? "Real-time" : "Speed " + state.prefs.speed + "×");
    };
  };

  // ---- Finish / share ----
  // ---- post-cook feedback (mandatory 5-star, half-star steps; emoji is display-only) ----
  function feedbackBlockHTML() {
    return `
      <p class="section-title" style="text-align:center;margin-top:6px">How did it go?</p>
      <div class="rate-emoji" id="rateEmoji">🙂</div>
      <div class="stars" id="stars" aria-label="Rate out of five">
        ${[1, 2, 3, 4, 5].map((n) => `<span class="star"><span class="star-bg">★</span><span class="star-fill"><span>★</span></span><button class="half" data-v="${n - 0.5}" aria-label="${n - 0.5} of 5"></button><button class="half" data-v="${n}" aria-label="${n} of 5"></button></span>`).join("")}
      </div>
      <p class="rate-val" id="rateVal">Tap the stars to rate (required)</p>
      <label class="btn secondary" id="photoBtn" style="margin-top:14px">📸 Add a photo (optional)<input type="file" id="photoInput" accept="image/*" hidden></label>
      <div id="photoPrev"></div>
      <p class="section-title" style="text-align:center;margin-top:16px">Comments & recommendations</p>
      <textarea id="fbComment" class="field" placeholder="How did it go? What worked, what should we improve? (required)" style="width:100%;min-height:84px;resize:vertical;line-height:1.45"></textarea>`;
  }

  function wireFeedback(recipeName, onReadyChange) {
    const fb = { recipe: recipeName, rating: null, comment: "", hasPhoto: false, at: new Date().toISOString() };
    let saved = false;
    const emojiFor = (v) => v <= 1 ? "😞" : v <= 2 ? "😐" : v <= 3 ? "🙂" : v <= 4 ? "😋" : "🤩";
    const paint = (v) => $$("#stars .star").forEach((st, i) => { st.querySelector(".star-fill").style.width = (Math.max(0, Math.min(1, v - i)) * 100) + "%"; });
    // ready to leave only once BOTH a rating and a non-empty comment are given
    const checkReady = () => { if (onReadyChange) onReadyChange(fb.rating != null && fb.comment.trim().length > 0); };
    function setRating(v) {
      fb.rating = v; paint(v);
      $("#rateEmoji").textContent = emojiFor(v);
      $("#rateVal").textContent = (v % 1 ? v.toFixed(1) : v) + " / 5";
      vibrate("tap");
      checkReady();
    }
    $$("#stars .half").forEach((b) => {
      const v = parseFloat(b.dataset.v);
      b.onmouseenter = () => { paint(v); $("#rateEmoji").textContent = emojiFor(v); };
      b.onclick = () => setRating(v);
    });
    const stars = $("#stars");
    if (stars) stars.onmouseleave = () => { paint(fb.rating || 0); $("#rateEmoji").textContent = emojiFor(fb.rating || 3); };
    const ta = $("#fbComment");
    if (ta) ta.oninput = () => { fb.comment = ta.value; checkReady(); };
    const inp = $("#photoInput");
    if (inp) inp.onchange = (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) { fb.hasPhoto = true; $("#photoPrev").innerHTML = `<img class="cook-photo" src="${URL.createObjectURL(f)}" alt="your cook">`; toast("Looks delicious 😋"); }
    };
    return () => {                       // persist (only fires once rating + comment exist)
      if (saved || fb.rating == null || !fb.comment.trim()) return;
      saved = true;
      const comment = fb.comment.trim();
      if (pendingSession) { pendingSession.rating = fb.rating; pendingSession.comment = comment; pendingSession.hasPhoto = fb.hasPhoto; pendingSession.finishedAt = new Date().toISOString(); Telemetry.save(pendingSession); pendingSession = null; }
      else { Telemetry.save({ mode: "unknown", recipe: fb.recipe, rating: fb.rating, comment, hasPhoto: fb.hasPhoto, at: fb.at, completed: true }); }
    };
  }

  screens.finish = () => {
    h(screenEl("center", `
      <div class="finish-hero">
        <div class="medal">🏅</div>
        <p class="eyebrow" style="margin-top:8px">First cook complete</p>
        <h1 style="margin-top:8px">You made<br><span class="gradient-text">${EXP.recipe.title.toLowerCase()}.</span></h1>
        <div class="streak">🔥 ${state.streak}-cook streak started</div>
      </div>

      <div class="share-card">
        <div class="glow"></div>
        <div class="big">${EXP.recipe.emoji}🎵</div>
        <h2 style="position:relative;margin-top:8px">Cooked to ${EXP.song.title}</h2>
        <p class="muted" style="position:relative">${EXP.song.artist} · SearTune</p>
      </div>

      ${feedbackBlockHTML()}

      <div class="stack" style="margin-top:16px">
        <button class="btn" id="share">Share my cook 📲</button>
        <button class="btn secondary" id="again">Cook it again</button>
        <button class="btn ghost" id="home">Back home</button>
      </div>
    `));
    const exitBtns = ["#share", "#again", "#home"];
    exitBtns.forEach((s) => { const e = $(s); if (e) e.disabled = true; });
    const save = wireFeedback(`${EXP.song.title} — ${EXP.recipe.title}`, (ready) => exitBtns.forEach((s) => { const e = $(s); if (e) e.disabled = !ready; }));
    $("#share").onclick = () => { save(); toast("Shareable card → Instagram / TikTok / Snap"); };
    $("#again").onclick = () => { save(); screens.prep(); };
    $("#home").onclick = () => { save(); screens.home(); };
  };

  // ============================================================
  // SIDEBAR — off-canvas right drawer (best-practice navigation)
  // ============================================================
  const Sidebar = {
    el: null, scrim: null, active: "home",
    mount() {
      if (this.el) return;
      const phone = document.querySelector(".phone");
      this.scrim = document.createElement("div");
      this.scrim.className = "scrim";
      this.el = document.createElement("aside");
      this.el.className = "sidebar";
      this.el.setAttribute("aria-hidden", "true");
      this.el.setAttribute("role", "navigation");
      this.el.innerHTML = `
        <div class="sb-head">
          <span class="brand-lockup"><img class="brand-logo" src="assets/logo.png" alt="" aria-hidden="true" /><span class="brand gradient-text">SearTune</span></span>
          <button class="icon-btn" id="sbClose" aria-label="Close menu">✕</button>
        </div>
        <nav class="sb-nav">
          <button class="sb-item" data-nav="profile"><span class="sb-ico">👤</span><span>Profile</span></button>
          <button class="sb-item" data-nav="search"><span class="sb-ico">🔍</span><span>Search recipes</span></button>
          <button class="sb-item" data-nav="premium"><span class="sb-ico">⭐</span><span>Premium</span></button>
          <button class="sb-item" data-nav="settings"><span class="sb-ico">⚙️</span><span>Settings</span></button>
        </nav>
        <div class="sb-foot">
          <button class="sb-update" data-nav="home">
            <b>🎸 New · Free Bird steak</b>
            <span>Cook a medium-rare steak in rhythm.</span>
          </button>
        </div>`;
      phone.appendChild(this.scrim);
      phone.appendChild(this.el);

      this.scrim.onclick = () => this.close();
      this.el.querySelector("#sbClose").onclick = () => this.close();
      this.el.querySelectorAll("[data-nav]").forEach((b) => b.onclick = () => this.go(b.dataset.nav));
      document.addEventListener("keydown", (e) => { if (e.key === "Escape") this.close(); });
    },
    open() {
      this.mount();
      this.setActive(this.active);
      this.el.classList.add("open");
      this.scrim.classList.add("show");
      this.el.setAttribute("aria-hidden", "false");
      const first = this.el.querySelector(".sb-item");
      if (first) setTimeout(() => first.focus(), 80);
    },
    close() {
      if (!this.el) return;
      this.el.classList.remove("open");
      this.scrim.classList.remove("show");
      this.el.setAttribute("aria-hidden", "true");
    },
    toggle() { this.el && this.el.classList.contains("open") ? this.close() : this.open(); },
    setActive(name) {
      this.active = name;
      if (!this.el) return;
      this.el.querySelectorAll(".sb-item").forEach((b) => b.classList.toggle("active", b.dataset.nav === name));
    },
    go(name) {
      this.close();
      if (name === "profile") screens.profile();
      else if (name === "search") screens.searchRecipes();
      else if (name === "premium") screens.premium();
      else if (name === "settings") screens.settings();
      else screens.home();
    },
  };

  // small reusable header with a back button + open-menu affordance
  function sectionHead(title) {
    return `
      <div class="topbar">
        <button class="btn ghost" id="back" style="width:auto;padding-left:0">← Back</button>
        <button class="icon-btn" id="hamburger" aria-label="Open menu">☰</button>
      </div>
      <h1 style="margin-top:6px">${title}</h1>`;
  }
  function wireSectionHead() {
    const b = $("#back"); if (b) b.onclick = () => screens.home();
    const h2 = $("#hamburger"); if (h2) h2.onclick = () => Sidebar.open();
  }

  // ---- Profile ----
  screens.profile = () => {
    Sidebar.setActive("profile");
    const eq = state.equipment;
    const stats = cookStats();
    h(screenEl("", `
      ${sectionHead("👤 Profile")}
      <div class="card" style="margin-top:18px;display:flex;align-items:center;gap:14px">
        <div class="avatar" style="width:52px;height:52px;font-size:20px">${state.email ? state.email[0].toUpperCase() : "S"}</div>
        <div style="min-width:0">
          <b style="font-family:'Instrument Sans'">${state.email || "guest@seartune.app"}</b>
          <div style="margin-top:4px"><span class="pill free">${state.tier === "premium" ? "PREMIUM" : "FREE TIER"}</span></div>
        </div>
      </div>

      <p class="section-title">Your cooking profile</p>
      <div class="card">
        <div class="prow">
          <span class="muted">Experience</span>
          <div class="pval"><span>${optLabel(EXPERIENCE_LEVELS, state.experience)}</span><button class="pedit" data-edit="experience">Edit</button></div>
        </div>
        <div class="prow">
          <span class="muted">Pans owned</span>
          <div class="pval"><span>${(eq.pans || []).map((id) => optLabel(PAN_OPTIONS, id)).join(", ") || "—"}</span><button class="pedit" data-edit="pans">Edit</button></div>
        </div>
        <div class="prow">
          <span class="muted">Heat source</span>
          <div class="pval"><span>${optLabel(HEAT_OPTIONS, eq.heat)}</span><button class="pedit" data-edit="heat">Edit</button></div>
        </div>
        <div class="prow">
          <span class="muted">Cooking streak</span>
          <div class="pval"><span>🔥 ${state.streak}</span></div>
        </div>
        <div class="prow">
          <span class="muted">Spotify</span>
          <div class="pval"><span>${state.spotifyConnected ? "Connected ✓" : "Not connected"}</span>${state.spotifyConnected ? "" : `<button class="pedit" data-edit="spotify">Edit</button>`}</div>
        </div>
      </div>

      <p class="section-title">📊 Cooking insights</p>
      <div class="card">
        <div class="prow"><span class="muted">Cooks completed</span><div class="pval"><span>${stats.count}</span></div></div>
        <div class="prow"><span class="muted">Average rating</span><div class="pval"><span>${stats.avgRating != null ? "⭐ " + stats.avgRating.toFixed(1) : "—"}</span></div></div>
        <div class="prow"><span class="muted">Detected pace</span><div class="pval"><span>${paceLabel(stats.pace)}${stats.pace != null ? ` (${stats.pace.toFixed(2)}×)` : ""}</span></div></div>
      </div>
      <p class="muted" style="font-size:11px;margin-top:8px">We learn your real pace from each cook and time future steps to match — no questionnaire needed.</p>

      <div class="mt-auto" style="margin-top:18px">
        <button class="btn ghost" id="signout">Sign out</button>
      </div>
    `));
    wireSectionHead();
    $$(".pedit").forEach((b) => b.onclick = () => {
      const f = b.dataset.edit;
      if (f === "spotify") { screens.premium(); return; }
      if (f === "pans") { editPansField(); return; }
      editProfileField(f);
    });
    $("#signout").onclick = () => { state.email = ""; if (window.API) API.logout(); toast("Signed out"); screens.welcome(); };
  };

  // edit a single profile field, then return to the profile
  function editProfileField(field) {
    const cfg = {
      experience: { title: "Experience", opts: EXPERIENCE_LEVELS, get: () => state.experience, set: (v) => setExperience(v) },
      heat: { title: "Heat source", opts: HEAT_OPTIONS, get: () => state.equipment.heat, set: (v) => (state.equipment.heat = v) },
    }[field];
    if (!cfg) return;
    Sidebar.setActive("profile");
    h(screenEl("", `
      <div class="topbar">
        <button class="btn ghost" id="back" style="width:auto;padding-left:0">← Profile</button>
        <button class="icon-btn" id="hamburger" aria-label="Open menu">☰</button>
      </div>
      <h1 style="margin-top:6px">Edit ${cfg.title.toLowerCase()}</h1>
      <div class="stack" style="margin-top:20px">
        ${cfg.opts.map((o) => `<button class="choice ${cfg.get() === o.id ? "selected" : ""}" data-v="${o.id}"><span class="emoji">${o.emoji}</span><span>${o.label}${o.blurb ? `<small>${o.blurb}</small>` : ""}</span></button>`).join("")}
      </div>
    `));
    $("#back").onclick = () => screens.profile();
    $("#hamburger").onclick = () => Sidebar.open();
    $$(".choice").forEach((c) => c.onclick = () => {
      cfg.set(c.dataset.v);
      saveProfile();
      toast(cfg.title + " updated ✓");
      screens.profile();
    });
  }

  // ---- Edit owned pans (multi-select, at least one) ----
  function editPansField() {
    Sidebar.setActive("profile");
    h(screenEl("", `
      <div class="topbar">
        <button class="btn ghost" id="back" style="width:auto;padding-left:0">← Profile</button>
        <button class="icon-btn" id="hamburger" aria-label="Open menu">☰</button>
      </div>
      <h1 style="margin-top:6px">Pans you own</h1>
      <p class="lead" style="margin-top:6px">Pick all that apply — at least one.</p>
      <div class="stack" style="margin-top:20px" data-group="pans">
        ${PAN_OPTIONS.map((p) => `<button class="choice ${state.equipment.pans.includes(p.id) ? "selected" : ""}" data-v="${p.id}"><span class="emoji">${p.emoji}</span><span>${p.label}</span></button>`).join("")}
      </div>
      <div class="mt-auto" style="margin-top:20px">
        <button class="btn" id="savePans">Save</button>
      </div>
    `));
    $("#back").onclick = () => screens.profile();
    $("#hamburger").onclick = () => Sidebar.open();
    const savePansBtn = $("#savePans");
    const refresh = () => { savePansBtn.disabled = !state.equipment.pans.length; };
    $$('[data-group="pans"] .choice').forEach((c) => c.onclick = () => {
      const v = c.dataset.v, i = state.equipment.pans.indexOf(v);
      if (i > -1) state.equipment.pans.splice(i, 1); else state.equipment.pans.push(v);
      c.classList.toggle("selected", state.equipment.pans.includes(v));
      refresh();
    });
    refresh();
    savePansBtn.onclick = () => {
      if (!state.equipment.pans.length) return toast("Pick at least one pan");
      if (state.cookPan && !state.equipment.pans.includes(state.cookPan)) state.cookPan = null;
      saveProfile(); toast("Pans updated ✓"); screens.profile();
    };
  }

  // ---- Search recipes (dedicated section) ----
  screens.searchRecipes = () => {
    if (!isPremium()) { screens.premium(); return; }
    Sidebar.setActive("search");
    h(screenEl("", `
      ${sectionHead("🔍 Search recipes")}
      <p class="lead" style="margin-top:8px">Search the full TheMealDB catalog — easy, medium & hard.</p>
      <div class="searchrow" style="margin-top:14px">
        <input class="field" id="rsearch" placeholder="e.g. curry, pasta, cake" autocomplete="off" autofocus />
        <button class="icon-btn" id="rsearchBtn" title="Search">🔍</button>
      </div>
      <div id="searchResults" class="catalog"><p class="muted" style="font-size:12px">Type a dish name and hit search.</p></div>
      <p class="attribution" id="attr"></p>
      <div style="height:18px"></div>
    `));
    wireSectionHead();
    loadCatalog().then((d) => { const a = $("#attr"); if (a) a.textContent = d.attribution || ""; });
    const si = $("#rsearch"), sb = $("#rsearchBtn");
    const run = () => doSearch(si.value.trim());
    if (sb) sb.onclick = run;
    if (si) si.onkeydown = (e) => { if (e.key === "Enter") run(); };
  };

  // ---- Settings ----
  screens.settings = () => {
    Sidebar.setActive("settings");
    h(screenEl("", `
      ${sectionHead("⚙️ Settings")}
      <p class="section-title">Voice & feedback</p>
      <div class="stack">
        <label class="choice toggle" id="tgVoice"><span class="emoji">🔊</span><span style="flex:1">Voice prompts</span><span class="sw">${state.prefs.voice ? "ON" : "OFF"}</span></label>
        <label class="choice toggle" id="tgCheck"><span class="emoji">⏯️</span><span style="flex:1">Step checkpoints<small>Confirm “Continue” at each step</small></span><span class="sw">${state.prefs.checkpoints ? "ON" : "OFF"}</span></label>
        <label class="choice toggle" id="tgHaptic"><span class="emoji">📳</span><span style="flex:1">Haptics</span><span class="sw">${state.prefs.haptics ? "ON" : "OFF"}</span></label>
      </div>

      <p class="section-title">Cooking voice</p>
      ${voicePickerHTML()}

      <p class="section-title">Appearance</p>
      <div class="stack">
        <label class="choice toggle" id="tgTheme"><span class="emoji">${state.prefs.theme === "light" ? "☀️" : "🌙"}</span><span style="flex:1">Theme</span><span class="sw">${state.prefs.theme === "light" ? "LIGHT" : "DARK"}</span></label>
      </div>

      <p class="section-title">Developer</p>
      <div class="stack">
        <button class="choice toggle" id="viewLog"><span class="emoji">📊</span><span style="flex:1">Session log</span><span class="sw">${Telemetry.read().length}</span></button>
        <button class="choice toggle" id="resetEnt"><span class="emoji">🔄</span><span style="flex:1">Reset tier / entitlement</span><span class="sw">${isPremium() ? "PREMIUM" : "FREE"}</span></button>
        <button class="choice toggle" id="clearAll" style="color:#ff4444"><span class="emoji">🗑️</span><span style="flex:1">Clear ALL user data</span><span class="sw" style="color:#ff4444">WIPE</span></button>
      </div>

      <div class="mt-auto"></div>
    `));
    wireSectionHead();
    wireVoicePicker();
    $("#viewLog").onclick = () => screens.sessionLog();
    $("#resetEnt").onclick = () => confirmDialog("Reset your tier back to Free? This clears Premium and disconnects Spotify.", "Yes, reset", () => {
      state.tier = "free"; state.musicPlatform = null; state.spotifyConnected = false; state.spotifyUri = null; state.spotifyLabel = null; state.customAudio = null;
      saveEnt(); if (window.Spotify_) Spotify_.logout();
      toast("Reset to Free tier"); screens.settings();
    });
    $("#clearAll").onclick = () => confirmDialog("Wipe ALL user data? This clears sessions, Premium, Spotify, and all settings. Cannot be undone.", "Yes, wipe everything", () => {
      localStorage.clear(); location.reload();
    });
    $("#tgVoice").onclick = () => {
      state.prefs.voice = !state.prefs.voice;
      $("#tgVoice .sw").textContent = state.prefs.voice ? "ON" : "OFF";
      if (!state.prefs.voice) stopVoice(); else speak("Voice on.");
    };
    $("#tgCheck").onclick = () => {
      state.prefs.checkpoints = !state.prefs.checkpoints;
      $("#tgCheck .sw").textContent = state.prefs.checkpoints ? "ON" : "OFF";
    };
    $("#tgHaptic").onclick = () => {
      state.prefs.haptics = !state.prefs.haptics;
      $("#tgHaptic .sw").textContent = state.prefs.haptics ? "ON" : "OFF";
      vibrate("tap");
    };
    $("#tgTheme").onclick = () => {
      state.prefs.theme = state.prefs.theme === "light" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", state.prefs.theme);
      $("#tgTheme .sw").textContent = state.prefs.theme === "light" ? "LIGHT" : "DARK";
      $("#tgTheme .emoji").textContent = state.prefs.theme === "light" ? "☀️" : "🌙";
    };
  };

  // ---- Session log viewer (dev) ----
  function sessionCardHTML(s) {
    const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const when = s.startedAt ? new Date(s.startedAt).toLocaleString() : "";
    const steps = (s.steps || []).map((st) => {
      const heat = st.heat ? ` · 🔥${st.heat}` : "";
      if (s.mode === "guided") return `<li><span>${st.title || ("step " + ((st.i || 0) + 1))}</span><span class="muted">${st.authoredSec}s → ${st.actualSec}s${st.extends ? ` · ${st.extends}×` : ""}${heat}</span></li>`;
      return `<li><span>${st.title}</span><span class="muted">@${st.firedSec}s${st.waitSec ? ` · wait ${st.waitSec}s` : ""}${st.extends ? ` · ${st.extends}×` : ""}${heat}</span></li>`;
    }).join("");
    const kit = [s.pan ? "🍳 " + s.pan : null, s.heatSource ? "🔥 " + s.heatSource : null].filter(Boolean).join(" · ");
    return `<div class="card logcard">
      <div class="prow" style="border:0;padding:0 0 6px">
        <span><b>${s.mode === "music" ? "🎵" : s.mode === "guided" ? "🍳" : "•"} ${s.recipe || "?"}</b></span>
        <span class="pval"><span>${s.rating != null ? s.rating + "★" : "—"}</span></span>
      </div>
      <p class="muted" style="font-size:11px;margin:0">${when} · ${s.completed ? "completed" : "incomplete"} · ${s.durationSec || 0}s · ${s.experience || "—"} · ${s.totalExtends || 0} extends</p>
      ${kit ? `<p class="muted" style="font-size:11px;margin:2px 0 0">${kit}</p>` : ""}
      ${s.comment ? `<p class="logcomment">💬 ${esc(s.comment)}</p>` : ""}
      ${steps ? `<ul class="ing loglist">${steps}</ul>` : ""}
    </div>`;
  }

  screens.sessionLog = () => {
    Sidebar.setActive("settings");
    const sessions = Telemetry.read().slice().reverse();
    const stats = cookStats();
    h(screenEl("", `
      <div class="topbar">
        <button class="btn ghost" id="back" style="width:auto;padding-left:0">← Settings</button>
        <button class="icon-btn" id="hamburger" aria-label="Open menu">☰</button>
      </div>
      <h1 style="margin-top:6px">📊 Session log</h1>
      <p class="lead" style="margin-top:6px">${sessions.length} session${sessions.length === 1 ? "" : "s"} · avg ${stats.avgRating != null ? stats.avgRating.toFixed(1) + "★" : "—"} · pace ${paceLabel(stats.pace)}</p>
      <div class="btn-row" style="margin-top:14px">
        <button class="btn" id="downloadLog">⬇ Download JSON</button>
        <button class="btn secondary" id="copyLog" style="flex:0 0 auto">Copy</button>
        <button class="btn ghost" id="clearLog" style="flex:0 0 auto">Clear</button>
      </div>
      ${sessions.length === 0 ? `<p class="muted" style="margin-top:18px;font-size:13px">No sessions yet. Finish a cook (and rate it) to log one.</p>` : ""}
      <div style="margin-top:14px">${sessions.map(sessionCardHTML).join("")}</div>
      <div style="height:18px"></div>
    `));
    $("#back").onclick = () => screens.settings();
    $("#hamburger").onclick = () => Sidebar.open();
    $("#copyLog").onclick = () => {
      const json = JSON.stringify(Telemetry.read(), null, 2);
      if (navigator.clipboard) navigator.clipboard.writeText(json).then(() => toast("Copied JSON ✓"), () => toast("Copy failed"));
      else toast("Clipboard unavailable");
    };
    $("#downloadLog").onclick = () => {
      const json = JSON.stringify(Telemetry.read(), null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `seartune-sessions-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast("Downloaded JSON ✓");
    };
    $("#clearLog").onclick = () => { Telemetry.clear(); toast("Log cleared"); screens.sessionLog(); };
  };

  // boot
  (async () => {
    let returned = false;
    if (window.Spotify_) { try { returned = await Spotify_.handleRedirect(); } catch (e) {} }
    loadEnt();
    // Connect to the backend; if we already hold a token, hydrate the account.
    let hydrated = false;
    if (window.API) {
      try {
        await API.init();
        if (API.online && API.isLoggedIn()) { const { user } = await API.me(); applyServerUser(user); hydrated = !!(user && user.experience); }
      } catch (e) {}
    }
    if (returned && isPremium()) { state.musicPlatform = "spotify"; state.spotifyConnected = true; saveEnt(); Spotify_.loadSdk(); }
    Sidebar.mount();
    if (returned) screens.premium();
    else if (hydrated) screens.home();           // logged-in returning account
    else screens.welcome();
  })();
})();
