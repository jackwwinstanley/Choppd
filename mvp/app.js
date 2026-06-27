/* ============================================================
   Sizle MVP — front-end demo of the core loop.
   Backend (Cognito/Spotify/RDS) is mocked; the cook engine is real.
   ============================================================ */
(function () {
  "use strict";

  const app = document.getElementById("app");
  const EXPERIENCES = window.EXPERIENCES || [window.FREEBIRD_STEAK];
  let EXP = EXPERIENCES[0];                 // the currently selected music cook
  let portionCount = null;                  // e.g. # of eggs, chosen on the prep screen
  let cookMethod = null;                    // chosen cooking-method id for cooks with EXP.methods (e.g. pan vs grill)
  let prepIdx = 0;                          // current screen in the prep wizard (0=overview, 1=pan, 2..=steps, last=music)
  let restReminder = null, restTick = null; // optional steak room-temp timer: { handle, endsAt } + the countdown interval
  let cookCardData = null;                  // { rating, photoFile } captured at finish for the shareable cook card
  let cookPreview = false;                  // one-shot flag: the next screens.cook() runs as a watch-along PREVIEW (read+reset on entry)

  // Launch the music-sync experience as a no-commitment PREVIEW (no prep, no
  // gates, no logging). The cook engine reads `cookPreview` once on entry.
  function startPreview(exp) { EXP = exp; cookMethod = null; resetPrepPrefs(); cookPreview = true; screens.cook(); }

  // "Save for later" list — client-side intent capture, persisted under the legacy
  // localStorage key `seartune_saved` (kept as-is so existing saves aren't orphaned).
  function savedList() { try { return JSON.parse(localStorage.getItem("seartune_saved") || "[]"); } catch (e) { return []; } }
  function saveWrite(list) { try { localStorage.setItem("seartune_saved", JSON.stringify(list)); } catch (e) {} }
  function isSaved(id) { return savedList().some((x) => x.id === id); }
  // Normalize either an EXP (authored cook) or a flat catalog recipe into a stored item.
  function savedItemFrom(r) {
    const exp = !!(r && r.recipe);
    return {
      id: r.id,
      title: exp ? r.recipe.title : r.title,
      emoji: exp ? r.recipe.emoji : (r.emoji || ""),
      song: exp ? (r.song && r.song.title) : (r.song || null),
      artist: exp ? (r.song && r.song.artist) : null,
      thumb: exp ? null : (r.thumb || null),
      isMusicSync: exp ? true : isMusicSyncRecipe(r),
      savedAt: new Date().toISOString(),
    };
  }
  function saveRecipe(r) { const list = savedList(); if (!list.some((x) => x.id === r.id)) { list.push(savedItemFrom(r)); saveWrite(list); } }
  function removeSaved(id) { saveWrite(savedList().filter((x) => x.id !== id)); }
  function toggleSaved(r) { if (isSaved(r.id)) { removeSaved(r.id); return false; } saveRecipe(r); return true; }
  const saveForLater = saveRecipe; // legacy alias (preview-done screen)
  // Per-cook (session-only) pasta selections — reset each time prep is entered.
  let garlicStrength = "moderate";          // mild | moderate | strong
  let cookLiquid = "chicken";               // chicken | vegetable | waterbutter | bouillon
  let addIns = { chicken: false, peas: false };
  function resetPrepPrefs() { prepIdx = 0; portionCount = null; garlicStrength = "moderate"; cookLiquid = "chicken"; addIns = { chicken: false, peas: false }; phase1MusicPlaying = false; }
  // True once an own-playlist soundtrack has been started in Phase 1 and is playing
  // continuously underneath — so Phase 2 doesn't restart it or run a countdown.
  let phase1MusicPlaying = false;
  let recipeStats = null;                   // real per-recipe {cooks, rating} from the backend (null = not loaded yet)

  // gently scale timing for portion size (e.g. more eggs = a bit longer); clamped so it never gets wild
  function portionFactor() {
    const p = EXP.portion;
    if (!p) return 1;
    const n = portionCount || p.base;
    const f = 1 + (n - p.base) * p.perUnit;
    return Math.max(p.clamp[0], Math.min(p.clamp[1], f));
  }
  // Linear scale for ingredient AMOUNTS (not timing): chosen servings ÷ base.
  function portionScale() {
    const p = EXP && EXP.portion;
    if (!p) return 1;
    return (portionCount || p.base) / p.base;
  }
  // A cook may offer multiple methods (e.g. pan-sear vs grill) with their own
  // timeline. Each method can override cues/prep/optionalGroups/technique; what
  // it omits falls back to the cook's top-level (default) values.
  function activeMethod() {
    if (!EXP || !Array.isArray(EXP.methods) || !EXP.methods.length) return null;
    return EXP.methods.find((m) => m.id === cookMethod) || EXP.methods[0];
  }
  const mCues = () => { const m = activeMethod(); return (m && m.cues) || EXP.cues; };
  const mPrep = () => { const m = activeMethod(); return (m && m.prep) || EXP.prep; };
  const mOptGroups = () => { const m = activeMethod(); return (m && m.optionalGroups) || EXP.optionalGroups || []; };
  const mTechnique = () => { const m = activeMethod(); return (m && m.technique) || EXP.recipe.technique; };

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
    prefs: { voice: true, haptics: true, checkpoints: true, theme: "dark", speed: 1, voiceURI: null, engine: "webspeech", kokoroVoice: "af_heart", cuisines: null }, // speed: 1× default (real-time); only 1× / 2× offered. cuisines = onboarding food prefs (null = no preference)
    streak: 0,
    currentStreak: 0,   // real consecutive-day streak (server-computed)
    longestStreak: 0,
    timezone: null,     // IANA tz for local-day streaks (captured on login)
  };
  function deviceTz() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch (e) { return null; } }

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
    if (typeof u.currentStreak === "number") state.currentStreak = u.currentStreak;
    if (typeof u.longestStreak === "number") state.longestStreak = u.longestStreak;
    if (u.timezone) state.timezone = u.timezone;
    saveEnt();
  }

  // Shared post-login routing for both Google OAuth and email-OTP sign-in.
  function afterServerLogin(user) {
    applyServerUser(user);
    // Capture the device timezone once so streaks bucket by the user's local day.
    if (!user.timezone) { const tz = deviceTz(); if (tz) { state.timezone = tz; if (backendOn() && API.isLoggedIn()) API.saveProfile({ timezone: tz }).catch(() => {}); } }
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
    try { localStorage.setItem("seartune_profile", JSON.stringify({ email: state.email, experience: state.experience, isBeginner: state.isBeginner, equipment: state.equipment, cuisines: state.prefs.cuisines, onboarded: true })); } catch (e) {}
    if (backendOn() && API.isLoggedIn()) {
      API.saveProfile({ experience: state.experience, isBeginner: state.isBeginner, equipment: state.equipment, prefs: state.prefs, streak: state.streak, timezone: state.timezone || deviceTz() }).catch(() => {});
    }
  }
  function loadProfile() {
    try {
      const p = JSON.parse(localStorage.getItem("seartune_profile") || "null");
      if (!p) return false;
      if (p.email && !state.email) state.email = p.email;
      if (p.experience) setExperience(p.experience);
      if (p.cuisines !== undefined) state.prefs.cuisines = p.cuisines;
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
    { id: "cast-iron", label: "Cast iron", emoji: "🍳", desc: "Holds heat incredibly well; slow to heat but stays hot. Stovetop + oven. Keep it dry and oiled." },
    { id: "stainless", label: "Stainless steel", emoji: "🪙", desc: "Gets very hot — great for browning meat & garlic. Sticks if it isn't preheated, so let it heat up first." },
    { id: "nonstick", label: "Non-stick", emoji: "⚫️", desc: "Food slides right out — great for eggs, sauces, anything creamy. Low-to-medium heat only (high heat ruins the coating)." },
  ];
  const HEAT_OPTIONS = [
    { id: "gas", label: "Gas", emoji: "🔥" },
    { id: "electric", label: "Electric / induction", emoji: "♨️" },
  ];
  // Cuisine buckets — shared by onboarding (preference) + the search filter.
  // "other" is the catch-all filter bucket; onboarding shows the 8 named + a
  // "no preference" toggle. Recipe `cuisine` tags map to these ids (see recipe-map.js).
  const CUISINES = [
    { id: "italian", emoji: "🇮🇹", label: "Italian", note: "pasta, pizza, risotto" },
    { id: "mexican", emoji: "🌮", label: "Mexican", note: "tacos, enchiladas, pozole" },
    { id: "japanese", emoji: "🍱", label: "Japanese", note: "sushi, ramen, tempura" },
    { id: "indian", emoji: "🍛", label: "Indian", note: "curries, biryani, tandoori" },
    { id: "french", emoji: "🥐", label: "French", note: "coq au vin, croissants, sauces" },
    { id: "thai", emoji: "🌶", label: "Thai", note: "Pad Thai, tom yum, green curry" },
    { id: "mediterranean", emoji: "🫒", label: "Mediterranean", note: "hummus, falafel, fresh fish" },
    { id: "american", emoji: "🍔", label: "American", note: "burgers, BBQ, comfort food" },
    { id: "asian", emoji: "🥢", label: "Asian", note: "Chinese, stir-fries, dumplings" },
    { id: "other", emoji: "🌍", label: "Other / Everything", note: "everything else" },
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
    // Returns the backend save promise (resolves to {id, currentStreak, longestStreak})
    // so the finish screen can celebrate the freshly-recomputed streak; null offline.
    save(s) {
      try { const log = this.read(); log.push(s); localStorage.setItem("seartune_sessions", JSON.stringify(log.slice(-200))); } catch (e) {}
      if (backendOn() && API.isLoggedIn()) return API.logSession(s).catch(() => null);
      return Promise.resolve(null);
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
    off:           { label: "OFF HEAT",      flames: "🚫",     gas: "burner off",          electric: "burner off" },
  };
  function heatGuidance(level) {
    const h = HEAT_LEVELS[level];
    if (!h) return null;
    const electric = state.equipment.heat === "electric";
    // "Off the heat" — the pan's residual warmth does the work (silky sauces,
    // melting cheese). Not a dial setting, so give a behavior note instead.
    if (level === "off") {
      return { level, label: h.label, flames: h.flames, source: electric ? "electric" : "gas",
        dial: "burner off", note: "Pan off the burner — residual heat keeps it moving without scorching or breaking the sauce." };
    }
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
    if (cookNeeds.grill) return `<p class="section-title" style="margin-top:18px">On the grill 🔥</p><p class="muted" style="font-size:12px;margin:-4px 2px 0">Cook over a preheated grill — no pan needed. Keep a cooler zone handy for flare-ups.</p>${toolsHTML}`;
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
  // Displayed cook time for a music experience. Prefer an authored honest total
  // (e.g. pasta = simmer + song), else fall back to the song length.
  const expMins = (exp) => exp.totalTimeMin || Math.round(exp.durationSec / 60);

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
  // Tap a cue reference image to enlarge it (full-screen overlay; tap to close).
  function lightbox(src, alt) {
    const wrap = document.createElement("div"); wrap.className = "lightbox";
    wrap.innerHTML = `<img src="${esc(src)}" alt="${esc(alt || "")}"><span class="lb-close" aria-hidden="true">✕</span>`;
    (document.querySelector(".phone") || app).appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add("show"));
    wrap.onclick = () => { wrap.classList.remove("show"); setTimeout(() => wrap.remove(), 180); };
  }

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

  // ---- short SFX (WebAudio synth — layers OVER the music, no asset files) ----
  const Sfx = {
    ctx: null,
    ensure() { try { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); if (this.ctx.state === "suspended") this.ctx.resume(); } catch (e) {} return this.ctx; },
    tone(freq, startMs, durMs, vol, type) {
      const c = this.ctx; if (!c) return;
      const t0 = c.currentTime + startMs / 1000;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type || "sine"; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + durMs / 1000);
      o.connect(g); g.connect(c.destination);
      o.start(t0); o.stop(t0 + durMs / 1000 + 0.03);
    },
    chime() { if (!this.ensure()) return; this.tone(880, 0, 320, 0.17, "sine"); this.tone(1320, 110, 380, 0.13, "sine"); }, // gentle two-note stir chime
    countdown() { if (!this.ensure()) return; this.tone(660, 0, 200, 0.15, "triangle"); this.tone(660, 700, 200, 0.15, "triangle"); this.tone(660, 1400, 200, 0.15, "triangle"); this.tone(990, 2100, 380, 0.19, "triangle"); }, // 3·2·1·go
  };

  // ---- Reminders: portable notification seam ---------------------------------
  // A timed pre-cook reminder (e.g. steak resting to room temp). Structured so
  // the DELIVERY mechanism can later swap to a native Capacitor plugin WITHOUT
  // touching callers — see the SWAP POINT below:
  //   web now      → Notification API + setTimeout (best-effort; in-app fallback)
  //   native later → @capacitor/local-notifications (fires when app is closed/locked)
  // Callers only use Reminders.requestPermission() / .schedule(); never the impl.
  const Reminders = {
    permission() { return (typeof Notification !== "undefined") ? Notification.permission : "unsupported"; },
    async requestPermission() {
      if (typeof Notification === "undefined") return "unsupported";
      if (Notification.permission === "default") { try { return await Notification.requestPermission(); } catch (e) { return Notification.permission; } }
      return Notification.permission;
    },
    // Fire title/body after `minutes`. Returns { endsAt, cancel() }. Non-blocking.
    schedule(minutes, title, body, opts) {
      const ms = Math.max(0, minutes * 60000), endsAt = Date.now() + ms;
      // ── NATIVE SWAP POINT ───────────────────────────────────────────────
      // Replace this setTimeout with the Capacitor plugin (delivers when closed):
      //   LocalNotifications.schedule({ notifications: [{ id, title, body,
      //     schedule: { at: new Date(endsAt) } }] });
      const id = setTimeout(() => { this._fire(title, body); if (opts && opts.onFire) opts.onFire(); }, ms);
      // ────────────────────────────────────────────────────────────────────
      return { endsAt, cancel() { clearTimeout(id); } };
    },
    _fire(title, body) {
      // OS notification — best-effort on web; reliable via the native plugin later
      try { if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification(title, { body, icon: "logo.png", tag: "sizle-reminder" }); } catch (e) {}
      // always-on in-app cue — covers denied / unsupported / foreground / on-return
      try { Sfx.chime(); } catch (e) {}
      vibrate("double");
      toast("🔥 " + body);
    },
  };
  window.Reminders = Reminders; // exposed so a native shell can override the seam

  // ---- ambient layer: Phase 1 calm music. A SEPARATE <audio> so it can fade out
  // as the main Phase 2 song kicks in (the "natural lift"). ----
  const PHASE1_AMBIENT = "audio/pasta-phase1.mp3"; // calm Phase-1 track (Delosound, royalty-free) — placeholder; swap here
  const Ambient = {
    el: null, vol: 0.4, fadeRaf: null,
    play(src) {
      if (this.fadeRaf) { cancelAnimationFrame(this.fadeRaf); this.fadeRaf = null; }
      if (!this.el) { this.el = new Audio(); this.el.loop = true; this.el.preload = "auto"; }
      if (this.el.src.indexOf(src) === -1) this.el.src = src;
      this.el.volume = this.vol; this.el.play().catch(() => {});
    },
    stop() { if (this.fadeRaf) { cancelAnimationFrame(this.fadeRaf); this.fadeRaf = null; } if (this.el) { this.el.pause(); try { this.el.currentTime = 0; } catch (e) {} } },
    fadeOut(ms) {
      if (!this.el) return;
      const start = performance.now(), v0 = this.el.volume;
      const step = (now) => {
        const k = Math.min(1, (now - start) / ms);
        if (this.el) this.el.volume = v0 * (1 - k);
        if (k < 1) this.fadeRaf = requestAnimationFrame(step); else this.stop();
      };
      this.fadeRaf = requestAnimationFrame(step);
    },
  };

  // ---- audible + visual 3·2·1 countdown before a cook / timed phase ----
  function runCountdown(onDone) {
    Sfx.ensure(); Sfx.countdown();
    const host = document.querySelector(".phone") || app;
    const ov = document.createElement("div"); ov.className = "countdown-ov";
    host.appendChild(ov);
    const steps = ["3", "2", "1", "GO 🔥"];
    let i = 0;
    (function tick() {
      if (i >= steps.length) { setTimeout(() => { ov.remove(); if (onDone) onDone(); }, 400); return; }
      ov.innerHTML = `<span class="cd-num">${steps[i]}</span>`;
      i++; setTimeout(tick, 700);
    })();
  }

  // ---- screen wake lock — keep the display awake during active cooking ----
  // Acquired on entering a cook context (prep wizard, preCook, cook, guided cook,
  // preview); released on completion / quit / any non-cook screen. The browser
  // auto-drops the lock when the page is hidden (tab switch, call, screen off), so
  // we re-acquire on visibilitychange while a cook is still active. Every call is
  // feature-detected and wrapped — a wake-lock failure never interrupts the cook.
  let cookActive = false;
  const WakeLock = {
    sentinel: null,
    async acquire() {
      cookActive = true;
      if (!("wakeLock" in navigator) || this.sentinel) return;
      try {
        this.sentinel = await navigator.wakeLock.request("screen");
        this.sentinel.addEventListener("release", () => { this.sentinel = null; });
      } catch (e) { /* battery saver / unsupported / page not visible — proceed without it */ }
    },
    async release() {
      cookActive = false;
      const s = this.sentinel; this.sentinel = null;
      if (s) { try { await s.release(); } catch (e) {} }
    },
  };
  document.addEventListener("visibilitychange", () => {
    // the lock is dropped whenever the page loses visibility — re-acquire on return
    // if the user is still mid-cook (without this it silently stops working).
    if (document.visibilityState === "visible" && cookActive) WakeLock.acquire();
  });

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
    const lines = mCues().map((c) => c.voice).filter(Boolean);
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
        <img class="hero-logo" src="assets/logo.png" alt="Sizle logo" />
        <p class="brand gradient-text" style="margin-top:14px">Sizle</p>
        <h1 style="margin-top:10px">Learn to cook<br>to the <span class="gradient-text">music</span>.</h1>
        <p class="lead" style="margin-top:14px">No experience needed. Press play, follow the cues, and cook your first real meal — in rhythm.</p>
      </div>
      <div class="mt-auto" style="margin-top:34px">
        <button class="btn" id="login">Let's cook 🔥</button>
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
      <img class="login-logo" src="assets/logo.png" alt="Sizle logo" />
      <p class="eyebrow">Step 1 · Sign in</p>
      <h1 style="margin-top:10px">${googleReady ? "Welcome to Sizle" : "What's your email?"}</h1>
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
        <p class="lead" style="color:var(--text)">Cooking involves <b>high heat, hot oil, sharp knives, and raw meat</b>. Sizle gives guidance, but you're in charge of your kitchen.</p>
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
    // The pan primer now lives inline on the equipment step (choose + learn at once).
    $$(".choice").forEach((c) => c.onclick = () => { setExperience(c.dataset.v); screens.onboardCuisine(); });
  };

  // ---- Onboarding: cuisine preference (soft signal for smart picks) ----
  screens.onboardCuisine = () => {
    const sel = new Set(Array.isArray(state.prefs.cuisines) ? state.prefs.cuisines : []);
    const named = CUISINES.filter((c) => c.id !== "other");
    h(screenEl("", `
      <button class="btn ghost" id="back" style="width:auto;align-self:flex-start;padding-left:0">← Back</button>
      <div class="dots"><span class="on"></span><span></span><span></span></div>
      <p class="eyebrow">Step 3 · About you</p>
      <h1 style="margin-top:10px">Any cuisines<br>you're into?</h1>
      <p class="lead" style="margin-top:10px">We'll weight your recommendations toward these. Optional — pick as many as you like, or none.</p>
      <div class="stack" style="margin-top:20px" id="cuisineList">
        ${named.map((c) => `<button class="choice ${sel.has(c.id) ? "selected" : ""}" data-v="${c.id}"><span class="emoji">${c.emoji}</span><span>${c.label}<small>${c.note}</small></span></button>`).join("")}
      </div>
      <button class="choice" id="noPref" style="margin-top:10px"><span class="emoji">🌍</span><span>All / No preference<small>Show me a balanced mix</small></span></button>
      <div class="mt-auto" style="margin-top:20px">
        <button class="btn" id="next">Continue</button>
      </div>
    `));
    const refresh = () => {
      $$("#cuisineList .choice").forEach((c) => c.classList.toggle("selected", sel.has(c.dataset.v)));
      $("#noPref").classList.toggle("selected", sel.size === 0);
    };
    $("#back").onclick = () => screens.onboardBeginner();
    $$("#cuisineList .choice").forEach((c) => c.onclick = () => { const v = c.dataset.v; sel.has(v) ? sel.delete(v) : sel.add(v); refresh(); });
    $("#noPref").onclick = () => { sel.clear(); refresh(); };
    refresh();
    $("#next").onclick = () => {
      state.prefs.cuisines = sel.size ? Array.from(sel) : null;
      screens.onboardEquipment();
    };
  };

  // ---- Onboarding: fast equipment check ----
  screens.onboardEquipment = () => {
    h(screenEl("", `
      <div class="dots"><span class="on"></span><span class="on"></span><span></span></div>
      <p class="eyebrow">Step 3 · Your kit</p>
      <h1 style="margin-top:10px">What are you<br>cooking with?</h1>
      <p class="lead" style="margin-top:10px">Tap the pans you own — here's what each is good at. No need to memorise it.</p>
      <p class="section-title" style="margin-top:18px">Pans you own <span class="muted" style="text-transform:none;letter-spacing:0;font-weight:500">· pick all that apply</span></p>
      <div class="stack" data-group="pans">
        ${PAN_OPTIONS.map((p) => `<button class="choice ${state.equipment.pans.includes(p.id) ? "selected" : ""}" data-v="${p.id}"><span class="emoji">${p.emoji}</span><span>${p.label}<small>${p.desc}</small></span></button>`).join("")}
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

  // ---- Music: curated royalty-free tracks are the default for everyone ----
  // (No connected service: Spotify's API is closed to us, Apple Music isn't built.
  // Every recipe ships a matched royalty-free track — see cues.js `audioFile`.)
  screens.connect = () => {
    h(screenEl("", `
      <div class="dots"><span class="on"></span><span class="on"></span><span class="on"></span></div>
      <p class="eyebrow">Step 4 · Music</p>
      <h1 style="margin-top:10px">Your kitchen<br>soundtrack 🎧</h1>
      <p class="lead" style="margin-top:10px">Sizle syncs cooking cues to music automatically. Every recipe comes with a track picked to match it — the Free Bird steak cook is on us.</p>
      <div class="stack" style="margin-top:22px">
        <div class="choice selected" id="useSizle">
          <span class="emoji">🎵</span>
          <span>Use Sizle's music<small>Curated tracks, synced to every recipe.</small></span>
          <span class="music-tag">✓ Default</span>
        </div>
        ${!isPremium() ? `
        <button class="choice locked" id="pickOwn">
          <span class="emoji">🔒</span>
          <span>Pick your own song<small>Cook to any track. Apple Music coming soon.</small></span>
          <span class="music-tag prem">Premium →</span>
        </button>` : ""}
      </div>
      <div style="margin-top:22px">${voicePickerHTML()}</div>
      <div class="mt-auto" style="margin-top:24px">
        <button class="btn" id="start">Start cooking 🎸</button>
      </div>
    `));
    wireVoicePicker();
    const pick = $("#pickOwn"); if (pick) pick.onclick = () => screens.premium();
    $("#start").onclick = () => screens.firstPreview(); // land on the watch-along preview, not straight into browse
  };

  // ---- real per-recipe stats (cooks + avg rating) under each recipe card ----
  // Keyed by recipe title (what cook_sessions stores). Rendered as placeholders,
  // then filled from the backend after a fetch; cached so re-renders don't flicker.
  function recipeStatText(title) {
    if (!recipeStats) return ""; // not loaded yet — applyRecipeStats fills it in
    const s = recipeStats[title];
    if (!s || !s.cooks) return "✨ Be the first to cook this";
    const stars = s.rating != null ? ` · ${Number(s.rating).toFixed(1)}★` : "";
    return `🔥 ${s.cooks.toLocaleString()} ${s.cooks === 1 ? "cook" : "cooks"}${stars}`;
  }
  function statLineHTML(title, style = "") {
    return `<p class="muted recipe-stat" data-recipe="${esc(title)}" style="font-size:12px;${style}">${recipeStatText(title)}</p>`;
  }
  function applyRecipeStats() { $$(".recipe-stat").forEach((el) => { el.textContent = recipeStatText(el.dataset.recipe); }); }
  async function refreshRecipeStats() {
    if (backendOn()) { try { const d = await API.recipeStats(); recipeStats = d.stats || {}; } catch (e) {} }
    applyRecipeStats();
  }

  // ---- Home ----
  screens.home = () => {
    WakeLock.release();   // back to browse — let the screen sleep again
    const name = state.email ? state.email[0].toUpperCase() : "S";
    const ordered = timeOrderedExperiences(); // time-of-day order; featured = ordered[0]
    const feat = ordered[0];
    h(screenEl("", `
      <div class="topbar">
        <div style="display:flex;align-items:center;gap:12px">
          <button class="icon-btn" id="hamburger" aria-label="Open menu" aria-haspopup="true">☰</button>
          <div>
            <p class="muted" style="font-size:13px">${greeting()}</p>
            <div class="brand-lockup"><img class="brand-logo" src="assets/logo.png" alt="" aria-hidden="true" /><span class="brand gradient-text">Sizle</span></div>
          </div>
        </div>
        <div class="home-id">
          ${state.currentStreak > 0 ? `<button class="streak-badge" id="streakBadge" title="${state.currentStreak}-day cook streak">🔥 ${state.currentStreak}</button>` : ""}
          <div class="avatar">${name}</div>
        </div>
      </div>

      <p class="lead">${state.isBeginner ? "First cook? Let's make it a good one." : "Pick tonight's vibe."}</p>

      <p class="section-title">${esc(timeHeaderPhrase())}</p>
      <div class="exp-card ${feat.heroImage ? "has-hero" : ""}" id="featured" ${feat.heroImage ? `style="background:#16161e url('${esc(feat.heroImage)}') center/cover"` : ""}>
        ${feat.heroImage ? `<div class="hero-overlay"></div>` : `<div class="glow"></div>`}
        ${bookmarkHTML(feat.id, "on-art")}
        ${feat.heroImage ? "" : `<div class="big-emoji">${feat.recipe.emoji}</div>`}
        <span style="position:relative;align-self:flex-start;display:inline-flex;gap:6px"><span class="badge-sync">🎵 Music Sync</span><span class="pill free">★ FREE</span></span>
        <h2 style="margin-top:auto">${feat.recipe.title}</h2>
        <p class="song">🎸 ${feat.song.title} · ${feat.song.artist}</p>
        <div class="row">
          <span class="pill">⏱ ~${expMins(feat)} min</span>
          <span class="pill">${feat.recipe.technique}</span>
          <span class="card-preview" data-prev="0">👀 Preview</span>
        </div>
      </div>
      ${statLineHTML(feat.recipe.title, "margin-top:8px")}

      ${EXPERIENCES.length > 1 ? `
      <p class="section-title">🎵 More music cooks</p>
      <div class="catalog">
        ${ordered.slice(1).map((x, i) => `
          <button class="rcard mexp" data-mexp="${i + 1}">
            <div class="rthumb" style="${x.heroImage ? `background:#16161e url('${esc(x.heroImage)}') center/cover` : "display:grid;place-items:center;font-size:34px;background:linear-gradient(160deg,#2a1410,#1a0f1a)"}">${x.heroImage ? "" : x.recipe.emoji}${bookmarkHTML(x.id)}</div>
            <div class="rinfo">
              <b>${x.recipe.title}</b>
              <small>🎸 ${x.song.title} · ${x.song.artist}</small>
              <div class="rrow">${syncBadge()}<span class="pill">⏱ ~${expMins(x)} min</span><span class="card-preview" data-prev="${i + 1}">👀 Preview</span></div>
              ${statLineHTML(x.recipe.title, "margin:4px 0 0;font-size:11px")}
            </div>
          </button>`).join("")}
      </div>` : ""}

      <div class="section-title" style="display:flex;justify-content:space-between;align-items:center">
        <span>✅ Easy picks to start</span><span class="pill">Guided mode</span>
      </div>
      <p class="muted" style="font-size:12px;margin:-6px 2px 10px">Smart picks for right now — matched to the time of day & your cooking level${isPremium() ? "" : " · tap to view, cook with Premium"}.</p>
      <div id="easyPicks" class="catalog"><p class="muted" style="font-size:13px">Loading recipes…</p></div>

      <p class="section-title">🔍 Find any recipe</p>
      <p class="muted" style="font-size:12px;margin:-6px 2px 10px">Browse &amp; filter the full catalog — free to explore${isPremium() ? "" : "; start a cook with Premium"}.</p>
      <div class="searchrow">
        <input class="field" id="rsearch" placeholder="Search all of TheMealDB… e.g. curry, pasta" autocomplete="off" />
        <button class="icon-btn" id="rsearchBtn" title="Search">🔍</button>
      </div>
      <div id="filterbarWrap"></div>
      <div id="searchResults" class="catalog"></div>

      <div class="ad"><p>FREE TIER · <b>ad placement</b> · upgrade to remove ads</p></div>
      <p class="attribution" id="attr"></p>
      <div style="height:18px"></div>
    `));
    $("#featured").onclick = () => { EXP = ordered[0]; cookMethod = null; resetPrepPrefs(); screens.prep(); };
    $$(".mexp").forEach((b) => b.onclick = () => { EXP = ordered[+b.dataset.mexp]; cookMethod = null; resetPrepPrefs(); screens.prep(); });
    $$(".card-preview").forEach((el) => el.onclick = (e) => { e.stopPropagation(); startPreview(ordered[+el.dataset.prev]); });
    wireBookmarks("#app", (id) => EXPERIENCES.find((e) => e.id === id));
    $("#hamburger").onclick = () => Sidebar.open();
    { const sb = $("#streakBadge"); if (sb) sb.onclick = () => screens.cookHistory(); }
    Sidebar.setActive("home");

    // Easy picks + browse/search are free for everyone now; cooking is gated in recipeDetail.
    renderEasyPicks();
    mountSearchSurface();
    loadCatalog().then((d) => { const a = $("#attr"); if (a) a.textContent = d.attribution || ""; });
    refreshRecipeStats();
  };

  function greeting() {
    const hr = new Date().getHours();
    return hr < 12 ? "Good morning 👋" : hr < 18 ? "Good afternoon 👋" : "Good evening 👋";
  }

  // ---- time-of-day surfacing: which core cook leads + a rotating header phrase ----
  // Uses the user's LOCAL device time. eggs=morning, pasta=day, steak=evening+late.
  function dayWindow() {
    const h = new Date().getHours();
    if (h >= 5 && h < 11) return "morning";
    if (h >= 11 && h < 17) return "day";
    if (h >= 17 && h < 22) return "evening";
    return "late"; // 22:00–05:00
  }
  // Full priority order per window (by recipe id). Lead = featured hero; rest fill the list.
  const TIME_ORDER = {
    morning: ["scrambled-eggs", "one-pot-garlic-parmesan-pasta", "crispy-chicken-thighs", "freebird-medium-rare-steak"],
    day: ["one-pot-garlic-parmesan-pasta", "crispy-chicken-thighs", "freebird-medium-rare-steak", "scrambled-eggs"],
    evening: ["freebird-medium-rare-steak", "crispy-chicken-thighs", "one-pot-garlic-parmesan-pasta", "scrambled-eggs"],
    late: ["freebird-medium-rare-steak", "crispy-chicken-thighs", "one-pot-garlic-parmesan-pasta", "scrambled-eggs"],
  };
  const TIME_HEADERS = {
    morning: ["Rise & Sizzle", "Morning Fuel", "Breakfast, Handled", "Up & At 'Em"],
    day: ["Midday Munch", "Lunch, Sorted", "Afternoon Fuel", "Midday Refuel"],
    evening: ["Tonight's Cook", "Dinner, Done Right", "Evening Eats", "Tonight We Cook"],
    late: ["Late-Night Bite", "Midnight Munchies", "Late-Night Fuel", "Burning the Midnight Oil"],
  };
  function timeOrderedExperiences() {
    const order = TIME_ORDER[dayWindow()] || [];
    const picked = order.map((id) => EXPERIENCES.find((e) => e.id === id)).filter(Boolean);
    EXPERIENCES.forEach((e) => { if (!picked.includes(e)) picked.push(e); }); // safety: keep any extras present
    return picked;
  }
  function timeHeaderPhrase() {
    const set = TIME_HEADERS[dayWindow()] || ["Pick your cook"];
    return set[Math.floor(Math.random() * set.length)];
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

    // Advanced: let a power user point Sizle at their own Spotify app.
    if (spForceIdEntry) {
      box.innerHTML = `
        <p class="muted" style="font-size:12px;line-height:1.5">Paste your own app's <b>Client ID</b> (create one free at <a href="https://developer.spotify.com/dashboard" target="_blank" style="color:var(--flame-2)">developer.spotify.com/dashboard</a>).</p>
        <div class="searchrow" style="margin-top:12px">
          <input class="field" id="spClient" placeholder="Paste Client ID…" autocomplete="off" autocapitalize="none" />
          <button class="icon-btn" id="spSave" style="width:auto;padding:0 16px;font-weight:800;color:#fff">Save</button>
        </div>
        <button class="btn ghost" id="spUseDefault" style="margin-top:8px;font-size:12px">← Use the built-in Sizle app instead</button>`;
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
    try { CATALOG = await (await fetch("recipes.json?v=4", { cache: "no-store" })).json(); }
    catch (e) { CATALOG = { recipes: [], attribution: "" }; }
    return CATALOG;
  }

  function diffBadge(d) {
    // tolerant of both the static catalog (easy/medium/hard) and DB tiers (beginner/…)
    const map = {
      easy: ["EASY", "diff-easy"], medium: ["MEDIUM", "diff-medium"], hard: ["HARD", "diff-hard"],
      beginner: ["BEGINNER", "diff-easy"], intermediate: ["INTERMEDIATE", "diff-medium"], advanced: ["ADVANCED", "diff-hard"],
    };
    const [label, cls] = map[d] || map.medium;
    return `<span class="pill ${cls}">${label}</span>`;
  }

  // The matching authored experience for a music-sync catalog row (by id), or null.
  const musicExpFor = (r) => (r && (r.isMusicSync || r.musicSynced) && EXPERIENCES.find((e) => e.id === r.id)) || null;
  // Recipe-type badges (data-driven off the music-sync flag): hand-crafted cooks
  // get the premium music-sync badge; TheMealDB imports get a neutral library label.
  const isMusicSyncRecipe = (r) => !!(r && (r.isMusicSync || r.musicSynced));
  const syncBadge = (cls) => `<span class="badge-sync${cls ? " " + cls : ""}">🎵 Music Sync</span>`;
  const libraryBadge = (cls) => `<span class="badge-library${cls ? " " + cls : ""}">📖 Recipe library</span>`;
  // Bookmark toggle (reflects current saved state via isSaved). SVG so the
  // filled/outline state is reliable across platforms (CSS .saved fills it).
  const BOOKMARK_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5h12a.5.5 0 0 1 .5.5v16.2a.5.5 0 0 1-.77.42L12 17.3l-5.73 3.32a.5.5 0 0 1-.77-.42V4a.5.5 0 0 1 .5-.5z"/></svg>`;
  const bookmarkHTML = (id, cls) => `<span class="bookmark-btn ${cls || ""} ${isSaved(id) ? "saved" : ""}" data-save-id="${esc(id)}" role="button" tabindex="0" aria-label="Save for later" title="Save for later">${BOOKMARK_SVG}</span>`;
  // Wire bookmarks inside a container; `lookup(id)` returns the recipe object to save.
  function wireBookmarks(rootSel, lookup) {
    $$(`${rootSel} .bookmark-btn`).forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation(); e.preventDefault();
        const r = lookup(btn.dataset.saveId); if (!r) return;
        const nowSaved = toggleSaved(r);
        btn.classList.toggle("saved", nowSaved);
        toast(nowSaved ? "Saved 🔖" : "Removed from saved");
        vibrate("tap");
      };
    });
  }
  // Open a catalog card: music-sync rows go to the music prep flow, imported to
  // the guided detail. DB list rows are "light" (no steps/ingredients) → fetch
  // the full recipe first; live-search/static rows already carry everything.
  async function openRecipe(r) {
    const exp = musicExpFor(r);
    if (exp) { EXP = exp; cookMethod = null; resetPrepPrefs(); screens.prep(); return; }
    if (r.ingredients || !backendOn()) { screens.recipeDetail(r); return; }
    try { const { recipe } = await API.recipeById(r.id); screens.recipeDetail(recipe || r); }
    catch (e) { screens.recipeDetail(r); }
  }
  function recipeCardHTML(r) {
    const musicExp = musicExpFor(r);
    if (musicExp) {
      // music-sync cook: hero photo (or emoji tile) + Music Sync badge
      const hero = musicExp.heroImage;
      return `<button class="rcard" data-id="${esc(r.id)}">
        <div class="rthumb" style="${hero ? `background:#16161e url('${esc(hero)}') center/cover` : "display:grid;place-items:center;font-size:34px;background:linear-gradient(160deg,#2a1410,#1a0f1a)"}">${hero ? "" : (r.emoji || "🎵")}${bookmarkHTML(r.id)}</div>
        <div class="rinfo">
          <b>${r.emoji || ""} ${esc(r.title)}</b>
          <small>${esc([CUISINES.find((c) => c.id === r.cuisine)?.label, r.category].filter(Boolean).join(" · "))}</small>
          <div class="rrow">${syncBadge()}${diffBadge(r.difficulty)}</div>
          ${statLineHTML(r.title, "margin:4px 0 0;font-size:11px")}
        </div>
      </button>`;
    }
    return `<button class="rcard" data-id="${esc(r.id)}">
        <div class="rthumb" style="background-image:url('${r.thumb}')">
          ${r.hasSafetyGate ? `<span class="rsafety" title="Has doneness safety checks">🌡️</span>` : ""}
          ${bookmarkHTML(r.id)}
        </div>
        <div class="rinfo">
          <b>${r.emoji} ${esc(r.title)}</b>
          <small>${esc([r.area, r.category].filter(Boolean).join(" · "))}</small>
          <div class="rrow">${libraryBadge()}${diffBadge(r.difficulty)}<span class="pill">📋 ${r.stepCount} steps</span><span class="pill">⏱ ~${r.estimatedTimeMin}m</span></div>
          ${statLineHTML(r.title, "margin:4px 0 0;font-size:11px")}
        </div>
      </button>`;
  }
  // render a list of recipe objects into a target box, wiring clicks from that list
  function renderCards(list, headerHTML, sel) {
    const box = app.querySelector(sel || "#searchResults");
    if (!box) return;
    box.innerHTML = (headerHTML || "") + list.map(recipeCardHTML).join("");
    applyRecipeStats();
    box.querySelectorAll(".rcard").forEach((c) => c.onclick = () => {
      const r = list.find((x) => x.id === c.dataset.id);
      if (r) openRecipe(r);
    });
    wireBookmarks(sel || "#searchResults", (id) => list.find((x) => x.id === id));
    const clear = box.querySelector("#clearSearch");
    if (clear) clear.onclick = clearSearch;
  }

  function clearSearch() {
    const si = app.querySelector("#rsearch"); if (si) si.value = "";
    const box = app.querySelector("#searchResults");
    if (box) box.innerHTML = `<p class="muted" style="font-size:12px">Search above to find more recipes.</p>`;
  }

  // ============================================================
  // SMART "EASY PICKS" — recommend guided recipes for RIGHT NOW.
  // Time-of-day is a HARD filter (never a dinner main at 8am); self-described
  // ability and onboarding cuisine prefs are SOFT ranking weights on top.
  // Relax cuisine (soft already) then difficulty until we have ~3 picks.
  // ============================================================
  // device clock → recommender meal slot (after 10pm = quick late-night only)
  function recommenderSlot() { return timeSlotNow(); }
  // self-described ability → which difficulty tiers we'll surface (easier first)
  function allowedTiers(exp) {
    if (exp === "beginner") return ["beginner"];
    if (exp === "some") return ["beginner", "intermediate"];
    return ["beginner", "intermediate", "advanced"]; // comfortable / seasoned / unknown
  }
  const tierOf = (r) => DIFF_TO_TIER[r.difficulty] || "intermediate";
  function slotMatch(r, slot) {
    if (slot === "latenight") return (r.estimatedTimeMin || 99) <= 20 && (r.mealTime || []).some((m) => m === "dinner" || m === "any");
    return (r.mealTime || []).some((m) => m === slot || m === "any");
  }
  function pickScore(r, slot, prefs) {
    let s = 0;
    if (prefs && prefs.size && prefs.has(r.cuisine)) s += 3;             // cuisine preference (soft)
    const t = tierOf(r);
    s += t === "beginner" ? 2 : t === "intermediate" ? 1 : 0;            // easier ranks higher
    if ((r.estimatedTimeMin || 99) <= 15) s += 0.5;                      // quick bonus
    return s;
  }
  function pickWhy(r, slot, prefs) {
    const quick = (r.estimatedTimeMin || 99) <= 15;
    const slotWord = { breakfast: "breakfast", lunch: "lunch", dinner: "dinner", latenight: "late-night bite" }[slot] || "anytime";
    // primary facet = time fit (with a "Quick" prefix when it's fast)
    let primary;
    if (slot === "latenight") primary = "Quick late-night bite";
    else if (quick) primary = `Quick ${slotWord}`;
    else primary = { breakfast: "Perfect for breakfast", lunch: "Great for lunch", dinner: "Good for dinner" }[slot] || "Anytime pick";
    // secondary facet = the strongest soft signal (cuisine match beats difficulty)
    let secondary = "";
    if (prefs && prefs.has(r.cuisine) && r.cuisine !== "other") {
      const cl = (CUISINES.find((c) => c.id === r.cuisine) || {}).label || r.cuisine;
      secondary = `Matches your ${cl} taste`;
    } else if (tierOf(r) === "beginner") secondary = "Beginner-friendly";
    return secondary ? `${primary} · ${secondary}` : primary;
  }

  async function renderEasyPicks() {
    const slot = recommenderSlot();
    // HARD time-of-day filter, applied at the source: the FULL DB catalog when
    // online (imported/guided only — exclude music cooks), the static 20 offline.
    let pool;
    if (backendOn()) {
      try { pool = ((await API.recipes({ mealTime: slot, limit: 600 })).recipes || []).filter((r) => !r.isMusicSync); }
      catch (e) { pool = (await loadCatalog()).recipes.filter((r) => slotMatch(r, slot)); }
    } else {
      pool = (await loadCatalog()).recipes.filter((r) => slotMatch(r, slot));
    }
    const box = app.querySelector("#easyPicks");
    if (!box) return; // navigated away mid-fetch

    const hasOnboarding = !!state.experience;
    const prefs = new Set(Array.isArray(state.prefs.cuisines) ? state.prefs.cuisines : []);
    const tiers = allowedTiers(state.experience);

    // SOFT: prefer recipes within the stated ability; relax difficulty only if too few.
    const inTier = pool.filter((r) => tiers.includes(tierOf(r)));
    let chosen = (hasOnboarding && inTier.length >= 3) ? inTier : pool;
    chosen = chosen.slice().sort((a, b) => pickScore(b, slot, prefs) - pickScore(a, slot, prefs)).slice(0, 4);

    const slotName = { breakfast: "breakfast", lunch: "lunch", dinner: "dinner", latenight: "a late-night bite" }[slot] || "now";
    let header = `<p class="muted" style="font-size:12px;margin:0 2px 8px">🍳 Picked for <b style="color:var(--text)">${slotName}</b>${hasOnboarding ? "" : ""} · guided mode</p>`;
    if (!hasOnboarding) {
      header += `<button class="easy-prompt" id="tellLevel">Tell us your cooking level to get better picks →</button>`;
    }

    if (!chosen.length) {
      box.innerHTML = header + `<p class="muted" style="font-size:13px">Nothing perfect for ${slotName} right now — <button class="linklike" id="browseAll">browse all recipes ↓</button>.</p>`;
      const ba = box.querySelector("#browseAll"); if (ba) ba.onclick = () => { const si = app.querySelector("#rsearch"); if (si) si.scrollIntoView({ behavior: "smooth" }); };
      wireEasyPrompt(box);
      return;
    }

    const cards = chosen.map((r) => `
      <button class="rcard" data-id="${r.id}">
        <div class="rthumb" style="background-image:url('${r.thumb}')">
          ${r.hasSafetyGate ? `<span class="rsafety" title="Has doneness safety checks">🌡️</span>` : ""}
          ${bookmarkHTML(r.id)}
        </div>
        <div class="rinfo">
          <b>${r.emoji} ${r.title}</b>
          <small class="easy-why">✨ ${esc(pickWhy(r, slot, prefs))}</small>
          <div class="rrow">${libraryBadge()}${diffBadge(r.difficulty)}<span class="pill">📋 ${r.stepCount} steps</span><span class="pill">⏱ ~${r.estimatedTimeMin}m</span></div>
          ${statLineHTML(r.title, "margin:4px 0 0;font-size:11px")}
        </div>
      </button>`).join("");
    box.innerHTML = header + cards;
    applyRecipeStats();
    box.querySelectorAll(".rcard").forEach((c) => c.onclick = () => { const r = chosen.find((x) => x.id === c.dataset.id); if (r) openRecipe(r); });
    wireBookmarks("#easyPicks", (id) => chosen.find((x) => x.id === id));
    wireEasyPrompt(box);
  }
  function wireEasyPrompt(box) {
    const t = box.querySelector("#tellLevel");
    if (t) t.onclick = () => screens.onboardBeginner();
  }

  // ============================================================
  // SEARCH FILTERS — difficulty / cuisine / time-of-day, AND logic.
  // Free to browse; cooking is gated (recipeDetail redirects free users to
  // Premium). Filter state lives for the session and resets on reload.
  // ============================================================
  const DIFF_FILTERS = [
    { id: "beginner", label: "Beginner" },
    { id: "intermediate", label: "Intermediate" },
    { id: "advanced", label: "Advanced" },
  ];
  // recipe.difficulty maps to a UI tier — handles both the static catalog's
  // easy/medium/hard and the DB's beginner/intermediate/advanced.
  const DIFF_TO_TIER = { easy: "beginner", medium: "intermediate", hard: "advanced", beginner: "beginner", intermediate: "intermediate", advanced: "advanced" };
  const TIME_FILTERS = [
    { id: "breakfast", emoji: "🌅", label: "Breakfast" },
    { id: "lunch", emoji: "☀️", label: "Lunch" },
    { id: "dinner", emoji: "🌙", label: "Dinner" },
    { id: "latenight", emoji: "🌃", label: "Late night" },
    { id: "any", emoji: "⏰", label: "Any time" },
  ];
  // Device-clock → meal slot (used for the soft auto-suggest + smart picks).
  function timeSlotNow() {
    const hr = new Date().getHours();
    if (hr >= 22 || hr < 5) return "latenight";
    if (hr < 11) return "breakfast";
    if (hr < 15) return "lunch";
    return "dinner";
  }
  // Filters start completely empty — NO auto-selection. They persist for the
  // session (until reload) but are never pre-populated.
  const searchFilters = { difficulty: null, cuisines: new Set(), time: null };
  const filterCount = () => (searchFilters.difficulty ? 1 : 0) + searchFilters.cuisines.size + (searchFilters.time && searchFilters.time !== "any" ? 1 : 0);
  const filtersActive = () => filterCount() > 0;

  // AND across categories; cuisine multi-select is OR within itself.
  function applyFilters(list) {
    const f = searchFilters;
    return list.filter((r) => {
      if (f.difficulty && DIFF_TO_TIER[r.difficulty] !== f.difficulty) return false;
      if (f.cuisines.size && !f.cuisines.has(r.cuisine || "other")) return false;
      if (f.time && f.time !== "any") {
        if (f.time === "latenight") { if ((r.estimatedTimeMin || 99) > 15) return false; } // quick, minimal cleanup
        else { const mt = r.mealTime || []; if (!mt.includes(f.time) && !mt.includes("any")) return false; }
      }
      return true;
    });
  }

  // A single "⚙️ Filters" button (top-right of the search bar) with an active count.
  function filtersButtonHTML() {
    const n = filterCount();
    return `<div class="filters-row"><button class="filters-btn ${n ? "on" : ""}" id="filtersBtn">⚙️ Filters${n ? ` · ${n}` : ""}</button></div>`;
  }
  function refreshFiltersButton() {
    const wrap = app.querySelector("#filterbarWrap");
    if (!wrap) return;
    wrap.innerHTML = filtersButtonHTML();
    const b = wrap.querySelector("#filtersBtn");
    if (b) b.onclick = openFilterDrawer;
  }
  // Bottom sheet with all three sections at once. Edits a DRAFT; tapping outside
  // closes WITHOUT applying — only "Apply" commits the draft to searchFilters.
  function openFilterDrawer() {
    const draft = { difficulty: searchFilters.difficulty, cuisines: new Set(searchFilters.cuisines), time: searchFilters.time };
    const scrim = document.createElement("div");
    scrim.className = "filter-scrim";
    scrim.innerHTML = `<div class="filter-sheet">
      <div class="sheet-grip"></div>
      <div class="sheet-head"><b>Filters</b><button class="linklike" id="sheetClear">Clear all</button></div>
      <div id="sheetBody"></div>
      <button class="btn" id="sheetApply">Apply</button>
    </div>`;
    (document.querySelector(".phone") || app).appendChild(scrim);
    requestAnimationFrame(() => scrim.classList.add("show"));

    const renderBody = () => {
      const chip = (on, attr, label) => `<button class="fchip ${on ? "on" : ""}" ${attr}>${label}</button>`;
      const diffRow = DIFF_FILTERS.map((d) => chip(draft.difficulty === d.id, `data-diff="${d.id}"`, d.label)).join("");
      const cuisRow = CUISINES.map((c) => chip(draft.cuisines.has(c.id), `data-cuis="${c.id}"`, `${c.emoji} ${c.label}`)).join("");
      const timeRow = TIME_FILTERS.map((t) => chip(draft.time === t.id, `data-time="${t.id}"`, `${t.emoji} ${t.label}`)).join("");
      scrim.querySelector("#sheetBody").innerHTML = `
        <div class="sheet-sec"><span class="filter-label">Difficulty</span><div class="sheet-chips">${diffRow}</div></div>
        <div class="sheet-sec"><span class="filter-label">Cuisine</span><div class="sheet-chips">${cuisRow}</div></div>
        <div class="sheet-sec"><span class="filter-label">Time of day</span><div class="sheet-chips">${timeRow}</div></div>`;
      scrim.querySelectorAll(".fchip[data-diff]").forEach((b) => b.onclick = () => { draft.difficulty = draft.difficulty === b.dataset.diff ? null : b.dataset.diff; renderBody(); });
      scrim.querySelectorAll(".fchip[data-cuis]").forEach((b) => b.onclick = () => { const v = b.dataset.cuis; draft.cuisines.has(v) ? draft.cuisines.delete(v) : draft.cuisines.add(v); renderBody(); });
      scrim.querySelectorAll(".fchip[data-time]").forEach((b) => b.onclick = () => { draft.time = draft.time === b.dataset.time ? null : b.dataset.time; renderBody(); });
    };
    renderBody();

    const close = () => { scrim.classList.remove("show"); setTimeout(() => scrim.remove(), 200); };
    scrim.onclick = (e) => { if (e.target === scrim) close(); }; // tap outside = close without applying
    scrim.querySelector("#sheetClear").onclick = () => { draft.difficulty = null; draft.cuisines.clear(); draft.time = null; renderBody(); };
    scrim.querySelector("#sheetApply").onclick = () => {
      searchFilters.difficulty = draft.difficulty;
      searchFilters.cuisines = new Set(draft.cuisines);
      searchFilters.time = draft.time;
      close();
      refreshFiltersButton();
      refreshSearchGrid();
    };
  }

  // A filterable search/browse surface: filter bar + (live search query OR the
  // local catalog when the box is empty), AND-filtered, into #searchResults.
  let _lastQuery = null, _lastResults = [];
  async function liveSearch(q) {
    if (q === _lastQuery) return _lastResults;
    const res = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(q)}`);
    const data = await res.json();
    _lastQuery = q; _lastResults = (data.meals || []).map((m) => window.RecipeMap.mapMeal(m)).filter((r) => r.stepCount >= 1);
    return _lastResults;
  }
  function mountSearchSurface() {
    refreshFiltersButton();
    refreshSearchGrid();
    const si = $("#rsearch"), sb = $("#rsearchBtn");
    const run = () => refreshSearchGrid();
    if (sb) sb.onclick = run;
    if (si) si.onkeydown = (e) => { if (e.key === "Enter") run(); };
  }
  // Build the {cuisine,difficulty,mealTime} query params from the active filters.
  function filterParams(extra) {
    const f = searchFilters, p = Object.assign({ limit: 400 }, extra || {});
    if (f.cuisines.size) p.cuisine = Array.from(f.cuisines).join(",");
    if (f.difficulty) p.difficulty = f.difficulty;
    if (f.time) p.mealTime = f.time;
    return p;
  }
  let _searchSeq = 0;
  async function refreshSearchGrid() {
    const box = app.querySelector("#searchResults");
    if (!box) return;
    const seq = ++_searchSeq; // ignore stale responses when filters change fast
    const q = (app.querySelector("#rsearch")?.value || "").trim();
    let list, alreadyFiltered = false;
    if (q) {
      // Text search hits MealDB live; active filters are applied client-side on top.
      box.innerHTML = `<p class="muted" style="font-size:13px">Searching TheMealDB for “${esc(q)}”…</p>`;
      try { list = await liveSearch(q); }
      catch (e) { box.innerHTML = `<p class="muted" style="font-size:13px">Search failed (network?).</p>`; return; }
    } else if (backendOn()) {
      // Browse/filter the FULL catalog from our DB.
      box.innerHTML = `<p class="muted" style="font-size:13px">Loading recipes…</p>`;
      try { list = (await API.recipes(filterParams())).recipes || []; alreadyFiltered = true; }
      catch (e) { list = applyFilters((await loadCatalog()).recipes.slice()); alreadyFiltered = true; } // offline fallback: the static 20
    } else {
      list = applyFilters((await loadCatalog()).recipes.slice()); alreadyFiltered = true; // offline: static catalog
    }
    if (!app.querySelector("#searchResults") || seq !== _searchSeq) return; // navigated away or superseded
    const filtered = alreadyFiltered ? list : applyFilters(list);
    if (!filtered.length) {
      box.innerHTML = `<p class="muted" style="font-size:13px">No recipes match these filters${q ? ` for “${esc(q)}”` : ""}. Loosen a filter${filtersActive() ? ` or <button class="linklike" id="clearFilters2">clear all</button>` : ""}.</p>`;
      const c2 = box.querySelector("#clearFilters2"); if (c2) c2.onclick = () => { searchFilters.difficulty = null; searchFilters.cuisines.clear(); searchFilters.time = null; refreshFiltersButton(); refreshSearchGrid(); };
      return;
    }
    const head = `<div class="searchhead">${q ? `Results for “${esc(q)}”` : "Browse"} · ${filtered.length} recipe${filtered.length === 1 ? "" : "s"}${q ? `<button id="clearSearch">✕ clear</button>` : ""}</div>`;
    renderCards(filtered, head, "#searchResults");
    const cs = box.querySelector("#clearSearch"); if (cs) cs.onclick = () => { const si = app.querySelector("#rsearch"); if (si) si.value = ""; refreshSearchGrid(); };
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
    if (/chicken|thigh|breast|steak|chop|fillet|beef|pork/.test(n)) return 150; // a meat portion
    return 60; // generic small item
  }
  function measureToGrams(measure, name) {
    if (!measure) return 0;
    const s = String(measure).toLowerCase()
      .replace(/½/g, "1/2").replace(/¼/g, "1/4").replace(/¾/g, "3/4").replace(/⅓/g, "1/3").replace(/⅔/g, "2/3").trim();
    const qty = parseQty(s);
    const q = qty == null ? 1 : qty;
    // Unit detection. Allow the unit to be attached to the number ("250g", "200ml")
    // — a plain \b before the unit fails when a digit precedes it. Check longer
    // units first (kg before g, ml before l). U() permits start / digit / space.
    const U = (body) => new RegExp("(^|[\\d\\s.])(" + body + ")\\b").test(s);
    if (U("kg|kilograms?|kilo")) return q * 1000;
    if (U("g|gr|grams?")) return q * 1;
    if (U("ml|millilit\\w*")) return q * 1;               // ~1 g/ml
    if (U("l|litres?|liters?")) return q * 1000;
    if (/\bcups?\b/.test(s)) return q * 240;
    if (/tbsp|tablespoon|tblsp/.test(s)) return q * 15;
    if (/tsp|teaspoon/.test(s)) return q * 5;
    if (U("oz|ounces?")) return q * 28;
    if (U("lbs?|pounds?")) return q * 454;
    if (/clove/.test(s)) return q * 5;
    if (/slices?/.test(s)) return q * 20;
    if (/pinch|dash|to taste|sprinkle|handful|garnish|sprigs?|leaf|leaves|stalks?/.test(s)) return 1;
    if (qty != null) return qty * itemWeight(name); // bare number → that many items
    return 0; // unparseable ("to taste") → don't count
  }

  // ---- inline ingredient amounts in step text ----
  // Show the (scaled) quantity right where an ingredient is named in an
  // instruction, so cooks don't scroll back to the ingredient list.
  const FRAC = (s) => String(s).replace(/½/g, "1/2").replace(/¼/g, "1/4").replace(/¾/g, "3/4").replace(/⅓/g, "1/3").replace(/⅔/g, "2/3");
  function fmtQty(n) {
    const r = Math.round(n * 100) / 100, whole = Math.floor(r), frac = r - whole;
    for (const [v, s] of [[0.25, "1/4"], [0.33, "1/3"], [0.5, "1/2"], [0.67, "2/3"], [0.75, "3/4"]])
      if (Math.abs(frac - v) < 0.05) return (whole ? whole + " " : "") + s;
    return r % 1 === 0 ? String(r) : r.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  }
  // ---- display unit system (US default ⇄ metric) — PRESENTATION ONLY ----
  // Never touches authored values or measureToGrams()/nutrition. Persisted under
  // `seartune_units` and read fresh on render so amounts stay consistent. In US
  // mode every function below is identity; metric mode APPENDS the metric form
  // (chosen "dual / add" model) so the cup/tbsp context + beginner equivalents stay.
  function unitSystem() { return localStorage.getItem("seartune_units") === "metric" ? "metric" : "us"; }
  function setUnitSystem(v) { try { localStorage.setItem("seartune_units", v === "metric" ? "metric" : "us"); } catch (e) {} state.prefs.units = unitSystem(); }
  const metricOn = () => unitSystem() === "metric";
  function roundMetric(n) { return n < 250 ? Math.round(n / 5) * 5 : Math.round(n / 10) * 10; } // cookable increments
  function fmtMetricWeight(g) { return g >= 1000 ? (Math.round(g / 100) / 10) + " kg" : roundMetric(g) + " g"; }
  function fmtMetricVol(ml) { return ml >= 1000 ? (Math.round(ml / 100) / 10) + " L" : roundMetric(ml) + " ml"; }
  // One clean "qty unit" measure → "qty unit / METRIC". Weight (oz/lb) → g/kg,
  // volume (cup/tbsp/tsp/fl oz) → ml/L. Counts & non-units (cloves, sprigs, "to
  // taste", already-metric) are returned untouched.
  function displayMeasure(str) {
    if (!metricOn() || !str) return str || "";
    const m = String(str).match(/^\s*((?:\d+\s+)?\d+(?:\.\d+)?(?:\s*\/\s*\d+)?)\s*(fl\s?oz|fluid\s?ounces?|oz|ounces?|lbs?|pounds?|cups?|tbsp|tablespoons?|tsp|teaspoons?)\b/i);
    if (!m) return str;
    const qty = parseQty(m[1].replace(/\s*\/\s*/, "/"));
    if (qty == null) return str;
    const u = m[2].toLowerCase().replace(/\s+/g, "");
    let metric = null;
    if (/^(floz|fluidounce)/.test(u)) metric = fmtMetricVol(qty * 30);
    else if (/^(oz|ounce)/.test(u)) metric = fmtMetricWeight(qty * 28.35);
    else if (/^(lb|pound)/.test(u)) metric = fmtMetricWeight(qty * 453.6);
    else if (/^cup/.test(u)) metric = fmtMetricVol(qty * 237);
    else if (/^(tbsp|tablespoon)/.test(u)) metric = fmtMetricVol(qty * 15);
    else if (/^(tsp|teaspoon)/.test(u)) metric = fmtMetricVol(qty * 5);
    if (!metric) return str;
    return String(str).slice(0, m[0].replace(/\s+$/, "").length) + " / " + metric + String(str).slice(m[0].length);
  }
  // Convert measures + temperatures inside prose (cue/step text). Metric mode only.
  function displayUnits(text) {
    if (!metricOn() || !text) return text || "";
    let out = String(text);
    // measures: "N unit" → "N unit / METRIC" (idempotent — skip if already "/ N")
    out = out.replace(/\b((?:\d+\s+)?\d+(?:\.\d+)?(?:\s*\/\s*\d+)?\s*(?:fl\s?oz|oz|ounces?|lbs?|pounds?|cups?|tbsp|tablespoons?|tsp|teaspoons?))\b(?!\s*\/\s*\d)/gi, (mm) => displayMeasure(mm));
    // temperatures: absolute °F (≥100, so deltas like "5°F" are skipped), not already dual
    out = out.replace(/(\d{2,3})\s*(?:(–|-|to)\s*(\d{2,3}))?\s*°\s?F\b(?!\s*\(?\s*\d{1,3}\s*°\s?C)/gi, (mm, a, sep, b) => {
      const fa = +a, fb = b ? +b : null;
      if (fa < 100 || (fb != null && fb < 100)) return mm;
      const ca = Math.round((fa - 32) * 5 / 9), cc = fb != null ? Math.round((fb - 32) * 5 / 9) : null;
      return mm + " (" + (cc != null ? ca + "–" + cc : ca) + "°C)";
    });
    return out;
  }

  // Clean a free-text measure, drop trailing prep words, scale the leading qty.
  function scaleAmount(measure, scale) {
    let clean = FRAC(String(measure || "")).trim()
      .replace(/[,\s]*\b(chopped|diced|minced|sliced|grated|crushed|peeled|cubed|shredded|beaten|melted|softened|finely|roughly|freshly|to serve|for garnish)\b/gi, "")
      .replace(/\s{2,}/g, " ").replace(/[,\s]+$/, "").trim();
    if (!clean || /^(to taste|for garnish|to serve|as needed|garnish|optional)$/i.test(clean)) return "";
    if (scale === 1) return clean;
    const qty = parseQty(clean);
    if (qty == null) return clean;                 // "a pinch" etc. — don't scale
    const rest = clean.replace(/^[\d\s./]+/, "").trim();
    return fmtQty(qty * scale) + (rest ? " " + rest : "");
  }
  // Annotate only ingredients actually mentioned in `text`; first mention only;
  // idempotent (won't double-annotate something already followed by "(...)").
  function injectAmounts(text, ingredients, scale = 1) {
    if (!text || !Array.isArray(ingredients) || !ingredients.length) return text;
    let out = text;
    const list = ingredients.filter((i) => i && i.name && i.measure && !i.noInline).sort((a, b) => b.name.length - a.name.length);
    for (const ing of list) {
      const amt = scaleAmount(ing.measure, scale);
      if (!amt) continue;
      const stem = ing.name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/(es|s)$/i, "");
      const re = new RegExp("\\b(" + stem + "(?:e?s)?)\\b(?!\\s*\\()", "i");
      if (re.test(out)) out = out.replace(re, `$1 (${amt})`);
    }
    return out;
  }

  // ---- shared ingredients + nutrition section (premium recipes AND free cooks) ----
  // `scale` (default 1) scales each measure by the servings control (authored cooks).
  function ingredientsSectionHTML(r, scale = 1) {
    if (!r || !Array.isArray(r.ingredients) || !r.ingredients.length) return "";
    const dm = (m) => displayMeasure(scale === 1 ? (m || "") : (scaleAmount(m, scale) || m || ""));
    const li = (i) => i.optional
      ? `<li class="opt-ing ${optActive(r.id, i.name) ? "" : "off"}"><label class="opt-ing-label"><input type="checkbox" data-optname="${esc(i.name)}" ${optActive(r.id, i.name) ? "checked" : ""}/><span>${esc(i.label || i.name)} <em class="opt">(optional)</em></span></label><span class="muted">${esc(dm(i.measure))}</span></li>`
      : `<li><span>${esc(i.label || i.name)}</span><span class="muted">${esc(dm(i.measure))}</span></li>`;
    return `
      <div class="section-title" style="display:flex;justify-content:space-between;align-items:center">
        <span>Ingredients</span>
        <span class="unit-toggle" id="unitToggle" role="button" tabindex="0" aria-label="Switch units" title="Switch units"><span class="${metricOn() ? "" : "on"}">US</span><span class="${metricOn() ? "on" : ""}">Metric</span></span>
      </div>
      <div class="card"><ul class="ing">${r.ingredients.map(li).join("")}</ul></div>
      ${backendOn() ? `<button class="btn ghost" id="nutriBtn" style="margin-top:10px;font-size:13px">📊 Show nutrition</button><div id="nutriBox"></div>` : ""}`;
  }
  function wireIngredientsSection(r, scale = 1) {
    if (!r || !Array.isArray(r.ingredients) || !r.ingredients.length) return;
    const dm = (m) => displayMeasure(scale === 1 ? m : (scaleAmount(m, scale) || m));
    const ut = $("#unitToggle");
    if (ut) ut.onclick = () => {
      setUnitSystem(metricOn() ? "us" : "metric"); vibrate("tap");
      if (app.querySelector(".detail-hero")) screens.recipeDetail(r); else screens.prep(); // re-render in place
    };
    // optional-ingredient toggles (default ON) — deselect to drop from list + nutrition
    $$(".opt-ing input[data-optname]").forEach((cb) => cb.onchange = () => {
      toggleOpt(r.id, cb.dataset.optname);
      cb.closest(".opt-ing").classList.toggle("off", !optActive(r.id, cb.dataset.optname));
    });
    const nutriBtn = $("#nutriBtn");
    if (!nutriBtn) return;
    nutriBtn.onclick = async () => {
      nutriBtn.disabled = true;
      const box = $("#nutriBox");
      const items = r.ingredients.slice(0, 16).filter((i) => !i.optional || optActive(r.id, i.name));
      const results = [];
      for (let i = 0; i < items.length; i++) {
        nutriBtn.textContent = `Loading nutrition… ${i + 1}/${items.length}`;
        const measure = dm(items[i].measure);
        try { const d = await API.nutrition(items[i].name); results.push({ name: items[i].name, measure, n: d.nutrition }); }
        catch (e) { results.push({ name: items[i].name, measure, n: null }); }
      }
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
        <p class="muted" style="font-size:11px;margin:8px 2px 4px"><b style="color:var(--text)">Key</b> — kcal = calories · <b style="color:var(--text)">P</b> = protein · <b style="color:var(--text)">F</b> = fat · <b style="color:var(--text)">C</b> = carbs (grams)</p>
        <div class="card" style="margin-top:0"><ul class="ing nutri-list">${rows}${totalRow}</ul></div>
        <p class="muted" style="font-size:10px;margin-top:6px">Rough estimate — each ingredient's nutrition is scaled from the listed amount${partial ? " (items marked “no data”/“/100g” aren't in the total)" : ""}. Data: curated staples + <a href="https://world.openfoodfacts.org" target="_blank" style="color:var(--flame-2)">Open Food Facts</a>. Measures are free-text, so treat the total as a ballpark.</p>`;
      nutriBtn.style.display = "none";
    };
  }

  // ---- Recipe detail ----
  screens.recipeDetail = (r) => {
    WakeLock.release();   // browsing a recipe, not cooking
    cookNeeds = recipeNeeds(r); // what this recipe needs (pan material + tools)
    h(screenEl("", `
      <button class="btn ghost" id="back" style="width:auto;align-self:flex-start;padding-left:0">← Back</button>
      <div class="detail-hero" style="background-image:url('${r.thumb}')">${bookmarkHTML(r.id, "on-art lg")}</div>
      <h1 style="margin-top:14px">${r.title}</h1>
      <p class="lead" style="margin-top:6px">${[r.area, r.category].filter(Boolean).join(" · ")}</p>
      <div style="margin-top:10px">${libraryBadge("lg")}</div>
      <p class="muted" style="font-size:11px;margin:6px 2px 0">🎵 Music sync coming soon — recipe &amp; ingredients for now.</p>
      <div class="row" style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
        ${diffBadge(r.difficulty)}
        <span class="pill">📋 ${r.stepCount} steps</span>
        <span class="pill">⏱ ~${r.estimatedTimeMin}m (generous est.)</span>
        ${r.hasSafetyGate ? `<span class="pill" style="color:#ffd56b">🌡️ doneness checks</span>` : ""}
      </div>

      ${ingredientsSectionHTML(r)}

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
        <p class="muted" style="font-size:12px;text-align:center;margin-bottom:10px">${isPremium() ? "Guided mode: tap through steps. Doneness steps need a safe-temp check before you continue." : "Browse the ingredients free. Cooking the guided walkthrough is a Premium feature."}</p>
        <button class="btn" id="cook">${isPremium() ? "▶ Start guided cook" : "🔒 Start guided cook · Premium"}</button>
      </div>
    `));
    $("#back").onclick = () => screens.home();
    wireIngredientsSection(r);
    wireBookmarks("#app", () => r);
    if (spotifyReady()) mountCookMusicPicker("#cookMusicPicker", { hasDemo: false });
    const cm = $("#connectMusic"); if (cm) cm.onclick = () => screens.premium();
    wireVoicePicker();
    if (isKokoro()) ensureKokoroLoaded();
    const cookBtn = $("#cook");
    const refreshCook = () => {
      // Free users: button stays tappable and redirects to Premium (no pan gating).
      if (!isPremium()) { cookBtn.disabled = false; cookBtn.textContent = "🔒 Start guided cook · Premium"; return; }
      if (noSuitablePan()) { cookBtn.disabled = true; cookBtn.textContent = "Need the right pan ↑"; }
      else if (needsPanChoice()) { cookBtn.disabled = true; cookBtn.textContent = "Pick a pan first ↑"; }
      else { cookBtn.disabled = false; cookBtn.textContent = "▶ Start guided cook"; }
    };
    wirePanChoice(refreshCook);
    refreshCook();
    cookBtn.onclick = async () => {
      // Cooking is Premium — free users can view the recipe but starting redirects to the paywall.
      if (!isPremium()) { toast("Cooking the walkthrough is Premium — unlock to start 🔓"); screens.premium(); return; }
      if (noSuitablePan()) { toast("You don't own a suitable pan — add one in your profile"); return; }
      if (needsPanChoice()) { toast("Pick the pan you're using first"); return; }
      // activate() must run inside the user gesture to unlock audio in the browser
      if (currentSpotifySel()) { try { await Spotify_.activate(); } catch (e) {} }
      screens.guidedCook(r);
    };
  };

  // ---- Guided cook (tap-through; conservative timing + safety gates) ----
  screens.guidedCook = (r) => {
    WakeLock.acquire();   // tap-through MealDB cook is also hands-busy
    let idx = 0;
    let timer = null, remain = 0;
    const session = { mode: "guided", recipe: r.title, emoji: r.emoji, category: r.category, difficulty: r.difficulty, equipment: { ...state.equipment }, heatSource: state.equipment.heat, pan: activePan(), pansOwned: [...(state.equipment.pans || [])], experience: state.experience, startedAt: Date.now(), steps: [], totalExtends: 0, completed: false };
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
          <p id="gtext" style="font-size:19px;margin-top:8px">${displayUnits(injectAmounts(step.text, r.ingredients, 1))}</p>
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
    WakeLock.release();   // guided cook complete
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
    $("#more").onclick = () => finishExit(save, () => screens.home());
    $("#home").onclick = () => finishExit(save, () => screens.home());
  };

  // ============================================================
  // PREP WIZARD — Screen 0 (overview) → pan select → one step per screen → music
  // Driven by EXP.prepSteps (method-aware) or auto-generated from the prep[] list.
  // ============================================================
  const PAN_EXPLAIN = {
    nonstick: { id: "nonstick", emoji: "⚫️", label: "Nonstick", short: "Easiest — food won't stick, forgiving for beginners.",
      more: "Low-to-medium heat only (high heat damages the coating). Best for eggs, sauces, anything creamy. <b>Too hot</b> = the surface smokes or food browns too fast — turn it down." },
    stainless: { id: "stainless", emoji: "🪙", label: "Stainless steel", short: "Better browning — needs more attention, use medium heat.",
      more: "Shiny silver inside, gets very hot. Great for browning garlic & meat. Food sticks if it isn't preheated — let it heat up first. <b>Too hot</b> = smoking oil or fast-darkening food." },
    "cast-iron": { id: "cast-iron", emoji: "🍳", label: "Cast iron", short: "Holds heat well — heavier, harder to fine-tune.",
      more: "Heavy and dark, retains heat incredibly. Slow to change temperature, so adjust early. Good but harder to control for delicate cream sauces. <b>Too hot</b> = constant smoking — pull it off the heat for a moment." },
  };
  const PAN_ORDER = ["nonstick", "stainless", "cast-iron"];

  function prepStepsFor() {
    if (EXP && EXP.id === "one-pot-garlic-parmesan-pasta") return pastaPrepSteps(); // selection-aware
    const m = activeMethod();
    const ps = (m && m.prepSteps) || EXP.prepSteps;
    if (ps && ps.length) return ps;
    return mPrep().map((s) => ({ title: s, instructions: "" })); // auto from the gather list
  }
  function equipmentFor() {
    const m = activeMethod();
    return (m && m.equipmentNeeded) || EXP.equipmentNeeded || ["A suitable pan or pot", "Cutting board & knife", "Measuring cups & spoons"];
  }
  function setCookNeeds() {
    const et = ((mTechnique() || "") + " " + EXP.recipe.title).toLowerCase();
    cookNeeds = /grill/.test(et) ? { panSuitable: null, panReason: "", tools: [], grill: true }
      : /sear|crispy|crisp |pan-fr|chicken/.test(et) ? { panSuitable: ["cast-iron", "stainless"], panReason: "high heat + a crisp crust — non-stick can't take it", tools: [] }
      : /scramble|egg|omelet/.test(et) ? { panSuitable: ["nonstick", "cast-iron"], panReason: "delicate — non-stick works best", tools: ["Whisk"] }
      : { panSuitable: null, panReason: "", tools: [] };
  }

  // ---- pasta: dynamic ingredient model (pure fn of servings + selections) ----
  const isPasta = () => EXP && EXP.id === "one-pot-garlic-parmesan-pasta";
  const fmtCups = (n) => (n <= 0 ? "" : `${fmtQty(n)} ${n <= 1 ? "cup" : "cups"}`);
  const LIQUIDS = {
    chicken: { label: "Chicken broth", measure: (s) => `${s} cup${s === 1 ? "" : "s"}` },
    vegetable: { label: "Vegetable broth", measure: (s) => `${s} cup${s === 1 ? "" : "s"}` },
    waterbutter: { label: "Water + butter/oil", measure: (s) => `${s} cup${s === 1 ? "" : "s"} water + ${s} tbsp butter` },
    bouillon: { label: "Water + bouillon", measure: (s) => `${s} cup${s === 1 ? "" : "s"} water + ${s} cube${s === 1 ? "" : "s"}` },
  };
  const GARLIC = { mild: { lo: 2, hi: 3, tLo: 1, tHi: 1.5 }, moderate: { lo: 4, hi: 4, tLo: 2, tHi: 2 }, strong: { lo: 5, hi: 6, tLo: 3, tHi: 3 } }; // per 2 servings
  function fmtTsp(t) {
    if (t < 3) return `${fmtQty(t)} tsp`;
    const tbsp = Math.floor(t / 3 + 1e-9), rem = Math.round((t - tbsp * 3) * 10) / 10;
    return rem ? `${tbsp} tbsp + ${fmtQty(rem)} tsp` : `${tbsp} tbsp`;
  }
  function garlicDisplay(servings, strength) {
    const g = GARLIC[strength] || GARLIC.moderate, f = servings / 2;
    const cLo = Math.round(g.lo * f), cHi = Math.round(g.hi * f), tLo = g.tLo * f, tHi = g.tHi * f;
    const cloves = cLo === cHi ? `${cLo} cloves` : `${cLo}–${cHi} cloves`;
    const head = servings >= 4 && strength === "strong" ? " / 1 head" : "";
    const tsp = tLo === tHi ? `~${fmtTsp(tLo)}` : (tHi < 3 ? `~${fmtQty(tLo)}–${fmtQty(tHi)} tsp` : `~${fmtTsp(tLo)}–${fmtTsp(tHi)}`);
    return `${cloves}${head} (${tsp} minced)`;
  }
  // Pure: returns the full ingredient list for the current servings + selections.
  function pastaIngredients() {
    const s = portionCount || (EXP.portion ? EXP.portion.base : 2);
    const oz = 4 * s, cupsDry = s;
    const out = [
      { name: "pasta", label: "Short pasta — penne, rigatoni, fusilli, farfalle, or rotini", measure: `${oz} oz (~${cupsDry} cup${cupsDry === 1 ? "" : "s"} dry)` },
      { name: "broth", label: LIQUIDS[cookLiquid].label, measure: LIQUIDS[cookLiquid].measure(s) },
      { name: "cream", label: "Heavy cream", measure: fmtCups(0.25 * s) },
      { name: "butter", measure: `${s} tbsp` },
      { name: "parmesan", label: "Parmigiano-Reggiano / Parmesan (block — grate it yourself)", measure: fmtCups(0.5 * s) },
      { name: "garlic", measure: garlicDisplay(s, garlicStrength) },
    ];
    if (addIns.chicken) out.push({ name: "chicken", label: "Chicken breast or thighs (1-inch pieces)", measure: `${oz} oz` });
    if (addIns.peas) out.push({ name: "peas", label: "Frozen peas", measure: fmtCups(0.25 * s) });
    out.push({ name: "basil", measure: "to garnish", optional: true }, { name: "salt", measure: "to taste", optional: true }, { name: "pepper", measure: "to taste", optional: true });
    return out;
  }
  function pastaControlsHTML() {
    const gchip = (id, label, emoji) => `<button class="pchip garlic-chip ${garlicStrength === id ? "on" : ""}" data-garlic="${id}"><span class="gc-label">${label}</span><span class="gc-emoji">${emoji}</span></button>`;
    const lchip = (id, label) => `<button class="pchip ${cookLiquid === id ? "on" : ""}" data-liquid="${id}">${label}</button>`;
    const tog = (id, emoji, label, note) => `<label class="choice opt-toggle ${addIns[id] ? "selected" : ""}" data-add="${id}"><span class="emoji">${addIns[id] ? "✅" : "⬜️"}</span><span>${emoji} ${label}<small>${note}</small></span></label>`;
    return `
      <p class="section-title" style="margin-top:16px">Garlic strength</p>
      <div class="portion" id="garlicSel">${gchip("mild", "Mild", "🧄")}${gchip("moderate", "Moderate", "🧄🧄")}${gchip("strong", "Strong", "🧄🧄🧄")}</div>
      <p class="muted" style="font-size:12px;margin-top:6px">Both cloves and teaspoons are shown — use whichever you like.</p>
      <p class="section-title" style="margin-top:16px">Cooking liquid</p>
      <div class="portion" id="liquidSel" style="flex-wrap:wrap">${lchip("chicken", "Chicken broth")}${lchip("vegetable", "Vegetable broth")}${lchip("waterbutter", "Water + butter")}${lchip("bouillon", "Bouillon cube")}</div>
      <p class="section-title" style="margin-top:16px">Optional add-ins</p>
      <div class="stack" id="addins">${tog("chicken", "🍗", "Chicken", "4 oz per serving, cut into 1-inch pieces")}${tog("peas", "🟢", "Peas", "1/4 cup frozen per serving — no need to thaw")}</div>`;
  }
  function pastaNotesHTML() {
    return `
      <p class="muted" style="font-size:12px;margin-top:8px">🍝 Avoid long pasta (spaghetti, linguine) — it won't fit the pan and cooks unevenly in this method.</p>
      <details class="pasta-note"><summary>🧀 No Parmigiano? Alternatives</summary><p>Pecorino Romano (saltier, sharper — use 25% less), Grana Padano (milder, cheaper, works great), or Aged Asiago (nuttier). Avoid pre-shredded mozzarella — too mild and stringy. And skip pre-grated parmesan: the anti-caking powder makes sauces grainy — grate a block yourself.</p></details>
      <details class="pasta-note"><summary>🥣 No broth? What to use instead</summary><p><b>Vegetable broth</b> — works identically, slightly different flavor.<br><b>Water + butter/oil</b> — 1 tbsp per cup of water; slightly less savory, so add extra salt + a squeeze of lemon at the end.<br><b>Water + bouillon cube</b> — 1 cube per cup of hot water; full flavor.<br><b>Pasta water from a previous cook</b> — 1:1, adds starch + flavor.</p></details>`;
  }

  const pastaAmt = (name) => { const i = pastaIngredients().find((x) => x.name === name); return i ? i.measure : ""; };
  // Rich, selection-aware prep steps for the wizard (Stage 3 technique guides).
  function pastaPrepSteps() {
    const s = portionCount || 2;
    const steps = [
      { title: "Gather your equipment", instructions: "Get everything within reach before the heat goes on — this cook moves once it starts.", techniqueGuide: equipmentFor() },
      { title: "Measure your pasta", instructions: `You need ${pastaAmt("pasta")}. The weight in oz is printed on the side of the box — 1 lb = 16 oz ≈ 4 cups dry.`, techniqueGuide: ["Use a kitchen scale if you have one — most accurate.", `No scale? ${s} cup${s === 1 ? "" : "s"} of dry short pasta ≈ ${4 * s} oz.`, "A standard box is 1 lb (16 oz) — eyeball the fraction you need."] },
      { title: "Prepare your liquid", instructions: `You're using ${LIQUIDS[cookLiquid].label.toLowerCase()} — ${pastaAmt("broth")}. Have it measured and ready to pour.`, techniqueGuide: cookLiquid === "waterbutter" ? ["Water + 1 tbsp butter per cup mimics the fat in broth.", "Add a little extra salt and a squeeze of lemon at the end to compensate."] : cookLiquid === "bouillon" ? ["Dissolve 1 cube per cup of hot water — stir until fully dissolved.", "Full flavour, works great."] : ["Just measure it out — no prep needed."] },
      { title: "Mince the garlic", instructions: `You need ${pastaAmt("garlic")}. Here's the easy way:`, techniqueGuide: ["Smash each clove flat with the side of your knife — the skin peels right off.", "Rock the knife back and forth across the garlic until the pieces are very small — about the size of a grain of rice.", "Scrape into a pile and go again. Done when no large chunks remain.", "Set the minced garlic aside in a small bowl — it goes straight into the melted butter at the very first cooking step."] },
      { title: "Grate your cheese", instructions: `Grate ${pastaAmt("parmesan")} of Parmigiano-Reggiano from a block — pre-grated has anti-caking powder that makes sauces grainy.`, techniqueGuide: ["Use the fine holes of a box grater or a microplane.", "Hold the grater at an angle over a bowl or plate.", "Press the block firmly against the grater and pull downward in long strokes.", "Keep your fingers curled back, away from the grater surface.", "1 cup grated ≈ a 2-inch chunk of block — it compresses, so be generous."] },
      { title: "Measure your cream", instructions: `You need ${pastaAmt("cream")} of heavy cream. Set it by the stove — it goes in once you're off the heat.`, techniqueGuide: [`${pastaAmt("cream")} — fill to the line on a measuring cup; a touch over is fine for a richer sauce.`] },
    ];
    if (addIns.chicken) steps.push({ title: "Cut & season your chicken", instructions: `Cut ${pastaAmt("chicken")} of chicken into 1-inch pieces and season with salt, pepper, and a pinch of garlic powder. You'll cook it first, then add it back with the cream.`, techniqueGuide: ["Pat the chicken dry first — it browns better.", "1-inch pieces cook evenly in 3–4 minutes per side.", "Season just before it goes in the pan."] });
    return steps;
  }
  // Phase 1 (silent simmer), selection-aware: scaled amounts, chosen liquid,
  // garlic by strength, an optional cook-the-chicken step, timers + stir config.
  function pastaPrePhase() {
    const base = EXP.prePhase, liquid = LIQUIDS[cookLiquid].label.toLowerCase();
    const steps = [];
    if (addIns.chicken) steps.push({ title: "Cook the chicken", heat: "medium-high", body: `Cook your seasoned chicken (${pastaAmt("chicken")}, 1-inch pieces) — 3–4 minutes per side until no longer pink. Set it aside; you'll add it back with the cream.` });
    steps.push({ title: "Butter + garlic", heat: "medium", timerSeconds: 75, body: `Heat the pan and melt the butter (${pastaAmt("butter")}), then sauté the garlic (${pastaAmt("garlic")}) until fragrant — don't let it brown.` });
    steps.push({ title: "Pasta + liquid in", heat: "medium-high", body: `Add the dry pasta (${pastaAmt("pasta")}) and the ${liquid} (${pastaAmt("broth")}). Stir to combine.` });
    steps.push({ title: "Bring to a simmer", heat: "medium-high", simmerPicker: true, body: "Bring it to a gentle simmer on medium-high — about 2–3 minutes. Then choose how long to simmer below." });
    return { title: base.title, intro: base.intro, steps, timer: { sec: 600, label: base.timer.label, earlyAfterSec: base.timer.earlyAfterSec, earlyLabel: base.timer.earlyLabel, heat: "medium", stirEvery: 120 }, gate: base.gate, transition: base.transition };
  }
  // Phase 2 music cues, selection-aware: scaled cream/parmesan, chosen liquid,
  // peas stirred in + chicken added back at the cream step.
  function pastaCues() {
    const cream = pastaAmt("cream"), parm = pastaAmt("parmesan"), liquid = LIQUIDS[cookLiquid].label.toLowerCase();
    const hasBasil = optActive(EXP.id, "basil");
    const hasSeason = optActive(EXP.id, "salt") || optActive(EXP.id, "pepper");
    return EXP.cues.map((c) => {
      // THE DROP — drop the salt/pepper language if neither was selected
      if (/taste & season/i.test(c.title) && !hasSeason) {
        return { ...c, title: "THE DROP — taste it! 🎸", body: "The rock drop! Taste the sauce right now and adjust it to your liking.", beginner: "HERE IT IS — the rock drop. Taste the sauce right now and adjust it to your liking. This is the moment — bold, decisive, no second-guessing.", voice: "Here it is — the rock drop! Taste the sauce right now and adjust it to your liking. Be bold — no second-guessing.", custom: { title: "Taste it! 🥄", beginner: "Taste the sauce right now and adjust it to your liking — bold and decisive.", voice: "Taste the sauce now and adjust to your liking. Be bold." } };
      }
      // Basil + plate — drop the basil step if basil wasn't selected (keep the plating)
      if (/Basil/.test(c.title) && !hasBasil) {
        return { ...c, title: "Plate it up 🍝", body: "Plate it up — twirl or spoon into a warm bowl.", beginner: "Plate it now — twirl or spoon into a warm bowl. The outro starts — you made it.", voice: "Plate it up — twirl it into a warm bowl. The outro's starting. You made it.", custom: { beginner: "Plate it now — twirl or spoon into a warm bowl. You made it.", voice: "Plate it up. You made it." } };
      }
      if (/Cream in/.test(c.title)) {
        const extra = [addIns.peas ? "Stir in the frozen peas now — they thaw and cook in about 90 seconds in the hot sauce." : "", addIns.chicken ? "Add your cooked chicken back in to warm through." : ""].filter(Boolean).join(" ");
        return { ...c, body: `Off the heat, pour in the cream (${cream}) slowly, stirring in lazy circles.${extra ? " " + extra : ""}`, beginner: `Pour in the cream (${cream}) slowly while stirring in lazy circles — don't rush, or the sauce breaks.${extra ? " " + extra : ""}` };
      }
      if (/Parmesan in/.test(c.title)) return { ...c, body: `Add the parmesan (${parm}) a handful at a time, stirring until glossy.`, beginner: `Add the parmesan (${parm}) a handful at a time, stirring after each addition until melted — glossy and silky. Keep the pace slow and steady.` };
      if (/Adjust/.test(c.title)) return { ...c, body: `Too thick? A splash of the reserved ${liquid} (1-2 tbsp). Too thin? Let it sit.`, beginner: `Too thick? Stir in a splash of the reserved ${liquid} (1-2 tbsp, not the full amount) to loosen it. Too thin? Let it sit — it thickens fast as it cools. Taste once more and adjust.` };
      return c;
    });
  }

  screens.prep = () => {
    WakeLock.acquire();   // keep the screen awake through the hands-busy cook flow
    setCookNeeds();
    const steps = prepStepsFor();
    const total = 2 + steps.length + 1; // 0=overview, 1=pan, 2..=steps, last=music
    if (prepIdx < 0) prepIdx = 0;
    if (prepIdx >= total) prepIdx = total - 1;
    if (prepIdx === 0) return prepOverview(steps);
    if (prepIdx === 1) return prepPanSelect();
    if (prepIdx >= 2 && prepIdx < 2 + steps.length) return prepStepScreen(steps, prepIdx - 2);
    return prepMusicVoice();
  };

  // ---- optional pre-cook reminder (steak room-temp rest) — uses the Reminders seam ----
  function fmtRemain(endsAt) {
    const s = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")} left`;
  }
  function stopRestTick() { if (restTick) clearInterval(restTick); restTick = null; }
  function startRestTick() {
    stopRestTick();
    restTick = setInterval(() => {
      if (!restReminder) return stopRestTick();
      const el = $("#restCountdown"); if (el) el.textContent = fmtRemain(restReminder.endsAt);
      if (restReminder.endsAt <= Date.now()) stopRestTick();
    }, 1000);
  }
  function restTimerCardHTML() {
    const r = EXP.restReminder; if (!r) return "";
    const running = restReminder && restReminder.endsAt > Date.now();
    const off = Reminders.permission() === "denied";
    return `<div class="rest-timer${running ? " running" : ""}" id="restCard">
      <div class="rt-head"><span class="rt-emoji">🌡️</span>
        <div class="rt-text"><b>${esc(r.label)}</b>
          <span class="muted">${running ? `<span id="restCountdown">${fmtRemain(restReminder.endsAt)}</span> · we'll ping you when it's ready` : esc(r.tip)}</span></div>
      </div>
      ${running
        ? `<button class="btn ghost rt-btn" id="restCancel">Cancel timer</button>`
        : `<button class="btn secondary rt-btn" id="restSet">Set ${r.minutes}-min timer ⏰</button>
           <p class="rt-note muted">Optional — start cooking whenever you like.${off ? " Notifications are off, so we'll show it in-app when you're back." : ""}</p>`}
    </div>`;
  }
  function wireRestTimer() {
    const setBtn = $("#restSet");
    if (setBtn) setBtn.onclick = async () => {
      const r = EXP.restReminder;
      await Reminders.requestPermission();
      const h = Reminders.schedule(r.minutes, "Sizle", r.done, { onFire: () => { restReminder = null; stopRestTick(); if ($("#restCard")) screens.prep(); } });
      restReminder = { handle: h, endsAt: h.endsAt };
      screens.prep(); // re-render → live countdown (wireRestTimer restarts the tick)
    };
    const cancelBtn = $("#restCancel");
    if (cancelBtn) cancelBtn.onclick = () => { if (restReminder) restReminder.handle.cancel(); restReminder = null; stopRestTick(); screens.prep(); };
    if (restReminder && restReminder.endsAt > Date.now()) startRestTick();
  }

  // Screen 0 — servings + live ingredient overview + equipment + nutrition.
  function prepOverview(steps) {
    const pn = EXP.portion ? (portionCount || EXP.portion.base) : null;
    // Pasta uses a computed ingredient list (already at the chosen servings, so scale=1).
    const ingRecipe = isPasta() ? { ...EXP, ingredients: pastaIngredients() } : EXP;
    const ingScale = isPasta() ? 1 : portionScale();
    h(screenEl("", `
      <button class="btn ghost" id="back" style="width:auto;align-self:flex-start;padding-left:0">← Back</button>
      ${EXP.heroImage ? `<div class="prep-hero" style="background-image:url('${esc(EXP.heroImage)}')"></div>` : ""}
      <p class="eyebrow"${EXP.heroImage ? ' style="margin-top:12px"' : ""}>${EXP.song.title} · ${EXP.recipe.title}</p>
      <h1 style="margin-top:8px">${EXP.recipe.emoji} ${esc(EXP.recipe.title)}</h1>
      <div style="margin-top:10px">${syncBadge("lg")}</div>
      <p class="muted" style="font-size:12px;margin-top:8px">⏱ ~${expMins(EXP)} min total${EXP.timeBreakdown ? ` — ${esc(EXP.timeBreakdown)}` : ""}</p>
      ${(EXP.methods && EXP.methods.length > 1) ? `
      <p class="section-title" style="margin-top:16px">Cooking method</p>
      <div class="portion" id="method">${EXP.methods.map((m) => `<button class="pchip ${m.id === (activeMethod() || {}).id ? "on" : ""}" data-method="${m.id}">${m.emoji || ""} ${m.label}</button>`).join("")}</div>` : ""}
      ${EXP.portion ? `
      <p class="section-title" style="margin-top:16px">${EXP.portion.label}</p>
      <div class="portion" id="portion">${EXP.portion.options.map((n) => `<button class="pchip ${n === pn ? "on" : ""}" data-n="${n}">${n}</button>`).join("")}</div>
      ${EXP.servingNote ? `<p class="muted" style="font-size:12px;margin-top:6px">${esc(EXP.servingNote)}</p>` : ""}` : ""}
      ${EXP.restReminder ? restTimerCardHTML() : ""}
      ${isPasta() ? pastaControlsHTML() : ""}
      <div style="margin-top:18px">${ingredientsSectionHTML(ingRecipe, ingScale)}</div>
      ${isPasta() ? pastaNotesHTML() : ""}
      ${(EXP.id === "freebird-medium-rare-steak" && (portionCount || EXP.portion.base) >= 3) ? `<p class="muted" style="font-size:12px;margin-top:10px;background:rgba(255,107,53,.1);border:1px solid rgba(255,107,53,.32);border-radius:12px;padding:10px 12px;line-height:1.5">🍳 <b style="color:var(--text)">Cooking ${portionCount || EXP.portion.base} steaks:</b> make sure your pan is big enough that they don't touch — crowded steaks steam instead of sear. Use a large pan, or cook in two batches.</p>` : ""}
      <p class="section-title" style="margin-top:18px">You'll need</p>
      <ul class="equip-list">${equipmentFor().map((e) => `<li>🔧 ${esc(e)}</li>`).join("")}</ul>
      <div class="mt-auto" style="margin-top:22px">
        <button class="btn" id="next">Looks good → Next</button>
        <button class="btn ghost" id="prevHere" style="margin-top:8px">👀 Preview the cook first</button>
      </div>
    `));
    $("#back").onclick = () => screens.home();
    $("#prevHere").onclick = () => startPreview(EXP);
    $$("#portion .pchip").forEach((b) => b.onclick = () => { portionCount = +b.dataset.n; screens.prep(); });
    $$("#method .pchip").forEach((b) => b.onclick = () => { cookMethod = b.dataset.method; screens.prep(); });
    $$("#garlicSel .pchip").forEach((b) => b.onclick = () => { garlicStrength = b.dataset.garlic; screens.prep(); });
    $$("#liquidSel .pchip").forEach((b) => b.onclick = () => { cookLiquid = b.dataset.liquid; screens.prep(); });
    $$("#addins .opt-toggle").forEach((c) => c.onclick = () => { addIns[c.dataset.add] = !addIns[c.dataset.add]; screens.prep(); });
    wireIngredientsSection(ingRecipe, ingScale);
    if (EXP.restReminder) wireRestTimer();
    $("#next").onclick = () => { prepIdx = 1; screens.prep(); };
  }

  // Screen 1 — choose your pan (with per-material explanations).
  function prepPanSelect() {
    const grill = cookNeeds.grill;
    const beginner = state.isBeginner;
    h(screenEl("", `
      <button class="btn ghost" id="back" style="width:auto;align-self:flex-start;padding-left:0">← Back</button>
      <p class="wiz-progress">Pick your pan</p>
      <h1 style="margin-top:6px">What are you<br>cooking in? 🍳</h1>
      ${grill ? `
      <p class="lead" style="margin-top:12px">You're grilling — no pan needed. Cook over a preheated grill and keep a cooler zone handy for flare-ups.</p>`
      : `
      <p class="lead" style="margin-top:12px">Each behaves a little differently for this cook.</p>
      <div class="pan-opts" id="panOpts">
        ${PAN_ORDER.map((id) => { const x = PAN_EXPLAIN[id]; const on = state.cookPan === id; return `<button class="pan-opt ${on ? "on" : ""}" data-pan="${id}"><span class="po-emoji">${x.emoji}</span><span class="po-body"><b>${x.label}</b><small>${x.short}</small></span></button>`; }).join("")}
      </div>
      <p class="muted" style="font-size:12px;margin-top:4px">Not sure? Choose <b>Nonstick</b>.</p>
      <div id="panMore" class="pan-more ${beginner ? "open" : ""}">
        ${beginner ? "" : `<button class="linklike" id="panLearn">Learn more about pans ▾</button>`}
        <div class="pan-more-body" ${beginner ? "" : "hidden"}>${PAN_ORDER.map((id) => { const x = PAN_EXPLAIN[id]; return `<p style="font-size:12px;margin:8px 2px"><b>${x.emoji} ${x.label}.</b> ${x.more}</p>`; }).join("")}</div>
      </div>`}
      <div class="mt-auto" style="margin-top:20px"><button class="btn" id="next" ${grill || state.cookPan ? "" : "disabled"}>Next →</button></div>
    `));
    $("#back").onclick = () => { prepIdx = 0; screens.prep(); };
    const next = $("#next");
    $$("#panOpts .pan-opt").forEach((b) => b.onclick = () => {
      state.cookPan = b.dataset.pan; saveEnt();
      $$("#panOpts .pan-opt").forEach((x) => x.classList.toggle("on", x.dataset.pan === state.cookPan));
      next.disabled = false;
    });
    const learn = $("#panLearn");
    if (learn) learn.onclick = () => { const body = $("#panMore .pan-more-body"); if (body) { body.hidden = !body.hidden; learn.textContent = body.hidden ? "Learn more about pans ▾" : "Hide ▴"; } };
    next.onclick = () => { prepIdx = 2; screens.prep(); };
  }

  // Screens 2..N — one prep step per screen (can't skip).
  function prepStepScreen(steps, i) {
    const step = steps[i];
    const n = steps.length;
    const pn = EXP.portion ? (portionCount || EXP.portion.base) : null;
    const sub = (t) => (pn != null ? String(t == null ? "" : t).replace(/\{n\}/g, pn) : String(t == null ? "" : t).replace(/\{n\}/g, ""));
    const body = displayUnits(step.instructions ? (isPasta() ? step.instructions : injectAmounts(sub(step.instructions), EXP.ingredients, portionScale())) : "Have this measured and ready before you start cooking.");
    h(screenEl("", `
      <button class="btn ghost" id="back" style="width:auto;align-self:flex-start;padding-left:0">← Back</button>
      <p class="wiz-progress">Prep step ${i + 1} of ${n}</p>
      <div class="wiz-bar"><i style="width:${Math.round(((i + 1) / n) * 100)}%"></i></div>
      <h1 style="margin-top:12px">${esc(sub(step.title))}</h1>
      <p class="lead" style="margin-top:10px">${esc(body)}</p>
      ${Array.isArray(step.techniqueGuide) && step.techniqueGuide.length ? `<div class="tech-guide"><p class="section-title" style="margin-top:16px">How to do it</p><ol class="tech-list">${step.techniqueGuide.map((g) => `<li>${esc(displayUnits(sub(g)))}</li>`).join("")}</ol></div>` : ""}
      ${step.equipmentNeeded ? `<p class="muted" style="font-size:12px;margin-top:12px">🔧 ${esc(step.equipmentNeeded)}</p>` : ""}
      <div class="mt-auto" style="margin-top:22px"><button class="btn" id="next">Done → ${i + 1 < n ? "Next step" : "Music"}</button></div>
    `));
    $("#back").onclick = () => { prepIdx -= 1; screens.prep(); };
    $("#next").onclick = () => { vibrate("tap"); prepIdx += 1; screens.prep(); };
  }

  // Final screen — music + voice, then launch the cook.
  function prepMusicVoice() {
    h(screenEl("", `
      <button class="btn ghost" id="back" style="width:auto;align-self:flex-start;padding-left:0">← Back</button>
      <p class="eyebrow">${EXP.song.title} · ${EXP.recipe.title}</p>
      <h1 style="margin-top:6px">Last thing —<br>your music 🎸</h1>
      <p class="lead" style="margin-top:10px">Pick a soundtrack and voice, then we cook.</p>
      <div style="margin-top:18px">
      ${spotifyReady() ? `
      <p class="section-title" style="margin-top:0">🎵 Your music <span class="pill premium" style="font-size:10px">PREMIUM</span></p>
      <p class="muted" style="font-size:11px;margin:-4px 2px 8px">Choose any Spotify song or playlist — it starts automatically when you press Start.</p>
      <div id="cookMusicPicker"></div>`
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
        <button class="btn" id="start">▶ Start cooking 🎸</button>
      </div>
    `));
    $("#back").onclick = () => { prepIdx -= 1; screens.prep(); };
    if (!EXP.song.youtubeId && !EXP.song.audioFile) wireMusicPicker();
    if (spotifyReady()) mountCookMusicPicker("#cookMusicPicker", { hasDemo: true });
    const cm2 = $("#connectMusic"); if (cm2) cm2.onclick = () => screens.premium();
    wireVoicePicker();
    if (isKokoro()) pregenKokoro();
    $("#start").onclick = async () => {
      // Own playlist? Activate Spotify on THIS tap so it can play continuously from
      // the very start of Phase 1. (Default song keeps the calm Phase 1 → tap-to-play
      // Phase 2 structure, where activation happens at the drop instead.)
      if (currentSpotifySel()) { try { await Spotify_.activate(); } catch (e) {} }
      if (EXP.prePhase) { screens.preCook(); return; }
      screens.cook();
    };
  }

  // ============================================================
  // PRE-MUSIC PHASE — the silent simmer before the song (EXP.prePhase)
  // A tap-through of prep steps → a countdown simmer timer with an early-exit →
  // a doneness gate → a full-screen "drop the music" moment that launches the
  // music-synced cook (screens.cook). No song/voice here — it's deliberately calm.
  // ============================================================
  screens.preCook = () => {
    WakeLock.acquire();
    const pp = (EXP.id === "one-pot-garlic-parmesan-pasta") ? pastaPrePhase() : EXP.prePhase;
    if (!pp) { screens.cook(); return; }
    Sfx.ensure();
    const ownPlaylist = !!currentSpotifySel();
    if (ownPlaylist) {
      // Own playlist: play it continuously from the very start of Phase 1, straight
      // through the simmer and into Phase 2 — no calm placeholder, no fresh start.
      phase1MusicPlaying = true;
      try { Spotify_.playSelection(currentSpotifySel()).catch(() => {}); } catch (e) {}
    } else {
      Ambient.play(PHASE1_AMBIENT);   // default song: calm Phase 1 placeholder (fades into the song at the drop)
    }
    let timerId = null, stepTimerId = null, simmerSec = pp.timer.sec, stirOn = true;
    const clearTimer = () => { if (timerId) { clearInterval(timerId); timerId = null; } };
    const clearStepTimer = () => { if (stepTimerId) { clearInterval(stepTimerId); stepTimerId = null; } };
    const quit = () => confirmDialog("Quit this cook? Your progress will be lost.", "Yes, quit", () => { clearTimer(); Ambient.stop(); if (ownPlaylist) { try { Spotify_.stop(); } catch (e) {} } phase1MusicPlaying = false; screens.home(); });
    const topBar = (label) => `<div class="cook-top precook-top">
        <button class="icon-btn" id="quit" title="Quit">✕</button>
        <span class="precook-phase">🎵 Phase 1 of 2 · ${esc(label)}</span>
      </div>`;
    const heatHTML = (lvl) => { const hg = lvl ? heatGuidance(lvl) : null; return hg
      ? `<div class="heat-badge ${lvl}"><b>${hg.flames} ${hg.label}</b><span>${hg.source}: ${esc(hg.dial)} · ${esc(hg.note)}</span></div>` : ""; };

    // ---- tap-through prep steps ----
    let idx = 0;
    function renderStep() {
      clearTimer(); clearStepTimer();
      const step = pp.steps[idx];
      const last = idx === pp.steps.length - 1;
      h(`<section class="screen precook fade">
        ${topBar("get it going")}
        <div class="precook-body">
          <p class="eyebrow">${esc(EXP.recipe.title)}</p>
          <h1 style="margin-top:6px">${esc(pp.title || "Get it simmering")}</h1>
          ${idx === 0 && pp.intro ? `<p class="lead" style="margin-top:8px">${esc(pp.intro)}</p>` : ""}
          <div class="precook-dots">${pp.steps.map((s, i) => `<span class="${i < idx ? "done" : i === idx ? "on" : ""}"></span>`).join("")}</div>
          <div class="card precook-card">
            <span class="pill type prep">STEP ${idx + 1} / ${pp.steps.length}</span>
            <h2 style="margin:8px 0 6px">${esc(step.title)}</h2>
            <p class="lead" style="margin:0">${esc(displayUnits(step.body))}</p>
            ${heatHTML(step.heat)}
            ${step.timerSeconds ? `<div class="step-timer" id="stepTimer"><button class="btn secondary" id="startStepTimer">▶ Start ${step.timerSeconds}s timer</button><p class="muted" style="font-size:11px;margin:6px 2px 0">Advisory — you can move on whenever it smells right.</p></div>` : ""}
            ${step.simmerPicker ? `<div class="simmer-pick"><p class="muted" style="font-size:12px;margin:12px 0 6px">How long to simmer? <b style="color:var(--text)">10 min suits most short pasta.</b></p><div class="portion" id="simmerSel">${[8, 10, 12].map((m) => `<button class="pchip ${simmerSec === m * 60 ? "on" : ""}" data-min="${m}">${m} min</button>`).join("")}</div></div>` : ""}
          </div>
          <div class="mt-auto" style="margin-top:18px">
            ${idx > 0 ? `<button class="btn secondary" id="back" style="margin-bottom:10px">← Back</button>` : ""}
            <button class="btn" id="next">${last ? "Start the simmer ⏱" : "Next ▸"}</button>
          </div>
        </div>
      </section>`);
      $("#quit").onclick = quit;
      if ($("#back")) $("#back").onclick = () => { idx--; renderStep(); };
      if (step.simmerPicker) $$("#simmerSel .pchip").forEach((b) => b.onclick = () => { simmerSec = +b.dataset.min * 60; $$("#simmerSel .pchip").forEach((x) => x.classList.toggle("on", x.dataset.min === b.dataset.min)); });
      if (step.timerSeconds) {
        const btn = $("#startStepTimer");
        btn.onclick = () => {
          if (stepTimerId) return;
          let remain = step.timerSeconds;
          $("#stepTimer").innerHTML = `<div class="st-count" id="stCount">${fmt(remain)}</div><div class="st-alert" id="stAlert" hidden></div>`;
          stepTimerId = setInterval(() => {
            remain -= 1;
            const c = $("#stCount"); if (c) c.textContent = remain > 0 ? fmt(remain) : "Time!";
            if (step.timerSeconds - remain >= 60) { const a = $("#stAlert"); if (a && a.hidden) { a.hidden = false; a.textContent = "👃 Check your garlic — it should smell amazing. Golden or brown? Move on now — brown turns bitter."; vibrate("double"); } }
            if (remain <= 0) { clearStepTimer(); vibrate("strong"); }
          }, 1000);
        };
      }
      $("#next").onclick = () => { vibrate("tap"); clearStepTimer(); if (last) runCountdown(() => renderTimer(simmerSec, pp.timer.label, pp.timer.earlyAfterSec ?? null, pp.timer.earlyLabel)); else { idx++; renderStep(); } };
    }

    // ---- countdown simmer timer (real-time) with an early-exit ----
    function renderTimer(totalSec, label, earlyAfterSec, earlyLabel) {
      clearTimer();
      let remain = totalSec;
      const showEarlyNow = earlyAfterSec != null && earlyAfterSec <= 0;
      const stirEvery = pp.timer.stirEvery || 0;
      h(`<section class="screen precook fade">
        ${topBar("simmer")}
        <div class="precook-body precook-timer">
          <p class="eyebrow">${esc(EXP.recipe.title)}</p>
          <h1 style="margin:6px 0 0">${esc(label)}</h1>
          ${pp.timer.heat ? heatHTML(pp.timer.heat) : ""}
          <p class="muted" style="font-size:12px;margin-top:8px">The liquid should be <b style="color:var(--text)">gently bubbling, not a rolling boil</b> — reduce the heat if it's boiling hard.</p>
          ${stirEvery ? `<label class="stir-toggle"><input type="checkbox" id="stirChk" checked> 🔔 Stir reminders (every ${Math.round(stirEvery / 60)} min)</label>` : ""}
          <div class="pt-time" id="ptTime">${fmt(remain)}</div>
          <div class="pt-bar"><i id="ptBar" style="width:0%"></i></div>
          <p class="muted" id="ptElapsed" style="font-size:12px;margin-top:8px">0:00 elapsed · ${fmt(totalSec)} total</p>
          <div id="stirPrompt" class="stir-prompt" hidden>🥄 Give it a stir — scrape the bottom of the pan to prevent sticking</div>
          <div class="mt-auto" style="margin-top:18px">
            <button class="btn" id="early" style="display:${showEarlyNow ? "block" : "none"}">${esc(earlyLabel || pp.gate.yesLabel)}</button>
          </div>
        </div>
      </section>`);
      $("#quit").onclick = quit;
      const stirChk = $("#stirChk"); if (stirChk) stirChk.onchange = () => { stirOn = stirChk.checked; };
      const earlyBtn = $("#early");
      earlyBtn.onclick = () => { clearTimer(); vibrate("tap"); renderGate(); };
      timerId = setInterval(() => {
        remain -= 1;
        const elapsed = totalSec - remain;
        const t = $("#ptTime"); if (t) t.textContent = fmt(Math.max(0, remain));
        const bar = $("#ptBar"); if (bar) bar.style.width = Math.min(100, (100 * elapsed) / totalSec) + "%";
        const el = $("#ptElapsed"); if (el) el.textContent = `${fmt(elapsed)} elapsed · ${fmt(totalSec)} total`;
        if (earlyBtn && earlyAfterSec != null && elapsed >= earlyAfterSec) earlyBtn.style.display = "block";
        // stir reminder: audible chime + haptic + on-screen visual (user may not be looking)
        if (stirEvery && stirOn && elapsed > 0 && elapsed % stirEvery === 0 && remain > 0) {
          vibrate("double"); Sfx.chime();
          const p = $("#stirPrompt"); if (p) { p.hidden = false; clearTimeout(p._h); p._h = setTimeout(() => { p.hidden = true; }, 6000); }
        }
        if (remain <= 0) { clearTimer(); vibrate("double"); renderGate(); }
      }, 1000);
    }

    // ---- doneness gate ----
    function renderGate() {
      clearTimer();
      h(`<section class="screen precook fade">
        ${topBar("doneness check")}
        <div class="precook-body">
          <p class="eyebrow">${esc(EXP.recipe.title)}</p>
          <h1 style="margin-top:6px">${esc(pp.gate.question)}</h1>
          <p class="lead" style="margin-top:10px">Bite a piece — it should be tender (not mushy), with the liquid mostly cooked down into a glossy sauce.</p>
          <div class="mt-auto" style="margin-top:24px">
            <button class="btn" id="ready">${esc(pp.gate.yesLabel)}</button>
            <button class="btn secondary" id="notyet" style="margin-top:10px">${esc(pp.gate.notYetLabel)}</button>
          </div>
        </div>
      </section>`);
      $("#quit").onclick = quit;
      $("#ready").onclick = () => { vibrate("strong"); renderTransition(); };
      $("#notyet").onclick = () => { vibrate("tap"); renderTimer(pp.gate.notYetSec || 120, "2 more minutes — almost there", 0, "It's ready now ▸"); };
    }

    // ---- the drop: launch the music-synced cook ----
    function renderTransition() {
      clearTimer();
      // Own playlist is already playing continuously — this is just the cooking "bring
      // it home" beat, not a music-start moment.
      const title = ownPlaylist ? "Time to bring it home 🎸" : pp.transition.title;
      const body = ownPlaylist ? "Your playlist keeps rolling — let's finish the sauce, off the heat." : (pp.transition.body || "Tap play to start the music.");
      const btn = ownPlaylist ? "Let's finish it 🎸" : "▶ " + (pp.transition.button || "Play");
      h(`<section class="screen precook precook-drop fade">
        <div class="drop-inner">
          <div class="big-emoji" style="font-size:72px">🎸</div>
          <h1 style="margin:10px 0">${esc(title)}</h1>
          <p class="lead">${esc(body)}</p>
          <button class="btn drop-play" id="drop">${esc(btn)}</button>
        </div>
      </section>`);
      $("#drop").onclick = async () => {
        if (ownPlaylist) { screens.cook(); return; }   // music already rolling — keep it continuous, no restart
        // Default song: the song starts on THIS tap, so the Spotify activation gesture lives here.
        if (currentSpotifySel()) { try { await Spotify_.activate(); } catch (e) {} }
        Ambient.fadeOut(900);              // calm Phase 1 fades out as the Phase 2 song kicks in
        screens.cook();
      };
    }

    renderStep();
  };

  // ============================================================
  // COOK SESSION — the hero
  // ============================================================
  screens.cook = () => {
    WakeLock.acquire();   // covers both the real cook and preview (watch-along)
    const preview = cookPreview; cookPreview = false;   // PREVIEW = watch-along demo (no prep / gates / logging)
    // scale cue times + total to the chosen portion (e.g. # of eggs)
    const pf = portionFactor();
    // pasta cues reflect the chosen servings/liquid/add-ins; others use the static set
    const baseCues = (EXP.id === "one-pot-garlic-parmesan-pasta") ? pastaCues() : mCues();
    // drop cues belonging to any deselected optional component (e.g. garlic butter)
    const active = baseCues.filter((c) => !c.opt || optActive(EXP.id, c.opt));
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
    if (state.prefs.speed !== 1 && state.prefs.speed !== 2) state.prefs.speed = 1; // only 1×/2× (clamp any old persisted value)
    // PHASE C: beat grid for musical seams
    const bpm = EXP.bpm || 100;
    const beatLen = 60 / bpm;
    const barLen = beatLen * 4;
    const alignToBar = (t) => Math.round(t / barLen) * barLen;

    h(`<section class="cook fade ${ytId ? "has-video" : ""} ${preview ? "is-preview" : ""}" id="cook">
      ${preview ? `<div class="preview-pill">👀 PREVIEW</div>` : ""}
      <div class="cook-top">
        <div class="now-playing">
          <span class="eq">${[0, 0, 0, 0].map(() => `<i style="animation-duration:${beatLen}s"></i>`).join("")}</span>
          <span><b>${spSel ? esc(cookSelectionLabel()) : EXP.song.title}</b><br><span class="muted">${spSel ? "🎧 Spotify" : EXP.song.artist + " · " + bpm + " BPM" + (Music.has() ? "" : " · demo")}</span></span>
        </div>
        <div class="cook-icons">
          <button class="icon-btn ${state.prefs.voice ? "" : "off"}" id="tVoice" title="Voice">🔊</button>
          <button class="icon-btn ${state.prefs.haptics ? "" : "off"}" id="tHaptic" title="Haptics">📳</button>
          <button class="icon-btn" id="tSpeed" title="${preview ? "Skip ahead" : "Demo speed"}">${preview ? "⏩" : state.prefs.speed + "×"}</button>
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
        <div class="step-head">
          <h2 id="stepTitle">Press play and let's cook</h2>
          <span class="pill type prep" id="stepType">GET READY</span>
        </div>
        <div class="heat-badge" id="heatBadge" hidden></div>
        <img class="cue-img" id="stepImage" hidden alt="" />
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
        <button class="btn ghost" id="quit" style="flex:0 0 auto">${preview ? "Exit preview" : "Quit"}</button>
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
    // songsPlayed = the ACTUAL track(s) heard during the cook (for the share card).
    // Today that's the recipe's default song; a premium playlist would append each
    // track as it plays. The Phase 1 ambient is filler and is intentionally excluded.
    const session = { mode: "music", recipe: EXP.recipe.title, emoji: EXP.recipe.emoji, song: EXP.song.title, artist: EXP.song.artist, songsPlayed: [{ title: EXP.song.title, artist: EXP.song.artist }], portion: EXP.portion ? (portionCount || EXP.portion.base) : undefined, equipment: { ...state.equipment }, heatSource: state.equipment.heat, pan: activePan(), pansOwned: [...(state.equipment.pans || [])], experience: state.experience, startedAt: Date.now(), steps: [], totalExtends: 0, completed: false };
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
      const body = injectAmounts((state.isBeginner && src.beginner) ? src.beginner : src.body, EXP.ingredients, portionScale());
      $("#stepType").className = "pill type " + cue.type;
      $("#stepType").textContent = cue.type.toUpperCase();
      $("#stepTitle").textContent = src.title;
      $("#stepBody").textContent = displayUnits(body);
      // heat level for this cue → concrete dial setting tuned to gas/electric
      const hb = $("#heatBadge"); const hg = (cue.heat && !preview) ? heatGuidance(cue.heat) : null; // preview hides heat badges
      if (hb) {
        if (hg) { hb.hidden = false; hb.className = "heat-badge " + cue.heat; hb.innerHTML = `<b>${hg.flames} ${hg.label}</b><span>${hg.source}: ${esc(hg.dial)} · ${esc(hg.note)}</span>`; }
        else { hb.hidden = true; hb.innerHTML = ""; }
      }
      // optional reference image (eggs pilot only) — load the stored file; if it's
      // missing/404 it hides itself (onerror), so steps without one render as text.
      const im = $("#stepImage");
      if (im) {
        if (cue.referenceImage) {
          // start hidden; reveal ONLY once it actually loads — a missing file never flashes
          im.onload = () => { im.hidden = false; };
          im.onerror = () => { im.hidden = true; };
          im.onclick = () => lightbox(cue.referenceImage, src.title);
          im.alt = src.title; im.hidden = true; im.src = cue.referenceImage;
        } else { im.hidden = true; im.onclick = null; im.removeAttribute("src"); }
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
      if (cue.type === "finish" && !preview) finish(); // preview ends via its own driver (no logging)
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
        // doneness gates always wait; generic checkpoints only when enabled; never
        // the first step, the finish, or a cue flagged noCheckpoint (e.g. the final
        // "admire it" beat, which lets the song play out instead of pausing).
        if (cue.type !== "finish" && nextIdx > 1 && (cue.gate || (state.prefs.checkpoints && !cue.noCheckpoint))) { enterWait(cue); break; }
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

    // ---- PREVIEW driver: highlight reel. Seek to each cue's real musical moment,
    // dwell a few seconds (authentic, normal-pitch audio), then jump to the next.
    // No gates, no logging, no streak — ends on the conversion screen.
    let pIdx = -1, pDwellStart = 0, pDwellMs = 5200, pRemain = 0, pTimer = null, pRaf = null, pEnded = false;
    const pSchedule = (fn, ms) => { clearTimeout(pTimer); pTimer = setTimeout(fn, ms); };
    function previewAdvance() {
      pIdx++;
      if (pIdx >= cues.length) { previewEnd(); return; }
      const cue = cues[pIdx];
      Music.seek(cue.at);                                        // jump the song to this cue's moment
      Music.duck(); setTimeout(() => { if (!pEnded && !paused) Music.unduck(); }, 240); // mask the seek jump
      if (!paused) Music.play();
      applyCue(cue, pIdx);
      pDwellStart = performance.now();
      const isLast = pIdx >= cues.length - 1;
      pDwellMs = isLast ? 2600 : (cue.type === "tip" ? 3800 : 5200);
      pSchedule(isLast ? previewEnd : previewAdvance, pDwellMs);
    }
    function previewRing() {
      pRaf = requestAnimationFrame(previewRing);
      if (pEnded || paused) return;
      const frac = Math.min(1, (performance.now() - pDwellStart) / pDwellMs);
      ring.style.strokeDashoffset = C * (1 - frac);
      const overall = Math.min(1, (pIdx + frac) / cues.length);
      $("#tlFill").style.width = (overall * 100) + "%";
      $("#tElapsed").textContent = `${Math.min(pIdx + 1, cues.length)} / ${cues.length}`;
      const cd = $("#cd"); if (cd) cd.textContent = "👀";
      const nl = $("#nextLabel"); if (nl) nl.textContent = (pIdx + 1 < cues.length) ? `MOMENT ${pIdx + 1} OF ${cues.length}` : "THE FINALE";
    }
    function previewPause() {
      paused = !paused;
      cookEl.classList.toggle("paused", paused);
      $("#pause").textContent = paused ? "▶ Resume" : "⏸ Pause";
      if (paused) { clearTimeout(pTimer); pRemain = Math.max(0, pDwellMs - (performance.now() - pDwellStart)); stopVoice(); Music.pause(); }
      else { pDwellStart = performance.now() - (pDwellMs - pRemain); Music.play(); const isLast = pIdx >= cues.length - 1; pSchedule(isLast ? previewEnd : previewAdvance, pRemain); }
    }
    function previewSkip() { if (paused || pEnded) return; previewAdvance(); }
    function previewEnd() {
      if (pEnded) return; pEnded = true;
      clearTimeout(pTimer); if (pRaf) cancelAnimationFrame(pRaf); pRaf = null;
      stopVoice(); Music.stop(); if (navigator.vibrate) navigator.vibrate(0);
      setTimeout(() => screens.previewDone(EXP), 500);
    }
    function previewExit() { pEnded = true; clearTimeout(pTimer); if (pRaf) cancelAnimationFrame(pRaf); stopVoice(); Music.stop(); screens.home(); }
    function startPreviewDriver() { pRaf = requestAnimationFrame(previewRing); previewAdvance(); }

    // The whole cook (video + timer + voice) starts on the user's tap of the player.
    let started = false;
    const greeting = spSel
      ? (state.isBeginner ? "Alright — I've got you. Your music's rolling, let's cook." : "Let's cook. Your music's rolling.")
      : (state.isBeginner ? `Alright — I've got you. ${EXP.song.title} is rolling, let's cook.` : `Let's cook. ${EXP.song.title} is rolling.`);

    function begin() {
      if (started) return;
      started = true; paused = false;
      const t = $("#videoTap"); if (t) t.style.display = "none";
      if (preview) { if (Music.loaded) { Music.rate(1); Music.play(); } startPreviewDriver(); return; }
      if (phase1MusicPlaying) {
        // Own playlist has been playing continuously since Phase 1 — no countdown, no
        // restart; the cues just pick up over the top.
        speak(greeting);
        lastTs = performance.now();
        raf = requestAnimationFrame(loop);
        return;
      }
      // audible + visual 3·2·1, THEN the music kicks in (the "natural lift" out of Phase 1)
      runCountdown(() => {
        if (ytId) { Yt.setVol(100); Yt.play(); }
        else if (spSel) { Spotify_.playSelection(spSel).catch((e) => toast("Couldn't start Spotify (" + (e.message || "error") + ") — cooking without music.")); }
        else if (Music.loaded) { Music.rate(state.prefs.speed); Music.seek(0); Music.play(); }
        speak(greeting);
        lastTs = performance.now();
        raf = requestAnimationFrame(loop);
      });
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
      if (preview) { previewPause(); return; }
      paused = !paused;
      cookEl.classList.toggle("paused", paused);
      e.target.textContent = paused ? "▶ Resume" : "⏸ Pause";
      if (paused) { stopVoice(); Music.pause(); if (spSel) Spotify_.pause(); } else { Music.play(); if (spSel) Spotify_.resume(); }
      lastTs = performance.now();
    };
    $("#quit").onclick = preview
      ? (() => previewExit())
      : (() => confirmDialog("Quit this cook? Your progress will be lost.", "Yes, quit", () => { stop(); screens.home(); }));
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
      if (preview) { previewSkip(); return; } // ⏩ jump to the next moment
      const opts = [1, 2]; // only 1× (default) and 2× — app-wide
      const i = (opts.indexOf(state.prefs.speed) + 1) % opts.length;
      state.prefs.speed = opts[i];
      if (Music.has()) Music.rate(state.prefs.speed);
      e.currentTarget.textContent = state.prefs.speed + "×";
      toast(state.prefs.speed === 1 ? "Real-time" : "Speed " + state.prefs.speed + "×");
    };
  };

  // ---- Preview conversion screen — capture intent while they're hooked ----
  screens.previewDone = (exp) => {
    WakeLock.release();   // preview ended
    exp = exp || EXP;
    const already = isSaved(exp.id);
    h(screenEl("center", `
      <div class="finish-hero">
        <div class="medal">🔥</div>
        <p class="eyebrow" style="margin-top:8px">Preview complete</p>
        <h1 style="margin-top:8px">That's the<br><span class="gradient-text">Sizle experience.</span></h1>
        <p class="lead" style="margin-top:10px">${esc(exp.recipe.title)} to ${esc(exp.song.title)} — every cook feels like that.</p>
      </div>
      <div class="stack" style="margin-top:26px">
        <button class="btn" id="cookReal">🎸 Cook it for real</button>
        <button class="btn secondary" id="saveLater" ${already ? "disabled" : ""}>${already ? "✓ Saved for later" : "🔖 Save for later"}</button>
        <button class="btn ghost" id="previewAnother">👀 Preview another</button>
      </div>
    `));
    $("#cookReal").onclick = () => { EXP = exp; cookMethod = null; resetPrepPrefs(); screens.prep(); };
    $("#saveLater").onclick = () => { saveForLater(exp); const b = $("#saveLater"); b.textContent = "✓ Saved for later"; b.disabled = true; toast("Saved for later 🔖"); };
    $("#previewAnother").onclick = () => screens.home();
  };

  // ---- Post-onboarding: guarantee the music-sync "aha" before the browse view ----
  screens.firstPreview = () => {
    const exp = EXPERIENCES[0]; // #1 recommended = the featured cook
    h(screenEl("center", `
      <div class="finish-hero">
        <div class="big-emoji" style="font-size:64px">${exp.recipe.emoji}</div>
        <p class="eyebrow" style="margin-top:10px">You're all set</p>
        <h1 style="margin-top:8px">See the magic<br><span class="gradient-text">first</span> 👀</h1>
        <p class="lead" style="margin-top:12px">Watch <b style="color:var(--text)">${esc(exp.recipe.title)}</b> cook to <b style="color:var(--text)">${esc(exp.song.title)}</b> — no pan, no commitment. About 60 seconds, right here on the couch.</p>
      </div>
      <div class="stack" style="margin-top:26px">
        <button class="btn" id="goPreview">Preview your first cook ▶</button>
        <button class="btn ghost" id="skipPreview">Skip to browse</button>
      </div>
    `));
    $("#goPreview").onclick = () => startPreview(exp);
    $("#skipPreview").onclick = () => screens.home();
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
    cookCardData = { rating: null, photoFile: null }; // fresh per cook, for the share card
    let saved = false, savePromise = null;
    const emojiFor = (v) => v <= 1 ? "😞" : v <= 2 ? "😐" : v <= 3 ? "🙂" : v <= 4 ? "😋" : "🤩";
    const paint = (v) => $$("#stars .star").forEach((st, i) => { st.querySelector(".star-fill").style.width = (Math.max(0, Math.min(1, v - i)) * 100) + "%"; });
    // ready to leave only once BOTH a rating and a non-empty comment are given
    const checkReady = () => { if (onReadyChange) onReadyChange(fb.rating != null && fb.comment.trim().length > 0); };
    function setRating(v) {
      fb.rating = v; if (cookCardData) cookCardData.rating = v; paint(v);
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
      if (f) { fb.hasPhoto = true; if (cookCardData) cookCardData.photoFile = f; $("#photoPrev").innerHTML = `<img class="cook-photo" src="${URL.createObjectURL(f)}" alt="your cook">`; toast("Looks delicious 😋"); }
    };
    return () => {                       // persist (only fires once rating + comment exist)
      if (saved) return savePromise;     // idempotent — return the in-flight save
      if (fb.rating == null || !fb.comment.trim()) return null;
      saved = true;
      const comment = fb.comment.trim();
      if (pendingSession) { pendingSession.rating = fb.rating; pendingSession.comment = comment; pendingSession.hasPhoto = fb.hasPhoto; pendingSession.finishedAt = new Date().toISOString(); savePromise = Telemetry.save(pendingSession); pendingSession = null; }
      else { savePromise = Telemetry.save({ mode: "unknown", recipe: fb.recipe, rating: fb.rating, comment, hasPhoto: fb.hasPhoto, at: fb.at, completed: true }); }
      return savePromise;
    };
  }

  // Apply a session-save response's streak to state, then show a celebratory
  // full-width flame banner before the caller navigates home. No-op offline.
  function applyStreakResp(res) {
    if (res && typeof res.currentStreak === "number") state.currentStreak = res.currentStreak;
    if (res && typeof res.longestStreak === "number") state.longestStreak = res.longestStreak;
  }
  function celebrateStreak() {
    return new Promise((resolve) => {
      const n = state.currentStreak || 0;
      if (n < 1) return resolve();
      const wrap = document.createElement("div");
      wrap.className = "streak-cele" + (n >= 7 ? " hot" : "");
      wrap.innerHTML = `<div class="cele-inner">
        <div class="cele-fire">🔥</div>
        <h1>${n}-day streak!</h1>
        <p>${n >= 7 ? "You're on fire — keep it going tomorrow." : "Keep it going tomorrow."}</p>
        <button class="btn" id="celeGo">Back home</button>
      </div>`;
      (document.querySelector(".phone") || app).appendChild(wrap);
      requestAnimationFrame(() => wrap.classList.add("show"));
      wrap.querySelector("#celeGo").onclick = () => { wrap.classList.remove("show"); setTimeout(() => { wrap.remove(); resolve(); }, 220); };
    });
  }
  // Save the rated session, light up the streak, celebrate, then run `next`.
  async function finishExit(save, next) {
    const res = await Promise.resolve(save());
    applyStreakResp(res);
    await celebrateStreak();
    next();
  }

  // ============================================================
  // SHAREABLE COOK CARD — Layout A (photo hero) + B-style stat band.
  // Rendered client-side to a 1080×1920 canvas (native Canvas API, no deps).
  // Free = full watermark bar; premium = minimal corner mark (configurable).
  // ============================================================
  const CARD_W = 1080, CARD_H = 1920;
  const PREMIUM_CARD_BRANDING = "corner"; // "corner" tiny mark | "none" — A/B later
  const CARD_TAGLINES = ["I cooked this to a song 🎶🔥", "Cooking, but make it a vibe ✨"];

  function loadImage(src, cross) {
    return new Promise((res, rej) => { const im = new Image(); if (cross) im.crossOrigin = "anonymous"; im.onload = () => res(im); im.onerror = rej; im.src = src; });
  }
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function drawCover(ctx, img, x, y, w, h) {
    const ir = img.width / img.height, br = w / h; let sw, sh, sx, sy;
    if (ir > br) { sh = img.height; sw = sh * br; sx = (img.width - sw) / 2; sy = 0; }
    else { sw = img.width; sh = sw / br; sx = 0; sy = (img.height - sh) / 2; }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  }

  async function buildCookCard(data) {
    const cv = document.createElement("canvas"); cv.width = CARD_W; cv.height = CARD_H;
    const ctx = cv.getContext("2d");
    try { await document.fonts.ready; } catch (e) {}
    const ORANGE = "#ff6b35", VIOLET = "#c44dff", MUTED = "#9a9ab0", TEXT = "#f4f4f7", cx = CARD_W / 2;
    const fireGrad = (x0, x1) => { const g = ctx.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, ORANGE); g.addColorStop(1, VIOLET); return g; };
    ctx.fillStyle = "#0b0b0f"; ctx.fillRect(0, 0, CARD_W, CARD_H);
    const glow = ctx.createRadialGradient(cx, 220, 60, cx, 220, 760);
    glow.addColorStop(0, "rgba(255,107,53,.22)"); glow.addColorStop(1, "rgba(255,107,53,0)");
    ctx.fillStyle = glow; ctx.fillRect(0, 0, CARD_W, 920);

    // logo lockup
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    let logoY = 96;
    try { const logo = await loadImage("assets/logo.png"); const lh = 100, lw = logo.width * (lh / logo.height); ctx.drawImage(logo, cx - lw / 2, logoY, lw, lh); logoY += lh + 18; } catch (e) { logoY += 10; }
    ctx.font = "800 46px 'Instrument Sans', system-ui, sans-serif";
    try { ctx.letterSpacing = "10px"; } catch (e) {}
    ctx.fillStyle = fireGrad(cx - 130, cx + 130); ctx.fillText("SIZLE", cx + 5, logoY + 38);
    try { ctx.letterSpacing = "0px"; } catch (e) {}

    // dish name (bold, wrapping)
    ctx.font = "800 78px 'Instrument Sans', system-ui, sans-serif"; ctx.fillStyle = TEXT;
    const maxNameW = CARD_W - 120, words = (data.recipe || "Your Cook").split(" "), lines = []; let curL = "";
    for (const w of words) { const t = curL ? curL + " " + w : w; if (ctx.measureText(t).width > maxNameW && curL) { lines.push(curL); curL = w; } else curL = t; }
    if (curL) lines.push(curL);
    let ny = 360; for (const ln of lines) { ctx.fillText(ln, cx, ny); ny += 90; }

    // hero photo (or fire-gradient fallback)
    const boxX = 72, boxW = CARD_W - 144, boxH = 740, boxY = ny + 8;
    ctx.save(); rr(ctx, boxX, boxY, boxW, boxH, 40); ctx.clip();
    if (data.photo) {
      drawCover(ctx, data.photo, boxX, boxY, boxW, boxH);
      let g = ctx.createLinearGradient(0, boxY, 0, boxY + 170); g.addColorStop(0, "rgba(11,11,15,.5)"); g.addColorStop(1, "rgba(11,11,15,0)"); ctx.fillStyle = g; ctx.fillRect(boxX, boxY, boxW, 170);
      g = ctx.createLinearGradient(0, boxY + boxH - 210, 0, boxY + boxH); g.addColorStop(0, "rgba(11,11,15,0)"); g.addColorStop(1, "rgba(11,11,15,.6)"); ctx.fillStyle = g; ctx.fillRect(boxX, boxY + boxH - 210, boxW, 210);
    } else {
      const fg = ctx.createLinearGradient(boxX, boxY, boxX + boxW, boxY + boxH); fg.addColorStop(0, "#2a1410"); fg.addColorStop(.5, "#3a1530"); fg.addColorStop(1, "#1a0f1a");
      ctx.fillStyle = fg; ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.font = "210px system-ui"; ctx.fillText(data.emoji || "🍳", cx, boxY + boxH / 2 + 40);
      ctx.font = "600 34px 'Inter', system-ui, sans-serif"; ctx.fillStyle = MUTED; ctx.fillText("my cook", cx, boxY + boxH - 64);
    }
    ctx.restore();
    ctx.lineWidth = 8; ctx.strokeStyle = fireGrad(boxX, boxX + boxW); rr(ctx, boxX + 4, boxY + 4, boxW - 8, boxH - 8, 38); ctx.stroke();

    // stat band
    const bandY = boxY + boxH + 44, bandH = 220, bandX = 72, bandW = CARD_W - 144;
    rr(ctx, bandX, bandY, bandW, bandH, 32); ctx.fillStyle = "#16161e"; ctx.fill();
    rr(ctx, bandX, bandY, bandW, bandH, 32); ctx.lineWidth = 2; ctx.strokeStyle = "#2a2a36"; ctx.stroke();
    const stats = [];
    if (data.rating != null) stats.push(`⭐ ${data.rating % 1 ? data.rating.toFixed(1) : data.rating}`);
    if (data.durationSec) stats.push(`⏱ ${Math.max(1, Math.round(data.durationSec / 60))} min`);
    if (data.streak > 0) stats.push(`🔥 ${data.streak}-day streak`);
    ctx.font = "700 42px 'Instrument Sans', system-ui, sans-serif"; ctx.fillStyle = TEXT;
    ctx.fillText(stats.join("    ·    "), cx, bandY + 94);
    ctx.font = "600 36px 'Inter', system-ui, sans-serif"; ctx.fillStyle = ORANGE;
    // actual song(s) played: one → "title · artist"; many → "a · b · c +N more"
    const songs = (Array.isArray(data.songs) && data.songs.length) ? data.songs : [{ title: data.song, artist: data.artist }];
    let song;
    if (songs.length === 1) song = `🎵 ${songs[0].title || ""}${songs[0].artist ? " · " + songs[0].artist : ""}`;
    else { const shown = songs.slice(0, 3).map((s) => s.title); song = `🎵 ${shown.join(" · ")}${songs.length > 3 ? ` +${songs.length - 3} more` : ""}`; }
    while (ctx.measureText(song).width > bandW - 60 && song.length > 10) song = song.slice(0, -2);
    ctx.fillText(song, cx, bandY + 162);

    // tagline
    ctx.font = "italic 700 40px 'Instrument Sans', system-ui, sans-serif"; ctx.fillStyle = TEXT;
    ctx.fillText(data.tagline || CARD_TAGLINES[0], cx, bandY + bandH + 92);

    // branding
    if (data.free) {
      const barY = CARD_H - 172;
      ctx.fillStyle = "#101018"; ctx.fillRect(0, barY, CARD_W, 172);
      ctx.fillStyle = fireGrad(0, CARD_W); ctx.fillRect(0, barY, CARD_W, 5);
      try {
        const logo = await loadImage("assets/logo.png"); const lh = 66, lw = logo.width * (lh / logo.height);
        ctx.drawImage(logo, cx - 158, barY + 52, lw, lh);
        ctx.textAlign = "left"; ctx.font = "800 40px 'Instrument Sans', system-ui, sans-serif"; ctx.fillStyle = TEXT; ctx.fillText("Made with Sizle", cx - 158 + lw + 20, barY + 84);
        ctx.font = "500 30px 'Inter', system-ui, sans-serif"; ctx.fillStyle = MUTED; ctx.fillText("sizle.app", cx - 158 + lw + 20, barY + 126);
        ctx.textAlign = "center";
      } catch (e) { ctx.font = "800 44px 'Instrument Sans', system-ui, sans-serif"; ctx.fillStyle = TEXT; ctx.fillText("Made with Sizle · sizle.app", cx, barY + 104); }
    } else if (PREMIUM_CARD_BRANDING === "corner") {
      ctx.textAlign = "right"; ctx.font = "700 30px 'Instrument Sans', system-ui, sans-serif"; ctx.fillStyle = "rgba(154,154,176,.65)";
      ctx.fillText("Sizle", CARD_W - 60, CARD_H - 56); ctx.textAlign = "center";
    }
    return await new Promise((res) => cv.toBlob((b) => res(b), "image/png"));
  }

  function trackCard(type) { try { if (backendOn()) API.event(type, (EXP && EXP.recipe) ? EXP.recipe.title : null).catch(() => {}); } catch (e) {} }
  function downloadBlob(blob, name) { const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name || "sizle-cook.png"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 5000); }
  async function shareCardBlob(blob) {
    const file = new File([blob], "sizle-cook.png", { type: "image/png" });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: "My Sizle cook", text: "Cooked this to a song 🎶🔥" }); trackCard("card_shared"); return "shared"; }
    } catch (e) { if (e && e.name === "AbortError") return "cancelled"; }
    downloadBlob(blob); trackCard("card_shared"); return "downloaded";
  }
  // Gentle, non-blocking nudge to add a photo. Resolves "add" or "asis".
  function photoNudge() {
    return new Promise((resolve) => {
      const wrap = document.createElement("div"); wrap.className = "confirm-scrim";
      wrap.innerHTML = `<div class="confirm-box"><p>Add a photo to make your card pop 📸<br><span class="muted" style="font-size:13px">Totally optional.</span></p><div class="btn-row"><button class="btn" data-add>📸 Add a photo</button><button class="btn secondary" data-asis>Share as is</button></div></div>`;
      (document.querySelector(".phone") || app).appendChild(wrap);
      requestAnimationFrame(() => wrap.classList.add("show"));
      const close = (v) => { wrap.classList.remove("show"); setTimeout(() => wrap.remove(), 180); resolve(v); };
      wrap.querySelector("[data-add]").onclick = () => close("add");
      wrap.querySelector("[data-asis]").onclick = () => close("asis");
      wrap.onclick = (e) => { if (e.target === wrap) close("asis"); };
    });
  }
  function showCookCard(blob, free) {
    const url = URL.createObjectURL(blob);
    h(screenEl("cookcard-screen", `
      <button class="btn ghost" id="ccBack" style="width:auto;align-self:flex-start;padding-left:0">← Back</button>
      <p class="eyebrow" style="text-align:center;margin-top:2px">Your cook card</p>
      <div class="cc-preview"><img src="${url}" alt="your cook card"></div>
      ${free ? `<button class="cc-upsell" id="ccUpsell">✨ Remove the watermark with <b>Premium</b></button>` : ""}
      <div class="stack" style="margin-top:14px">
        <button class="btn" id="ccShare">Share 📲</button>
        <button class="btn secondary" id="ccDownload">Save image ⬇</button>
        <button class="btn ghost" id="ccHome">Back home</button>
      </div>
    `));
    $("#ccBack").onclick = () => screens.home();
    $("#ccHome").onclick = () => screens.home();
    $("#ccShare").onclick = () => shareCardBlob(blob);
    $("#ccDownload").onclick = () => { downloadBlob(blob); trackCard("card_shared"); };
    const up = $("#ccUpsell"); if (up) up.onclick = () => screens.premium();
  }
  // Build the card from the finished cook, with a photo nudge, then preview it.
  async function makeAndShowCard(save, btn) {
    const orig = btn ? btn.textContent : "";
    if (btn) { btn.disabled = true; btn.textContent = "Building your card…"; }
    const dur = pendingSession ? pendingSession.durationSec : null;
    const songs = (pendingSession && pendingSession.songsPlayed && pendingSession.songsPlayed.length) ? pendingSession.songsPlayed : [{ title: EXP.song.title, artist: EXP.song.artist }];
    try { applyStreakResp(await Promise.resolve(save ? save() : null)); } catch (e) {}
    if (!cookCardData || !cookCardData.photoFile) {
      const r = await photoNudge();
      if (r === "add") { if (btn) { btn.disabled = false; btn.textContent = orig; } const inp = $("#photoInput"); if (inp) inp.click(); return; }
    }
    let photo = null;
    try { if (cookCardData && cookCardData.photoFile) photo = await loadImage(URL.createObjectURL(cookCardData.photoFile)); } catch (e) {}
    trackCard("card_generated");
    const blob = await buildCookCard({ recipe: EXP.recipe.title, emoji: EXP.recipe.emoji, songs, rating: cookCardData ? cookCardData.rating : null, durationSec: dur, streak: state.currentStreak, photo, free: !isPremium() });
    if (btn) { btn.disabled = false; btn.textContent = orig; }
    showCookCard(blob, !isPremium());
  }

  screens.finish = () => {
    WakeLock.release();   // cook complete
    h(screenEl("center", `
      <div class="finish-hero">
        <div class="medal">🏅</div>
        <p class="eyebrow" style="margin-top:8px">First cook complete</p>
        <h1 style="margin-top:8px">You made<br><span class="gradient-text">${EXP.recipe.title.toLowerCase()}.</span></h1>
        <div class="streak">🔥 Rate it to bank your streak</div>
      </div>

      <div class="share-card">
        <div class="glow"></div>
        <div class="big">${EXP.recipe.emoji}🎵</div>
        <h2 style="position:relative;margin-top:8px">Cooked to ${EXP.song.title}</h2>
        <p class="muted" style="position:relative">${EXP.song.artist} · Sizle</p>
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
    $("#share").onclick = () => makeAndShowCard(save, $("#share"));
    $("#again").onclick = () => { save(); resetPrepPrefs(); screens.prep(); };
    $("#home").onclick = () => finishExit(save, () => screens.home());
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
          <span class="brand-lockup"><img class="brand-logo" src="assets/logo.png" alt="" aria-hidden="true" /><span class="brand gradient-text">Sizle</span></span>
          <button class="icon-btn" id="sbClose" aria-label="Close menu">✕</button>
        </div>
        <nav class="sb-nav">
          <button class="sb-item" data-nav="profile"><span class="sb-ico">👤</span><span>Profile</span></button>
          <button class="sb-item" data-nav="saved"><span class="sb-ico">🔖</span><span>Saved</span></button>
          <button class="sb-item" data-nav="history"><span class="sb-ico">📅</span><span>Cook History</span></button>
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
      else if (name === "saved") screens.saved();
      else if (name === "history") screens.cookHistory();
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

  // ============================================================
  // COOK HISTORY — Phase 1: free "Recent Cooks" (last 3) + locked teaser + streak.
  // (Premium full history / calendar / records arrive in Phase 2.)
  // ============================================================
  const sessionEmoji = (s) => s.emoji || (EXPERIENCES.find((e) => e.recipe.title === s.recipe) || {}).recipe?.emoji || "🍽️";
  function timeAgo(iso) {
    if (!iso) return "";
    const sec = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (sec < 60) return "just now";
    const m = sec / 60; if (m < 60) return `${Math.floor(m)}m ago`;
    const hh = m / 60; if (hh < 24) return `${Math.floor(hh)}h ago`;
    const d = hh / 24; if (d < 7) { const n = Math.floor(d); return `${n} day${n === 1 ? "" : "s"} ago`; }
    const w = d / 7; if (w < 5) { const n = Math.floor(w); return `${n} week${n === 1 ? "" : "s"} ago`; }
    const mo = d / 30; if (mo < 12) { const n = Math.floor(mo); return `${n} month${n === 1 ? "" : "s"} ago`; }
    const y = Math.floor(d / 365); return `${y} year${y === 1 ? "" : "s"} ago`;
  }
  function starsHTML(rating) {
    const full = Math.round(rating || 0);
    return `<span class="hs-stars" title="${rating || 0} / 5">${"★".repeat(full)}<span class="hs-empty">${"★".repeat(5 - full)}</span></span>`;
  }
  function historyCardHTML(s) {
    const sub = s.song ? `${esc(s.song)}${s.artist ? " · " + esc(s.artist) : ""}` : (esc([s.category, s.difficulty].filter(Boolean).join(" · ")) || "Guided cook");
    const when = timeAgo(s.finishedAt || s.savedAt || s.at);
    const done = !!s.completed;
    return `<div class="hist-card">
      <div class="hist-emoji">${sessionEmoji(s)}</div>
      <div class="hist-body">
        <b>${esc(s.recipe || "Cook")}</b>
        <small>${sub}</small>
        <div class="hist-meta">${starsHTML(s.rating)}<span class="hist-when">${when}</span><span class="hist-badge ${done ? "ok" : "warn"}">${done ? "✅ Completed" : "⚠️ Abandoned"}</span></div>
      </div>
    </div>`;
  }
  screens.cookHistory = () => {
    Sidebar.setActive("history");
    if (isPremium()) { renderPremiumHistory(); return; }
    renderFreeHistory();
  };
  async function renderFreeHistory() {
    h(screenEl("", `
      ${sectionHead("📅 Cook History")}
      <div id="histStreak"></div>
      <div id="histBody"><p class="muted" style="font-size:13px">Loading your cook story…</p></div>
      <div style="height:18px"></div>
    `));
    wireSectionHead();

    let sessions = [];
    if (backendOn() && API.isLoggedIn()) { try { sessions = (await API.sessions()).sessions || []; } catch (e) { sessions = Telemetry.read(); } }
    else sessions = Telemetry.read();
    if (!app.querySelector("#histBody")) return; // navigated away mid-fetch

    const n = state.currentStreak || 0;
    $("#histStreak").innerHTML = n > 0
      ? `<div class="hist-streakline">🔥 <b>${n}-day streak</b>${n >= 7 ? " — on fire!" : ""}</div>`
      : `<div class="hist-streakline none">No active streak — cook today to start one 🔥</div>`;

    const completed = sessions.filter((s) => s.completed)
      .sort((a, b) => new Date(b.finishedAt || b.savedAt || b.at || 0) - new Date(a.finishedAt || a.savedAt || a.at || 0));
    const body = $("#histBody");

    if (!completed.length) {
      body.innerHTML = `<div class="hist-empty">
        <div class="he-emoji">🍳</div>
        <p>Your cook story starts here.<br>Complete your first cook to begin tracking.</p>
        <button class="btn" id="histBrowse">Browse recipes</button>
      </div>`;
      const br = $("#histBrowse"); if (br) br.onclick = () => screens.searchRecipes();
      return;
    }

    const recent = completed.slice(0, 3);
    const hidden = completed.length - recent.length;
    let html = `<p class="section-title">Recent cooks</p>` + recent.map(historyCardHTML).join("");
    if (hidden > 0) {
      html += `<button class="hist-locked" id="histLocked">
        <span class="hl-top">🔒 +${hidden} more cook${hidden === 1 ? "" : "s"} in your history</span>
        <span class="hl-sub">See all your stats, streaks &amp; records → <b>Unlock your full cook story · Premium</b></span>
      </button>`;
    }
    // Blurred preview of the premium streak calendar + records (extra upsell surface).
    html += `<p class="section-title" style="margin-top:20px">Streaks &amp; records</p>
      <button class="prem-preview" id="premPreview">
        <div class="pp-blur">
          <div class="pp-cal">${Array.from({ length: 84 }).map((_, i) => `<i class="${[3, 4, 5, 10, 11, 17, 18, 19, 24, 25, 31, 38, 45, 46, 52, 59, 60, 66, 73, 80, 81].includes(i) ? "on" : ""}"></i>`).join("")}</div>
          <div class="pp-tiles">${["⚡", "🏆", "🔁", "📊"].map((e) => `<span>${e}</span>`).join("")}</div>
        </div>
        <div class="pp-over">🔒 Unlock your full cook story → <b>Premium</b></div>
      </button>`;
    body.innerHTML = html;
    const lk = $("#histLocked"); if (lk) lk.onclick = () => screens.premium();
    const pp = $("#premPreview"); if (pp) pp.onclick = () => screens.premium();
  }

  // ---- Premium Cook History: Streak / Records / History sub-tabs ----
  let histTab = "history", histPage = 1, histQuery = "", histFilter = "all";
  const fmtDur = (sec) => { const h2 = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60); return h2 ? `${h2}h ${m}m` : `${m}m`; };
  const monthYear = (ymd) => { try { return new Date(ymd + "T00:00:00Z").toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }); } catch (e) { return ymd; } };
  const weekLabel = (ymd) => { try { return new Date(ymd + "T00:00:00Z").toLocaleString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }); } catch (e) { return ymd; } };
  const panLabel = (id) => optLabel(PAN_OPTIONS, id);
  const heatLabel = (id) => optLabel(HEAT_OPTIONS, id);

  function renderPremiumHistory() {
    h(screenEl("", `
      ${sectionHead("📅 Cook History")}
      <div class="hist-tabs">
        <button class="ht-tab" data-htab="history">📜 History</button>
        <button class="ht-tab" data-htab="streak">🔥 Streak</button>
        <button class="ht-tab" data-htab="records">🏆 Records</button>
      </div>
      <div id="histPanel"><p class="muted" style="font-size:13px">Loading…</p></div>
      <div style="height:18px"></div>
    `));
    wireSectionHead();
    $$(".ht-tab").forEach((b) => b.onclick = () => { histTab = b.dataset.htab; $$(".ht-tab").forEach((x) => x.classList.toggle("on", x.dataset.htab === histTab)); renderHistTab(); });
    $$(".ht-tab").forEach((x) => x.classList.toggle("on", x.dataset.htab === histTab));
    renderHistTab();
  }
  function renderHistTab() {
    const panel = $("#histPanel"); if (!panel) return;
    if (histTab === "records") return renderRecordsPanel(panel);
    if (histTab === "history") return renderHistoryPanel(panel);
    return renderStreakPanel(panel);
  }

  // ---- real month-by-month calendar (Jun 2026 … Dec 2029) ----
  let streakData = null, calY = 2026, calM = 5; // calM is 0-indexed; June 2026 = (2026, 5)
  const CAL_MIN_Y = 2026, CAL_MIN_M = 5, CAL_MAX_Y = 2029, CAL_MAX_M = 11;
  const calAtMin = () => calY === CAL_MIN_Y && calM === CAL_MIN_M;
  const calAtMax = () => calY === CAL_MAX_Y && calM === CAL_MAX_M;
  function calStep(delta) {
    let m = calM + delta, y = calY;
    if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
    if (y < CAL_MIN_Y || (y === CAL_MIN_Y && m < CAL_MIN_M)) return;
    if (y > CAL_MAX_Y || (y === CAL_MAX_Y && m > CAL_MAX_M)) return;
    calY = y; calM = m; renderCalendar();
  }
  function monthCalHTML(year, month, counts, today) {
    const firstDow = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7; // Mon=0
    const daysIn = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    let cells = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((w) => `<div class="cal-h">${w}</div>`).join("");
    for (let i = 0; i < firstDow; i++) cells += `<div class="cal-d empty"></div>`;
    for (let dd = 1; dd <= daysIn; dd++) {
      const ds = `${year}-${String(month + 1).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
      const n = counts[ds] || 0;
      cells += `<div class="cal-d ${n > 0 ? "on" : ""}${ds === today ? " today" : ""}" title="${ds}${n > 0 ? ` · ${n} cook${n === 1 ? "" : "s"}` : ""}">${dd}</div>`;
    }
    return cells;
  }
  function renderCalendar() {
    const box = $("#calBox"); if (!box) return;
    const counts = (streakData && streakData.counts) || {};
    const today = (streakData && streakData.today) || "";
    const lab = $("#calLabel"); if (lab) lab.textContent = new Date(Date.UTC(calY, calM, 1)).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
    const pv = $("#calPrev"), nx = $("#calNext"); if (pv) pv.disabled = calAtMin(); if (nx) nx.disabled = calAtMax();
    box.innerHTML = monthCalHTML(calY, calM, counts, today);
  }
  async function renderStreakPanel(panel) {
    panel.innerHTML = `<p class="muted" style="font-size:13px">Loading your streak…</p>`;
    try { streakData = await API.streakCalendar(); } catch (e) { panel.innerHTML = `<p class="muted" style="font-size:13px">Couldn't load your streak.</p>`; return; }
    if ($("#histPanel") !== panel) return;
    // Open on today's month, clamped into the [Jun 2026 … Dec 2029] range.
    const t = streakData.today || "2026-06-26";
    calY = +t.slice(0, 4); calM = +t.slice(5, 7) - 1;
    if (calY < CAL_MIN_Y || (calY === CAL_MIN_Y && calM < CAL_MIN_M)) { calY = CAL_MIN_Y; calM = CAL_MIN_M; }
    if (calY > CAL_MAX_Y || (calY === CAL_MAX_Y && calM > CAL_MAX_M)) { calY = CAL_MAX_Y; calM = CAL_MAX_M; }
    const stat = (emoji, val, label) => `<div class="ss-card"><span class="ss-emoji">${emoji}</span><b>${val}</b><small>${label}</small></div>`;
    const stats = `<div class="streak-stats">
      ${stat("🔥", streakData.current, `Current streak${streakData.current === 1 ? " (day)" : " days"}`)}
      ${stat("🏆", streakData.longest, `Longest${streakData.longest === 1 ? " (day)" : " days"}`)}
      ${stat("📅", streakData.total, "Total cooks")}
      ${stat("🗓", streakData.since ? monthYear(streakData.since) : "—", "Cooking since")}
    </div>`;
    panel.innerHTML = stats + `<p class="section-title" style="margin-top:18px">Your cook calendar</p>
      <div class="cal-nav"><button class="cal-arrow" id="calPrev" aria-label="Previous month">‹</button><b id="calLabel"></b><button class="cal-arrow" id="calNext" aria-label="Next month">›</button></div>
      <div class="cal-month" id="calBox"></div>
      <p class="muted" style="font-size:11px;margin-top:10px"><i class="cal-key on"></i> a day you cooked · <i class="cal-key today"></i> today</p>`;
    $("#calPrev").onclick = () => calStep(-1);
    $("#calNext").onclick = () => calStep(1);
    renderCalendar();
  }

  async function renderRecordsPanel(panel) {
    panel.innerHTML = `<p class="muted" style="font-size:13px">Tallying your records…</p>`;
    let r; try { r = await API.records(); } catch (e) { panel.innerHTML = `<p class="muted" style="font-size:13px">Couldn't load your records.</p>`; return; }
    if ($("#histPanel") !== panel) return;
    const short = (s) => s ? (s.length > 15 ? s.slice(0, 14) + "…" : s) : "";
    const tile = (emoji, label, value) => value
      ? `<div class="rec-tile"><div class="rt-emoji">${emoji}</div><div class="rt-label">${esc(label)}</div><div class="rt-val">${esc(value)}</div></div>`
      : `<div class="rec-tile empty"><div class="rt-emoji">${emoji}</div><div class="rt-label">${esc(label)}</div><div class="rt-val">Not yet — cook it to set your record.</div></div>`;
    panel.innerHTML = `<div class="rec-grid">
      ${tile("💪", r.hardest ? `Hardest ${short(r.hardest.recipe)}` : "Hardest Cook", r.hardest ? `${fmtClock(r.hardest.sec)} of work` : null)}
      ${tile("⭐", "Best Cook", r.best ? `${short(r.best.recipe)} · ${r.best.rating}★` : null)}
      ${tile("🔁", "Favourite Dish", r.favourite ? `${short(r.favourite.recipe)} · ${r.favourite.n}×` : null)}
      ${tile("⏱", "Total Cook Time", r.totalSec ? fmtDur(r.totalSec) : null)}
      ${tile("🗓", "Best Week", r.bestWeek ? `${r.bestWeek.n} cook${r.bestWeek.n === 1 ? "" : "s"} · Week of ${weekLabel(r.bestWeek.start)}` : null)}
      ${tile("🍳", "Go-To Pan", r.pan ? panLabel(r.pan.pan) : null)}
      ${tile("📊", "Avg Rating", r.avgRating != null ? `${r.avgRating.toFixed(1)} ★` : null)}
      ${tile("🏆", "Best Streak", r.longestStreak ? `${r.longestStreak} day${r.longestStreak === 1 ? "" : "s"}` : null)}
    </div>`;
  }

  function premiumHistCardHTML(s) {
    const sub = s.song ? `${esc(s.song)}${s.artist ? " · " + esc(s.artist) : ""}` : (esc([s.category, s.difficulty].filter(Boolean).join(" · ")) || "Guided cook");
    const done = !!s.completed;
    const meta = [];
    if (s.durationSec) meta.push(`⏱ Finished in ${fmtClock(s.durationSec)}`);
    if (s.pace) meta.push(s.pace);
    const gear = [s.pan ? panLabel(s.pan) : null, s.heatSource ? heatLabel(s.heatSource) : null].filter(Boolean).join(" · ");
    if (gear) meta.push(`🍳 ${gear}`);
    return `<div class="hist-card pro">
      <div class="hist-emoji">${sessionEmoji(s)}</div>
      <div class="hist-body">
        <b>${esc(s.recipe || "Cook")}</b>
        <small>${sub}</small>
        <div class="hist-meta">${starsHTML(s.rating)}<span class="hist-when">${timeAgo(s.createdAt)}</span><span class="hist-badge ${done ? "ok" : "warn"}">${done ? "✅ Completed" : "⚠️ Abandoned"}</span></div>
        ${meta.length ? `<div class="hist-pro-meta">${meta.map((mm) => `<span>${esc(mm)}</span>`).join("")}</div>` : ""}
        ${s.comment ? `<div class="hist-comment">“${esc(s.comment)}”</div>` : ""}
        <button class="hist-again" data-recipe="${esc(s.recipe || "")}">↻ Cook it again</button>
      </div>
    </div>`;
  }
  function cookAgain(title) {
    const exp = EXPERIENCES.find((e) => e.recipe.title === title);
    if (exp) { EXP = exp; cookMethod = null; resetPrepPrefs(); screens.prep(); return; }
    if (backendOn()) API.recipes({ q: title, limit: 1 }).then((d) => { const r = (d.recipes || [])[0]; if (r) openRecipe(r); else toast("Couldn't find that recipe"); }).catch(() => toast("Couldn't reopen that recipe"));
    else toast("Reconnect to cook this again");
  }
  function renderHistoryPanel(panel) {
    const chip = (f, label) => `<button class="fchip ${histFilter === f ? "on" : ""}" data-hf="${f}">${label}</button>`;
    panel.innerHTML = `
      <div class="searchrow"><input class="field" id="histSearch" placeholder="Search by recipe…" autocomplete="off" value="${esc(histQuery)}"><button class="icon-btn" id="histSearchBtn">🔍</button></div>
      <div class="filter-row hist-chips">${chip("all", "All")}${chip("completed", "Completed")}${chip("abandoned", "Abandoned")}${chip("week", "This Week")}${chip("month", "This Month")}</div>
      <div id="histList"><p class="muted" style="font-size:13px">Loading…</p></div>`;
    const run = () => { histQuery = ($("#histSearch")?.value || "").trim(); histPage = 1; loadHistoryPage(); };
    $("#histSearchBtn").onclick = run;
    $("#histSearch").onkeydown = (e) => { if (e.key === "Enter") run(); };
    $$(".hist-chips .fchip").forEach((b) => b.onclick = () => { histFilter = b.dataset.hf; histPage = 1; $$(".hist-chips .fchip").forEach((x) => x.classList.toggle("on", x.dataset.hf === histFilter)); loadHistoryPage(); });
    loadHistoryPage();
  }
  async function loadHistoryPage() {
    const list = $("#histList"); if (!list) return;
    list.innerHTML = `<p class="muted" style="font-size:13px">Loading…</p>`;
    let d; try { d = await API.history({ page: histPage, q: histQuery, filter: histFilter }); } catch (e) { list.innerHTML = `<p class="muted" style="font-size:13px">Couldn't load history.</p>`; return; }
    if (!$("#histList")) return;
    if (!d.sessions.length) { list.innerHTML = `<p class="muted" style="font-size:13px">No cooks match.</p>`; return; }
    const pager = d.totalPages > 1 ? `<div class="hist-pager">
      <button class="btn secondary" id="histPrev" ${d.page <= 1 ? "disabled" : ""}>← Prev</button>
      <span class="muted">Page ${d.page} / ${d.totalPages} · ${d.total} cooks</span>
      <button class="btn secondary" id="histNext" ${d.page >= d.totalPages ? "disabled" : ""}>Next →</button>
    </div>` : `<p class="muted" style="font-size:11px;margin-top:8px">${d.total} cook${d.total === 1 ? "" : "s"}</p>`;
    list.innerHTML = d.sessions.map(premiumHistCardHTML).join("") + pager;
    list.querySelectorAll(".hist-again").forEach((b) => b.onclick = () => cookAgain(b.dataset.recipe));
    const pv = $("#histPrev"); if (pv) pv.onclick = () => { histPage = Math.max(1, histPage - 1); loadHistoryPage(); };
    const nx = $("#histNext"); if (nx) nx.onclick = () => { histPage = histPage + 1; loadHistoryPage(); };
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
          <b style="font-family:'Instrument Sans'">${state.email || "guest@sizle.app"}</b>
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
  // ---- Saved recipes — retrievable "save for later" list ----
  function savedCardHTML(s) {
    const badge = s.isMusicSync ? syncBadge() : libraryBadge();
    const sub = s.song ? `🎸 ${esc(s.song)}${s.artist ? " · " + esc(s.artist) : ""}` : (s.isMusicSync ? "Music-sync cook" : "Recipe library");
    const thumb = s.thumb
      ? `<div class="rthumb" style="background-image:url('${esc(s.thumb)}')"></div>`
      : `<div class="rthumb" style="display:grid;place-items:center;font-size:34px;background:linear-gradient(160deg,#2a1410,#1a0f1a)">${s.emoji || "🎵"}</div>`;
    return `<div class="rcard saved-card" data-id="${esc(s.id)}">
      ${thumb}
      <div class="rinfo">
        <b>${s.emoji ? s.emoji + " " : ""}${esc(s.title)}</b>
        <small>${sub}</small>
        <div class="rrow">${badge}${s.isMusicSync ? `<span class="card-preview" data-prev="${esc(s.id)}">👀 Preview</span>` : ""}</div>
      </div>
      <button class="saved-remove" data-id="${esc(s.id)}" aria-label="Remove from saved" title="Remove">✕</button>
    </div>`;
  }
  // Launch a saved recipe: music-sync → the music cook; library → fetch + detail.
  function launchSaved(id) {
    const exp = EXPERIENCES.find((x) => x.id === id);
    if (exp) { EXP = exp; cookMethod = null; resetPrepPrefs(); screens.prep(); return; }
    openRecipe({ id }); // library recipe — openRecipe fetches the full recipe then shows the detail
  }
  screens.saved = () => {
    WakeLock.release();
    Sidebar.setActive("saved");
    const list = savedList().slice().reverse(); // newest first
    const body = list.length
      ? `<div class="catalog">${list.map(savedCardHTML).join("")}</div>`
      : `<div class="empty-state">
           <div class="empty-emoji">🔖</div>
           <h2 style="margin:6px 0">Nothing saved yet</h2>
           <p class="lead">Tap the bookmark on any recipe to save it for later — your list lives right here, ready when you are.</p>
           <button class="btn" id="emptyBrowse" style="margin-top:18px">Browse recipes</button>
         </div>`;
    h(screenEl("", `
      ${sectionHead("🔖 Saved")}
      ${list.length ? `<p class="muted" style="font-size:12px;margin:-2px 2px 12px">${list.length} recipe${list.length === 1 ? "" : "s"} saved for later</p>` : ""}
      ${body}
    `));
    wireSectionHead();
    const eb = $("#emptyBrowse"); if (eb) eb.onclick = () => screens.home();
    $$(".saved-card").forEach((c) => c.onclick = (e) => {
      if (e.target.closest(".saved-remove") || e.target.closest(".card-preview")) return;
      launchSaved(c.dataset.id);
    });
    $$(".saved-card .card-preview").forEach((el) => el.onclick = (e) => {
      e.stopPropagation();
      const exp = EXPERIENCES.find((x) => x.id === el.dataset.prev);
      if (exp) startPreview(exp);
    });
    $$(".saved-remove").forEach((b) => b.onclick = (e) => {
      e.stopPropagation();
      removeSaved(b.dataset.id); vibrate("tap"); toast("Removed from saved");
      screens.saved();
    });
  };

  screens.searchRecipes = () => {
    Sidebar.setActive("search");
    h(screenEl("", `
      ${sectionHead("🔍 Search recipes")}
      <p class="lead" style="margin-top:8px">Browse &amp; filter the full catalog — free to explore${isPremium() ? "" : ". Start a cook with Premium."}</p>
      <div class="searchrow" style="margin-top:14px">
        <input class="field" id="rsearch" placeholder="e.g. curry, pasta, cake" autocomplete="off" autofocus />
        <button class="icon-btn" id="rsearchBtn" title="Search">🔍</button>
      </div>
      <div id="filterbarWrap"></div>
      <div id="searchResults" class="catalog"></div>
      <p class="attribution" id="attr"></p>
      <div style="height:18px"></div>
    `));
    wireSectionHead();
    loadCatalog().then((d) => { const a = $("#attr"); if (a) a.textContent = d.attribution || ""; });
    mountSearchSurface();
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

      <p class="section-title">Measurements</p>
      <div class="stack">
        <label class="choice toggle" id="tgUnits"><span class="emoji">📏</span><span style="flex:1">Units<small>Ingredient amounts &amp; temperatures</small></span><span class="sw">${metricOn() ? "METRIC" : "US"}</span></label>
      </div>

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
    $("#tgUnits").onclick = () => {
      setUnitSystem(metricOn() ? "us" : "metric");
      $("#tgUnits .sw").textContent = metricOn() ? "METRIC" : "US";
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
      a.download = `sizle-sessions-${new Date().toISOString().slice(0, 10)}.json`;
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
        // Log one app-open per browser session (monthly active users — even anonymous).
        if (API.online && !sessionStorage.getItem("seartune_visited")) {
          sessionStorage.setItem("seartune_visited", "1");
          let vid = localStorage.getItem("seartune_visitor");
          if (!vid) { vid = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()); localStorage.setItem("seartune_visitor", vid); }
          API.visit(vid).catch(() => {});
        }
      } catch (e) {}
    }
    if (returned && isPremium()) { state.musicPlatform = "spotify"; state.spotifyConnected = true; saveEnt(); Spotify_.loadSdk(); }
    Sidebar.mount();
    if (returned) screens.premium();
    else if (hydrated) screens.home();           // logged-in returning account
    else screens.welcome();
  })();
})();
