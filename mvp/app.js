/* ============================================================
   Sizle MVP — front-end demo of the core loop.
   Backend (Cognito/Spotify/RDS) is mocked; the cook engine is real.
   ============================================================ */
(function () {
  "use strict";

  // Opt-in test seam (regression-lock asserts): `?__test=1` enables window.CHOPPD_TEST before boot so
  // the __testCook launcher + in-cook probe below can drive jumps/pause/resume headlessly. No effect
  // on a normal run (the flag is absent) — the seams are all `if (window.CHOPPD_TEST)`.
  if (/[?&]__test=1/.test(location.search)) window.CHOPPD_TEST = true;

  const app = document.getElementById("app");
  const EXPERIENCES = window.EXPERIENCES || [window.FREEBIRD_STEAK];
  let EXP = EXPERIENCES[0];                 // the currently selected music cook
  let portionCount = null;                  // e.g. # of eggs, chosen on the prep screen
  let cookMethod = null;                    // chosen cooking-method id for cooks with EXP.methods (e.g. pan vs grill)
  let prepIdx = 0;                          // current screen in the prep wizard (0=overview, 1=pan, 2..=steps, last=music)
  let restReminder = null, restTick = null; // optional steak room-temp timer: { handle, endsAt } + the countdown interval
  let cookCardData = null;                  // { rating, photoFile } captured at finish for the shareable cook card
  let cookPreview = false;                  // one-shot flag: the next screens.cook() runs as a watch-along PREVIEW (read+reset on entry)
  let finishIsFirstCook = false;            // set at screens.finish: drives the warm "first one down" beat + low-rating headline

  // Launch the music-sync experience as a no-commitment PREVIEW (no prep, no
  // gates, no logging). The cook engine reads `cookPreview` once on entry.
  function startPreview(exp) { EXP = exp; cookMethod = null; resetPrepPrefs(); cookPreview = true; screens.cook(); }
  // TEST SEAM (CHOPPD_TEST only — never in a real run): launch a cook headlessly for the regression-lock
  // asserts. `am` seeds an Apple Music selection (with MOCK_AM the transport is simulated).
  if (window.CHOPPD_TEST) window.__testCook = (id, am) => {
    EXP = EXPERIENCES.find((e) => e.id === id) || EXPERIENCES[0];
    cookMethod = null; resetPrepPrefs(); cookPreview = false; cookTutorial = false;
    state.amQueue = am ? [{ id: "am.song.testA", label: "Hotel California" }, { id: "am.song.testB", label: "Take It Easy" }] : [];
    screens.cook();
  };
  // §d.1 MOCK COORDINATOR — a faithful recording ChoppdAudio/ChoppdSpeech installed where the real plugin
  // is null (web). Makes isNativeVoice()/useNativeDuck() true and RECORDS the ordered coordinator sequence
  // (setMode/activate/deactivate) so the native-only re-duck becomes VISIBLE headless. ChoppdSpeech.stop()
  // resolves async so _nativeTeardown's serialize defers finishCoord — reproducing the deferred setMode
  // landing AFTER releaseDuck exactly as on device.
  if (window.CHOPPD_TEST) window.__mockNative = () => {
    const log = []; let seq = 0;
    const rec = (call, mode) => { log.push(mode ? { n: ++seq, call, mode } : { n: ++seq, call }); };
    const aL = {}, sL = {};   // ChoppdAudio / ChoppdSpeech listeners
    const ChoppdAudio = {
      setMode: (o) => { rec("setMode", (o && o.mode) || "?"); return Promise.resolve({ ok: true, mode: o && o.mode }); },
      activate: () => { rec("activate"); return Promise.resolve({ ok: true }); },
      deactivate: () => { rec("deactivate"); return Promise.resolve({ ok: true }); },
      playClip: (o) => { setTimeout(() => (aL["clipEnd"] || []).forEach((cb) => cb({ token: o && o.token })), 10); return Promise.resolve({ ok: true, duration: 0.2 }); },
      stopClip: () => Promise.resolve({ ok: true }),
      addListener: (ev, cb) => { (aL[ev] = aL[ev] || []).push(cb); return Promise.resolve({ remove() { } }); },
      removeAllListeners: () => Promise.resolve(),
    };
    const ChoppdSpeech = {
      available: () => Promise.resolve({ available: true }),
      requestPermissions: () => Promise.resolve({ speechRecognition: "granted", microphone: "granted" }),
      checkPermissions: () => Promise.resolve({ speechRecognition: "granted", microphone: "granted" }),
      status: () => Promise.resolve({ engine: "on-device", available: true }),
      start: () => { setTimeout(() => (sL["listeningState"] || []).forEach((cb) => cb({ status: "started" })), 5); return Promise.resolve({ ok: true }); },
      stop: () => new Promise((res) => setTimeout(() => { (sL["listeningState"] || []).forEach((cb) => cb({ status: "stopped" })); res({ ok: true }); }, 8)),   // ASYNC → serialize defers finishCoord (faithful re-duck timing)
      addListener: (ev, cb) => { (sL[ev] = sL[ev] || []).push(cb); return Promise.resolve({ remove() { } }); },
      removeAllListeners: () => { for (const k in sL) delete sL[k]; return Promise.resolve(); },
      injectTranscript: (o) => { (sL["partialResults"] || []).forEach((cb) => cb({ matches: [o && o.transcript] })); return Promise.resolve({ ok: true }); },
    };
    window.Capacitor = { isNativePlatform: () => true, Plugins: { ChoppdAudio, ChoppdSpeech } };
    window.__coordLog = log;
    state.prefs.voice = true; state.prefs.voiceControl = true; state.prefs.voiceRehearsedOk = true; state.prefs.voiceCtrlAsked = true;
    return log;
  };
  let cookTutorial = false;                 // one-shot flag: the next screens.cook() runs as the interactive TUTORIAL
  let tutorialActive = false;               // suppresses non-tutorial telemetry while the sandbox runs
  // Sandboxed real-engine tutorial: SCRAMBLED_EGGS, forced nonstick+electric (no
  // prompts — the ONLY bypass of the pan/stove gate), silent clock, ends at cue 3.
  function startTutorial(replay) {
    EXP = EXPERIENCES.find((e) => e.id === "scrambled-eggs") || EXPERIENCES[0];
    cookMethod = null; resetPrepPrefs();
    eggFat = "butter"; eggStove = "electric";   // forced internally; user's saved defaults untouched (state.cookPan/equipment.heat not written)
    cookTutorial = true; tutorialActive = true;
    trackEvent(replay ? "tutorial_replayed" : "tutorial_started");
    screens.cook();
  }

  // "Save for later" list — client-side intent capture, persisted under the legacy
  // localStorage key `seartune_saved` (kept as-is so existing saves aren't orphaned).
  function savedList() { try { return JSON.parse(localStorage.getItem("seartune_saved") || "[]"); } catch (e) { return []; } }
  function saveWrite(list) { try { localStorage.setItem("seartune_saved", JSON.stringify(list)); } catch (e) { } }
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
  let eggStove = "gas";                     // gas | electric — scrambled-eggs preheat timing
  let eggFat = "butter";                    // butter | vegetable | olive | canola | spray — fat for the pan
  // COOKING-FOR-ONE: the picker OPENS on the recipe's for-one default (portion.default),
  // not its base. EXP is always set before this runs (every caller sets EXP first).
  function resetPrepPrefs() { prepIdx = 0; portionCount = (EXP && EXP.portion && EXP.portion.default) || null; garlicStrength = "moderate"; cookLiquid = "chicken"; addIns = { chicken: false, peas: false }; eggStove = (state && state.equipment && state.equipment.heat) || "gas"; eggFat = "butter"; phase1MusicPlaying = false; }
  // True once an own-playlist soundtrack has been started in Phase 1 and is playing
  // continuously underneath — so Phase 2 doesn't restart it or run a countdown.
  let phase1MusicPlaying = false;
  let recipeStats = null;                   // real per-recipe {cooks, rating} from the backend (null = not loaded yet)

  // ---- COOKING-FOR-ONE yield copy (swappable — brand pass may reword) ----------
  // COPY GUARDRAIL (governs all portion/yield copy): the tease lands on the
  // Tupperware, the leftovers, the situation — NEVER on eating alone. Warmth lands
  // on feeding yourself well. Renders ABOVE each recipe's factual servingNote.
  const PORTION_COPY = {
    _default: "Makes one real dinner. Not four sad Tupperwares.",
    "one-pot-garlic-parmesan-pasta": "One real dinner, one pot, zero science experiments.",
    "chicken-fried-rice": "One real dinner — no day-four rice in your future.",
    "ground-beef-tacos": "Taco night for one is still taco night.",
    "pancakes": "One real stack. Day-old pancakes were never the plan.",
    "upgraded-ramen": "Built for exactly you. No Tupperware was ever in danger.",
    "freebird-medium-rare-steak": "One steak, one pan, one very good evening.",
    "smash-burgers": "Two burgers, one person, one real dinner. That's just math.",
    "crispy-chicken-thighs": "One real dinner — the crispy skin doesn't survive to leftovers anyway.",
    "teriyaki-chicken-bowl": "One bowl, no sad desk-lunch sequel.",
    "philly-cheesesteak": "One sandwich. It was never becoming leftovers.",
    "scrambled-eggs": "Just you, just breakfast, done in six minutes.",
  };
  const portionVoiceLine = (exp) => (exp && PORTION_COPY[exp.id]) || PORTION_COPY._default;

  // ---- MONEY RECEIPT (savings scoreboard) --------------------------------------
  // Every string here is DRAFT-PENDING-VOICE-REVIEW — the founder's voice pass owns
  // the words; this build owns the mechanism. Two lines ship VERBATIM per founder:
  // the ramen no-receipt line (authored in cues.js) and `tabNudge`.
  const RECEIPT_COPY = {
    headline: (saveStr) => `That's ${saveStr} that stayed in your account.`,
    // enemyNoun is per-recipe (default "takeout"); sit-down recipes override it — steak
    // "the steakhouse", pancakes "the diner" — so the counterfactual is honest (a real
    // steak/short-stack isn't a delivery order). Never says "takeout" for those.
    estimate: (enemyStr, costStr, enemyNoun) => `${enemyStr} ${enemyNoun || "takeout"} vs ~${costStr} in ingredients`,
    tabNudge: "Sign in to start your tab.",   // ships VERBATIM
    tabLabel: (totalStr) => `Saved since joining: ${totalStr}`,
    cardKicker: "out of the delivery app.",
    cardSub: "estimated savings vs. takeout",
  };
  // Format cents → "$13" / "$1.50" (whole dollars drop the .00).
  const money = (cents) => "$" + (Math.round(cents) % 100 === 0 ? String(Math.round(cents) / 100) : (Math.round(cents) / 100).toFixed(2));
  // Anonymous-cook holding pen: an anonymous completed cook stashes its receipt here
  // so signup-within-the-session doesn't lose it (posted on the next successful auth).
  let pendingReceipt = null;
  const Receipt = {
    enabled: () => RECEIPTS_ENABLED,
    // Compute a receipt from a recipe (EXP-shaped) + the chosen picker count. Returns
    // null when the recipe carries no `receipt` data (e.g. quesadilla) → no receipt.
    compute(exp, pickerCount) {
      const r = exp && exp.receipt;
      if (!r) return null;
      const base = (exp.portion && exp.portion.default) || 1;
      const portions = Math.max(1, Math.round((pickerCount || base) / base));   // for-one = one person
      if (r.noReceipt) return { noReceipt: true, line: r.line, portions, recipeId: exp.id };
      const enemyCents = Math.round(r.enemy * 100), costCents = Math.round(r.cost * 100);
      const saveCents = Math.max(0, (enemyCents - costCents) * portions);        // never negative
      return { recipeId: exp.id, portions, enemyCents, costCents, saveCents, enemyNoun: r.enemyNoun || null };
    },
    // Record a completed-cook receipt server-side (logged-in) or hold it for signup
    // (anonymous). Only real-money receipts count — a no_receipt cook adds nothing.
    record(rc) {
      if (!RECEIPTS_ENABLED || !rc || rc.noReceipt) return;
      const body = { recipeId: rc.recipeId, portions: rc.portions, enemyCents: rc.enemyCents, costCents: rc.costCents };
      if (backendOn() && API.isLoggedIn()) API.postReceipt(body).catch(() => { });
      else pendingReceipt = body;   // anonymous → hold; posted on signup within the session
    },
    // Post a held (anonymous) receipt once the user signs in — one-shot.
    flushPending() {
      if (!RECEIPTS_ENABLED || !pendingReceipt || !(backendOn() && API.isLoggedIn())) return;
      const body = pendingReceipt; pendingReceipt = null;
      API.postReceipt(body).catch(() => { });
    },
  };
  // The receipt block for the finish payoff — a WARM slot inside the hero, not a
  // popup, never blocking rate/finish. no_receipt → the honest alternative line, no
  // math. UNGATED: renders for the anonymous first cook too (client-computed), with
  // the sign-in nudge. Returns "" when the flag is off or the recipe has no data.
  function receiptBlockHTML(exp, pickerCount) {
    if (!RECEIPTS_ENABLED) return "";
    const rc = Receipt.compute(exp, pickerCount);
    if (!rc) return "";
    const anon = !(backendOn() && API.isLoggedIn());
    const nudge = anon ? `<p class="receipt-nudge">${esc(RECEIPT_COPY.tabNudge)}</p>` : "";
    if (rc.noReceipt) return `<div class="receipt"><p class="receipt-line">${esc(rc.line)}</p>${nudge}</div>`;
    return `<div class="receipt">
      <p class="receipt-head">${esc(RECEIPT_COPY.headline(money(rc.saveCents)))}</p>
      <p class="receipt-est">${esc(RECEIPT_COPY.estimate(money(rc.enemyCents), money(rc.costCents), rc.enemyNoun))}</p>
      ${nudge}
    </div>`;
  }
  // DEV: headless receipt verification (mirrors __Resume/__Alarm; harmless).
  window.__receipt = {
    block: (id, n) => receiptBlockHTML((window.EXPERIENCES || []).find((e) => e.id === id), n),
    compute: (id, n) => Receipt.compute((window.EXPERIENCES || []).find((e) => e.id === id), n),
    record: (id, n) => Receipt.record(Receipt.compute((window.EXPERIENCES || []).find((e) => e.id === id), n)),
    flush: () => Receipt.flushPending(),
    buildSavings: (totalCents, cooks) => buildSavingsCard({ totalCents, cooks, free: true }),
    pending: () => pendingReceipt,
  };
  // Fill the profile "Saved vs. takeout" row from the running tab (enabled + logged-in only).
  function mountSavingsTab() {
    const row = document.querySelector("#savingsRow"); if (!row) return;
    if (!RECEIPTS_ENABLED || !(backendOn() && API.isLoggedIn())) return;
    API.receiptTab().then((t) => {
      if (!t || !t.enabled || !t.totalCents) return;
      const val = document.querySelector("#savingsVal"); if (val) val.textContent = money(t.totalCents);
      row.hidden = false;
    }).catch(() => { });
  }
  // Prominent running-tab banner at the top of Cook History (enabled + logged-in only).
  function mountHistorySavings() {
    const slot = document.querySelector("#histSavings"); if (!slot) return;
    if (!RECEIPTS_ENABLED || !(backendOn() && API.isLoggedIn())) return;
    API.receiptTab().then((t) => {
      if (!t || !t.enabled || !t.totalCents) return;
      const s = document.querySelector("#histSavings"); if (!s) return;
      s.innerHTML = `<div class="hist-savings">
        <div class="hs-amt">${money(t.totalCents)}</div>
        <div class="hs-cap">saved vs. takeout · ${t.cooks} cook${t.cooks === 1 ? "" : "s"}</div>
        <div class="hs-sub">estimated savings vs. delivery</div>
      </div>`;
    }).catch(() => { });
  }

  // ---- GROCERY REVERSE-SCAN — starter basket -----------------------------------
  // CANONICAL WEEK + STARTER BASKET are DRAFTS, PENDING FOUNDER ROW-BY-ROW AUDIT.
  // The build never invents a price or a week; these ship as drafts behind the flag.
  // Staples (butter/oil/salt/pepper) excluded per the scan's staples rule. Prices
  // ROUND UP for display (the mirror of receipts' round-down — errors break toward him).
  const BASKET_DATA = {
    weekId: "starter-v1",
    week: [
      { day: 1, recipeId: "scrambled-eggs", note: "the 6-minute win" },
      { day: 2, recipeId: "upgraded-ramen", note: "the packet, transformed" },
      { day: 3, recipeId: "one-pot-garlic-parmesan-pasta", note: "one pot, one real dinner" },
      { day: 4, recipeId: "ground-beef-tacos", note: "assembly night" },
      { day: 5, recipeId: "chicken-fried-rice", note: "the takeout replacement" },
    ],
    items: [
      { id: "egg", label: "Eggs (dozen)", cost: 3, days: [1, 2, 5] },
      { id: "instant_ramen", label: "Instant ramen packet", cost: 1, days: [2] },
      { id: "pasta", label: "Pasta", cost: 2, days: [3] },
      { id: "ground_beef", label: "Ground beef (1 lb)", cost: 6, days: [4], note: "half — the rest is smash burgers next week" },
      { id: "tortilla", label: "Tortillas", cost: 2, days: [4] },
      { id: "taco_seasoning", label: "Taco seasoning packet", cost: 1, days: [4] },
      { id: "chicken_breast", label: "Chicken breast", cost: 4, days: [5] },
      { id: "rice", label: "Rice pouch", cost: 2, days: [5] },
      { id: "soy_sauce", label: "Soy sauce", cost: 3, days: [2, 5] },
    ],
  };
  // DRAFT-PENDING-VOICE-REVIEW (founder's voice pass owns the words). Verbatim: nudge.
  const BASKET_COPY = {
    cta: "Want the basket that unlocks the week? →",
    title: "Your starter basket 🧺",
    lead: "One short list. Five real dinners. Grab it in one trip.",
    about: (d) => `About $${d}`,
    aboutSub: "Prices vary by store — this rounds up, so you're never short.",
    weekTitle: "The week it unlocks",
    daySet: "you're set ✓",
    dedupe: (have) => `You've already got ${have} — this gets you the other nights.`,
    nudge: "Sign in to keep your list.",   // ships VERBATIM
    completeTitle: "That's the whole basket ✓",
    completeSub: "Five dinners in the bag. Go cook Day 1.",
  };
  let pendingBasket = null;   // anonymous held basket → flushed on login (pendingReceipt pattern)
  const Basket = {
    enabled: () => BASKET_ENABLED,
    // "about $X": sum the items still TO BUY, round UP to the next $5 (never short).
    aboutDollars: (items) => { const s = (items || []).filter((i) => !i.owned).reduce((a, i) => a + (i.cost || 0), 0); return Math.max(0, Math.ceil(s / 5) * 5); },
    // Build the basket, marking items the scan CONFIRMED as owned (ghosts excluded upstream).
    generate(ownedIds) {
      const owned = new Set(ownedIds || []);
      const items = BASKET_DATA.items.map((i) => ({ id: i.id, label: i.label, cost: i.cost, days: i.days, note: i.note || null, owned: owned.has(i.id), checked: false }));
      return { weekId: BASKET_DATA.weekId, items, dedupe: BASKET_DATA.items.map((i) => i.id).filter((id) => owned.has(id)), generatedAt: Date.now(), schema_version: 1 };
    },
    // Persist (logged-in) or hold for signup (anonymous). Checked state rides in items.
    save(basket) {
      if (!BASKET_ENABLED || !basket) return;
      const body = { weekId: basket.weekId, items: basket.items, dedupe: basket.dedupe, generatedAt: basket.generatedAt, schema_version: 1 };
      if (backendOn() && API.isLoggedIn()) API.putBasket(body).catch(() => { });
      else pendingBasket = body;
    },
    flushPending() {
      if (!BASKET_ENABLED || !pendingBasket || !(backendOn() && API.isLoggedIn())) return;
      const body = pendingBasket; pendingBasket = null;
      API.putBasket(body).catch(() => { });
    },
    async fetchActive() {
      if (!BASKET_ENABLED || !(backendOn() && API.isLoggedIn())) return null;
      try { const r = await API.getBasket(); return (r && r.enabled && r.basket) || null; } catch (e) { return null; }
    },
  };
  window.__basket = { data: BASKET_DATA, generate: (ids) => Basket.generate(ids), about: (items) => Basket.aboutDollars(items), save: (b) => Basket.save(b), pending: () => pendingBasket, flush: () => Basket.flushPending() };  // DEV verification

  // SKILL GRAPH (graduation system, Phase 1 — dark instrumentation). On a COMPLETED
  // cook the client posts { recipeId, gatesConfirmed }; the SERVER owns which skills
  // that recipe evidences (skills-map.ts) — the client never sends skillIds
  // (anti-tamper, design §5). Deliberately NOT gated by SKILLS_ENABLED: evidence
  // accumulates dark so the calibration data exists the day testers arrive (the
  // scan_miss precedent). Anonymous cooks hold in pendingSkills, flushed on login
  // (the pendingReceipt pattern). Fire-and-forget — a missing endpoint never blocks finish.
  let pendingSkills = null;
  const Skills = {
    // gatesConfirmed: a genuine flagship finish confirms every gate (gates block
    // advancement), so it's true on completion; abandoned cooks never call record.
    record(recipeId, gatesConfirmed) {
      if (!recipeId) return;
      const body = { recipeId, gatesConfirmed: gatesConfirmed !== false };
      if (backendOn() && API.isLoggedIn()) API.skillsComplete(body.recipeId, body.gatesConfirmed).catch(() => { });
      else pendingSkills = body;   // anonymous → hold; posted on signup within the session
    },
    flushPending() {
      if (!pendingSkills || !(backendOn() && API.isLoggedIn())) return;
      const body = pendingSkills; pendingSkills = null;
      API.skillsComplete(body.recipeId, body.gatesConfirmed).catch(() => { });
    },
  };
  // DEV: headless skill-graph verification (mirrors __receipt/__basket; harmless).
  window.__skills = { record: (id, g) => Skills.record(id, g), get: () => (backendOn() && API.isLoggedIn()) ? API.skills() : Promise.resolve(null), pending: () => pendingSkills, flush: () => Skills.flushPending() };

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
  // A method may carry its OWN full cues array (steak grill), OR share the base cues and only
  // overlay per-cue `methodAlt[method]` overrides (smash single/double, tacos packet/homemade).
  const mCues = () => { const m = activeMethod(); if (m && m.cues) return m.cues; return m ? EXP.cues.map((c) => (c.methodAlt && c.methodAlt[m.id]) ? { ...c, ...c.methodAlt[m.id] } : c) : EXP.cues; };
  const mPrep = () => { const m = activeMethod(); return (m && m.prep) || EXP.prep; };
  const mIngredients = () => { const m = activeMethod(); return (m && m.ingredients) || EXP.ingredients; };
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
    amQueue: [],             // AM PILOT: [{id,label}] Apple Music catalog picks (ambient on the cook clock)
    amShuffle: false,        // AM PILOT: shuffle the queue (native shuffleMode at queue time); per-pick, resets on a new pick
    prefs: {
      voice: true, haptics: true, checkpoints: true, theme: "dark", speed: 1, voiceURI: "am_michael", engine: "kokoro", kokoroVoice: "am_michael", cuisines: null, // voice = pre-generated Kokoro Michael (free default). speed: 1× default; only 1× / 2× offered. cuisines = onboarding food prefs (null = no preference)
      // hands-free voice control (SpeechRecognition) — opt-in, default OFF, never auto-enabled.
      voiceControl: false,     // the feature toggle (Settings → Voice control)
      voiceCtrlAsked: false,   // the one-time ask happened (onboarding step OR home card) — any interaction sets it
      voiceCtrlTipShown: false, // the one-time "enable it in Settings" checkpoint tip
      voiceCtrlCkpts: 0,       // checkpoints seen since ship (counts to 3, then the tip; stops counting after)
      voiceRehearsedOk: false, // NATIVE: a mic-check rehearsal succeeded this install — re-enable skips it (until a failure/permission change)
      scanStaples: true,       // fridge scan: "I've got the basics" toggle (persisted)
    },
    streak: 0,
    currentStreak: 0,   // real consecutive-day streak (server-computed)
    longestStreak: 0,
    timezone: null,     // IANA tz for local-day streaks (captured on login)
  };
  function trackEvent(type) { if (tutorialActive && type.indexOf("tutorial_") !== 0) return; try { if (backendOn()) API.event(type).catch(() => { }); } catch (e) { } }
  function deviceTz() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch (e) { return null; } }

  // ---- entitlement (premium + connected music platform), persisted ----
  const PLAT_LABEL = { spotify: "Spotify", apple: "Apple Music" };
  // Inline brand marks (no network / deps) — official-style Spotify + Apple Music logos.
  const SPOTIFY_SVG = `<svg class="brand-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#1DB954"/><path fill="#000" d="M17.6 10.9c-3-1.8-7.9-1.9-10.7-1.1-.46.14-.94-.12-1.08-.58-.14-.46.12-.94.58-1.08 3.27-.99 8.66-.8 12.12 1.26.41.24.55.78.3 1.2-.24.41-.78.55-1.24.31zm-.1 2.6c-.21.34-.65.45-.99.24-2.5-1.54-6.32-1.98-9.27-1.08-.38.11-.78-.1-.9-.48-.11-.38.1-.78.48-.9 3.37-1.02 7.58-.53 10.45 1.23.34.21.45.65.23.99zm-1.12 2.5c-.17.27-.52.36-.79.19-2.19-1.34-4.94-1.64-8.18-.9-.31.07-.62-.12-.69-.43-.07-.31.12-.62.43-.69 3.55-.81 6.6-.46 9.05 1.04.27.16.36.52.18.79z"/></svg>`;
  const APPLE_MUSIC_SVG = `<svg class="brand-ico" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="amgrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FB5C74"/><stop offset="1" stop-color="#FA233B"/></linearGradient></defs><rect width="24" height="24" rx="6" fill="url(#amgrad)"/><path fill="#fff" d="M16.6 6.18c-.13-.11-.31-.15-.51-.11l-6.07 1.23c-.35.07-.6.38-.6.74v6.49c-.32-.2-.71-.31-1.13-.31-1.13 0-2.04.79-2.04 1.76s.91 1.76 2.04 1.76 2.04-.79 2.04-1.76V10.7l5.13-1.04v3.86c-.32-.2-.71-.31-1.13-.31-1.13 0-2.04.79-2.04 1.76s.91 1.76 2.04 1.76 2.04-.79 2.04-1.76V6.76c0-.23-.1-.44-.24-.58z"/></svg>`;
  const isPremium = () => state.tier === "premium";
  // Launch-phase: library open to all. Set false to re-gate to premium.
  // (Also set the matching LIBRARY_OPEN_TO_ALL in server/src/limits.ts false to re-arm enforcement.)
  const LIBRARY_OPEN_TO_ALL = true;
  // LIBRARY VISIBILITY (licensing): while false the imported TheMealDB catalog is
  // hidden from every user surface — browse, search, scan, deep links. The server
  // mirrors this (server/src/limits.ts LIBRARY_VISIBLE) and is the real gate; this
  // constant hides the client-only sections + drives the flagship-only scan copy.
  // Nothing is deleted; flip both to true to restore the full catalog exactly.
  const LIBRARY_VISIBLE = false;
  // YT DOCK PILOT — REMOVED (founder decision, 2026-07-15). The whole YouTube dock (pilot cook player,
  // proxied frame, bridged transport) is ripped out; every recipe runs the local/hosted track +
  // NATIVE_DUCK spine, or Apple Music (amSel). `youtubeId` fields in cue data are now inert (unused).
  // FLAG_DUCK_TEST — dev-only iOS system-ducking test harness (docs/design/ DuckTest spec). FALSE in
  // every shipped bundle: the native DuckTest plugin is #if DEBUG (absent from Release), and this flag
  // guards the JS test screen + its Settings entry out of prod. Set true ONLY in a local dev build to
  // run the matrix; never commit true. See screens.duckTest.
  const FLAG_DUCK_TEST = false;   // dev-only DuckTest screen (+ VR rows); never commit true. VR sitting done — Outcome A (both sources survive the mic window, deeply attenuated but alive). Native Release excludes the plugin via #if DEBUG regardless.
  // NATIVE_VOICE_V2 — the ChoppdSpeech checkpoint-listener + ChoppdAudio session-coordinator
  // (docs/design/native-voice-v2.md). Outcome A measured → building. DARK until the founder's device
  // battery passes: supportState flips from "native-off" only under this flag; ON → nativeSpeech()
  // resolves ChoppdSpeech (not the v1 plugin) and the mic opens through the coordinator's listen mode.
  const NATIVE_VOICE_V2 = true;
  // NATIVE_DUCK — route cue voice clips through the native ChoppdAudio plugin so its .duckOthers
  // session ducks the WebView music (local track) UNDER the voice (iOS system ducking never fires
  // from WebView-played audio). Dark until the founder's ears pass; web + non-native untouched.
  // Instant-off = false → the voice plays on the WebView <audio> exactly as today.
  // ON for the founder's on-device ears battery (native gate-fade on the LOCAL track). Web + non-native
  // untouched (isNativePlatform() gate). If the ears pass fails, revert to false; do NOT cut a TestFlight
  // build off a commit with this true until the ears pass — it'd ship the unproven duck to native.
  const NATIVE_DUCK = true;
  const choppdAudio = () => (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.ChoppdAudio) || null;
  // COORDINATOR WRITE-OWNERSHIP (corrected muffle fix, advisor-directed). The re-duck bug is a STALE write:
  // the teardown's deferred setMode(playbackDucked) lands AFTER the confirm's releaseDuck and re-ducks.
  // Fix = make stale writes LOSE (not change what they write). AUTHORITATIVE session transitions bump
  // coordEpoch (releaseDuck = gate confirm un-duck · _nativeOpen's setMode("listen") = a new window · cook
  // stop/quit). _nativeTeardown captures the epoch when it begins; its deferred setMode no-ops if the epoch
  // has since moved — a newer owner has spoken. Base is e5dd9db verbatim otherwise (target playbackDucked,
  // recover on every close, SP.stop serialize). Nothing else changes.
  let coordEpoch = 0;
  const bumpCoordEpoch = (why) => { coordEpoch++; try { console.log("COORD epoch→" + coordEpoch + " (" + why + ")"); } catch (e) { } };
  const useNativeDuck = () => NATIVE_DUCK && isNativePlatform() && !!choppdAudio();
  // AM PILOT (§2) — Apple Music as a FREE-tier AMBIENT source for subscribers on AM-capable devices; the
  // local/hosted track stays the universal spine (this flag never touches it). Ships DARK until the
  // founder's device pass; web + non-native untouched. RATIFIED: AM is ambient on the cook clock — no
  // song-time slaving, beat-sync stays on the local spine. `window.MOCK_AM` (a dev/sim build global)
  // forces applemusic.js's canned catalog + simulated transport so the picker / source selection /
  // fallback ladder / cook behaviors are all testable BEFORE the MusicKit key lands. NO paywall EVER
  // sits in front of AM (MusicKit no-charge rule) — see applemusic.js + server /api/music/token.
  const AM_PILOT = true;   // LIVE but CAPABILITY-GATED: appleMusicCapable() is false unless native + the ChoppdMusic plugin + not MOCK — so web, non-native, and non-subscribed devices see NOTHING. Only an AM-capable device surfaces the source picker.
  const appleMusicCapable = () => AM_PILOT && !!(window.AppleMusic_ && window.AppleMusic_.capable());
  // MONEY RECEIPT (savings tab). Ships DISABLED — mirrors server/src/limits.ts
  // RECEIPTS_ENABLED. While false the finish screen is UNCHANGED (no receipt, no tab,
  // no ledger post). Flip both to true only after the founder audits every enemy
  // price. The per-cook receipt DISPLAY is client-computed + ungated (anonymous first
  // cook sees it); the running TAB is account-keyed + server-side (like cook-state).
  const RECEIPTS_ENABLED = true;
  // GROCERY REVERSE-SCAN starter basket. Ships DISABLED (built dark) — mirrors
  // server/src/limits.ts BASKET_ENABLED. While false: no basket screen, no scan-results
  // CTA, no persistence — zero change anywhere. Flip both to true on founder sign-off.
  const BASKET_ENABLED = true;
  // SKILL GRAPH / graduation system (docs/design/skill-graduation.md). Mirrors
  // server/src/limits.ts SKILLS_ENABLED. RESERVED for PHASE 2 — gates the unbuilt
  // surfaces (skill panel, no-cues offer, freestyle, graduation). Phase-1 evidence
  // logging is NOT gated by this: a completed cook posts { recipeId, gatesConfirmed }
  // dark so evidence accumulates the day testers arrive (the scan_miss precedent).
  const SKILLS_ENABLED = false;
  // Library (imported/guided) cooking is free while open: bypasses the premium wall + lock badges.
  const libraryFree = () => LIBRARY_OPEN_TO_ALL || isPremium();
  const isConnected = () => isPremium() && !!state.musicPlatform;
  function loadEnt() {
    try {
      const e = JSON.parse(localStorage.getItem("seartune_ent") || "{}");
      if (e.tier) state.tier = e.tier;
      if (e.platform) { state.musicPlatform = e.platform; state.spotifyConnected = e.platform === "spotify"; }
      if (e.spotifyUri) { state.spotifyUri = e.spotifyUri; state.spotifyLabel = e.spotifyLabel || null; }
    } catch (e) { }
    // Real Spotify login survives reloads — but only wire it up if they're already Premium.
    if (isPremium() && window.Spotify_ && Spotify_.isLoggedIn()) { state.musicPlatform = "spotify"; state.spotifyConnected = true; Spotify_.loadSdk(); }
  }
  function saveEnt() {
    try { localStorage.setItem("seartune_ent", JSON.stringify({ tier: state.tier, platform: state.musicPlatform, spotifyUri: state.spotifyUri, spotifyLabel: state.spotifyLabel })); } catch (e) { }
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
    // cookPan (the pan/stove gate default) isn't in the server schema — restore it from the local mirror
    try { const lp = JSON.parse(localStorage.getItem("seartune_profile") || "{}"); if (!state.cookPan && lp.cookPan) state.cookPan = lp.cookPan; } catch (e) { }
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
    Receipt.flushPending();   // MONEY RECEIPT: a cook completed while signed-out posts its held receipt now
    Basket.flushPending();    // BASKET: a basket built while signed-out saves to the account now
    Skills.flushPending();    // SKILL GRAPH: a cook completed while signed-out posts its held skill evidence now

    // Capture the device timezone once so streaks bucket by the user's local day.
    if (!user.timezone) { const tz = deviceTz(); if (tz) { state.timezone = tz; if (backendOn() && API.isLoggedIn()) API.saveProfile({ timezone: tz }).catch(() => { }); } }
    if (user.experience) { // already onboarded
      toast("Welcome back 🍳");
      if (!state.prefs.activationComplete && state.prefs.activationStarted) enterActivation(state.prefs.activationStep || "pick");   // resume force-quit mid-activation
      else screens.home();
    }
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
    try { localStorage.setItem("seartune_profile", JSON.stringify({ email: state.email, experience: state.experience, isBeginner: state.isBeginner, equipment: state.equipment, cookPan: state.cookPan, cuisines: state.prefs.cuisines, onboarded: true, activationComplete: !!state.prefs.activationComplete, activationStep: state.prefs.activationStep || null, activationStarted: !!state.prefs.activationStarted, activationPickId: state.prefs.activationPickId || null, dinnerTime: state.prefs.dinnerTime || null })); } catch (e) { }
    if (backendOn() && API.isLoggedIn()) {
      API.saveProfile({ experience: state.experience, isBeginner: state.isBeginner, equipment: state.equipment, prefs: state.prefs, streak: state.streak, timezone: state.timezone || deviceTz() }).catch(() => { });
    }
  }
  function loadProfile() {
    try {
      const p = JSON.parse(localStorage.getItem("seartune_profile") || "null");
      if (!p) return false;
      if (p.email && !state.email) state.email = p.email;
      if (p.experience) setExperience(p.experience);
      if (p.cuisines !== undefined) state.prefs.cuisines = p.cuisines;
      if (p.activationComplete !== undefined) state.prefs.activationComplete = p.activationComplete;
      if (p.activationStep !== undefined) state.prefs.activationStep = p.activationStep;
      if (p.activationStarted !== undefined) state.prefs.activationStarted = p.activationStarted;
      if (p.activationPickId !== undefined) state.prefs.activationPickId = p.activationPickId;
      if (p.dinnerTime !== undefined) state.prefs.dinnerTime = p.dinnerTime;
      if (p.cookPan) state.cookPan = p.cookPan;   // the pan/stove gate pre-selects last picks
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
  // STREAK RECORDING — the completed cook is banked at the finish hook (recordCompletion,
  // fired where Receipt.record + Skills.record fire), not on rating/exit. completionRecorded
  // is set synchronously so the rating path attaches to that one session instead of writing
  // a second row; completionSessionId is the row it targets once the POST resolves.
  let completionSessionId = null, completionRecorded = false;
  const Telemetry = {
    read() { try { return JSON.parse(localStorage.getItem("seartune_sessions") || "[]"); } catch (e) { return []; } },
    // Returns the backend save promise (resolves to {id, currentStreak, longestStreak})
    // so the finish screen can celebrate the freshly-recomputed streak; null offline.
    save(s) {
      try { const log = this.read(); log.push(s); localStorage.setItem("seartune_sessions", JSON.stringify(log.slice(-200))); } catch (e) { }
      if (backendOn() && API.isLoggedIn()) return API.logSession(s).catch(() => null);
      return Promise.resolve(null);
    },
    clear() { try { localStorage.removeItem("seartune_sessions"); } catch (e) { } },
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
    high: { label: "HIGH HEAT", flames: "🔥🔥🔥", gas: "full flame", electric: "8–9 / 10" },
    "medium-high": { label: "MED-HIGH HEAT", flames: "🔥🔥", gas: "just under full", electric: "6–7 / 10" },
    medium: { label: "MEDIUM HEAT", flames: "🔥🔥", gas: "middle flame", electric: "5 / 10" },
    "medium-low": { label: "MED-LOW HEAT", flames: "🔥", gas: "low-middle flame", electric: "3–4 / 10" },
    low: { label: "LOW HEAT", flames: "🔥", gas: "low flame", electric: "2 / 10" },
    off: { label: "OFF HEAT", flames: "🚫", gas: "burner off", electric: "burner off" },
  };
  function heatGuidance(level) {
    const h = HEAT_LEVELS[level];
    if (!h) return null;
    // Scrambled eggs has its own per-cook stove selector (eggStove); for that recipe
    // it's the source of truth so the dial guidance matches the preheat timer.
    const heatSource = (typeof isEggs === "function" && isEggs()) ? eggStove : state.equipment.heat;
    const electric = heatSource === "electric";
    // "Off the heat" — the pan's residual warmth does the work (silky sauces,
    // melting cheese). Not a dial setting, so give a behavior note instead.
    if (level === "off") {
      return {
        level, label: h.label, flames: h.flames, source: electric ? "electric" : "gas",
        dial: "burner off", note: "Pan off the burner — residual heat keeps it moving without scorching or breaking the sauce."
      };
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
  const optOut = {};               // explicitly turned OFF (default-on items)
  const optIn = {};                // explicitly turned ON (default-off "level it up" items)
  const optSet = (key) => (optOut[key] || (optOut[key] = new Set()));
  const optInSet = (key) => (optIn[key] || (optIn[key] = new Set()));
  // a "level it up" extra that starts OFF until the user opts in (ingredient/group flagged defaultOff)
  function optDefaultOff(id) {
    const ing = ((EXP && mIngredients()) || []).find((i) => i.name === id);
    if (ing && ing.defaultOff) return true;
    const g = (mOptGroups() || []).find((x) => x.id === id);
    return !!(g && g.defaultOff);
  }
  const optActive = (key, id) => {
    if (optOut[key] && optOut[key].has(id)) return false;               // turned off
    if (optDefaultOff(id)) return !!(optIn[key] && optIn[key].has(id)); // off until opted in
    return true;                                                        // default included
  };
  function toggleOpt(key, id) {
    if (optDefaultOff(id)) { const s = optInSet(key); s.has(id) ? s.delete(id) : s.add(id); }
    else { const s = optSet(key); s.has(id) ? s.delete(id) : s.add(id); }
  }

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
      ? `<p class="muted" style="font-size:11px;color:var(--gold);margin:6px 2px 0">⚠️ You don't own a suitable pan for this recipe${req ? ` (need ${req.map((id) => optLabel(PAN_OPTIONS, id)).join(" or ")})` : ""}. Add one in your profile to cook it.</p>` : "";
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
  // Scrambled eggs is stove-aware: electric's 240s preheat (vs gas 90s) pushes the
  // realistic total up, so don't oversell ~8 min to electric users.
  const expMins = (exp) => {
    if (exp.id === "scrambled-eggs" && eggStove === "electric") return 11;
    if (exp.id === "one-pot-garlic-parmesan-pasta" && state.equipment.heat === "electric") return 31;   // Rule 1: the 8-min electric boil fallback
    if (exp.id === "freebird-medium-rare-steak" && isSteakGrill()) return 22;   // 9 preheat + 8 cook + 5 rest
    if (exp.id === "crispy-chicken-thighs" && isChickenGrill()) return 33;      // ~preheat (bg) + 6 sear + 12 indirect + 5 rest, honest for bone-in
    if (exp.id === "crispy-chicken-thighs" && state.equipment.heat === "electric") return 27;   // pan: electric preheat is longer
    if (exp.id === "smash-burgers" && state.equipment.heat === "electric") return 22;   // electric 300s preheat vs gas 180s
    return exp.totalTimeMin || Math.round(exp.durationSec / 60);
  };
  const expBreakdown = (exp) => (exp.id === "scrambled-eggs" && eggStove === "electric")
    ? "~5–6 min prep + preheat, ~5 min cook"
    : (exp.timeBreakdown || "");

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
  // External (TheMealDB) URLs: only http(s) — blocks javascript:/data: schemes in hrefs.
  const safeUrl = (u) => (/^https?:\/\//i.test(String(u || "")) ? String(u) : "");
  // For style="background-image:url('…')": esc() + neutralize ' so the URL can't break out.
  const cssUrl = (u) => esc(safeUrl(u)).replace(/'/g, "%27");
  const capFirst = (s) => { s = String(s == null ? "" : s); return s ? s[0].toUpperCase() + s.slice(1) : s; };

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

  // ---- delete account: two-step confirm (type DELETE) → server hard-delete → local wipe ----
  function deleteAccountFlow() {
    const wrap = document.createElement("div");
    wrap.className = "confirm-scrim";
    wrap.innerHTML = `<div class="confirm-box danger-box">
      <p><b>Delete your account?</b></p>
      <p style="margin-top:8px">This <b>permanently deletes</b> your account and <b>all your data</b> — cooks, streaks, ratings, saved recipes. It <b>cannot be undone</b>, and you'll start over from scratch. <span class="muted">(Anonymous usage limits may persist to prevent abuse.)</span></p>
      <p class="muted" style="font-size:12px;margin-top:10px">Type <b>DELETE</b> to confirm:</p>
      <input class="field" id="delConfirm" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="DELETE" style="margin-top:6px">
      <div class="btn-row" style="margin-top:14px">
        <button class="btn" data-no>Cancel</button>
        <button class="btn danger" data-del disabled>Delete forever</button>
      </div>
    </div>`;
    (document.querySelector(".phone") || app).appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add("show"));
    const close = () => { wrap.classList.remove("show"); setTimeout(() => wrap.remove(), 200); };
    const input = wrap.querySelector("#delConfirm"), delBtn = wrap.querySelector("[data-del]");
    input.oninput = () => { delBtn.disabled = input.value.trim() !== "DELETE"; };   // confirm stays dead until typed exactly
    wrap.querySelector("[data-no]").onclick = close;                               // cancel = the easy path
    wrap.onclick = (e) => { if (e.target === wrap) close(); };
    delBtn.onclick = async () => {
      if (input.value.trim() !== "DELETE") return;
      delBtn.disabled = true; delBtn.textContent = "Deleting…";
      // Server hard-delete first (identity from the JWT). Offline/demo mode has no
      // server account — the local wipe below is the whole deletion in that case.
      if (backendOn() && API.isLoggedIn()) {
        try { await API.deleteAccount(); }
        catch (e) { delBtn.disabled = false; delBtn.textContent = "Delete forever"; toast("Couldn't delete — check your connection and try again"); return; }
      }
      // Local wipe: every user-keyed key. KEEP device-level, non-identity keys:
      // seartune_api_base (dev), seartune_sp_client (dev), seartune_visitor
      // (anonymous per-device MAU id — no user identity in it).
      ["seartune_token", "seartune_profile", "seartune_ent", "seartune_sessions", "seartune_saved",
        "seartune_sp_token", "seartune_sp_verifier", "seartune_units", "seartune_visited"]
        .forEach((k) => { try { localStorage.removeItem(k); } catch (e) { } });
      try { if (window.Spotify_) Spotify_.logout(); } catch (e) { }
      close();
      // Full re-onboarding: reload boots the app clean (fresh state, welcome screen).
      // The confirmation toast is shown AFTER the reload via a one-shot flag.
      try { sessionStorage.setItem("seartune_deleted_notice", "1"); } catch (e) { }
      location.reload();
    };
  }

  // ---- music engine ----
  // Playback + ALL music gain now live in music-backend.js (the MusicBackend
  // interface). This is the app's only handle; no direct <audio>/player access
  // outside that module.
  const Music = window.getMusicBackend();

  // ---- voice-over ducking (GLOBAL) -------------------------------------------
  // Clip-driven timing: the voice element's onplay/onended fire down()/up().
  // MUSIC gain now lives entirely in the MusicBackend (duckForTTS/restoreFromTTS
  // — the ONE place that touches music volume; tunables in MUSIC_TUNABLES).
  // This slim engine keeps the same frac ramp for the Phase-1 Ambient element,
  // which the backend doesn't own. Spotify runs inside its SDK — nothing ducks.
  const VoiceDuck = {
    frac: 1, timer: null, upTimer: null,
    _apply(force) { if (Ambient.el && !Ambient.fadeRaf && (force || !Ambient.el.paused)) Ambient._vol(); },
    // setInterval, NOT requestAnimationFrame: rAF freezes in background tabs / locked
    // phones, which would stall a ramp mid-duck. Timers keep ticking (coarser when
    // backgrounded, but the ramp always COMPLETES — volume can never stick ducked).
    _ramp(target, ms) {
      if (this.timer) clearInterval(this.timer);
      const from = this.frac, start = performance.now();
      this.timer = setInterval(() => {
        const k = Math.max(0, Math.min(1, (performance.now() - start) / ms));
        this.frac = from + (target - from) * k;
        this._apply(k >= 1 && target === 1);   // final restore hits a paused Ambient too
        if (k >= 1) { clearInterval(this.timer); this.timer = null; }
      }, 33);
    },
    down() {
      Music.duckForTTS();
      if (this.upTimer) { clearTimeout(this.upTimer); this.upTimer = null; }
      this._ramp(MUSIC_TUNABLES.TTS_DUCK_LEVEL, MUSIC_TUNABLES.TTS_DOWN_MS);
    },
    up() {   // backend applies its own grace; mirror it for Ambient
      Music.restoreFromTTS();
      if (this.upTimer) clearTimeout(this.upTimer);
      this.upTimer = setTimeout(() => { this.upTimer = null; this._ramp(1, MUSIC_TUNABLES.TTS_UP_MS); }, MUSIC_TUNABLES.TTS_GRACE_MS);
    },
    cancel() { if (this.upTimer) { clearTimeout(this.upTimer); this.upTimer = null; } if (this.timer) { clearInterval(this.timer); this.timer = null; } this.frac = 1; },
  };

  // ---- short SFX (WebAudio synth — layers OVER the music, no asset files) ----
  const Sfx = {
    ctx: null,
    ensure() { try { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); if (this.ctx.state === "suspended") this.ctx.resume(); } catch (e) { } return this.ctx; },
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
    alert() { if (!this.ensure()) return; this.tone(988, 0, 200, 0.3, "triangle"); this.tone(988, 240, 200, 0.3, "triangle"); this.tone(1319, 480, 420, 0.32, "triangle"); }, // louder, cutting 3-note stir alert
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
      try { if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification(title, { body, icon: "logo.png", tag: "sizle-reminder" }); } catch (e) { }
      // always-on in-app cue — covers denied / unsupported / foreground / on-return
      try { Sfx.chime(); } catch (e) { }
      vibrate("double");
      toast("🔥 " + body);
    },
  };
  window.Reminders = Reminders; // exposed so a native shell can override the seam

  // ---- ambient layer: Phase 1 calm music. A SEPARATE <audio> so it can fade out
  // as the main Phase 2 song kicks in (the "natural lift"). ----
  // Royalty-free chill tracks for Phase 1 (the silent-prep / preheat / simmer wait).
  // Shuffled each time Phase 1 starts so the order varies. Files are gitignored (the
  // free-to-use tracks are dropped into mvp/audio/ — see audio/README.txt); a missing
  // file is skipped gracefully. All are free-to-use; full credits in audio/README.txt.
  const PHASE1_TRACKS = [
    { file: "audio/delosound-background.mp3", credit: "Delosound" },
    { file: "audio/mondamusic-background.mp3", credit: "Mondamusic" },
    { file: "audio/pumpupthemind-on.mp3", credit: "“Once in Paris” by PumpupTheMind" },
    { file: "audio/alex-morgan-downtempo-chill-electronic.mp3", credit: "“Downtempo Chill Electronic” by Alex Morgan" },
    { file: "audio/tokyo-music-walker-way-home.mp3", credit: "“Way Home” by Tokyo Music Walker (Free To Use YouTube license)" },
  ];
  // Consolidated, user-facing attribution for the Phase-1 mix (shown on the prep music note).
  const PHASE1_CREDIT = "Prep-music mix (royalty-free): Delosound · Mondamusic · PumpupTheMind · Alex Morgan · “Way Home” by Tokyo Music Walker (Free To Use YouTube license).";
  const Ambient = {
    el: null, vol: 0.4, fadeRaf: null, queue: [], qIdx: 0, fails: 0,
    gain: null, ctx: null, graphFailed: false, fadeK: 1,
    shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[a[i], a[j]] = [a[j], a[i]]; } return a; },
    _ensure() {
      if (this.el) return;
      this.el = new Audio(); this.el.preload = "auto";
      this.el.onended = () => this._advance();                                   // track finished → next in the shuffled queue
      this.el.onerror = () => { this.fails++; if (this.fails < this.queue.length) this._advance(); }; // missing/404 → skip to next (until all tried)
      this.el.onplaying = () => { this.fails = 0; };
      // iOS ignores element.volume, so the TTS duck (and the drop fade) must go
      // through a Web Audio GAIN node — same architecture as the MusicBackend
      // graph. Same-origin bundled mp3s, so MediaElementSource is safe; on any
      // failure we fall back to element volume (desktop behavior, unchanged).
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) {
          this.ctx = new Ctx();
          const src = this.ctx.createMediaElementSource(this.el);
          this.gain = this.ctx.createGain();
          src.connect(this.gain); this.gain.connect(this.ctx.destination);
        } else this.graphFailed = true;
      } catch (e) { this.graphFailed = true; this.gain = null; }
    },
    // the ONE place Ambient loudness is written: duck fraction × fade progress × base
    _vol() {
      const v = Math.max(0, Math.min(1, this.vol * VoiceDuck.frac * this.fadeK));
      if (this.gain) { try { if (this.ctx.state === "suspended") this.ctx.resume(); this.gain.gain.value = v; if (this.el) this.el.volume = 1; } catch (e) { } }   // gain carries the ABSOLUTE level; element stays at 1 (iOS ignores volume writes anyway)
      else if (this.el) this.el.volume = v;
    },
    _advance() { if (!this.queue.length) return; this.qIdx = (this.qIdx + 1) % this.queue.length; this._cue(); },
    _cue() { if (!this.el || !this.queue.length) return; this.el.src = this.queue[this.qIdx]; this._vol(); this.el.play().catch(() => { }); },   // frac: a track advance mid-voice-clip stays ducked
    // shuffle a list of {file} and play them in order, looping the list (skips missing files)
    playShuffled(tracks) {
      if (this.fadeRaf) { cancelAnimationFrame(this.fadeRaf); this.fadeRaf = null; }
      this._ensure(); this.fadeK = 1; this.el.loop = false; this.fails = 0;
      this.queue = this.shuffle((tracks || []).map((t) => t.file)); this.qIdx = 0;
      this._cue();
    },
    stop() { if (this.fadeRaf) { cancelAnimationFrame(this.fadeRaf); this.fadeRaf = null; } if (this.el) { this.el.pause(); try { this.el.currentTime = 0; } catch (e) { } } },
    fadeOut(ms) {
      if (!this.el) return;
      const start = performance.now(), k0 = this.fadeK;
      const step = (now) => {
        const k = Math.min(1, (now - start) / ms);
        this.fadeK = k0 * (1 - k); this._vol();
        if (k < 1) this.fadeRaf = requestAnimationFrame(step); else { this.stop(); this.fadeK = 1; }
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
      try { Alarm.dismiss(); } catch (e) { }   // leaving any cook context silences a live alarm
      const s = this.sentinel; this.sentinel = null;
      if (s) { try { await s.release(); } catch (e) { } }
    },
  };
  document.addEventListener("visibilitychange", () => {
    // the lock is dropped whenever the page loses visibility — re-acquire on return
    // if the user is still mid-cook (without this it silently stops working).
    if (document.visibilityState === "visible" && cookActive) WakeLock.acquire();
    if (document.visibilityState === "visible") Alarm.onForeground();   // reconstruct alarm state after a background stint
  });

  // ---- GLOBAL ring-until-dismissed countdown alarm (engine-level, all recipes) ----
  // iPhone-timer behavior: when any COUNTDOWN timer hits zero it RINGS — the Sfx chime
  // on a ~4s repeat + a haptic each ring — until the user TAPS (no auto-dismiss, no voice
  // dismiss). Rings 15 min max, then converts to a persistent VISUAL banner ("went off X
  // min ago") that survives cook-screen navigation (it lives on `.phone`, outside #app) and
  // stays until tapped. Uses the Sfx AudioContext — a SEPARATE channel from music/voice;
  // touches NO music playback, NO voice, NO cue-arrival sounds. Timestamp-based (startedAt),
  // so a background→foreground return reconstructs the right state. NOT per-recipe data —
  // callers just fire Alarm.start() wherever a countdown reaches zero, and route every
  // flow-advancing tap through Alarm.dismiss().
  const Alarm = {
    ringing: false, visual: false, startedAt: 0, label: "", banner: null, _ringInt: null, _agoInt: null,
    CEILING_MS: 15 * 60 * 1000, REPEAT_MS: 4000,
    prime() { try { Sfx.ensure(); } catch (e) { } },   // call at a timer's START tap to unlock web audio
    // Start (or restart) ringing. `sinceMs` backdates zero (e.g. a countdown that expired while
    // the tab was backgrounded) so the 15-min ceiling is measured from the real go-off moment.
    start(label, sinceMs) {
      this._clear();
      this.label = label || "Timer"; this.startedAt = Date.now() - (sinceMs || 0);
      const past = Date.now() - this.startedAt >= this.CEILING_MS;
      this.ringing = !past; this.visual = past;
      if (this.ringing) { this._ring(); this._ringInt = setInterval(() => this._loop(), this.REPEAT_MS); }
      this._render();
    },
    _loop() { if (Date.now() - this.startedAt >= this.CEILING_MS) this._ceiling(); else this._ring(); },
    _ring() {
      try { Sfx.chime(); } catch (e) { }                 // -16 LUFS-tuned Sfx chime, no escalation
      vibrate("double");
      if (this.banner) { this.banner.classList.remove("pulse"); void this.banner.offsetWidth; this.banner.classList.add("pulse"); }
    },
    _ceiling() {                                         // 15-min ceiling: sound + haptic stop, visual persists
      this.ringing = false; this.visual = true;
      if (this._ringInt) { clearInterval(this._ringInt); this._ringInt = null; }
      this._render();
    },
    dismiss() {                                          // TAP-ONLY: banner tap OR any flow-advancing tap
      if (!this.ringing && !this.visual) return;
      this.ringing = false; this.visual = false; this._clear();
      if (this.banner) { this.banner.remove(); this.banner = null; }
    },
    active() { return this.ringing || this.visual; },
    _clear() { if (this._ringInt) clearInterval(this._ringInt); if (this._agoInt) clearInterval(this._agoInt); this._ringInt = this._agoInt = null; },
    _render() {
      if (this.banner) this.banner.remove();
      const b = document.createElement("div");
      b.className = "alarm-banner " + (this.visual ? "visual" : "ringing");
      b.setAttribute("role", "button"); b.tabIndex = 0;
      this.banner = b; this._paint();
      b.onclick = () => this.dismiss();
      (document.querySelector(".phone") || app).appendChild(b);
      if (this._agoInt) clearInterval(this._agoInt);
      this._agoInt = setInterval(() => this._paint(), 15000);
    },
    _paint() {
      if (!this.banner) return;
      const agoMin = Math.floor((Date.now() - this.startedAt) / 60000);
      const sub = this.ringing ? "Tap to dismiss" : `Went off ${agoMin < 1 ? "just now" : agoMin + " min ago"} · tap to dismiss`;
      this.banner.innerHTML = `<span class="ab-ico">${this.ringing ? "⏰" : "🔕"}</span><span class="ab-body"><b>${esc(this.label)} — time's up</b><small>${sub}</small></span>`;
    },
    onForeground() {   // the ring interval throttles while hidden — re-check the ceiling + repaint on return
      if (!this.active()) return;
      if (this.ringing && Date.now() - this.startedAt >= this.CEILING_MS) this._ceiling();
      this._paint();
    },
  };
  // A cook-clock checkpoint whose preceding leg (previous cue → this cue) ran this long or longer is
  // treated as a come-back-now and rings (ramen's egg = 240s); shorter arrivals stay heads-ups. Tunable.
  const COMEBACK_SEC = 180;
  window.__Alarm = Alarm; window.__COMEBACK_SEC = COMEBACK_SEC;   // DEV: headless alarm verification

  // ---- COOK RESUME — server-side cook state (account-keyed) -----------------
  // Leaving mid-cook and returning drops the user exactly where they were. The
  // SERVER is the source of truth (PUT/GET/DELETE /api/cook-state, one active cook
  // per account); the SAME endpoints back the future iOS app, so it inherits
  // resume — including cross-device — with zero rework. localStorage mirrors only
  // as an offline nicety for a LOGGED-IN user; it is never the source of truth and
  // anonymous cooks (LIBRARY_OPEN_TO_ALL) get nothing. Alarm state is deliberately
  // NOT snapshotted — a restored step starts pre-ring (see restore semantics).
  let resumeCtx = null;   // pending restore position; screens.cook/guidedCook read+clear it on entry
  const Resume = {
    LS: "choppd_cook_state",
    SCHEMA: 1,
    WINDOW_MS: 6 * 60 * 60 * 1000,   // 6h resume window (mirrors the server)
    _timer: null, _pending: null, _cache: undefined, _expired: null,

    enabled() { return backendOn() && API.isLoggedIn(); },   // resume is a logged-in feature

    // Event-driven, DEBOUNCED (2s) fire-and-forget save with one retry. A failed
    // save must never block or slow the cook UI, so every path swallows errors.
    save(snapshot) {
      if (!snapshot) return;
      snapshot.schema_version = this.SCHEMA;
      this._cache = snapshot;
      if (!this.enabled()) return;                 // anonymous → no server row, no mirror
      try { localStorage.setItem(this.LS, JSON.stringify({ ...snapshot, mirroredAt: Date.now() })); } catch (e) { }
      this._pending = snapshot;
      clearTimeout(this._timer);
      this._timer = setTimeout(() => this._flush(1), 2000);
    },
    _flush(retries) {
      const snap = this._pending;
      if (!snap || !this.enabled()) return;
      API.putCookState(snap).catch(() => { if (retries > 0) setTimeout(() => this._flush(retries - 1), 3000); });
    },

    // Fetch the active snapshot: server-first (authoritative), localStorage mirror
    // only as an offline fallback. Returns { state, expired }.
    async fetchActive() {
      this._expired = null;
      if (!this.enabled()) { this._cache = null; return { state: null }; }
      try {
        const r = await API.getCookState();
        this._cache = r.state || null;
        if (r.expired) { this._expired = r.expired; try { localStorage.removeItem(this.LS); } catch (e) { } }
        return r;
      } catch (e) {
        const m = this._readMirror();     // offline: honest 6h window off the mirror
        this._cache = m; return { state: m };
      }
    },
    _readMirror() {
      try {
        const m = JSON.parse(localStorage.getItem(this.LS) || "null");
        const last = m && (Date.parse(m.updatedAt) || m.mirroredAt);
        if (!m || !last || Date.now() - last > this.WINDOW_MS) return null;
        return m;
      } catch (e) { return null; }
    },

    // Clear on finish / explicit quit / start-over. Cancels any queued save first
    // so a late debounce can't resurrect a just-cleared cook.
    clear() {
      clearTimeout(this._timer); this._pending = null; this._cache = null; this._expired = null;
      try { localStorage.removeItem(this.LS); } catch (e) { }
      if (backendOn() && API.isLoggedIn()) API.deleteCookState().catch(() => { });
    },
    active() { return this._cache || null; },
    expired() { return this._expired; },
  };

  // Confirmed-gate ids = indices of gate cues/steps BEHIND the current position
  // (the engine can't advance past a blocking gate without confirming it). Purely
  // position-derived, so it needs no per-recipe authoring.
  function gatesBelow(list, idx) {
    const out = [];
    for (let i = 0; i < idx && i < (list ? list.length : 0); i++) if (list[i] && list[i].gate) out.push(i);
    return out;
  }
  // Selection half of a flagship snapshot (recipe/method/optionals/pan-stove/
  // portion) read from the module prep vars; the engine spreads in the runtime half.
  function flagshipSelection() {
    return {
      recipeId: EXP.id, engine: "flagship",
      title: EXP.recipe.title, emoji: EXP.recipe.emoji,   // display metadata (instant resume card, no lookup)
      method: cookMethod || null,
      portion: EXP.portion ? (portionCount || EXP.portion.base) : null,
      prep: { pan: state.cookPan || null, heat: state.equipment.heat || null,
              garlicStrength, cookLiquid, addIns: { ...addIns }, eggStove, eggFat },
    };
  }
  // Library cooks carry only the pan/stove gate answers (no method/optionals/portion).
  function librarySelection(r) {
    return { recipeId: r.id, engine: "library",
             title: r.title, emoji: r.emoji,   // display metadata (instant resume card, no lookup)
             prep: { pan: state.cookPan || null, heat: state.equipment.heat || null } };
  }
  // Elapsed-since text for the resume card / banner.
  function resumeAgo(ts) {
    const mins = Math.max(1, Math.round((Date.now() - (ts || Date.now())) / 60000));
    return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m ago` : `${mins} min ago`;
  }
  function resumeTitle(s) {
    if (s.title) return (s.emoji ? s.emoji + " " : "") + s.title;
    const exp = (window.EXPERIENCES || []).find((e) => e.id === s.recipeId);
    return exp ? exp.recipe.emoji + " " + exp.recipe.title : s.recipeId;
  }
  // Home resume surface: paint from cache instantly, then refresh from the server
  // (cross-device). Active → resume card; expired (6h+) → "you had a cook going".
  function mountResumeCard() {
    const slot = $("#resumeCard"); if (!slot) return;
    const paint = () => {
      const el = $("#resumeCard"); if (!el) return;   // home navigated away
      const s = Resume.active(), ex = Resume.expired();
      if (s) {
        const ago = resumeAgo(Date.parse(s.updatedAt) || s.mirroredAt || s.startedAt);
        el.innerHTML = `<button class="resume-card" id="resumeGo"><span class="rc-thumb">${recipeThumbInner(s, "↩︎")}</span><span class="rc-body"><b>Resume your cook</b><small>${esc(resumeTitle(s))} · ${ago}</small></span><span class="rc-go">▶</span></button>`;
        const b = $("#resumeGo"); if (b) b.onclick = () => resumeInto(Resume.active());
      } else if (ex) {
        el.innerHTML = `<div class="resume-card expired"><span class="rc-ico">⌛</span><span class="rc-body"><b>You had a cook going</b><small>${esc(resumeTitle(ex))} — too long ago to safely resume</small></span><button class="rc-startover" id="resumeOver">Start over</button></div>`;
        const b = $("#resumeOver"); if (b) b.onclick = () => openRecipeById(ex.recipeId);
      } else el.innerHTML = "";
    };
    paint();
    if (Resume.enabled()) Resume.fetchActive().then(paint).catch(() => { });
  }
  // Overwrite guard: starting a DIFFERENT cook while one is active confirms first.
  function guardActiveCook(newRecipeId, proceed) {
    const act = Resume.active();
    if (act && act.recipeId !== newRecipeId) {
      confirmDialog(`This replaces your paused ${resumeTitle(act)}.`, "Replace it", () => { Resume.clear(); proceed(); });
    } else proceed();
  }
  // Re-open a recipe's detail (start-over from an expired cook). Flagship via
  // EXPERIENCES; library via the catalog API.
  function openRecipeById(id) {
    const exp = (window.EXPERIENCES || []).find((e) => e.id === id);
    if (exp) { EXP = exp; cookMethod = null; resetPrepPrefs(); screens.recipeDetail(exp); return; }
    if (backendOn()) API.recipeById(id).then((d) => { const r = (d && d.recipe) || d; if (r) openRecipe(r); else toast("Couldn't find that recipe"); }).catch(() => toast("Couldn't reopen that recipe"));
  }
  window.__Resume = Resume;   // DEV: headless resume verification

  // Raw-protein safety on resume (food-honesty). Derive the protein from the
  // recipe — no per-recipe authoring. steak→beef for natural copy.
  const RESUME_PROTEINS = ["chicken", "turkey", "beef", "steak", "pork", "sausage", "bacon", "lamb", "salmon", "fish", "shrimp", "prawn"];
  function detectProtein() {
    const hay = [...arguments].filter(Boolean).join(" ").toLowerCase();
    const hit = RESUME_PROTEINS.find((p) => hay.includes(p));
    return hit ? (hit === "steak" ? "beef" : hit) : "protein";
  }
  // A raw-protein safety gate = an explicit safetyCritical flag OR a safe-internal-
  // temp doneness gate (safeTempF/C — the 165°F chicken / 145°F beef check). Covers
  // both flagship styles (teriyaki/philly flag it; fried rice carries safeTempF) and
  // the library steps (recipe-map sets safetyCritical + safeTempF).
  function isSafetyGate(c) {
    return !!(c && (c.safetyCritical || (c.gate && (c.gate.safeTempF || c.gate.safeTempC || c.gate.safetyCritical))));
  }
  // The safety line shows when an UNCONFIRMED safety gate sits at or ahead of the
  // restore point (raw protein may already be in the pan); it stays quiet once every
  // safety gate is behind + confirmed (fried rice mid-chicken → shows; pancakes →
  // never). `list` = cues (flagship) or steps (library).
  function resumeSafetyProtein(list, idx, confirmed, recipeTexts) {
    const g = (list || []).find((c, i) => isSafetyGate(c) && i >= idx && !(confirmed || []).includes(i));
    if (!g) return null;
    return detectProtein(g.title, g.text, g.gate && g.gate.prompt, g.gate && g.gate.question, g.gate && g.gate.name, ...(recipeTexts || []));
  }
  // Honest resume message as a FULL-SCREEN BLOCKING overlay: elapsed-since-left +
  // (optional) raw-protein safety line. It covers the whole cook screen and must be
  // tapped to dismiss — unmissable, and it forces an explicit "I checked my food"
  // acknowledgement before the cook continues. One-shot.
  function mountResumeBanner(sinceMs, protein) {
    const mins = Math.max(1, Math.round((sinceMs || 0) / 60000));
    const ago = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins} min`;
    const safety = protein
      ? `<div class="resume-ov-safety">⚠️ You were mid-cook with raw ${protein} — check your protein's state before going on.</div>`
      : "";
    const host = document.querySelector(".phone") || document.body;
    const ov = document.createElement("div");
    ov.className = "resume-overlay";
    ov.innerHTML = `<div class="resume-ov-card">
      <div class="resume-ov-ico">↩︎</div>
      <h2 class="resume-ov-title">Welcome back</h2>
      <p class="resume-ov-line">You left ${ago} ago — check where your food actually is before continuing.</p>
      ${safety}
      <button class="btn resume-ov-btn" id="resumeOvBtn">Got it — continue</button>
    </div>`;
    host.appendChild(ov);
    const b = ov.querySelector("#resumeOvBtn"); if (b) b.onclick = () => ov.remove();
    vibrate("double");
  }

  // Rehydrate the module selection state from a flagship snapshot, then enter the
  // cook engine at the saved position (via resumeCtx, read once in screens.cook).
  function restoreFlagship(snap) {
    const exp = (window.EXPERIENCES || []).find((e) => e.id === snap.recipeId);
    if (!exp) { toast("Couldn't reopen that cook"); return false; }
    EXP = exp;
    cookMethod = snap.method || null;
    portionCount = snap.portion || null;
    const prep = snap.prep || {};
    if (prep.pan) state.cookPan = prep.pan;
    if (prep.heat) state.equipment.heat = prep.heat;
    if (prep.garlicStrength) garlicStrength = prep.garlicStrength;
    if (prep.cookLiquid) cookLiquid = prep.cookLiquid;
    if (prep.addIns) addIns = { ...addIns, ...prep.addIns };
    if (prep.eggStove) eggStove = prep.eggStove;
    if (prep.eggFat) eggFat = prep.eggFat;
    phase1MusicPlaying = false;
    resumeCtx = { engine: "flagship", recipeId: snap.recipeId, cueIdx: snap.cueIdx || 0, paused: !!snap.paused, confirmedGates: snap.confirmedGates || [], startedAt: snap.startedAt, updatedAt: snap.updatedAt };
    cookPreview = false; cookTutorial = false;
    screens.cook();
    return true;
  }
  // Library resume: set the pan/stove answers, fetch the recipe, enter guidedCook
  // at the saved step (fresh countdown, gate re-checked).
  async function restoreLibrary(snap) {
    const prep = snap.prep || {};
    if (prep.pan) state.cookPan = prep.pan;
    if (prep.heat) state.equipment.heat = prep.heat;
    let r = null;
    try { const d = await API.recipeById(snap.recipeId); r = (d && d.recipe) || d; } catch (e) { }
    if (!r || !Array.isArray(r.steps) || !r.steps.length) { toast("Couldn't reopen that cook"); Resume.clear(); return false; }
    screens.guidedCook(r, { stepIdx: snap.cueIdx || 0, paused: !!snap.paused, startedAt: snap.startedAt, updatedAt: snap.updatedAt });
    return true;
  }
  // Dispatch a snapshot to the right engine by its `engine` field.
  function resumeInto(snap) {
    if (!snap) return;
    return snap.engine === "library" ? restoreLibrary(snap) : restoreFlagship(snap);
  }

  // ---- hands-free voice control (checkpoint-scoped SpeechRecognition) --------
  // Opt-in (default OFF). ADDITIVE: buttons always remain the primary path —
  // voice literally .click()s the same buttons, so there is ONE handler per
  // action. The mic is only live while a checkpoint is mounted; it stops the
  // instant the checkpoint advances/goes back/exits or the app backgrounds.
  // Recognition is the device's own (Apple/Google); no audio or transcript
  // ever touches the Choppd backend — only anonymous count events.
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;   // THE shared feature-detect
  // ---- native (Capacitor) speech backend ------------------------------------
  // In the iOS Capacitor WebView the Web Speech `SR` above is null, so voice routes
  // through @capacitor-community/speech-recognition (registered at
  // window.Capacitor.Plugins.SpeechRecognition). Chosen at runtime; the web path is
  // never touched — on web these both return falsy, so every branch below is web-identical.
  // Detection is lazy (each call) so it survives a late bridge inject and lets headless
  // tests mock Capacitor post-load.
  const isNativeVoice = () => !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === "function" && window.Capacitor.isNativePlatform());
  const isNativePlatform = isNativeVoice;   // same runtime check, general name (used by the auth platform split)
  const choppdSpeech = () => (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.ChoppdSpeech) || null;
  // NATIVE_VOICE_V2 ON → the native backend is ChoppdSpeech (SFSpeechRecognizer + coordinator); OFF →
  // the (dark) v1 community plugin. Same JS contract either way, so all of VoiceCtrl works unchanged.
  const nativeSpeech = () => (NATIVE_VOICE_V2 ? choppdSpeech() : (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.SpeechRecognition)) || null;
  const choppdAudioCoord = () => (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.ChoppdAudio) || null;
  // 1b coexistence mitigation: on native, give the AVAudioSession a beat to hand off
  // from WebView playback (cook TTS just ended) to the record session before start().
  // If this doesn't cure the 1101 "no speech" on device, the AVAudioSession category
  // change is the required fix (reported — founder decides, plugin not patched here).
  const NATIVE_HANDOFF_MS = 350;
  // 1e min listen window: a session that has run this long is "healthy" — a native
  // silence-stop after it is a normal timeout (restart FRESH, reset the fail counter),
  // not a thrash symptom. Only user action / TTS / the thrash guard close a session early.
  const NATIVE_MIN_WINDOW_MS = 8000;
  // Storm guard: the native speech bridge HANGS (WebView freeze, the founder's bug A) if
  // open/start is hammered faster than iOS can service it. Cap mic lifecycle opens to
  // MAX_OPENS_PER_SEC within a rolling 1s window; on the (N+1)th, log-and-HOLD one delayed
  // retry instead of firing — the storm collapses to a heartbeat, the bridge never floods.
  const NATIVE_MAX_OPENS_PER_SEC = 4;
  const NATIVE_STORM_HOLD_MS = 700;
  // Command table = data, not conditionals (future phrases/languages are config
  // changes). Matching: lowercase, punctuation stripped, leading/trailing filler
  // words dropped, then EXACT phrase match — so "please next" fires but
  // "background" and "the next time" never do, and a spoken cue line like
  // "tap continue when you're ready" can't echo-trigger anything ("continue"
  // is no longer a voice command — NEXT is the official advance word).
  const VOICE_COMMANDS = [
    { cmd: "advance", phrases: ["next"] },
    { cmd: "back", phrases: ["back", "go back"] },
    { cmd: "repeat", phrases: ["repeat", "say again"] },
  ];
  const VOICE_FILLERS = new Set(["please", "ok", "okay", "now", "hey", "um", "uh", "and", "then", "choppd"]);
  function matchVoiceCommand(raw) {
    const toks = String(raw || "").toLowerCase().replace(/[^a-z' ]+/g, " ").split(/\s+/).filter(Boolean);
    while (toks.length && VOICE_FILLERS.has(toks[0])) toks.shift();
    while (toks.length && VOICE_FILLERS.has(toks[toks.length - 1])) toks.pop();
    const said = toks.join(" ");
    for (const c of VOICE_COMMANDS) if (c.phrases.includes(said)) return c.cmd;
    return null;
  }
  window.__matchVoiceCommand = matchVoiceCommand;   // exposed for tests

  const VoiceCtrl = {
    rec: null, active: false, suspended: false, handlers: null,
    armedAt: 0, fails: 0, deniedThisSession: false,
    coldRestarts: 0, _aliveTimer: null, _lvlTimer: null,
    // v2 coordinator: a listen (record) window is OPEN. The cook's AM state listener reads this so a
    // window's iOS interruption is never misread as an AM failure (amActive stays true). _musicRecover is
    // the cook's source-aware recovery (kick / AM resume), run after each listen exit; _recoverTimer is
    // its 350ms retry — the cook cancels it on exit so a stopped cook can't be resurrected.
    _listening: false, _musicRecover: null, _recoverTimer: null, _listenExitAt: 0,
    listening() { return !!this._listening; },
    // JOB A GRACE: an AM error/pause landing WITHIN ~3s AFTER a listen window closes is interruption
    // aftermath, never an AM failure — the founder's incident was the error arriving the beat after the
    // window. The AM state listener treats listening()||inGrace() as "don't touch amActive / don't escalate".
    inGrace() { return this._listening || (performance.now() - this._listenExitAt < 3000); },
    ECHO_GUARD_MS: 700,   // ignore matches just after the cue TTS starts (echo of the clip / muffled music)
    // Support state at CALL TIME (never cached — survives a late Capacitor bridge):
    //   'ok'             usable (web has Web Speech, OR native has the plugin registered)
    //   'native-missing' native build but the speech plugin isn't in the app (broken build)
    //   'web-unsupported' a browser with no Web Speech API
    // The "try Safari/Chrome" copy renders ONLY for 'web-unsupported' — it is
    // UNREACHABLE on native (every native render branch checks isNativeVoice()).
    _warnedMissingPlugin: false,
    supportState() {
      // §3 — VOICE DARK ON NATIVE: native voice is OFF for now. The speech plugin's AVAudioSession
      // init can hang the main thread (the founder's whole-app freeze), so the plugin stays
      // UNREACHABLE on native builds — never referenced here, never started. This is the single lever:
      // "native-off" → supported()=false everywhere → no onboarding ask, no mic-tip, the Settings
      // toggle is hidden, enabled()=false → VoiceCtrl.start() early-returns → the plugin is never
      // touched. Web voice is UNTOUCHED. v1.1 follow-up: re-enable behind an AVAudioSession
      // .playAndRecord + mixWithOthers fix and its own device test — not before.
      if (isNativeVoice()) return NATIVE_VOICE_V2 ? "ok" : "native-off";   // v2: ChoppdSpeech behind the coordinator makes native voice available
      return SR ? "ok" : "web-unsupported";
    },
    supported() { return this.supportState() === "ok"; },
    enabled() { return (NATIVE_VOICE_V2 || !isNativeVoice()) && this.supported() && !!state.prefs.voiceControl; },
    // checkpoint MOUNT → register handlers. STRICT SEQUENCING: the mic never
    // opens while the AI voice is speaking — if the cue clip is mid-play, we
    // wait for its 'ended' event (onVoiceDone) and open the mic at that exact
    // moment. No mic during TTS = iOS cannot duck the spoken instruction.
    // (The browser's mic-permission prompt appears at the first OPEN.)
    start(handlers) {
      if (!this.enabled() || this.deniedThisSession) return;
      this._closeReason = "start-reset"; this._close();
      this.handlers = handlers; this.fails = 0; this.suspended = false;
      if (VoicePlayer.speaking) { this._vlog("start held (speaking) — onVoiceDone will open"); return; }   // onVoiceDone opens the mic
      this._arm();
      this._open();
    },
    // checkpoint UNMOUNT (advance/back/exit) → session over, mic off instantly. `caller` tags the
    // stop in the VOICE: log so the cascade names its source (advance/back/exit/jump/…).
    stop(caller) { this.handlers = null; this.suspended = false; this._closeReason = caller || "stop"; this._close(); },
    // ---- TTS gate (driven by the voice element's own play/ended events) ----
    onVoiceStart() { if (this.active) { this._closeReason = "tts"; this._close(); } },   // a clip started (repeat, coach, nudge) → mic off
    onVoiceDone() {   // the clip ended → open the mic NOW, echo guard armed
      if (!this.handlers || this.active || this.suspended) return;
      if (document.visibilityState === "hidden") return;
      if (!this.enabled() || this.deniedThisSession) return;
      this.fails = 0; this._arm(); this._open();
    },
    _open() {
      if (isNativeVoice()) { this._nativeOpen(); this._ui(true); return; }
      this._spawn(); this._ui(true);
    },
    _close() {
      if (isNativeVoice()) { this._nativeClose(); this._ui(false); return; }
      const r = this.rec; this.rec = null; this.active = false;
      if (this._aliveTimer) { clearTimeout(this._aliveTimer); this._aliveTimer = null; }
      if (this._lvlTimer) { clearTimeout(this._lvlTimer); this._lvlTimer = null; }
      if (r) { r.onresult = r.onerror = r.onend = r.onaudiostart = r.onsoundstart = r.onspeechstart = r.onsoundend = null; try { r.abort(); } catch (e) { try { r.stop(); } catch (_) { } } }
      this._ui(false);
    },
    _spawn() {
      const rec = new SR();
      rec.continuous = true; rec.interimResults = true; rec.lang = "en-US";
      rec.onresult = (e) => this._onResult(e);
      rec.onerror = (e) => this._onError(e);
      // onend fires spontaneously on silence timeouts — auto-restart while the
      // checkpoint is still mounted (this.active guards restart-after-advance races)
      rec.onend = () => { if (this.rec === rec && this.active) this._restart(); };
      // ---- first-run liveness watchdog (the tutorial "hears nothing" bug) ----
      // A recognizer started BEFORE the mic-permission grant lands binds no capture
      // and emits NOTHING (no audiostart, no error, no end) — WebKit's dead-instance
      // pattern. audiostart = proof of a live capture; if it never comes, respawn.
      // Cold restarts don't count against the 3-strike giveup (the prompt can sit
      // open a while) but cap at 8 (~20s) so a truly broken engine still gives up.
      rec.__alive = false;
      rec.onaudiostart = () => { rec.__alive = true; this.coldRestarts = 0; this._level("idle"); };
      rec.onsoundstart = () => this._level("hot");
      rec.onspeechstart = () => this._level("hot");
      rec.onsoundend = () => this._level("idle");
      if (this._aliveTimer) clearTimeout(this._aliveTimer);
      this._aliveTimer = setTimeout(() => {
        if (this.rec === rec && this.active && !rec.__alive && !this.deniedThisSession) {
          if (this.coldRestarts++ < 8) this._spawn();   // respawn WITHOUT counting a strike
        }
      }, 2500);
      this.rec = rec; this.active = true;
      try { rec.start(); } catch (e) { /* already started / transient */ }
    },
    // gesture anchor: (re)open the mic from INSIDE a user tap — first-run permission
    // prompts then originate from a gesture (the proven path: the settings mic test).
    kick() {
      if (!this.enabled() || this.deniedThisSession || !this.handlers) return;
      if (VoicePlayer.speaking) return;
      this._close(); this.handlers = this.handlers; this._arm(); this._open();
    },
    // ---- mic level indicator (recognition-EVENT-driven — no second capture stream;
    // a parallel getUserMedia analyser contends with SpeechRecognition on iOS) ----
    _level(state) {
      $$(".mic-bars").forEach((el) => { el.classList.toggle("hot", state === "hot"); });
      if (this._lvlTimer) clearTimeout(this._lvlTimer);
      if (state === "hot") this._lvlTimer = setTimeout(() => $$(".mic-bars").forEach((el) => el.classList.remove("hot")), 900);
    },
    _arm() { this.armedAt = performance.now() + this.ECHO_GUARD_MS; },
    _restart() {
      this.fails++;
      if (this.fails > 3 || !this.active || !this.enabled()) { this.stop(); return; }   // give up silently for THIS checkpoint (Brave/Samsung land here)
      this._spawn();
    },
    _onResult(e) {
      this._level("hot");   // the indicator reacts to ANY heard speech, even guarded
      if (!this.active || performance.now() < this.armedAt) return;
      this.fails = 0;   // real audio is flowing — reset the giveup counter
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const cmd = matchVoiceCommand(e.results[i][0] && e.results[i][0].transcript);
        if (!cmd) continue;
        const h = this.handlers;
        if (!h) return;                                   // torn down — a trailing result can't double-fire
        if (cmd === "advance") { this.stop(); trackEvent("voice_advance"); h.advance(); }
        else if (cmd === "back") { this.stop(); trackEvent("voice_back"); h.back(); }
        else if (cmd === "repeat") { trackEvent("voice_repeat"); h.repeat(); }   // clip start CLOSES the mic (onVoiceStart); its end reopens + re-arms it
        return;                                           // first matched command per result event
      }
    },
    _onError(e) {
      const code = e && e.error;
      if (code === "not-allowed" || code === "service-not-allowed") {
        // mic denied at the browser prompt: pref OFF, one toast, never re-prompt
        // mid-cook (deniedThisSession also suppresses the settings tip today)
        this.stop();
        this.deniedThisSession = true;
        state.prefs.voiceControl = false; saveProfile();
        if (this.onDenied) { const f = this.onDenied; this.onDenied = null; f(); return; }   // the enable-time test shows its own message
        toast("Mic permission needed for voice control — using tap");
      }
      // 'no-speech' / 'network' → onend follows; _restart counts the failures
    },
    // ---- native (Capacitor plugin) backend: SAME grammar / handlers / lifecycle ----
    // Mirrors the web recognizer through window.Capacitor.Plugins.SpeechRecognition.
    // DEFERRED PERMISSION: the OS prompt fires on the FIRST mic open inside a cook
    // (here) — never at launch/onboarding (runVoiceTest is informational on native).
    // ---- native session lifecycle (token-disciplined; ONE teardown owner) ----------
    // Every _nativeOpen bumps _openToken → THAT session's id. Every listener callback and
    // error carries its token and is IGNORED unless it's still current (_stale). A stale
    // event from a superseded session can no longer tear down the live one — that cross-fire
    // was the thrash. _nativeTeardown is the ONLY code that calls removeAllListeners/stop.
    _permGranted: false, _permLogged: false, _nativeFails: 0, _lastStartAt: 0, _restartTimer: null,
    _nativeUnavailable: false, _openToken: 0, _sessionId: 0, _closeReason: null, _openTimes: [],
    _vlog(m) { try { if (isNativeVoice()) console.log("VOICE: " + m); } catch (e) { } },
    _stale(token, what) { if (token !== this._openToken) { this._vlog("ignored stale#" + token + " (" + what + ")"); return true; } return false; },
    async _nativeOpen() {
      const SP = nativeSpeech();
      if (!SP) { this._onNativeUnavailable("no-plugin"); return; }
      if (this.deniedThisSession || this._nativeUnavailable) return;   // honest states never retry
      // Storm guard (bug A): if the mic has already opened NATIVE_MAX_OPENS_PER_SEC times in the
      // last second, HOLD — schedule ONE delayed retry and bail — so a start/stop cascade can't
      // hammer (and hang) the native bridge. The hold self-clears once the window drains.
      const now = performance.now();
      this._openTimes = this._openTimes.filter((t) => now - t < 1000);
      if (this._openTimes.length >= NATIVE_MAX_OPENS_PER_SEC) {
        this._vlog("HELD open — " + this._openTimes.length + " opens/1s (storm guard)");
        if (this._restartTimer) { clearTimeout(this._restartTimer); this._restartTimer = null; }
        this._restartTimer = setTimeout(() => {
          if (this.handlers && this.enabled() && !this.deniedThisSession && !this._nativeUnavailable && !VoicePlayer.speaking) this._nativeOpen();
        }, NATIVE_STORM_HOLD_MS);
        return;
      }
      this._openTimes.push(now);
      const token = ++this._openToken;   // THIS session's id — every event from it carries `token`
      this._vlog("open#" + token);
      try {
        if (!this._permGranted) {
          // 1c: one grant covers BOTH mic + speech on iOS (plugin's speechRecognition alias).
          const perm = await SP.requestPermissions();
          const v = perm && (typeof perm === "string" ? perm : (perm.speechRecognition || perm.microphone));
          if (!this._permLogged) { this._permLogged = true; console.log("[VoiceCtrl] iOS speech+mic permission:", v); }
          if (v !== "granted") { this._onNativeDenied(); return; }   // missing grant → denied, NOT no-speech
          this._permGranted = true;
        }
        if (token !== this._openToken || !this.handlers) return;   // superseded/closed during the await
        // 1d: BOTH listeners attached BEFORE start(), each carrying this session's token.
        await SP.removeAllListeners();
        await SP.addListener("partialResults", (data) => this._onNativeResult(data, token));
        await SP.addListener("listeningState", (data) => this._onNativeListeningState(data, token));
        if (NATIVE_HANDOFF_MS) await new Promise((r) => setTimeout(r, NATIVE_HANDOFF_MS));   // 1b (i): session handoff beat
        if (token !== this._openToken || !this.handlers) return;   // superseded during handoff — teardown already owns cleanup
        // COORDINATOR (v2): ChoppdAudio owns the session — transition to the §0-measured `listen` config
        // (.playAndRecord + mixWithOthers: both sources stay ALIVE, deeply attenuated) BEFORE the
        // recognizer's engine starts its input tap. ChoppdSpeech never touches setCategory/setActive.
        if (NATIVE_VOICE_V2) { const CO = choppdAudioCoord(); if (CO) { try { bumpCoordEpoch("listen#" + token); await CO.setMode({ mode: "listen" }); this._listening = true; this._vlog("coord→listen#" + token); } catch (e) { } } }
        this._lastStartAt = performance.now();
        await SP.start({ language: "en-US", partialResults: true, popup: false, maxResults: 5 });
        if (token !== this._openToken) return;   // a teardown landed while start() resolved
        this._sessionId = token; this.active = true; this._level("idle");
        this._vlog("live#" + token);
      } catch (e) { this._onNativeError(e, token); }
    },
    // THE single owner of stop/removeAllListeners. Bumps the token so every in-flight event
    // from the closing session is now stale, and logs one reason line for the story.
    _nativeTeardown(reason) {
      const closing = this._sessionId || this._openToken;
      this._openToken++;   // invalidate the closing session's pending events + any scheduled open
      this.active = false; this._sessionId = 0;
      if (this._restartTimer) { clearTimeout(this._restartTimer); this._restartTimer = null; }
      if (this._lvlTimer) { clearTimeout(this._lvlTimer); this._lvlTimer = null; }
      this._vlog("closing#" + closing + " reason=" + reason);
      const SP = nativeSpeech();
      // COORDINATOR (v2): mic window closed → return the session to playbackDucked, THEN recover the music
      // pipeline the record window interrupted. FIX 1 CRASH: a transport jump tears the window down
      // mid-flight; SP.stop() (tears down the recognizer + AVAudioEngine input tap) and CO.setMode()
      // (reconfigures AVAudioSession) were both fire-and-forget → they raced (the founder's jump-during-
      // voice crash). Now SERIALIZED: await the ChoppdSpeech stop BEFORE the coordinator reconfigures the
      // session (with a 300ms fallback so a wedged plugin can never hang the teardown).
      // WRITE-OWNERSHIP GUARD (corrected muffle fix): capture the coordinator epoch NOW. When the deferred
      // setMode finally runs (post-serialize), it NO-OPS if the epoch has moved — the confirm's releaseDuck
      // (or the next window's listen, or cook stop) has since spoken and is the authoritative owner. The
      // late re-duck is voided STRUCTURALLY (C2), not raced. Base otherwise = e5dd9db verbatim.
      const teardownEpoch = coordEpoch;
      const finishCoord = () => {
        if (!NATIVE_VOICE_V2) return;
        this._listening = false;
        this._listenExitAt = performance.now();   // A GRACE: AM errors within ~3s of here are interruption aftermath, not failures
        const CO = choppdAudioCoord();
        if (coordEpoch !== teardownEpoch) { this._vlog("setMode VOIDED — a newer owner spoke (epoch " + teardownEpoch + "→" + coordEpoch + ")"); }
        else if (CO) { try { CO.setMode({ mode: "playbackDucked" }); } catch (e) { } }   // deactivate(.notifyOthers)+restore is inside setMode
        // JOB C: AT MOST ONE recover per window close — a single call after the transition settles (350ms),
        // intent-guarded (_musicRecover no-ops when parked/paused/dead). No immediate+retry churn.
        if (this._recoverTimer) clearTimeout(this._recoverTimer);
        this._recoverTimer = setTimeout(() => { this._recoverTimer = null; try { if (this._musicRecover) this._musicRecover(); } catch (e) { } }, 350);
        this._vlog("coord→playbackDucked + recover@350");
      };
      if (SP) {
        try { SP.removeAllListeners(); } catch (e) { }
        let settled = false; const go = () => { if (settled) return; settled = true; finishCoord(); };
        try { const r = SP.stop(); if (r && typeof r.then === "function") { r.then(go, go); setTimeout(go, 300); } else go(); }   // await stop → then setMode; never hang
        catch (e) { go(); }
      } else { finishCoord(); }
    },
    _nativeClose() { const r = this._closeReason || "stop"; this._closeReason = null; this.rec = null; this._nativeTeardown(r); },
    // 1a — errors map to the web's classes: permission → denied; else (no-speech/1101/timeout)
    // → silent restart with backoff (250→500ms), thrash guard (≥3 fast <500ms) → honest
    // unavailable. A healthy long session's silence-stop restarts FRESH (min window, 1e).
    _onNativeError(e, token) {
      if (this._stale(token, "error")) return;   // stale-session error can't tear down the live one
      const msg = String((e && (e.message || e.errorMessage)) || e || "").toLowerCase();
      if (/denied|not ?author|permission|not-allowed/.test(msg)) { this._onNativeDenied(); return; }
      const since = performance.now() - (this._lastStartAt || 0);
      if (since >= NATIVE_MIN_WINDOW_MS) this._nativeFails = 0;        // healthy → normal timeout, reset
      else if (since < 500) this._nativeFails += 1;                    // fast failure → thrash candidate
      else this._nativeFails = Math.max(1, this._nativeFails);
      this._nativeTeardown("error:" + msg.slice(0, 24));
      if (this._nativeFails >= 3) { this._onNativeUnavailable("thrash:" + msg.slice(0, 40)); return; }
      const delay = this._nativeFails >= 2 ? 500 : 250;               // 250 → 500 backoff
      this._restartTimer = setTimeout(() => {
        if (this.handlers && this.enabled() && !this.deniedThisSession && !this._nativeUnavailable && !VoicePlayer.speaking) this._nativeOpen();
      }, delay);
    },
    _onNativeListeningState(data, token) {
      if (this._stale(token, "listeningState")) return;   // stale → ignore (the race)
      if (data && data.status === "stopped" && this.active) { this.active = false; this._onNativeError(new Error("no-speech:listening-stopped"), token); }
    },
    _onNativeResult(data, token) {
      if (this._stale(token, "result")) return;   // stale → ignore
      const matches = (data && (data.matches || data.value)) || [];
      if (!this._loggedResult) { this._loggedResult = true; this._vlog("first result matches[0]=" + JSON.stringify(matches[0] || null)); }   // 1f: prove transcription is arriving (redacted to first match)
      this._level("hot");
      this._nativeFails = 0;   // real audio flowing → reset the thrash counter (parity with web _onResult)
      if (!this.active || performance.now() < this.armedAt) return;   // echo guard, same as web
      for (const m of matches) {
        const cmd = matchVoiceCommand(m);
        if (!cmd) continue;
        const h = this.handlers; if (!h) return;
        if (cmd === "advance") { this.stop("advance"); trackEvent("voice_advance"); h.advance(); }
        else if (cmd === "back") { this.stop("back"); trackEvent("voice_back"); h.back(); }
        else if (cmd === "repeat") { trackEvent("voice_repeat"); h.repeat(); }   // clip start closes the mic; its end reopens
        return;   // first matched command per event
      }
    },
    _onNativeDenied() {   // permission path — never re-prompt; forces a re-rehearsal next enable
      this.stop("denied");
      this.deniedThisSession = true;
      state.prefs.voiceControl = false; state.prefs.voiceRehearsedOk = false; saveProfile();
      if (this.onDenied) { const f = this.onDenied; this.onDenied = null; f("denied"); return; }
      toast("Voice needs mic access — turn it on in Settings. Tapping always works.");
    },
    _onNativeUnavailable(reason) {   // persistent failure → honest unavailable, touch fallback, no loop
      this.stop("unavailable");
      this._nativeUnavailable = true; this._autoDisableReason = reason || "wedged";
      console.error("[VoiceCtrl] native speech unavailable (" + (reason || "") + ") — the on-device recogniser wedged (1101 storm); ChoppdSpeech degrades to server next session. Voice falls back to touch, re-armable in Settings.");
      if (this.onDenied) { const f = this.onDenied; this.onDenied = null; f("unavailable"); return; }
      toast("Voice paused — re-enable it in Settings.");   // JOB B: honest + points to the re-enable path
    },
    // JOB B — re-arm the AUTO-disable (per-cook, never a permanent latch). Clears the storm/thrash state
    // so the mic can open again; a NEW COOK calls this, and so does the Settings toggle. Does NOT clear a
    // permission DENIAL (that needs the rehearsal's re-prompt).
    autoDisabled() { return !isNativeVoice() ? false : (this._nativeUnavailable && !this.deniedThisSession); },
    autoDisableReason() { return this._autoDisableReason || ""; },
    rearm() {
      this._nativeUnavailable = false; this._autoDisableReason = null;
      this._nativeFails = 0; this.fails = 0; this._openTimes = [];
      if (this._restartTimer) { clearTimeout(this._restartTimer); this._restartTimer = null; }
      this._vlog("re-armed (auto-disable cleared)");
    },
    // app backgrounded → mic off; on return, resume IF the checkpoint is still mounted
    _onVisibility() {
      if (document.visibilityState === "hidden") {
        if (this.handlers) { this._closeReason = "background"; this._close(); this.suspended = true; }
      } else if (this.suspended && this.handlers && this.enabled()) {
        this.suspended = false;
        if (!VoicePlayer.speaking) { this._arm(); this._open(); }
      }
    },
    _ui(on) {
      const el = document.getElementById("micHint");
      if (el) el.hidden = !on;
      // static, always-visible reminder of all three commands (no rotation —
      // users shouldn't have to wait to learn what they can say)
      if (on) { const t = document.getElementById("micHintText"); if (t) t.textContent = "say \u201cnext\u201d, \u201cback\u201d or \u201crepeat\u201d"; }
    },
  };
  document.addEventListener("visibilitychange", () => VoiceCtrl._onVisibility());
  window.__AmbientGain = () => (Ambient.gain ? Math.round(Ambient.gain.gain.value * 1000) / 1000 : (Ambient.el ? Ambient.el.volume : null));   // headless duck-trace hook
  window.__VoiceCtrl = VoiceCtrl;   // exposed for headless lifecycle tests

  // ---- the voice opt-in ASK (one shared card: onboarding step + home sheet) --
  // Never requests mic permission here — that prompts at the first checkpoint,
  // in context. Any interaction (either button, or dismissing the sheet) sets
  // voiceCtrlAsked so the modal never returns; the checkpoint tip is the only
  // re-discovery path. Unsupported browsers never see it AND keep the flag
  // unset (a later visit from a supported browser still gets the ask).
  // the three commands, plainly stated — shown at enable time AND echoed by the
  // always-visible checkpoint hint, so users never have to remember them cold.
  function voiceCommandsHTML() {
    return `<div class="voice-cmds">
      <div class="voice-cmd"><b>\u201cnext\u201d</b><span>advance to the next step</span></div>
      <div class="voice-cmd"><b>\u201cback\u201d</b><span>go to the previous step</span></div>
      <div class="voice-cmd"><b>\u201crepeat\u201d</b><span>replay the current cue's voice</span></div>
    </div>`;
  }
  function voiceOptinCardHTML() {
    return `
      <p class="eyebrow">Optional</p>
      <h2 style="margin-top:6px">Cook hands-free 🎙️</h2>
      <p class="lead" style="margin-top:8px;font-size:14px">Say 'next' at checkpoints instead of tapping — no messy-finger taps. Uses your device's speech recognition (Apple/Google); nothing is recorded or stored by Choppd. The mic only listens at checkpoints while you cook. You can change this anytime in Settings.</p>
      ${voiceCommandsHTML()}
      <div class="stack" style="margin-top:16px">
        <button class="btn" id="voEnable">Enable voice control</button>
        <button class="btn ghost" id="voLater">Not now</button>
      </div>`;
  }
  // ---- the enable-time REHEARSAL (also Settings "Test voice control") ----------
  // Not a bare mic check: a short SIMULATED CHECKPOINT that mirrors a real cook
  // moment — a practice cue card renders, the AI voice reads a cue-style line
  // with the mic CLOSED, and the mic opens the instant the line ends (the same
  // VoicePlayer.speaking gate + VoiceCtrl session the cook engine uses, so the
  // sequencing and the listening indicator are inherently identical). The user
  // rehearses the wait-then-speak rhythm on "continue", then optionally "back"
  // and "repeat". Unlimited retries. The browser's mic permission prompt
  // arrives at the first mic open, attached to the practice — not mid-recipe.
  // (legacy "then say continue" test line retired with the command change)
  const VOICE_REHEARSAL = {
    advance: { pill: "PRACTICE", title: "Give it a stir 🥄", body: "Give everything a good stir around the pan.",
      line: "Give everything a good stir. When you're done, say next.", say: "next", next: "back", nextLabel: "Practice \u201cback\u201d →" },
    back:    { pill: "PRACTICE", title: "Previous step 👀", body: "Want to see the last step again? Your voice can take you back.",
      line: "Want the previous step? After I finish talking, say back.", say: "back", next: "repeat", nextLabel: "Practice \u201crepeat\u201d →" },
    repeat:  { pill: "PRACTICE", title: "Say it again 🔁", body: "Missed an instruction? Ask for it again.",
      line: "Missed something? Say repeat, and I'll read the step again.", say: "repeat", next: null },
  };
  function voiceTestHTML() {
    return `
      <p class="eyebrow">Practice run</p>
      <h2 style="margin-top:6px">Let's rehearse it 🎙️</h2>
      <p class="lead" style="margin-top:8px;font-size:14px">Quick practice — <b style="color:var(--text)">this is exactly how it works while cooking</b>: the voice reads a step, and the mic listens only <b style="color:var(--text)">after</b> it finishes.</p>
      <div class="vt-card" id="vtCard"></div>
      ${voiceCommandsHTML()}
      <div class="vt-status" id="vtStatus">Starting\u2026</div>
      <div class="stack" style="margin-top:14px" id="vtActions"><button class="btn ghost" id="vtSkip">Skip practice</button></div>`;
  }
  // NATIVE MIC-CHECK REHEARSAL — mirrors the web voiceMicTest shape/register. Runs on any
  // EXPLICIT enable (onboarding opt-in, Settings toggle, Test row); the OS prompt fires
  // HERE, the founder-amended contextual moment (never WITHOUT an explicit enable). The
  // post-TTS mic open is ALSO the permanent regression test for the 1b session handoff.
  // Strings DRAFT-PENDING-VOICE-REVIEW. Never fake-enables — the toggle only sticks ON on success.
  // Native mic-check rehearsal spoken lines (clips via the standing Kokoro/am_michael
  // pipeline; byte-identical to voice-lines.json). DRAFT-PENDING-VOICE-REVIEW.
  const NATIVE_REHEARSAL_LINES = {
    intro: "Let's check your mic. After I finish talking, say 'next'.",
    retry: "Say it like you mean it — 'next'.",
    success: "Voice is on. Cook with your hands full.",
  };
  function runNativeVoiceRehearsal(box, onDone) {
    VoicePlayer.unlock();
    VoiceCtrl.deniedThisSession = false; VoiceCtrl._nativeUnavailable = false; VoiceCtrl._nativeFails = 0;   // fresh attempt
    const REH_INTRO = NATIVE_REHEARSAL_LINES.intro, REH_RETRY = NATIVE_REHEARSAL_LINES.retry, REH_SUCCESS = NATIVE_REHEARSAL_LINES.success;
    let attempt = 0, settled = false, timer = null, poll = null, opened = false;
    const shell = (inner) => { box.innerHTML = `<p class="eyebrow">Mic check 🎙️</p><h2 style="margin-top:6px">Let's make sure it hears you</h2>${inner}`; wire(); };
    const cleanup = () => {
      if (timer) { clearTimeout(timer); timer = null; }
      if (poll) { clearInterval(poll); poll = null; }
      VoiceCtrl.onDenied = null; VoiceCtrl.stop(); stopVoice();
    };
    function wire() {
      const d = box.querySelector("#rehDone"); if (d) d.onclick = () => { cleanup(); onDone(true); };
      const o = box.querySelector("#rehOff"); if (o) o.onclick = () => { cleanup(); onDone(false); };
      const s = box.querySelector("#rehSkip"); if (s) s.onclick = () => { settled = true; cleanup(); state.prefs.voiceControl = false; saveProfile(); onDone(false); };
    }
    function success() {
      if (settled) return; settled = true; cleanup(); vibrate("double"); trackEvent("voice_rehearsal_ok");
      state.prefs.voiceControl = true; state.prefs.voiceRehearsedOk = true; saveProfile();
      speak(REH_SUCCESS);   // spoken confirmation (mic already torn down by cleanup → no reopen)
      shell(`<p class="lead" style="margin-top:8px;font-size:14px">✅ <b>Voice is on.</b> Cook with your hands full.</p><div class="stack" style="margin-top:16px"><button class="btn" id="rehDone">Done</button></div>`);
    }
    function failFinal() {
      if (settled) return; settled = true; cleanup(); trackEvent("voice_rehearsal_fail");
      state.prefs.voiceControl = false; state.prefs.voiceRehearsedOk = false; saveProfile();
      shell(`<p class="lead" style="margin-top:8px;font-size:14px">Voice isn't picking you up here. <b>Tapping always works</b> — try voice again from Settings.</p><div class="stack" style="margin-top:16px"><button class="btn ghost" id="rehOff">OK — I'll tap</button></div>`);
    }
    function denied(kind) {
      if (settled) return; settled = true; cleanup(); trackEvent("voice_rehearsal_denied");
      state.prefs.voiceControl = false; state.prefs.voiceRehearsedOk = false; saveProfile();
      const line = kind === "unavailable"
        ? "Voice isn't picking you up here. Tapping always works — try voice again from Settings."
        : "Voice needs mic access — turn it on in Settings. Tapping always works.";
      shell(`<p class="lead" style="margin-top:8px;font-size:14px">${line}</p><div class="stack" style="margin-top:16px"><button class="btn ghost" id="rehOff">OK</button></div>`);
    }
    function attemptOnce(tip) {
      if (timer) { clearTimeout(timer); timer = null; }
      if (poll) { clearInterval(poll); poll = null; }
      attempt++; settled = false; opened = false;
      shell(`<p class="lead" style="margin-top:8px;font-size:14px">${tip || "I'll read a line — then say <b>“next”</b> right after it finishes."}</p><div class="vt-status" id="rehStatus">Starting…</div><div class="stack" style="margin-top:14px"><button class="btn ghost" id="rehSkip">Skip</button></div>`);
      const status = (h) => { const el = box.querySelector("#rehStatus"); if (el) el.innerHTML = h; };
      VoiceCtrl.onDenied = (kind) => denied(kind);
      speak(attempt === 1 ? REH_INTRO : REH_RETRY);   // attempt 1 = intro, retry = the "mean it" line; mic opens after the CLIP ends
      VoiceCtrl.start({ advance: success, back: success, repeat: success });   // any recognized command passes the mic check
      status(VoicePlayer.speaking ? "🔇 Listening opens the moment the voice finishes…" : "🎙️ <b>Listening</b> — say “next”");
      poll = setInterval(() => {
        if (settled) return;
        if (!opened && VoiceCtrl.active) {
          opened = true; status("🎙️ <b>Listening</b> — say “next”");
          if (timer) clearTimeout(timer);
          timer = setTimeout(onTimeout, 6000);   // the 6s window starts once the mic is actually open
        }
      }, 120);
      // safety: if the mic never opens (slow permission modal / blocked), fall through; deny/unavailable fire their own paths
      timer = setTimeout(() => { if (!opened && !settled) onTimeout(); }, 20000);
    }
    function onTimeout() {
      if (settled) return;
      VoiceCtrl.stop();
      if (attempt < 2) attemptOnce("Say it like you mean it — <b>“next”</b>.");   // one retry with a tip
      else failFinal();
    }
    attemptOnce(null);
  }
  window.__nativeRehearsal = (box, onDone) => runNativeVoiceRehearsal(box, onDone);   // exposed for headless tests
  function runVoiceTest(box, onDone) {
    if (isNativeVoice()) { runNativeVoiceRehearsal(box, onDone); return; }   // native: the live mic-check rehearsal
    // (called from a tap — a user gesture, so audio + the mic prompt can fire)
    VoicePlayer.unlock();
    VoiceCtrl.deniedThisSession = false;   // an explicit test may re-attempt after an old deny
    const status = (html) => { const el = box.querySelector("#vtStatus"); if (el) el.innerHTML = html; };
    const actions = (html) => { const el = box.querySelector("#vtActions"); if (el) el.innerHTML = html; };
    const card = (r) => { const el = box.querySelector("#vtCard"); if (el) el.innerHTML =
      `<div class="vt-card-head"><b>${r.title}</b><span class="pill type tip">${r.pill}</span></div><p>${r.body}</p>`; };
    let settled = false, timer = null, poll = null, round = "advance", practiced = new Set();
    const cleanup = () => {
      if (timer) { clearTimeout(timer); timer = null; }
      if (poll) { clearInterval(poll); poll = null; }
      VoiceCtrl.onDenied = null; VoiceCtrl.stop(); stopVoice();
    };
    const again = `<button class="btn" id="vtAgain">Try again 🔁</button>`;
    const wire = () => {
      const sk = box.querySelector("#vtSkip"); if (sk) sk.onclick = () => { settled = true; cleanup(); onDone(false); };
      const ag = box.querySelector("#vtAgain"); if (ag) ag.onclick = () => attempt(round);
      const nx = box.querySelector("#vtNext"); if (nx) nx.onclick = () => attempt(VOICE_REHEARSAL[round].next);
      const dn = box.querySelector("#vtDone"); if (dn) dn.onclick = () => { cleanup(); onDone(true); };
      const okb = box.querySelector("#vtOk"); if (okb) okb.onclick = () => { cleanup(); onDone(false); };
      const off = box.querySelector("#vtOff"); if (off) off.onclick = () => { state.prefs.voiceControl = false; saveProfile(); cleanup(); onDone(false); };
    };
    const ok = (cmd) => {
      if (settled) return; settled = true; cleanup(); practiced.add(cmd); trackEvent("voice_test_ok"); vibrate("double");
      const r = VOICE_REHEARSAL[round];
      const asAsked = cmd === r.say;
      status(asAsked
        ? `✅ <b>Perfect — that's exactly how it works!</b> The mic only listens after the voice finishes talking.`
        : `✅ Heard \u201c${cmd}\u201d — that works too! Same rhythm for every command: wait for the voice, then speak.`);
      const done = `<button class="btn secondary" id="vtDone">${practiced.size >= 3 ? "Done — full set rehearsed 🎉" : "Done — I'm confident"}</button>`;
      actions(r.next
        ? `<button class="btn" id="vtNext">${r.nextLabel}</button>${again.replace('class="btn"', 'class="btn secondary"')}${done}`
        : `${again}${done}`);
      wire();
    };
    const fail = (msg, denied) => {
      if (settled) return; settled = true; cleanup(); trackEvent("voice_test_fail");
      status(`⚠️ ${msg}`);
      actions(denied
        ? `<button class="btn" id="vtOk">OK — I'll use the buttons</button>`
        : `${again}<button class="btn secondary" id="vtOff">Turn voice off — I'll tap</button><button class="btn ghost" id="vtDone">Keep it on anyway</button>`);
      wire();
    };
    function attempt(which) {
      cleanup();   // clear any previous run's timers/mic
      round = which || "advance";
      const r = VOICE_REHEARSAL[round];
      settled = false;
      card(r);
      actions(`<button class="btn ghost" id="vtSkip">Skip practice</button>`);
      wire();
      VoiceCtrl.onDenied = () => fail("Mic access was denied — no problem, the tap buttons always work. Re-enable voice anytime in Settings.", true);
      // real sequencing: speak FIRST (mic stays closed), start() registers the
      // session, and the mic opens on the line's 'ended' event — same as a cook.
      speak(r.line);
      VoiceCtrl.start({ advance: () => ok("next"), back: () => ok("back"), repeat: () => ok("repeat") });
      const speaking = VoicePlayer.speaking;
      const listenHint = `<div class="mic-hint" style="margin-top:0"><span class="mic-dot">🎙️</span> <span><b>Listening</b> — now say \u201c${r.say}\u201d →</span></div>`;
      status(speaking
        ? `🔇 Voice speaking — mic is <b>off</b>. It opens the moment the voice finishes\u2026`
        : listenHint);
      // watch for the mic actually opening; the no-speech timeout starts THEN
      let opened = !speaking && VoiceCtrl.active;
      poll = setInterval(() => {
        if (settled) return;
        if (!opened && VoiceCtrl.active) {
          opened = true;
          if (timer) { clearTimeout(timer); timer = null; }
          status(listenHint);
          timer = setTimeout(() => fail("Didn't catch that — remember: wait until the voice finishes talking, THEN speak. Try again."), 10000);
        }
      }, 150);
      // safety: if the mic never opens (blocked clip AND blocked mic), fail gently
      timer = setTimeout(() => { if (!opened && !settled) fail("Couldn't start the practice — the tap buttons always work. You can retry or turn voice off."); }, 12000);
    }
    attempt("advance");
  }
  // the repeatable test in a dismissible sheet — used by the settings toggle
  // (on enable) and the permanent "Test voice control" row.
  function openVoiceTestSheet(onClose) {
    const wrap = document.createElement("div");
    wrap.className = "confirm-scrim show";
    wrap.innerHTML = `<div class="confirm-box" style="text-align:left;max-width:330px">${voiceTestHTML()}</div>`;
    app.appendChild(wrap);
    let closed = false;
    const done = () => { if (closed) return; closed = true; if (wrap.parentNode) wrap.remove(); if (onClose) onClose(); };
    runVoiceTest(wrap.querySelector(".confirm-box"), done);
    wrap.onclick = (e) => { if (e.target === wrap) done(); };
    return done;
  }
  function wireVoiceOptin(onDone, box) {
    trackEvent("voice_optin_shown");
    const settle = (enabled) => {
      state.prefs.voiceCtrlAsked = true;
      if (enabled) state.prefs.voiceControl = true;
      saveProfile();
      if (enabled) trackEvent("voice_optin_enabled");
    };
    $("#voEnable").onclick = () => {
      settle(true);
      // NATIVE: a prior successful rehearsal (this install) + permission still granted → skip
      // it (re-run only after a failure/permission change, not every enable).
      if (isNativeVoice() && state.prefs.voiceRehearsedOk) { onDone(); return; }
      const host = box || $("#voEnable").closest("div");
      host.innerHTML = voiceTestHTML();
      runVoiceTest(host, () => onDone());
    };
    $("#voLater").onclick = () => { settle(false); onDone(); };
    return settle;   // the sheet variant calls settle(false) on scrim-dismiss
  }

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

  // ============================================================
  // CUE VOICE — pre-generated Kokoro audio, played as files.
  // Clips are generated OFFLINE (tools/gen-cue-voices.mjs, Kokoro am_michael +
  // other voices) and served from audio/voice/<voiceId>/<hash>.mp3. So it plays
  // hands-free on iPhone — there is NO model on the phone. speak(text) plays the
  // file whose name is a content hash of the exact line; a missing file is simply
  // silent (graceful). Michael is the free default + only free voice; the other
  // Kokoro voices are premium (their file sets are generated with the same script).
  // ============================================================
  const KOKORO_VOICES = [
    { id: "am_michael", label: "Michael · US male (deep)", premium: false },
    { id: "af_heart", label: "Heart · US female (warm)", premium: true },
    { id: "af_bella", label: "Bella · US female", premium: true },
    { id: "af_nicole", label: "Nicole · US female (soft)", premium: true },
    { id: "af_sky", label: "Sky · US female (bright)", premium: true },
    { id: "am_adam", label: "Adam · US male", premium: true },
    { id: "bf_emma", label: "Emma · UK female", premium: true },
    { id: "bm_george", label: "George · UK male", premium: true },
  ];
  const FREE_VOICE = "am_michael";
  // tiny silent clip — played inside the cook-start gesture to unlock the <audio> on iOS
  const SILENT_MP3 = "data:audio/mpeg;base64,//NAxAAAAANIAAAAAExBTUUDAAkIAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/80LEAAAAA0gAAAAATEFNRQMACQgABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRQMACQgABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/zQsQAAAADSAAAAABMQU1FAwAJCAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";
  // stable content hash (cyrb53) — MUST stay byte-identical to tools/gen-cue-voices.mjs
  function voiceHash(str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0, ch; i < str.length; i++) { ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507); h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507); h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }
  // voice sets that have been generated + deployed (add the premium sets here as they're built)
  const AVAILABLE_VOICES = ["am_michael"];
  // free users are locked to Michael; premium may use another voice, but only once its file
  // set exists — otherwise it falls back to Michael (no broken 404s / silence).
  const activeVoice = () => (isPremium() && AVAILABLE_VOICES.includes(state.prefs.kokoroVoice)) ? state.prefs.kokoroVoice : FREE_VOICE;
  // (The earlier iOS-duck volume-boost graph is GONE by design: the mic now
  // never opens while the voice speaks, so iOS has nothing to duck the
  // instruction against. The voice plays on the plain element at normal volume.)
  const VoicePlayer = {
    el: null, blobs: new Map(),
    speaking: false,   // true while a clip is playing — VoiceCtrl keys its mic sequencing off this
    _el() {
      if (!this.el) {
        this.el = new Audio();
        // These element events are the single source of truth for "the voice is
        // talking": they drive the music duck AND the voice-control mic gate
        // (mic closes on play, opens on ended — never both at once).
        // JOB 0 GAIN-LEAK FIX: on the native duck path the WebAudio gain must NEVER be ducked — the
        // ChoppdAudio session does the duck (system-level). The web <audio> element only plays SILENT
        // unlock clips on native, and el.onended is guarded (no _finish), so a VoiceDuck.down() here
        // would duck the graph gain to 0.10 and NEVER restore → the whole cook ran at 10%. Guard it.
        this.el.onplay = () => { this.speaking = true; if (!useNativeDuck()) VoiceDuck.down(); VoiceCtrl.onVoiceStart(); };
        // 1c: ONE onVoiceDone per play. onended (clip finished) + onerror (clip 404/failed) both
        // route through the latched _finish — a missing clip fires it once, not twice (the double
        // onVoiceDone → double mic-open that seeded the thrash). onpause is NOT a done signal:
        // it fires on interrupt/src-change and must never re-trigger a mic open.
        // On the NATIVE_DUCK path the <audio> element only ever plays the silent unlock clip — cue
        // clips go through ChoppdAudio (clipEnd drives _finish). So its onended/onerror must NOT
        // _finish there, or the silent-unlock's end would deactivate a real cue's duck session early.
        this.el.onended = () => { if (!useNativeDuck()) this._finish(); };
        this.el.onerror = () => { if (!useNativeDuck()) this._finish(); };
      }
      return this.el;
    },
    _done: true, _playToken: 0, _duckHold: false,
    // AM GATE DUCK-HOLD: enterWait(AM) calls holdDuck → the ChoppdAudio session stays ACTIVE through the
    // wait (AM keeps playing, ducked — the duck the founder praised). Voice clips inside the gate play
    // over it; their clip-end is suppressed (see _finish). exitWait(AM) calls releaseDuck → deactivate
    // with the runway → the song swells back where it naturally is. Local source uses Music muffle instead.
    holdDuck() {
      if (!useNativeDuck()) return;
      this._duckHold = true;
      const CA = choppdAudio(); if (CA) { try { CA.activate(); this._ndlog("GATE holdDuck (session active)"); } catch (e) { } }
    },
    releaseDuck() {
      this._duckHold = false;
      bumpCoordEpoch("releaseDuck");   // AUTHORITATIVE un-duck — this is the final session word; void any later teardown re-duck
      if (!useNativeDuck()) return;
      const CA = choppdAudio(); if (CA) { try { CA.deactivate(); this._ndlog("GATE releaseDuck (session off)"); } catch (e) { } }
    },
    _finish() {
      if (this._done) return; this._done = true;   // latched — exactly one onVoiceDone per play
      this.speaking = false;
      if (useNativeDuck()) {
        VoiceCtrl.onVoiceDone();                                        // mic gate (no VoiceDuck — WebAudio was never ducked)
        // AM GATE DUCK-HOLD: while a gate holds the duck, a voice clip ending must NOT release the session
        // (the duck stays through the whole wait — only exitWait's releaseDuck deactivates on confirm).
        if (this._duckHold) { this._ndlog("clipEnd — gate holds duck; session stays active"); return; }
        const CA = choppdAudio(); if (CA) { try { CA.deactivate(); this._ndlog("DEACTIVATE (duck off)"); } catch (e) { } }   // session un-ducks the music
        // Part B — the activate/deactivate can INTERRUPT the WKWebView's own local track (ctx suspends /
        // el pauses) and it never auto-resumes → the spine goes silent. Re-assert it: immediately + a
        // delayed retry (the AVAudioSession hand-back isn't instantaneous). kick() self-gates on _wantPlay
        // so it can't resurrect a paused/parked/stopped track. Eye-log the pipeline state each side.
        try { Music.kick(); this._ndlog("post-deactivate " + JSON.stringify(Music.audioState())); } catch (e) { }
        // §0 STEADY-STATE probe (mid-cue-gap): log the graph GAIN (should be 1.0 — proves it's not a gain
        // constant) alongside the ChoppdAudio SESSION category/mode/options (reveals a lingering
        // duck/voicePrompt = the release leak). This is the founder's diagnose-before-the-knob readout.
        setTimeout(() => {
          try {
            Music.kick();
            const st = JSON.stringify(Music.audioState());
            const CA2 = choppdAudio();
            if (CA2 && CA2.sessionState) CA2.sessionState().then((s) => this._ndlog("STEADY " + st + " session=" + JSON.stringify(s))).catch(() => this._ndlog("STEADY " + st));
            else this._ndlog("STEADY " + st);
          } catch (e) { }
        }, 350);
        return;
      }
      VoiceDuck.up(); VoiceCtrl.onVoiceDone();
    },
    // NATIVE_DUCK path: play the cue clip through ChoppdAudio (native AVAudioPlayer) so its .duckOthers
    // session ducks the WebView music UNDER the voice. clipStart/clipEnd (wired once) drive the mic
    // gate + _finish, token-guarded exactly like the web _playToken so a superseded clip can't finish
    // the current one. VoiceDuck (WebAudio ramp) is bypassed on this path — the session does the duck.
    _ndlog(m) { try { console.log("NDUCK " + m); } catch (e) { } },   // Eye-visible choreography trace (native-duck path only)
    _wireNative() {
      if (this._naWired) return; const CA = choppdAudio(); if (!CA) return; this._naWired = true;
      CA.addListener("clipStart", (e) => { if (e && e.token != null && e.token !== this._playToken) return; this._ndlog("clipStart tok=" + (e && e.token)); this.speaking = true; VoiceCtrl.onVoiceStart(); });
      CA.addListener("clipEnd", (e) => { if (e && e.token != null && e.token !== this._playToken) return; this._ndlog("clipEnd tok=" + (e && e.token)); this._finish(); });
    },
    _clipB64(url) {
      return fetch(url).then((r) => r.blob()).then((b) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(",")[1]); fr.onerror = rej; fr.readAsDataURL(b); }));
    },
    _playNative(text, token) {
      const CA = choppdAudio(); if (!CA) { this._finish(); return; }
      this._wireNative();
      this._ndlog("play tok=" + token + " (fetch clip)");
      this._clipB64(this.urlFor(text)).then(async (b64) => {
        if (this._playToken !== token) return;                       // superseded before it started
        try { await CA.activate(); this._ndlog("ACTIVATE (duck on) tok=" + token); } catch (e) { }   // duck ON — the music dips to the system floor
        this._ndlog("post-activate " + JSON.stringify(Music.audioState()));   // Part B: did activate DUCK the local track (playing, low) or INTERRUPT it (paused/suspended)?
        if (this._playToken !== token) { try { CA.deactivate(); } catch (e) { } return; }
        try { const r = await CA.playClip({ base64: b64, volume: 1, token }); this._ndlog("playClip ok=" + (r && r.ok) + " dur=" + (r && r.duration)); }   // clipStart→mic gate; clipEnd→_finish→deactivate
        catch (e) { this._ndlog("playClip FAIL " + (e && e.message)); if (this._playToken === token) this._finish(); }
      }).catch((e) => { this._ndlog("clip fetch FAIL " + (e && e.message)); if (this._playToken === token) this._finish(); });
    },
    // play the (truly silent) unlock clip inside the gesture — no muting, and always leave the
    // element unmuted at full volume so later cue plays are audible on iOS + desktop.
    unlock() { const el = this._el(); el.muted = false; el.volume = 1; try { el.src = SILENT_MP3; const p = el.play(); if (p && p.catch) p.catch(() => { }); } catch (e) { } },
    urlFor(text) { const h = voiceHash(text); return this.blobs.get(h) || (`audio/voice/${activeVoice()}/${h}.mp3`); },
    play(text) {
      if (!state.prefs.voice || !text) return;
      this._done = false;     // arm the latch for THIS play
      this.speaking = true;   // set synchronously so a checkpoint mounting in the same tick keeps the mic closed
      if (useNativeDuck()) { this._playNative(text, ++this._playToken); return; }   // native ChoppdAudio duck path (dark flag)
      const el = this._el(); el.muted = false; el.volume = 1;
      // Per-play token: when clip A is INTERRUPTED by clip B (e.g. the greeting → cue-0 at:0),
      // A's play() promise rejects (AbortError). Its .catch must NOT _finish() — B has already
      // re-armed the latch, and A firing _finish would steal B's latch so B's onended can't
      // restore the duck (the first-cue "music stays low until cue 2" bug). Only _finish on a
      // GENUINE failure of the CURRENT clip (404/decoding), i.e. the token still matches.
      const token = ++this._playToken;
      try { el.src = this.urlFor(text); el.currentTime = 0; const p = el.play(); if (p && p.catch) p.catch(() => { if (this._playToken === token) this._finish(); }); } catch (e) { this._finish(); }
    },
    stop() {
      this._done = true; this._playToken++;   // invalidate any in-flight native clip
      if (this.el) { try { this.el.pause(); } catch (e) { } }
      this.speaking = false;
      if (useNativeDuck()) { const CA = choppdAudio(); if (CA) { try { CA.stopClip(); } catch (e) { } try { CA.deactivate(); } catch (e) { } } return; }
      VoiceDuck.up();
    },
    // fetch a recipe's lines into blob URLs so each cue fires instantly (no network at fire time)
    async preload(texts) { const v = activeVoice(); for (const t of texts) { if (!t) continue; const h = voiceHash(t); if (this.blobs.has(h)) continue; try { const r = await fetch(`audio/voice/${v}/${h}.mp3`); if (r.ok) this.blobs.set(h, URL.createObjectURL(await r.blob())); } catch (e) { } } },
    reset() { this.blobs.forEach((u) => { try { URL.revokeObjectURL(u); } catch (e) { } }); this.blobs.clear(); },
  };
  window.__VoicePlayer = VoicePlayer;   // exposed for headless boost tests
  function speak(text) { VoicePlayer.play(text); }
  function stopVoice() { VoicePlayer.stop(); }
  // every static voiceable line for the active recipe: cue voice (+ own-playlist custom) + gate coaches + stir
  // Phase-1 (pre-phase) spoken lines: each step's voice + the doneness-gate + the transition.
  function prePhaseVoices(pp) {
    const out = [];
    if (!pp) return out;
    (pp.steps || []).forEach((s) => { if (s.voice) out.push(s.voice); });
    if (pp.gate && pp.gate.voice) out.push(pp.gate.voice);
    if (pp.transition && pp.transition.voice) out.push(pp.transition.voice);
    return out;
  }
  function activePrePhase() {
    return (EXP.id === "one-pot-garlic-parmesan-pasta") ? pastaPrePhase() : (EXP.id === "scrambled-eggs") ? eggsPrePhase() : (EXP.id === "chicken-fried-rice") ? friedricePrePhase() : (EXP.id === "pancakes") ? pancakesPrePhase() : (EXP.id === "teriyaki-chicken-bowl") ? teriyakiPrePhase() : (EXP.id === "loaded-quesadilla") ? quesadillaPrePhase() : (EXP.id === "upgraded-ramen") ? ramenPrePhase() : (EXP.id === "philly-cheesesteak") ? phillyPrePhase() : isSteakGrill() ? steakGrillPrePhase() : isChickenGrill() ? chickenGrillPrePhase() : isChickenPan() ? chickenPanPrePhase() : isSmash() ? smashPrePhase() : EXP.prePhase;
  }
  function recipeVoiceLines() {
    const cues = (EXP.id === "one-pot-garlic-parmesan-pasta") ? pastaCues() : (EXP.id === "scrambled-eggs") ? eggsCues() : isSteakGrill() ? steakGrillCues() : isSmash() ? smashCues() : mCues();
    const out = new Set();
    cues.forEach((c) => { if (c.voice) out.add(c.voice); if (c.custom && c.custom.voice) out.add(c.custom.voice); if (c.finishVoice) out.add(c.finishVoice); if (c.gate) ["notReadyCoach", "checkCoach", "doneCoach"].forEach((k) => c.gate[k] && out.add(c.gate[k])); });
    prePhaseVoices(activePrePhase()).forEach((v) => out.add(v));   // Phase-1 step voices (preload before preCook)
    out.add("Okay — time to stir.");
    return [...out];
  }
  const preloadRecipeVoices = () => VoicePlayer.preload(recipeVoiceLines());
  // legacy shims (old call sites): the live in-browser model is gone — nothing to load.
  const isKokoro = () => true;
  const ensureKokoroLoaded = async () => true;
  const pregenKokoro = () => preloadRecipeVoices();
  // DEV: enumerate every distinct voiceable line across recipes + selection variants using
  // the REAL transforms, so generated clips can never drift from what the app speaks.
  // tools/gen-cue-voices.mjs reads this (via a headless page) to know what to generate.
  // DEV: enumerate every SCREEN-RENDERED step text across recipes + variants (real
  // transforms) for the one-screen budget check — same skeleton as __voiceLines.
  window.__screenSteps = function () {
    const rows = [];
    const cueText = (c) => Math.max((c.body || "").length, (c.beginner || "").length) + (c.warning ? c.warning.length : 0);
    const grab = (rid, variant, cues) => (cues || []).forEach((c) => { if (!c) return; rows.push({ kind: "cue", rid, variant, title: c.title || "", chars: cueText(c), img: !!c.referenceImage }); });
    const grabPrep = (rid, variant, steps) => (steps || []).forEach((st) => { if (!st) return; rows.push({ kind: "prep", rid, variant, title: st.title || "", chars: (st.instructions || "").length + (Array.isArray(st.techniqueGuide) ? st.techniqueGuide.join("").length : 0), img: !!st.referenceImage }); });
    const grabPre = (rid, variant, pp) => { if (!pp) return; (pp.steps || []).forEach((st) => rows.push({ kind: "prephase", rid, variant, title: st.title || "", chars: (st.body || "").length + (st.timerNote || "").length, img: !!st.referenceImage })); if (pp.timer && pp.timer.note) rows.push({ kind: "prephase", rid, variant, title: "(timer)", chars: pp.timer.note.length, img: !!pp.timer.referenceImage }); };
    const save = { EXP, eggFat, eggStove, cookLiquid, cookMethod, heat: state.equipment.heat, chick: addIns.chicken };
    (window.EXPERIENCES || []).forEach((exp) => {
      EXP = exp;
      grabPrep(exp.id, "base", exp.prepSteps);
      (exp.methods || []).forEach((m) => grabPrep(exp.id, m.id, m.prepSteps));
      if (exp.id === "scrambled-eggs") {
        ["gas", "electric"].forEach((st) => { eggStove = st; eggFat = "butter"; grab(exp.id, "eggs-" + st, eggsCues()); grabPre(exp.id, "eggs-" + st, eggsPrePhase()); });
        eggStove = "gas";
      } else if (exp.id === "one-pot-garlic-parmesan-pasta") {
        ["chicken", "waterbutter"].forEach((l) => { cookLiquid = l; ["gas", "electric"].forEach((h) => { state.equipment.heat = h; grab(exp.id, l + "-" + h, pastaCues()); [false, true].forEach((ch) => { addIns.chicken = ch; grabPre(exp.id, l + "-" + h + (ch ? "-chick" : ""), pastaPrePhase()); }); }); });
        addIns.chicken = save.chick; grabPrep(exp.id, "wizard", prepStepsFor());
      } else if (Array.isArray(exp.methods) && exp.methods.length) {
        exp.methods.forEach((m) => { cookMethod = m.id; grab(exp.id, m.id, mCues());
          if (exp.id === "freebird-medium-rare-steak" && m.id === "grill") grabPre(exp.id, "grill", steakGrillPrePhase());
          if (exp.id === "crispy-chicken-thighs") { if (m.id === "grill") grabPre(exp.id, "chicken-grill", chickenGrillPrePhase()); else { ["gas", "electric"].forEach((h) => { state.equipment.heat = h; grabPre(exp.id, "chicken-pan-" + h, chickenPanPrePhase()); }); } }
          if (exp.id === "smash-burgers") { const sp = portionCount; [1, 2].forEach((p) => { portionCount = p; grab(exp.id, m.id + "-p" + p, smashCues()); }); portionCount = sp; grabPre(exp.id, "smash", smashPrePhase()); }
          if (exp.id === "ground-beef-tacos") { grabPrep(exp.id, m.id, prepStepsFor()); grabPre(exp.id, m.id, activePrePhase()); }   // prep seasoning step splits per method; + phase-1 preheat
          if (exp.id === "upgraded-ramen") { grabPrep(exp.id, m.id, prepStepsFor()); ["gas", "electric"].forEach((h) => { state.equipment.heat = h; grabPre(exp.id, m.id + "-" + h, activePrePhase()); }); }   // method-split station + method+stove-split boil
          if (exp.id === "philly-cheesesteak") { grabPrep(exp.id, m.id, prepStepsFor()); ["gas", "electric"].forEach((h) => { state.equipment.heat = h; grabPre(exp.id, m.id + "-" + h, activePrePhase()); }); }   // method-split beef prep + stove-split preheat
        });
      } else if (exp.id === "chicken-fried-rice") {
        cookMethod = null; grab(exp.id, "base", mCues());
        ["gas", "electric"].forEach((h) => { state.equipment.heat = h; grabPre(exp.id, "cfr-" + h, friedricePrePhase()); });
      } else if (exp.id === "pancakes") {
        cookMethod = null; grab(exp.id, "base", mCues());
        ["gas", "electric"].forEach((h) => { state.equipment.heat = h; grabPre(exp.id, "pancakes-" + h, pancakesPrePhase()); });   // stove-split preheat clock/note
      } else if (exp.id === "teriyaki-chicken-bowl") {
        cookMethod = null; grab(exp.id, "base", mCues());   // mCues = full list incl. the opt broccoli tip (budget check needs it)
        ["gas", "electric"].forEach((h) => { state.equipment.heat = h; grabPre(exp.id, "teriyaki-" + h, teriyakiPrePhase()); });   // stove-split shimmer clock/note
      } else if (exp.id === "loaded-quesadilla") {
        cookMethod = null; grab(exp.id, "base", mCues());   // mCues = full list incl. the opt protein load cue
        ["gas", "electric"].forEach((h) => { state.equipment.heat = h; grabPre(exp.id, "quesadilla-" + h, quesadillaPrePhase()); });   // stove-split preheat clock/note
      } else { cookMethod = null; grab(exp.id, "base", mCues()); grabPre(exp.id, "base", exp.prePhase); }
    });
    EXP = save.EXP; eggFat = save.eggFat; eggStove = save.eggStove; cookLiquid = save.cookLiquid; cookMethod = save.cookMethod; state.equipment.heat = save.heat; addIns.chicken = save.chick;
    return rows;
  };
  // DEV: render the eggs recipe through the REAL transforms for one fat+stove —
  // the fat-variant matrix test reads this (butter leak sweep, images, gates).
  window.__eggsFatProbe = function (fat, stove) {
    const save = { EXP, eggFat, eggStove };
    EXP = (window.EXPERIENCES || []).find((e) => e.id === "scrambled-eggs");
    eggFat = fat; eggStove = stove || "gas";
    const cues = eggsCues().map((c) => ({ title: c.title, body: c.body, beginner: c.beginner, voice: c.voice, img: c.referenceImage || null, coaches: c.gate ? [c.gate.notReadyCoach, c.gate.checkCoach, c.gate.doneCoach].filter(Boolean) : [] }));
    const prep = eggsPrepSteps().map((st) => ({ title: st.title, instructions: st.instructions, voice: st.voice, guide: (st.techniqueGuide || []).join(" | ") }));
    const ings = eggsIngredients().map((i) => i.name);
    EXP = save.EXP; eggFat = save.eggFat; eggStove = save.eggStove;
    return { cues, prep, ings };
  };
  // format-checker support: every PREHEAT pre-phase (one with a heat-up timer whose
  // gate is a readiness check) must ship skipWarning copy now that preheats are always
  // skippable. Returns any offenders (pasta's cook-phase pre-phase has no skipWarning
  // and is correctly excluded — it's a cook, not a preheat).
  window.__preheatSkipAudit = function () {
    const save = { EXP, cookMethod, heat: state.equipment.heat };
    const rows = [];
    (window.EXPERIENCES || []).forEach((exp) => {
      EXP = exp; const methods = (exp.methods && exp.methods.length) ? exp.methods.map((m) => m.id) : [null];
      methods.forEach((mid) => { cookMethod = mid; try { const pp = activePrePhase(); if (pp && pp.timer && pp.timer.phaseLabel === "preheat") rows.push({ id: exp.id, method: mid, hasSkipWarning: !!pp.skipWarning, title: pp.title }); } catch (e) { /* skip */ } });
    });
    EXP = save.EXP; cookMethod = save.cookMethod; state.equipment.heat = save.heat;
    return { preheats: rows, missing: rows.filter((r) => !r.hasSkipWarning) };
  };
  window.__voiceLines = function () {
    const set = new Set();
    const grab = (cues) => cues.forEach((c) => { if (!c) return; if (c.voice) set.add(c.voice); if (c.custom && c.custom.voice) set.add(c.custom.voice); if (c.finishVoice) set.add(c.finishVoice); if (c.gate) ["notReadyCoach", "checkCoach", "doneCoach"].forEach((k) => c.gate[k] && set.add(c.gate[k])); });
    const save = { EXP, eggFat, cookLiquid, cookMethod, heat: state.equipment.heat };
    const grabPrep = (steps) => (steps || []).forEach((st) => { if (st && st.voice) set.add(st.voice); });
    (window.EXPERIENCES || []).forEach((exp) => {
      EXP = exp;
      grabPrep(exp.prepSteps);
      (exp.methods || []).forEach((m) => grabPrep(m.prepSteps));
      if (exp.id === "one-pot-garlic-parmesan-pasta") { const sc = addIns.chicken; [false, true].forEach((ch) => { addIns.chicken = ch; grabPrep(prepStepsFor()); }); addIns.chicken = sc; }
      if (exp.id === "scrambled-eggs") { ["gas", "electric"].forEach((st) => { eggStove = st; ["butter", "vegetable", "olive", "canola", "spray"].forEach((f) => { eggFat = f; grab(eggsCues()); }); }); eggStove = "gas"; prePhaseVoices(eggsPrePhase()).forEach((v) => set.add(v)); }
      else if (exp.id === "one-pot-garlic-parmesan-pasta") {
        ["chicken", "vegetable", "waterbutter", "bouillon"].forEach((l) => { cookLiquid = l;["gas", "electric"].forEach((h) => { state.equipment.heat = h; grab(pastaCues()); }); });
        // Phase-1 step voices: static, but the set of steps varies by liquid (bouillon) + chicken add-in
        const savedChick = addIns.chicken;
        // prePhase voices vary by stove (butter step) AND liquid (bouillon/waterbutter/broth) AND the chicken add-in
        [false, true].forEach((ch) => { addIns.chicken = ch; ["gas", "electric"].forEach((h) => { state.equipment.heat = h; ["chicken", "vegetable", "waterbutter", "bouillon"].forEach((l) => { cookLiquid = l; prePhaseVoices(pastaPrePhase()).forEach((v) => set.add(v)); }); }); });
        addIns.chicken = savedChick;
      }
      else if (Array.isArray(exp.methods) && exp.methods.length) {
        exp.methods.forEach((m) => {
          cookMethod = m.id; grab(mCues());
          if (exp.id === "smash-burgers") { prePhaseVoices(smashPrePhase()).forEach((v) => set.add(v)); grabPrep(prepStepsFor()); }
          if (exp.id === "ground-beef-tacos") { grabPrep(prepStepsFor()); prePhaseVoices(activePrePhase()).forEach((v) => set.add(v)); }   // packet vs homemade prep voices + phase-1 preheat
          // steak grill: butter-conditional finish variants + the grill pre-phase lines
          if (exp.id === "freebird-medium-rare-steak" && m.id === "grill") {
            [true, false].forEach((b) => grab(steakGrillCues(b)));
            prePhaseVoices(steakGrillPrePhase()).forEach((v) => set.add(v));
          }
          // chicken: pan preheat (stove-independent voices) + grill two-zone preheat
          if (exp.id === "crispy-chicken-thighs") {
            if (m.id === "grill") prePhaseVoices(chickenGrillPrePhase()).forEach((v) => set.add(v));
            else prePhaseVoices(chickenPanPrePhase()).forEach((v) => set.add(v));
          }
          if (exp.id === "smash-burgers") { const sp = portionCount; [1, 2].forEach((p) => { portionCount = p; grab(smashCues()); }); portionCount = sp; }
          if (exp.id === "upgraded-ramen") { grabPrep(prepStepsFor()); ["gas", "electric"].forEach((h) => { state.equipment.heat = h; prePhaseVoices(activePrePhase()).forEach((v) => set.add(v)); }); }   // method-split station voices + method+stove-split boil gate/transition voices
          if (exp.id === "philly-cheesesteak") { grabPrep(prepStepsFor()); ["gas", "electric"].forEach((h) => { state.equipment.heat = h; prePhaseVoices(activePrePhase()).forEach((v) => set.add(v)); }); }   // method-split beef prep voices + stove-split preheat gate/transition voices
        });
      }
      else if (exp.id === "chicken-fried-rice") { cookMethod = null; grab(mCues()); prePhaseVoices(friedricePrePhase()).forEach((v) => set.add(v)); }
      else if (exp.id === "pancakes") { cookMethod = null; grab(mCues()); prePhaseVoices(pancakesPrePhase()).forEach((v) => set.add(v)); }   // preheat step/gate/transition voices (stove-independent)
      else if (exp.id === "teriyaki-chicken-bowl") { cookMethod = null; grab(mCues()); prePhaseVoices(teriyakiPrePhase()).forEach((v) => set.add(v)); }   // cues (incl. opt broccoli tip) + shimmer gate/transition voices
      else if (exp.id === "loaded-quesadilla") { cookMethod = null; grab(mCues()); prePhaseVoices(quesadillaPrePhase()).forEach((v) => set.add(v)); }   // cues (incl. opt protein cue) + water-drop gate/transition voices
      else { cookMethod = null; grab(mCues()); }
      // dynamic cook-start greeting (per song, beginner + non-beginner forms)
      const song = exp.song && exp.song.title;
      if (song && !exp.noMusic) { set.add(`Alright — I've got you. ${song} is rolling, let's cook.`); set.add(`Let's cook. ${song} is rolling.`); }
      if (exp.noMusic) { set.add("Alright — I've got you. Let's cook."); set.add("Let's cook."); }
    });
    EXP = save.EXP; eggFat = save.eggFat; cookLiquid = save.cookLiquid; cookMethod = save.cookMethod; state.equipment.heat = save.heat;
    set.add("Okay — time to stir."); set.add(VOICE_SAMPLE);
    // own-playlist greetings + hardcoded speak() fallbacks that aren't in the recipe data
    ["Alright — I've got you. Your music's rolling, let's cook.", "Let's cook. Your music's rolling.",
      "No rush. Tap continue when you're ready.", "Ready? Tap continue when you are.", "Voice on."].forEach((s) => set.add(s));
    Object.values(VOICE_REHEARSAL).forEach((r) => set.add(r.line));   // the web practice-checkpoint lines
    Object.values(NATIVE_REHEARSAL_LINES).forEach((s) => set.add(s));  // the native mic-check rehearsal lines
    return [...set].filter(Boolean);
  };

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

  // Kokoro voices only. Michael is free + the only free option; the rest are Premium
  // (server-checked). Locked voices show but can't be selected without Premium.
  function fillVoiceSelect() {
    const sel = app.querySelector("#voiceSel");
    if (!sel) return;
    const prem = isPremium();
    sel.innerHTML = `<optgroup label="🎙 Kokoro voices">` + KOKORO_VOICES.map((v) => {
      const locked = v.premium && !prem;
      const tag = v.premium ? (locked ? " · 🔒 Premium" : " · Premium") : " · Free";
      return `<option value="${v.id}"${locked ? " disabled" : ""}>${v.label}${tag}</option>`;
    }).join("") + `</optgroup>`;
    sel.value = activeVoice();
    const hint = app.querySelector("#voiceHint");
    if (hint && !hint.textContent) hint.textContent = prem
      ? "Deep, natural neural voices — pre-recorded, so they play hands-free on any phone."
      : "Michael is your free cooking voice — natural, and hands-free on any phone. More voices with Premium.";
  }

  const VOICE_SAMPLE = "Hi, this is Michael. I'll read each step out loud while you cook.";
  function previewVoice() {
    const saved = state.prefs.voice; state.prefs.voice = true;
    // The ▶ tap is our gesture: a single play() unlocks the element AND plays the sample.
    // (Don't call unlock() first — the back-to-back silent-play then sample-play race, which
    // is what made the preview silent.)
    VoicePlayer.play(VOICE_SAMPLE);
    state.prefs.voice = saved;
  }

  function wireVoicePicker() {
    const sel = app.querySelector("#voiceSel");
    if (!sel) return;
    fillVoiceSelect();
    sel.onchange = () => {
      const id = sel.value;
      const v = KOKORO_VOICES.find((x) => x.id === id);
      if (v && v.premium && !isPremium()) { sel.value = activeVoice(); toast("That voice is Premium ⭐"); if (screens.premium) screens.premium(); return; }
      state.prefs.kokoroVoice = id; state.prefs.voiceURI = id; state.prefs.engine = "kokoro";
      VoicePlayer.reset();                 // drop old-voice blobs; new voice preloads on next cook
      previewVoice();
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
      ? `<span style="color:var(--success);font-weight:700">✅ Loaded — plays with the cues</span>`
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
      box.addEventListener("dragover", (e) => { e.preventDefault(); box.style.borderColor = "var(--brand)"; });
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
        <img class="hero-logo" src="assets/logo.png?v=4" alt="Choppd logo" />
        <img class="brand-wordmark welcome-wordmark" src="assets/wordmark.svg?v=1" alt="Choppd" />
        <h1 style="margin-top:10px">One guy. One pan.<br>One <span class="gradient-text">real dinner</span>.</h1>
        <p class="lead" style="margin-top:14px">Recipes built for the person actually cooking them — portioned for you, timed to a clock, no four-serving fiction.</p>
      </div>
      <div class="mt-auto" style="margin-top:34px">
        <button class="btn gradient" id="login">Let's cook 🔥</button>
        <button class="btn ghost" id="create" style="margin-top:10px;color:var(--muted)">Create account</button>
      </div>
    `));
    $("#login").onclick = () => { returningLogin = true; screens.login(); };
    $("#create").onclick = () => { returningLogin = false; screens.login(); };
  };

  // ---- Sign in (Google OAuth, with email-OTP fallback for dev/offline) ----
  // approved throttle string with the live {time}; and the approved verify-error strings
  function resendThrottleMsg(sec) {
    const s = Math.max(1, Math.round(sec || 60));
    const t = s < 60 ? `${s} seconds` : `${Math.ceil(s / 60)} minute${Math.ceil(s / 60) > 1 ? "s" : ""}`;
    return `Easy — you can request another in ${t}.`;
  }
  function verifyErrMsg(err) {
    if (err === "expired") return "That one expired. Grab a fresh code.";
    if (err === "too-many") return "Too many tries — request a new code.";
    return "That code isn't right — check the digits and go again.";   // bad-code + default
  }
  screens.login = () => {
    const native = isNativePlatform();   // NATIVE: OTP is the ONLY door — no Google button (Apple Guideline 4.8)
    // NATIVE + no backend → the app MUST NOT present a working fake sign-in. The web offline
    // demo (any email, pre-filled code) is a local-demo convenience; on a shipped native app
    // an unreachable server is a real error, not a demo. Show an honest can't-connect state.
    if (native && !backendOn()) return screens.offlineNative();
    const googleReady = backendOn() && !!API.googleClientId && !native;   // WEB shows BOTH doors; native hides Google
    // OTP is the universal path — always visible (web AND native). The old prod-web Google-only gate is removed.
    h(screenEl("", `
      <img class="login-logo" src="assets/logo.png?v=4" alt="Choppd logo" />
      <p class="eyebrow">Step 1 · Sign in</p>
      <h1 style="margin-top:10px">${googleReady ? "Welcome to Choppd" : "What's your email?"}</h1>
      <p class="lead" style="margin-top:10px">${googleReady ? "Sign in so your cooks, streak, and Premium follow you around. No passwords, ever." : "We'll text your inbox a 6-digit code. No passwords, ever."}</p>
      <div class="stack" style="margin-top:24px">
        ${googleReady ? `<div id="gbtn" style="display:flex;justify-content:center;min-height:44px"></div>` : ""}
        ${googleReady ? `<p class="muted" style="text-align:center;font-size:12px;margin:2px 0">or</p>` : ""}
        <input class="field" id="email" type="email" placeholder="you@email.com" autocomplete="email" />
        <button class="btn ${googleReady ? "ghost" : ""}" id="send">Send code</button>
      </div>
      ${!backendOn() && !native ? `<p class="muted" style="font-size:12px;margin-top:14px">Demo: any email works, code is pre-filled.</p>` : ""}
    `));
    if (googleReady) mountGoogleSignIn("gbtn");
    $("#send").onclick = async () => {
      const v = $("#email").value.trim();
      if (!v || !v.includes("@")) { toast("Enter a valid email"); return; }
      state.email = v;
      pendingDevCode = null;
      if (backendOn()) {
        const btn = $("#send"); btn.disabled = true; btn.textContent = "Sending…";
        try { const r = await API.requestCode(v); pendingDevCode = r.devCode || null; }
        catch (e) {
          btn.disabled = false; btn.textContent = "Send code";
          if (e && e.status === 429) { toast(resendThrottleMsg(e.data && e.data.retryAfterSec)); return; }
          if (e && e.message === "send-failed") { toast("Couldn't send the code — try again in a moment."); return; }   // NOT in approved set (flagged)
          toast("Couldn't reach the server — try again."); return;   // NOT in approved set (flagged)
        }
      }
      screens.otp();
    };
  };

  // NATIVE-ONLY: honest "can't reach the kitchen" screen. Reached only when isNativePlatform()
  // AND the backend is unreachable — the offline demo (fake sign-in) is web-only and never
  // renders here. A retry re-inits the API and returns to the real sign-in once reachable.
  screens.offlineNative = () => {
    // Dev-visible detail line: the ACTUAL probe failure (URL · status/error) so a native
    // connectivity bug is never a guessing game again. Full detail also in the console tell.
    const p = (window.API && API.lastProbe) || null;
    const detail = p ? `${p.url} · ${p.error ? p.error : ("HTTP " + p.status)}` : "no probe yet";
    h(screenEl("", `
      <img class="login-logo" src="assets/logo.png?v=4" alt="Choppd logo" />
      <p class="eyebrow">Connection</p>
      <h1 style="margin-top:10px">Can't reach the kitchen</h1>
      <p class="lead" style="margin-top:10px">We couldn't connect to Choppd. Check your internet and try again.</p>
      <div class="stack" style="margin-top:24px">
        <button class="btn" id="retry">Try again</button>
      </div>
      <p class="muted" style="font-size:11px;margin-top:16px;text-align:center;word-break:break-word;opacity:.7">${esc(detail)}</p>
    `));   /* strings DRAFT-PENDING-VOICE-REVIEW */
    $("#retry").onclick = async () => {
      const btn = $("#retry"); btn.disabled = true; btn.textContent = "Reconnecting…";
      try { await API.init(); } catch (e) { }
      if (backendOn()) screens.login();
      else { btn.disabled = false; btn.textContent = "Try again"; screens.offlineNative(); }   // re-render with the fresh probe detail
    };
  };

  screens.otp = () => {
    const native = isNativePlatform();
    // prefill ONLY under dev (devAuth ⇒ dev build); prod never prefills. The web offline demo
    // prefills the fixed code — NEVER on native (no fake sign-in on the shipped app).
    const prefill = backendOn() ? (API.devAuth && pendingDevCode ? pendingDevCode : "") : (native ? "" : "481516");
    h(screenEl("", `
      <p class="eyebrow">Step 1 · Verify</p>
      <h1 style="margin-top:10px">Check your inbox</h1>
      <p class="lead" style="margin-top:10px">Code's on its way to <b style="color:var(--text)">${state.email}</b>.</p>
      <div class="stack" style="margin-top:24px">
        <input class="field" id="code" inputmode="numeric" maxlength="6" value="${prefill}"
          style="letter-spacing:10px;text-align:center;font-size:24px;font-weight:700" />
        <button class="btn" id="verify">Verify & continue</button>
        <button class="btn ghost" id="back">Use a different email</button>
        <button class="btn ghost" id="resend">Didn't get it? Resend</button>
      </div>
      ${backendOn() && API.devAuth && pendingDevCode ? `<p class="muted" style="font-size:11px;margin-top:10px;text-align:center">Dev — code <b>${pendingDevCode}</b></p>` : ""}
    `));
    $("#verify").onclick = async () => {
      if (backendOn()) {
        const code = $("#code").value.trim();
        const btn = $("#verify"); btn.disabled = true; btn.textContent = "Verifying…";
        try {
          const { token, user } = await API.verify(state.email, code);
          API.setToken(token); afterServerLogin(user);
        } catch (e) { btn.disabled = false; btn.textContent = "Verify & continue"; toast(verifyErrMsg(e && e.message)); }
        return;
      }
      // NATIVE never fakes a sign-in — an unreachable backend is an honest error, not a demo.
      if (native) return screens.offlineNative();
      // offline demo (WEB only): returning user with a saved profile skips onboarding
      if (returningLogin && hasProfile()) { loadProfile(); toast("Welcome back 🍳"); screens.home(); }
      else screens.disclaimer();
    };
    $("#back").onclick = () => screens.login();
    $("#resend").onclick = async () => {
      if (!backendOn()) { if (native) return screens.offlineNative(); toast("Demo — code is pre-filled."); return; }
      const btn = $("#resend"); btn.disabled = true; btn.textContent = "Resending…";
      try {
        const r = await API.requestCode(state.email); pendingDevCode = r.devCode || null;
        btn.textContent = "Sent ✓"; setTimeout(() => { const b = $("#resend"); if (b) { b.disabled = false; b.textContent = "Didn't get it? Resend"; } }, 3000);
        if (API.devAuth && pendingDevCode) screens.otp();   // refresh the dev prefill
      } catch (e) {
        btn.disabled = false; btn.textContent = "Didn't get it? Resend";
        if (e && e.status === 429) { toast(resendThrottleMsg(e.data && e.data.retryAfterSec)); return; }
        toast("Couldn't send the code — try again in a moment.");   // NOT in approved set (flagged)
      }
    };
  };

  // ---- Safety disclaimer ----
  screens.disclaimer = () => {
    h(screenEl("", `
      <p class="eyebrow">Step 2 · Stay safe</p>
      <h1 style="margin-top:10px">Quick safety check 🔪🔥</h1>
      <div class="card" style="margin-top:20px">
        <p class="lead" style="color:var(--text)">Cooking involves <b>high heat, hot oil, sharp knives, and raw meat</b>. Choppd gives guidance, but you're in charge of your kitchen.</p>
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
      <div class="dots"><span class="on"></span><span></span></div>
      <p class="eyebrow">Step 3 · About you</p>
      <h1 style="margin-top:10px">How much have<br>you cooked?</h1>
      <p class="lead" style="margin-top:10px">No judgment — this just sets how much we guide you.</p>
      <div class="stack" style="margin-top:24px">
        ${EXPERIENCE_LEVELS.map((e) => `<button class="choice" data-v="${e.id}"><span class="emoji">${e.emoji}</span><span>${e.label}<small>${e.blurb}</small></span></button>`).join("")}
      </div>
    `));
    // The pan primer now lives inline on the equipment step (choose + learn at once).
    $$(".choice").forEach((c) => c.onclick = () => { setExperience(c.dataset.v); screens.connect(); });
  };
  // Cuisine + equipment asks were CUT from onboarding (2026-07-07): cuisines stays a
  // null-tolerant pref (browse taste-boost degrades gracefully until set); pan + stove
  // moved to the per-recipe pre-cook gate (panStoveGate) where the answers have context.

  // ---- Onboarding: optional hands-free voice control (supported browsers only) ----
  screens.onboardVoice = () => {
    if (!VoiceCtrl.supported()) { screens.firstPreview(); return; }   // no ask, flag stays unset
    h(screenEl("center", `<div id="voBox">${voiceOptinCardHTML()}</div>`));
    wireVoiceOptin(() => screens.firstPreview(), $("#voBox"));
  };

  // ---- Music: curated royalty-free tracks are the default for everyone ----
  // (No connected service: Spotify's API is closed to us, Apple Music isn't built.
  // Every recipe ships a matched royalty-free track — see cues.js `audioFile`.)
  screens.connect = () => {
    h(screenEl("", `
      <div class="dots"><span class="on"></span><span class="on"></span></div>
      <p class="eyebrow">Step 4 · Music</p>
      <h1 style="margin-top:10px">Your kitchen<br>soundtrack 🎧</h1>
      <p class="lead" style="margin-top:10px">Choppd syncs cooking cues to music automatically. Every recipe comes with a track picked to match it — the Free Bird steak cook is on us.</p>
      <div class="stack" style="margin-top:22px">
        <div class="choice selected" id="useSizle">
          <span class="emoji">🎵</span>
          <span>Use Choppd's music<small>Curated tracks, synced to every recipe.</small></span>
          <span class="music-tag">✓ Default</span>
        </div>
      </div>
      <div style="margin-top:22px">${voicePickerHTML()}</div>
      <div class="mt-auto" style="margin-top:24px">
        <button class="btn" id="start">Start cooking 🎸</button>
      </div>
    `));
    wireVoicePicker();
    $("#start").onclick = () => screens.onboardVoice(); // optional hands-free ask, then the watch-along preview
  };

  // ---- real per-recipe stats (cooks + avg rating) under each recipe card ----
  // Keyed by recipe title (what cook_sessions stores). Rendered as placeholders,
  // then filled from the backend after a fetch; cached so re-renders don't flicker.
  // GATED per recipe by the server-side show_cook_count flag (default OFF for
  // every recipe — low counts hurt trust). /api/recipes/stats only returns
  // recipes an admin flagged on (admin → Cook Counts tab), so with no flags set
  // nothing renders here. Counts keep accumulating server-side regardless.
  function recipeStatText(title) {
    if (!recipeStats) return ""; // not loaded yet — applyRecipeStats fills it in
    const s = recipeStats[title];
    if (!s || !s.show) return ""; // hidden (the default): no count line, no zero-state nudge
    if (!s.cooks) return "✨ Be the first to cook this";
    const stars = s.rating != null ? ` · ${Number(s.rating).toFixed(1)}★` : "";
    return `🔥 ${s.cooks.toLocaleString()} ${s.cooks === 1 ? "cook" : "cooks"}${stars}`;
  }
  // The placeholder <p> always renders (so a late stats fetch can fill it in)
  // but stays `hidden` while empty — no blank line/orphaned gap on the cards.
  function statLineHTML(title, style = "") {
    const t = recipeStatText(title);
    return `<p class="muted recipe-stat" data-recipe="${esc(title)}" style="font-size:12px;${style}"${t ? "" : " hidden"}>${t}</p>`;
  }
  function applyRecipeStats() { $$(".recipe-stat").forEach((el) => { const t = recipeStatText(el.dataset.recipe); el.textContent = t; el.hidden = !t; }); }
  async function refreshRecipeStats() {
    if (backendOn()) { try { const d = await API.recipeStats(); recipeStats = d.stats || {}; } catch (e) { } }
    applyRecipeStats();
  }

  // ============================================================
  // FRIDGE SCAN — photo → detected ingredients → recipe matches.
  // PRIVACY: photos are compressed on-device (EXIF/location stripped by the
  // canvas re-encode), sent once, processed in memory server-side, and
  // DISCARDED — never stored. Only canonical ingredient ids persist.
  // ============================================================
  let scanVocab = null;            // [{id,label,staple}] — fetched once
  // AI-idea card copy — swappable block, DRAFT-PENDING-VOICE-REVIEW.
  const IDEA_COPY = {
    usesLead: "uses",
    confirmed: "On the list — your fridge just voted.",
    failed: "Couldn't save that — try again.",
    notLoading: "Ideas aren't loading — your scan still works.",
  };
  let scanState = { ids: [], other: [], uncertain: [], scanId: null, quality: "ok" };
  // DEV: headless AI-ideas verification (mirrors __receipt/__skills/__streak). Renders the
  // scan-results screen with supplied concepts so tests can assert cards/chips/tap without
  // driving a full scan. Harmless; no effect on the product path.
  window.__ideas = { render: async (concepts, ids, failed) => { try { await loadScanVocab(); } catch (e) { } if (ids) { scanState.ids = ids.slice(); scanState.confirmedIds = ids.slice(); } screens.scanResults([], concepts || [], 2, !!failed); } };
  const MAX_SCAN_PHOTOS_FREE = 3;   // per-tier resolver (premium hook, same pattern as the model ladder)
  const maxScanPhotos = () => MAX_SCAN_PHOTOS_FREE;
  // ① Capture ② Ingredients ③ Recipes — the persistent progress rail (flame current, ✓ done, muted future)
  function scanRailHTML(step) {
    const items = ["① Capture", "② Ingredients", "③ Recipes"];
    return `<div class="brand-lockup scan-brand"><img class="brand-logo" src="assets/logo.png?v=4" alt="" aria-hidden="true" /><img class="brand-wordmark" src="assets/wordmark.svg?v=1" alt="Choppd" /></div>
    <div class="scan-rail">${items.map((t, i) => `<span class="sr-step ${i < step ? "done" : i === step ? "on" : ""}">${i < step ? "✓ " + t.slice(2) : t}</span>`).join("<i class='sr-line'></i>")}</div>`;
  }

  // ---- Part 2: in-app live camera (getUserMedia; native picker = the standing fallback) ----
  let camStream = null;
  function camTeardown() {
    if (camStream) { try { camStream.getTracks().forEach((t) => t.stop()); } catch (e) { } camStream = null; }
  }
  screens.scanCamera = async () => {
    // scanning must never be blocked by the camera: unsupported → picker path
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) { trackEvent("camera_fallback_used"); return screens.scanCapture(true); }
    if (!state.prefs.photoTipsSeen) {
      state.prefs.photoTipsSeen = true; saveProfile();
      h(screenEl("center", `
        <div class="finish-hero"><div class="big-emoji" style="font-size:56px">📸</div>
        <p class="eyebrow" style="margin-top:10px">Photo tips</p>
        <h1 style="margin-top:8px">Four rules for a<br>fuller find</h1>
        <p class="lead" style="margin-top:14px;text-align:left">🚪 Open the fridge WIDE — get the whole shelf in frame
🔄 One shot per zone: shelves, door, drawers
🥫 Pantry and counter work too
💡 More light = more found</p></div>
        <div class="mt-auto" style="margin-top:24px"><button class="btn" id="tipsGo">Got it</button></div>`));
      $("#tipsGo").onclick = () => screens.scanCamera();
      return;
    }
    const photos = [];   // {blob, url}
    h(`<section class="cam" id="cam">
      ${scanRailHTML(0)}
      <div class="cam-view"><video id="camVideo" autoplay playsinline muted></video>
        <div class="cam-corners"><i></i><i></i><i></i><i></i></div>
        <button class="cam-x" id="camClose">✕</button>
        <button class="cam-torch" id="camTorch" hidden>🔦</button>
      </div>
      <div class="cam-strip" id="camStrip"></div>
      <div class="cam-controls">
        <button class="btn secondary" id="camGallery">🖼 Gallery</button>
        <button class="cam-shutter" id="camShutter" aria-label="Take photo"></button>
        <button class="btn" id="camDone" disabled>Done →</button>
      </div>
    </section>`);
    const video = $("#camVideo");
    try {
      camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 2048 } }, audio: false });
      video.srcObject = camStream;
    } catch (e) {
      // permission denied / stream error → seamless picker fallback with a one-line note
      camTeardown(); trackEvent("camera_fallback_used");
      toast("No camera access — pick photos instead 📸");
      return screens.scanCapture(true);
    }
    // torch: only where the track really supports it (iOS support is spotty)
    try {
      const track = camStream.getVideoTracks()[0];
      const caps = track.getCapabilities ? track.getCapabilities() : {};
      if (caps.torch) {
        const tb = $("#camTorch"); tb.hidden = false; let on = false;
        tb.onclick = () => { on = !on; track.applyConstraints({ advanced: [{ torch: on }] }).catch(() => { }); tb.style.opacity = on ? 1 : 0.6; };
      }
    } catch (e) { /* no torch — button stays hidden */ }
    const renderStrip = () => {
      const max = maxScanPhotos();
      const thumbs = photos.map((p, i) => `<span class="cam-thumb"><img src="${p.url}" alt=""><button data-rm="${i}">✕</button></span>`).join("");
      const locked = photos.length >= max ? `<button class="cam-thumb locked" id="capTile">🔒<small>Unlock more</small></button>` : "";
      $("#camStrip").innerHTML = thumbs + locked;
      $$("#camStrip [data-rm]").forEach((b) => b.onclick = () => { URL.revokeObjectURL(photos[+b.dataset.rm].url); photos.splice(+b.dataset.rm, 1); renderStrip(); });
      const tile = $("#capTile");
      if (tile) tile.onclick = () => { trackEvent("photo_cap_tile_tapped"); camTeardown(); screens.upsell("photos"); };
      $("#camDone").disabled = photos.length === 0;
      $("#camShutter").disabled = photos.length >= max;
    };
    renderStrip();
    $("#camShutter").onclick = () => {
      if (photos.length >= maxScanPhotos()) return;
      const c = document.createElement("canvas");
      const scale = Math.min(1, 1568 / Math.max(video.videoWidth, video.videoHeight));   // same cap as the picker path
      c.width = Math.round(video.videoWidth * scale); c.height = Math.round(video.videoHeight * scale);
      c.getContext("2d").drawImage(video, 0, 0, c.width, c.height);   // canvas grab = orientation-true pixels
      c.toBlob((blob) => { if (blob) { photos.push({ blob, url: URL.createObjectURL(blob) }); vibrate("tap"); renderStrip(); } }, "image/jpeg", 0.78);
    };
    $("#camGallery").onclick = () => { camTeardown(); screens.scanCapture(true); };
    $("#camClose").onclick = () => { camTeardown(); screens.home(); };
    $("#camDone").onclick = async () => {
      camTeardown();
      trackEvent("scan_started");
      const blobs = photos.map((p) => p.blob);
      photos.forEach((p) => URL.revokeObjectURL(p.url));
      runScanLive(blobs);
    };
  };

  // ---- Part 2b: the LIVE counter — one request per photo, counts climb per response ----
  async function runScanLive(blobs) {
    h(screenEl("center", `
      ${scanRailHTML(0)}
      <div style="text-align:center;margin-top:40px">
        <div class="hero-emoji" style="font-size:56px">🧊</div>
        <h2 style="margin-top:14px" id="scanLiveTitle">Scanning photo 1 of ${blobs.length}…</h2>
        <p class="muted" style="font-size:13px;margin-top:8px" id="scanLiveCount"></p>
        <p class="muted" style="font-size:12px;margin-top:6px">Photos are scanned in memory and discarded.</p>
      </div>`));
    await loadScanVocab();
    const found = new Set(); const uncertain = []; const others = new Set();
    let doneCount = 0, failCount = 0, scanId = null;
    const update = () => {
      const t = $("#scanLiveTitle"), c = $("#scanLiveCount");
      if (t) t.textContent = doneCount < blobs.length ? `Scanning photo ${Math.min(doneCount + 1, blobs.length)} of ${blobs.length}…` : "Pulling it together…";
      if (c) c.textContent = found.size + uncertain.length ? `Found ${found.size + uncertain.length} so far…` : "";
    };
    update();
    // photo 1 goes FIRST alone (it creates the session + takes the limit hit), the rest run in parallel
    const toB64 = (blob) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.readAsDataURL(blob); });
    const runOne = async (blob) => {
      const resp = await API.scanPhoto(await toB64(blob), scanId);
      scanId = scanId || resp.scanId;
      (resp.matched || []).forEach((id) => found.add(id));
      (resp.uncertain || []).forEach((u) => { if (![...found].includes(u.id_or_name) && !uncertain.some((x) => x.id_or_name === u.id_or_name)) uncertain.push(u); });
      (resp.other || []).forEach((o) => others.add(o));
      doneCount++; update();
    };
    try { await runOne(blobs[0]); }
    catch (e) {
      if (e && e.status === 402) { trackEvent("scan_limit_hit"); return screens.upsell("scan"); }
      failCount++; doneCount++;
    }
    await Promise.all(blobs.slice(1).map((b) => runOne(b).catch(() => { failCount++; doneCount++; update(); })));
    if (failCount >= blobs.length) { trackEvent("scan_failed"); toast("Couldn't read the photos — add ingredients by hand"); return openScanConfirm({ detected: [], other: [], quality: "ok", scanId: null, manual: true }); }
    if (failCount > 0) toast("One photo couldn't be read — here's the rest");
    trackEvent("scan_completed");
    openScanConfirm({ detected: [...found], uncertain, other: [...others], quality: "ok", scanId });
  }

  async function loadScanVocab() {
    if (scanVocab) return scanVocab;
    try { scanVocab = (await API.scanVocab()).vocab || []; } catch (e) { scanVocab = []; }
    return scanVocab;
  }
  const vocabLabel = (id) => {
    if (id.startsWith("~")) return id.slice(1);                       // unmapped shopping-list item
    const v = (scanVocab || []).find((x) => x.id === id);
    return v ? v.label : id.replace(/_/g, " ");
  };
  const scanAvailable = () => backendOn() && navigator.onLine !== false;

  // Downscale + re-encode on-device: iPhone originals (5–12MB, often HEIC) →
  // ~200–400KB JPEG; EXIF (incl. location) never leaves the phone. Same
  // orientation-safe bitmap loader as the cook-card photo.
  async function compressForScan(file) {
    const bmp = await loadPhotoUpright(file);
    const scale = Math.min(1, 1568 / Math.max(bmp.width, bmp.height));   // SCAN 2.0: label-reading needs resolution — recall over bytes (backstop is 1.5MB)
    const cv = document.createElement("canvas");
    cv.width = Math.round(bmp.width * scale); cv.height = Math.round(bmp.height * scale);
    cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
    const blob = await new Promise((res) => cv.toBlob(res, "image/jpeg", 0.8));
    const buf = await blob.arrayBuffer();
    let bin = ""; const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }

  // ---- entry: capture screen ----
  screens.scanCapture = (autoOpen) => {
    h(screenEl("", `
      <button class="btn ghost" id="back" style="width:auto;align-self:flex-start;padding-left:0">← Back</button>
      <p class="eyebrow">Fridge scan</p>
      <h1 style="margin-top:8px">What can I<br>cook right now? 📸</h1>
      <p class="lead" style="margin-top:12px">Fridge, pantry, or leftovers — up to 3 shots. We match what you've got against every recipe. Photos are scanned and <b style="color:var(--text)">immediately discarded</b>, never stored.</p>
      <div class="stack" style="margin-top:22px">
        <button class="btn" id="scanPick">📸 Take / choose photos</button>
        <button class="btn secondary" id="scanManual">⌨️ Or type your ingredients</button>
      </div>
      <p class="muted" style="font-size:12px;margin-top:12px">Tip: fridge + pantry + counter gets the best coverage.</p>
      <p class="muted" id="scansLeft" style="font-size:12px;margin-top:6px"></p>
      <input type="file" id="scanFile" accept="image/*" multiple hidden />
    `));
    $("#back").onclick = () => screens.home();
    $("#scanManual").onclick = () => { trackEvent("scan_manual_fallback"); openScanConfirm({ detected: [], other: [], quality: "ok", scanId: null, manual: true }); };
    const input = $("#scanFile");
    $("#scanPick").onclick = () => input.click();
    input.onchange = async () => {
      let files = [...(input.files || [])].filter((f) => f.type.startsWith("image"));
      if (!files.length) return;
      if (files.length > 3) { toast("First 3 photos used — fridge + pantry + counter"); files = files.slice(0, 3); }
      trackEvent("scan_started");
      runScan(files);
    };
    // limits mirror (UX only — enforcement is the server's): scans-left when non-exempt
    if (backendOn()) API.limits().then((l) => {
      state.limits = l;
      if (l && !l.exempt) { const el = $("#scansLeft"); if (el) el.textContent = `📸 ${Math.max(0, l.scansLimit - l.scansUsed)} of ${l.scansLimit} scans left this week — typing is always free`; }
    }).catch(() => { });
    // camera-first (§3.1): when entered from the home card, the picker IS the first
    // thing seen — fired synchronously inside the same tap gesture. Cancelling the
    // native sheet lands on this screen (privacy line + manual entry) as the fallback.
    if (autoOpen) input.click();
  };

  async function runScan(files) {
    // loading state — a 2–8s round trip, so keep it alive with rotating copy
    const lines = ["Peeking in the fridge…", "Checking the shelves…", "Squinting at the labels…", "Counting the vegetables…"];
    h(screenEl("center", `
      <div style="text-align:center">
        <div class="hero-emoji" style="font-size:56px">🧊</div>
        <h2 style="margin-top:14px" id="scanLoading">${lines[0]}</h2>
        <p class="muted" style="font-size:13px;margin-top:8px">Photos are scanned in memory and discarded.</p>
      </div>
    `));
    let li = 0;
    const rot = setInterval(() => { li = (li + 1) % lines.length; const el = $("#scanLoading"); if (el) el.textContent = lines[li]; }, 2200);
    try {
      await loadScanVocab();
      const images = [];
      for (const f of files) images.push(await compressForScan(f));
      const resp = await API.scan({ images, assumeStaples: state.prefs.scanStaples !== false });
      clearInterval(rot);
      trackEvent("scan_completed");
      openScanConfirm({ detected: resp.detected || [], uncertain: resp.uncertain || [], other: resp.other || [], quality: resp.quality || "ok", scanId: resp.scanId || null, matches: resp.matches });   // FIX (sweep J3): the picker path dropped the uncertain tier — ghost chips were dead on this whole path
    } catch (e) {
      clearInterval(rot);
      if (e && (e.status === 402 || /scan-limit/.test(String(e && e.message)))) {
        trackEvent("scan_limit_hit");
        screens.upsell("scan");
        return;
      }
      trackEvent("scan_failed");
      toast(e && e.status === 429 ? "Daily scan limit reached — type your ingredients instead" : "Scan didn't work — type your ingredients instead");
      openScanConfirm({ detected: [], other: [], quality: "ok", scanId: null, manual: true });   // degrade to manual chips, never a dead end
    }
  }

  // ---- confirm/edit screen (the trust step — never skip straight to results) ----
  function openScanConfirm({ detected, uncertain, other, quality, scanId, manual }) {
    scanState = { ids: [...detected], uncertain: uncertain || [], other: other || [], scanId, quality };
    pushScanState("confirm");
    screens.scanConfirm(!!manual);
  }
  screens.scanConfirm = (manual) => {
    // UNCERTAIN TIER now flows straight into the category sections (the separate
    // "Did we spot these right?" strip is gone). Folded once on entry, idempotently
    // (uncertain is cleared after): vocab guesses → ids (normal removable chips that
    // count toward matching); free-text guesses → other (grey "Also spotted",
    // preserved — an id-less name can't be category-grouped or matched).
    if (scanState.uncertain && scanState.uncertain.length) {
      scanState.fromUncertain = scanState.fromUncertain || [];
      scanState.uncertain.forEach((x) => {
        const isVocab = (scanVocab || []).some((v) => v.id === x.id_or_name);
        if (isVocab) { if (!scanState.ids.includes(x.id_or_name)) { scanState.ids.push(x.id_or_name); if (!scanState.fromUncertain.includes(x.id_or_name)) scanState.fromUncertain.push(x.id_or_name); } }
        else if (!(scanState.other || []).includes(x.id_or_name)) { scanState.other = scanState.other || []; scanState.other.push(x.id_or_name); }
      });
      scanState.uncertain = [];
    }
    const badQuality = scanState.quality !== "ok";
    const retakeMsg = { too_dark: "Too dark — open the fridge door wide and try again.", too_blurry: "Too blurry — hold steady and try again.", not_food: "That didn't look like food — try the fridge or pantry." }[scanState.quality] || "";
    h(screenEl("", `
      <button class="btn ghost" id="back" style="width:auto;align-self:flex-start;padding-left:0">← Back</button>
      ${scanRailHTML(1)}
      <p class="eyebrow">${manual ? "Your ingredients" : "Fridge scan"}</p>
      <h1 style="margin-top:8px">${manual ? "What have<br>you got?" : "Here's what we spotted —<br>fix anything we got wrong 👀"}</h1>
      ${badQuality ? `<div class="cook-warning" style="margin-top:14px">📷 ${esc(retakeMsg)} <button class="linklike" id="scanRetake">Retake</button> — or add your ingredients below.</div>` : ""}
      <p class="lead" style="margin-top:10px;font-size:14px">${manual ? "Add what's in your fridge — we'll match recipes to it." : "Tap ✕ to remove anything we got wrong, and add what we missed (drawers, opaque containers…)."}</p>
      <div class="scan-chips" id="scanChips"></div>
      ${scanState.other.length ? `<p class="muted" style="font-size:12px;margin-top:10px">Also spotted (not in our catalog yet): ${scanState.other.map((o) => `<span class="scan-chip other">${esc(o)}</span>`).join(" ")}</p>` : ""}
      <div style="position:relative;margin-top:14px">
        <input class="field" id="scanAdd" placeholder="Add an ingredient…" autocomplete="off" />
        <div class="scan-suggest" id="scanSuggest" hidden></div>
      </div>
      <label class="stir-toggle" style="margin-top:14px"><input type="checkbox" id="scanStaples" ${state.prefs.scanStaples !== false ? "checked" : ""}> 🧂 I've got the basics (salt, pepper, oil, butter)</label>
      <div class="mt-auto" style="margin-top:22px">
        <button class="btn" id="scanGo">Confirm ingredients →</button>
      </div>
    `));
    $("#back").onclick = () => screens.scanCapture();
    const retake = $("#scanRetake"); if (retake) retake.onclick = () => screens.scanCapture();
    const CAT_META = { produce: "🥦 Produce", dairy_eggs: "🥛 Dairy & Eggs", meat_seafood: "🥩 Meat & Seafood", sauces_condiments: "🧂 Sauces & Condiments", pantry: "🥫 Pantry", frozen: "🧊 Frozen", drinks: "🥤 Drinks" };
    const vocabCat = (id) => { const v = (scanVocab || []).find((x) => x.id === id); return (v && v.category) || "pantry"; };
    let addFilter = null;   // per-category [+ Add] pre-filter (full search reachable by clearing)
    const renderChips = () => {
      if (!scanState.ids.length) {
        $("#scanChips").innerHTML = `<p class="muted" style="font-size:13px;margin-top:8px">${manual ? "Nothing yet — start typing below." : "Nothing detected — add ingredients below, or retake."}</p>`;
      } else {
        // sections per category PRESENT in the confirmed set (data-driven — no hardcoded assignments)
        const groups = {};
        scanState.ids.forEach((id) => { const c = vocabCat(id); (groups[c] = groups[c] || []).push(id); });
        $("#scanChips").innerHTML = Object.keys(CAT_META).filter((c) => groups[c]).map((c) => `
          <p class="scan-cat">${CAT_META[c]} <button class="linklike cat-add" data-cat="${c}">＋ Add</button></p>
          <div class="scan-chips chip-rows">${groups[c].map((id) => `<span class="scan-chip"><span class="chip-label">${esc(vocabLabel(id))}</span><button data-rm="${esc(id)}">✕</button></span>`).join("")}</div>`).join("");
      }
      $$("#scanChips [data-rm]").forEach((b) => b.onclick = () => {
        if ((scanState.fromUncertain || []).includes(b.dataset.rm)) trackEvent("uncertain_item_removed");   // detection-quality: an auto-added low-confidence guess the user rejected
        scanState.ids = scanState.ids.filter((x) => x !== b.dataset.rm);
        renderChips();
      });
      $$("#scanChips .cat-add").forEach((b) => b.onclick = () => { addFilter = b.dataset.cat; const inp2 = $("#scanAdd"); inp2.placeholder = `Add to ${CAT_META[addFilter].replace(/^\S+ /, "")}… (or search all)`; inp2.focus(); });
    };
    renderChips();
    // autocomplete over the vocabulary
    const inp = $("#scanAdd"), sug = $("#scanSuggest");
    const renderSug = () => {
      const q = inp.value.trim().toLowerCase();
      if (!q) { sug.hidden = true; return; }
      const hits = (scanVocab || []).filter((v) => !scanState.ids.includes(v.id) && (!addFilter || v.category === addFilter) && (v.label.toLowerCase().includes(q) || v.id.includes(q.replace(/ /g, "_")))).slice(0, 6);
      if (!q) addFilter = null;
      if (!hits.length) { sug.hidden = true; return; }
      sug.hidden = false;
      sug.innerHTML = hits.map((v) => `<button data-add="${esc(v.id)}">${esc(v.label)}</button>`).join("");
      sug.querySelectorAll("[data-add]").forEach((b) => b.onclick = () => { scanState.ids.push(b.dataset.add); inp.value = ""; sug.hidden = true; renderChips(); });
    };
    inp.oninput = renderSug;
    loadScanVocab().then(renderSug);
    $("#scanStaples").onchange = (e) => { state.prefs.scanStaples = e.target.checked; saveProfile(); };
    $("#scanGo").onclick = async () => {
      const btn = $("#scanGo"); btn.disabled = true; btn.textContent = "Matching…";
      try {
        // §4.1: concept previews fetched IN PARALLEL with matching; preview failure
        // can never error or block sections 1–2 (it resolves to an empty list).
        const staples = state.prefs.scanStaples !== false;
        const [resp, conc] = await Promise.all([
          API.scan({ ids: scanState.ids, scanId: scanState.scanId, assumeStaples: staples }),
          API.scanConcepts(scanState.ids, staples).catch(() => ({ concepts: [], failed: true })),
        ]);
        scanState.scanId = resp.scanId || scanState.scanId;
        scanState.confirmedIds = [...scanState.ids];
        screens.scanResults(resp.matches || [], (conc && conc.concepts) || [], undefined, !!(conc && conc.failed));
      } catch (e) { btn.disabled = false; btn.textContent = "Confirm ingredients →"; toast("Couldn't match — try again"); }   // ids-mode never hits the scan limit
    };
  };

  // ---- results (§3.3): three sections — cook now / almost / make it ----
  // ---- SCAN STATE COPY (flagship-only catalog) --------------------------------
  // DRAFTS — this whole block is the founder's brand-voice swap point; changing the
  // strings never touches the matching/logging logic below.
  const SCAN_STATE_COPY = {
    cookNowHead: "You can cook<br>right now 🎉",
    almostHead: "One thing<br>away 🛒",
    missHead: "Let's build you<br>a cook 💡",
    // ALMOST → ONE INGREDIENT AWAY: [what they have] + [the one missing item + cost] + [payoff]
    oneAway: ({ have, cost, payoff }) => `You've got ${have}. You're one ${cost} from ${payoff}.`,
    twoAway: ({ have, items }) => `You've got ${have}. Grab ${items} and you're cooking.`,
    almostPayoff: "the best thing you'll eat this week",
    // MISS / EMPTY → DEMAND CAPTURE (single tap → concept_requests source='scan_miss')
    missLine: "Nothing in here maps to a Choppd cook yet. Want us to build one?",
    almostMissLine: "Don't see the exact cook you want? We'll build one from this.",
    missSub: "We'll build a real, tested cook from exactly what you scanned.",
    missCta: "Yes — build one from this",
    missDone: "On the list ✓",
    missDoneSub: "We'll build from what you scanned — keep an eye out.",
  };
  // Rough cost per flagship required ingredient — STATIC map, no live pricing.
  // Keyed by canonical id; falls back to the plain ingredient label when unlisted.
  const SCAN_MISSING_COST = {
    steak: "$6 steak", ground_beef: "$5 of ground beef",
    chicken_breast: "$4 chicken breast", chicken_thigh: "$4 of chicken thighs",
    egg: "$3 of eggs", tortilla: "$3 pack of tortillas", hoagie_roll: "$2 hoagie roll",
    rice: "$2 of rice", instant_ramen: "$1 ramen packet", cheese_slices: "$4 of cheese",
    pasta: "$2 of pasta", bacon: "$5 of bacon",
  };
  const missCost = (id) => SCAN_MISSING_COST[id] || vocabLabel(id);
  const joinAnd = (a) => a.length <= 1 ? (a[0] || "") : a.length === 2 ? `${a[0]} and ${a[1]}` : `${a.slice(0, -1).join(", ")}, and ${a[a.length - 1]}`;
  // The one-away hook for an "almost" flagship match (names the missing item + cost).
  function oneAwayLine(m) {
    const have = joinAnd((m.present || []).map(vocabLabel).slice(0, 3));
    const miss = m.missing || [];
    if (miss.length === 1) return SCAN_STATE_COPY.oneAway({ have: have || "most of it", cost: missCost(miss[0]), payoff: SCAN_STATE_COPY.almostPayoff });
    return SCAN_STATE_COPY.twoAway({ have: have || "most of it", items: joinAnd(miss.map(vocabLabel)) });
  }

  screens.scanResults = (matches, concepts, restoreTab, ideasFailed) => {
    concepts = concepts || [];
    lastScan = { matches, concepts, tab: restoreTab };   // survives recipe navigation (jobs: back-to-results + quit preservation)
    const ready = matches.filter((m) => m.status === "ready");
    const almost = matches.filter((m) => m.status === "almost");
    if (!ready.length && !almost.length) trackEvent("scan_no_match");
    if (concepts.length) trackEvent("preview_shown");
    const nIds = (scanState.confirmedIds || scanState.ids || []).length;
    // recipe-type pill — DERIVED from data (song presence + noMusic), never a hardcoded
    // list, so wiring a track later flips a guided cook to music-synced automatically.
    const typePill = (exp) => {
      // dashboard coloring: music-synced + guided use .badge-sync (purple accent),
      // imported uses the quiet .badge-library — exactly as the browse cards render.
      if (!exp) return `<span class="badge-library">📖 Recipe library</span>`;   // imported tap-through
      const hasSong = !exp.noMusic && exp.song && !!exp.song.audioFile;
      return hasSong ? `<span class="badge-sync">🎵 Music-synced</span>` : `<span class="badge-guided">🎧 Guided cook</span>`;
    };
    const card = (m, badge, subtitle) => {
      const r = m.recipe || {};
      const missing = (m.missing || []).map(vocabLabel).join(", ");
      // hero-over-emoji tile via the shared helper (was the original per-surface mechanism).
      const exp0 = musicExpFor(r);
      // subtitle override (the one-away hook for "almost"); else the plain missing list.
      const sub = subtitle ? `<small class="scan-oneaway">${esc(subtitle)}</small>` : (missing ? `<small style="color:var(--hot)">missing: ${esc(missing)}</small>` : "");
      return `<button class="rcard scan-result" data-id="${esc(r.id || m.recipeId)}">
        <div class="rthumb">${recipeThumbInner(r, "🍽️")}</div>
        <div class="rinfo">
          <b>${r.emoji && r.thumb ? r.emoji + " " : ""}${esc(r.title || m.recipeId)}</b>
          <div class="rrow">${badge}${lockBadge(r.id || m.recipeId)}${r.estimatedTimeMin ? `<span class="pill">⏱ ~${r.estimatedTimeMin}m</span>` : ""}${typePill(exp0)}</div>
          ${sub}
        </div>
      </button>`;
    };
    // §4.1 concept preview cards — visually distinct (dashed + CONCEPT badge); NEVER route into a cook
    // Card = name + one-line pitch + "uses:" chips. Chips are DETECTED items only —
    // staples (salt/oil/…) never chip. Grounding guarantees would_need is empty, so no
    // "needs X" line. Tap = one-tap demand capture (source='ai_idea'); status fills in place.
    const isStaple = (id) => { const v = (scanVocab || []).find((x) => x.id === id); return !!(v && v.staple); };
    const conceptCard = (c, i) => {
      const chipIds = (c.uses || []).filter((id) => !isStaple(id)).slice(0, 6);
      const chips = chipIds.map((id) => `<span class="uses-chip">${esc(vocabLabel(id))}</span>`).join("");
      return `<button class="rcard concept-card" data-ci="${i}">
      <div class="rthumb" style="display:grid;place-items:center;font-size:30px;background:var(--bg-2)">💡</div>
      <div class="rinfo">
        <b>${esc(c.title)}</b>
        ${c.one_line_hook ? `<small class="concept-pitch muted">${esc(c.one_line_hook)}</small>` : ""}
        ${chips ? `<div class="uses-chips"><span class="uses-lead">${IDEA_COPY.usesLead}</span>${chips}</div>` : ""}
        <small class="idea-status" hidden></small>
      </div>
    </button>`;
    };
    const noMatches = !ready.length && !almost.length;
    const hideLib = !LIBRARY_VISIBLE;   // flagship-only catalog → the rebuilt scan states
    const readyHTML = ready.slice(0, 12).map((m) => card(m, `<span class="hist-badge ok">✅ cook now</span>`)).join("");
    // ALMOST: the one-away hook (names the missing item + rough cost) when the catalog is flagship-only.
    const almostHTML = almost.slice(0, 12).map((m) => card(m, `<span class="hist-badge warn">${m.missing.length} to buy</span>`, hideLib ? oneAwayLine(m) : null)).join("");
    // MISS / EMPTY → demand capture: one tap files concept_requests (source='scan_miss')
    // with the fridge list (the demand gold). Shown whenever there's no cook-now match
    // (a flagship-only catalog is almost always "one away", so gating on a TRUE empty
    // would make it unreachable) — the honest "we don't have your exact cook yet" state.
    const demandCapture = (hideLib && !ready.length) ? `
      <div class="scan-demand" id="scanDemand">
        <div class="sd-ico">💡</div>
        <p class="sd-line">${noMatches ? SCAN_STATE_COPY.missLine : SCAN_STATE_COPY.almostMissLine}</p>
        <p class="sd-sub">${SCAN_STATE_COPY.missSub}</p>
        <button class="btn" id="scanMissBtn">${SCAN_STATE_COPY.missCta}</button>
      </div>` : "";
    const makeSection = `
      ${demandCapture}
      <p class="section-title" style="margin-top:14px">${noMatches ? (hideLib ? "Or spin up an AI idea" : "Nothing in the catalog fits — so make it") : "Doesn't exist yet? Make it."}</p>
      ${concepts.length ? `<div class="catalog">${concepts.map(conceptCard).join("")}</div>` : (ideasFailed ? `<p class="muted" style="margin-top:10px">${IDEA_COPY.notLoading}</p>` : "")}
      <button class="btn ${noMatches && !hideLib ? "" : "secondary"}" id="createNew" style="margin-top:10px">＋ Create new recipe</button>`;
    const nAI = concepts.length + 1;   // concepts + the always-present create button
    const defTab = (restoreTab != null) ? restoreTab : (ready.length ? 0 : almost.length ? 1 : 2);
    lastScan.tab = defTab;
    pushScanState("results");
    h(screenEl("", `
      ${scanRailHTML(2)}
      <button class="btn ghost" id="back" style="width:auto;align-self:flex-start;padding-left:0">← Edit ingredients</button>
      <h1 style="margin-top:4px">${ready.length ? (hideLib ? SCAN_STATE_COPY.cookNowHead : "You can cook<br>right now 🎉") : almost.length ? (hideLib ? SCAN_STATE_COPY.almostHead : "So close 👀") : (hideLib ? SCAN_STATE_COPY.missHead : "Let's invent<br>something 💡")}</h1>
      <div class="scan-tabs" id="scanTabs">
        <button class="stab ${defTab === 0 ? "on" : ""} ${ready.length ? "" : "empty"}" data-tab="0">✅ Cook now (${ready.length})</button>
        <button class="stab ${defTab === 1 ? "on" : ""} ${almost.length ? "" : "empty"}" data-tab="1">${hideLib ? "🛒 One away" : "🧩 Almost"} (${almost.length})</button>
        <button class="stab ${defTab === 2 ? "on" : ""}" data-tab="2">✨ AI ideas (${nAI})</button>
      </div>
      <div class="tab-pane" data-pane="0" ${defTab === 0 ? "" : "hidden"}>${ready.length ? `<div class="catalog">${readyHTML}</div>` : `<p class="muted" style="margin-top:14px">Nothing fully stocked — check ${hideLib ? "One away" : "Almost"} and AI ideas.</p>`}</div>
      <div class="tab-pane" data-pane="1" ${defTab === 1 ? "" : "hidden"}>${almost.length ? `<p class="muted" style="font-size:12px;margin-top:10px">${hideLib ? "One grocery run away." : "Missing just a couple of things."}</p><div class="catalog">${almostHTML}</div>` : `<p class="muted" style="margin-top:14px">No near-misses this time.</p>`}</div>
      <div class="tab-pane" data-pane="2" ${defTab === 2 ? "" : "hidden"}>${makeSection}</div>
      ${BASKET_ENABLED ? `<button class="basket-cta" id="basketCta">${esc(BASKET_COPY.cta)}</button>` : ""}
      <div class="mt-auto" style="margin-top:22px">
        <button class="btn secondary" id="scanAgain" style="margin-top:8px">📸 Scan again</button>
      </div>
    `));
    $$("#scanTabs .stab").forEach((t) => t.onclick = () => {
      $$("#scanTabs .stab").forEach((x) => x.classList.toggle("on", x === t));
      $$(".tab-pane").forEach((p) => p.hidden = p.dataset.pane !== t.dataset.tab);
      if (lastScan) lastScan.tab = +t.dataset.tab;   // back returns to the SAME tab
    });
    $("#back").onclick = () => screens.scanConfirm(false);
    $("#scanAgain").onclick = () => screens.scanCapture();
    { const bc = $("#basketCta"); if (bc) bc.onclick = () => { trackEvent("basket_cta_tapped"); screens.basket(scanState.confirmedIds || scanState.ids || []); }; }   // BASKET: scan-results CTA → the starter basket, deduped by this scan
    $$(".scan-result").forEach((c) => c.onclick = async (e) => {
      const id = c.dataset.id;
      trackEvent("scan_recipe_launched");
      if (scanState.scanId) { try { API.scanLaunched(scanState.scanId, id).catch(() => { }); } catch (e2) { } }
      const m = matches.find((x) => (x.recipe && x.recipe.id) === id || x.recipeId === id);
      openRecipe((m && m.recipe) || { id }, "scan");
    });
    // Scan 2.1: the concept-request sheet — recap + optional message + optional
    // @instagram (contact data: used ONLY to DM them about this request; rows
    // fully deleted on account deletion). Writes concept_requests (new system).
    const requestSheet = (concept, sourceBtn) => {
      trackEvent(concept ? "preview_tapped" : "create_new_tapped");
      const uses = concept ? `uses ${concept.uses.length} of your ${(scanState.confirmedIds || scanState.ids || []).length} ingredients` : "";
      const wrap = document.createElement("div");
      wrap.className = "confirm-scrim";
      wrap.innerHTML = `<div class="confirm-box" style="text-align:left">
        <p><b>${concept ? esc(concept.title) : "Create a new recipe"}</b>${concept && concept.one_line_hook ? `<br><span class="muted" style="font-size:13px">${esc(concept.one_line_hook)}</span>` : ""}${uses ? `<br><span class="muted" style="font-size:12px">${uses}</span>` : ""}</p>
        <p style="font-size:13px;margin-top:10px">Want this to be real? Tell us and we'll build it — tested timing, voice, the works. Drop your Instagram and we'll DM you when it's live.</p>
        <textarea class="field" id="crMsg" rows="2" placeholder="anything specific you're imagining?" style="margin-top:10px;resize:none"></textarea>
        <div style="display:flex;align-items:center;gap:4px;margin-top:8px"><span class="muted" style="font-weight:700">@</span><input class="field" id="crIg" placeholder="yourhandle — so we can tell you when it's ready" style="flex:1"></div>
        <p class="muted" style="font-size:11px;margin-top:6px">We only use your handle to tell you about this request.</p>
        <div class="btn-row" style="margin-top:12px"><button class="btn" data-yes>Request this recipe</button><button class="btn secondary" data-no>Not now</button></div>
      </div>`;
      (document.querySelector(".phone") || app).appendChild(wrap);
      requestAnimationFrame(() => wrap.classList.add("show"));
      const close = () => { wrap.classList.remove("show"); setTimeout(() => wrap.remove(), 200); };
      wrap.querySelector("[data-no]").onclick = close;
      wrap.querySelector("[data-yes]").onclick = async () => {
        const msg = wrap.querySelector("#crMsg").value.trim();
        const ig = wrap.querySelector("#crIg").value.trim().replace(/^@/, "");
        if (ig && !/^[A-Za-z0-9._]{1,30}$/.test(ig)) { toast("That handle doesn't look right — letters, numbers, dots, underscores"); return; }
        try {
          await API.scanConceptRequest(scanState.confirmedIds || scanState.ids || [], concept || null, msg, ig);
          trackEvent(ig ? "concept_request_submitted_with_handle" : "concept_request_submitted");
          if (sourceBtn) { sourceBtn.classList.add("requested"); const info = sourceBtn.querySelector("small"); if (info) info.textContent = ig ? "Requested ✓ — we'll DM you when it's live" : "Requested ✓"; }
          toast(ig ? "Requested ✓ — we'll DM you" : "Requested ✓");
          close();
        } catch (e) { toast(e && e.status === 400 ? "That handle doesn't look right" : "Couldn't send — try again"); }
      };
    };
    // AI-IDEA TAP = one-tap demand capture (the scan_miss pattern): files concept_requests
    // with source='ai_idea' + the idea + the fridge list, then confirms in place. No sheet.
    const captureIdea = async (concept, btn) => {
      if (!concept || (btn && btn.classList.contains("requested"))) return;
      trackEvent("ai_idea_tapped");
      try {
        await API.scanIdea(scanState.confirmedIds || scanState.ids || [], concept);
        if (btn) { btn.classList.add("requested"); const s = btn.querySelector(".idea-status"); if (s) { s.hidden = false; s.textContent = IDEA_COPY.confirmed; } }
        toast(IDEA_COPY.confirmed);
      } catch (e) { toast(IDEA_COPY.failed); }
    };
    $$(".concept-card").forEach((b) => b.onclick = () => captureIdea(concepts[+b.dataset.ci], b));
    $("#createNew").onclick = () => requestSheet(null, null);   // freestyle custom request keeps the DM sheet
    // MISS demand capture — ONE tap → concept_requests (source='scan_miss') + fridge list.
    const missBtn = $("#scanMissBtn");
    if (missBtn) missBtn.onclick = async () => {
      const ids = scanState.confirmedIds || scanState.ids || [];
      missBtn.disabled = true;
      try {
        await API.scanMissRequest(ids);
        trackEvent("scan_miss_request");
        const d = $("#scanDemand");
        if (d) d.innerHTML = `<div class="sd-ico">✅</div><p class="sd-line">${SCAN_STATE_COPY.missDone}</p><p class="sd-sub">${SCAN_STATE_COPY.missDoneSub}</p>`;
        toast("On the list ✓");
      } catch (e) { missBtn.disabled = false; toast("Couldn't send — try again"); }
    };
  };

  // ---- GROCERY REVERSE-SCAN — the starter basket screen (reached from the scan CTA) ----
  // A NEW scan re-dedupes; otherwise the saved basket (with in-aisle check-offs) loads.
  screens.basket = async (ownedIds) => {
    if (!BASKET_ENABLED) return screens.home();
    WakeLock.release();
    const owned = (ownedIds || []).filter((id) => BASKET_DATA.items.some((i) => i.id === id));   // scan-CONFIRMED ids only (ghosts excluded upstream)
    h(screenEl("", `${sectionHead("🛒 Groceries")}<p class="muted" style="font-size:13px;margin-top:10px">Building your list…</p>`));
    wireSectionHead();
    let basket = await Basket.fetchActive();
    const savedDedupe = basket ? (basket.dedupe || []).slice().sort().join(",") : null;
    const newDedupe = owned.slice().sort().join(",");
    if (!basket || (ownedIds != null && savedDedupe !== newDedupe)) {   // new scan → regenerate + re-dedupe
      basket = Basket.generate(owned);
      Basket.save(basket);
    }
    renderBasket(basket);
  };
  const _humanJoin = (a) => a.length <= 1 ? (a[0] || "") : a.length === 2 ? `${a[0]} and ${a[1]}` : `${a.slice(0, -1).join(", ")}, and ${a[a.length - 1]}`;
  function renderBasket(basket) {
    const items = basket.items || [];
    const toBuy = items.filter((i) => !i.owned);
    const ownedItems = items.filter((i) => i.owned);
    const about = Basket.aboutDollars(items);
    const allChecked = toBuy.length > 0 && toBuy.every((i) => i.checked);
    const anon = !(backendOn() && API.isLoggedIn());
    const dayItems = (day) => BASKET_DATA.items.filter((i) => (i.days || []).includes(day));
    const daySet = (day) => { const di = dayItems(day); return di.length > 0 && di.every((i) => (items.find((x) => x.id === i.id) || {}).owned); };
    const dedupeLine = ownedItems.length ? `<p class="basket-dedupe">✅ ${esc(BASKET_COPY.dedupe(_humanJoin(ownedItems.map((i) => i.label.toLowerCase().replace(/\s*\(.*\)/, "")))))}</p>` : "";
    h(screenEl("", `
      ${sectionHead("🛒 Groceries")}
      <h1 style="margin-top:4px">${esc(BASKET_COPY.title)}</h1>
      <p class="lead" style="margin-top:6px;font-size:14px">${esc(BASKET_COPY.lead)}</p>
      <div class="basket-total"><span class="bt-amt">${esc(BASKET_COPY.about(about))}</span><span class="bt-sub">${esc(BASKET_COPY.aboutSub)}</span></div>
      ${dedupeLine}
      ${allChecked ? `<div class="basket-complete"><b>${esc(BASKET_COPY.completeTitle)}</b><span>${esc(BASKET_COPY.completeSub)}</span></div>` : ""}
      <div class="basket-list" id="basketList">
        ${toBuy.map((i) => `<div class="basket-item ${i.checked ? "checked" : ""}" data-id="${esc(i.id)}" role="button" tabindex="0">
          <span class="bi-check">${i.checked ? "✅" : "⬜️"}</span>
          <span class="bi-body"><b>${esc(i.label)}</b>${i.note ? `<small>${esc(i.note)}</small>` : ""}</span>
          <span class="bi-cost">~$${i.cost}</span>
        </div>`).join("")}
      </div>
      ${anon ? `<p class="basket-nudge">${esc(BASKET_COPY.nudge)}</p>` : ""}
      <p class="section-title" style="margin-top:20px">${esc(BASKET_COPY.weekTitle)}</p>
      <div class="basket-week">
        ${BASKET_DATA.week.map((d) => { const exp = (window.EXPERIENCES || []).find((e) => e.id === d.recipeId); const set = daySet(d.day); return `<div class="bw-day ${set ? "set" : ""}"><span class="bw-num">${d.day}</span><span class="bw-body"><b>${esc(exp ? exp.recipe.title : d.recipeId)}</b><small>${set ? esc(BASKET_COPY.daySet) : esc(d.note)}</small></span></div>`; }).join("")}
      </div>
      <div class="mt-auto" style="margin-top:22px"><button class="btn secondary" id="basketDone">Done</button></div>
    `));
    wireSectionHead();
    $("#basketDone").onclick = () => screens.home();
    $$(".basket-item").forEach((el) => el.onclick = () => {
      const it = basket.items.find((x) => x.id === el.dataset.id); if (!it) return;
      it.checked = !it.checked;
      el.classList.toggle("checked", it.checked);
      const chk = el.querySelector(".bi-check"); if (chk) chk.textContent = it.checked ? "✅" : "⬜️";
      vibrate("tap");
      Basket.save(basket);   // persist the check-off — survives navigation + reload
      if (basket.items.filter((x) => !x.owned).every((x) => x.checked)) renderBasket(basket);   // all done → complete state
    });
  }

  // ---- usage limits: the client-side gate + upsell (server-authoritative) ----
  async function cookStartGate(recipeId) {
    if (!backendOn()) return true;                       // offline: fail-open, documented
    try {
      const r = await API.cookStart(recipeId);
      if (r && r.reason === "consumed") trackEvent("unlock_consumed_" + recipeId);
      if (state.limits && r && r.reason === "consumed") state.limits.unlockedIds.push(recipeId);
      return true;
    } catch (e) {
      if (e && (e.status === 402 || /recipe-limit/.test(String(e && e.message)))) {
        trackEvent("recipe_limit_hit");
        screens.upsell("recipe");
        return false;
      }
      return true;                                       // network hiccup: fail-open
    }
  }
  // one shared upsell, two variants — sell the value, never shame the wall
  screens.upsell = (variant) => {
    trackEvent("upsell_shown_" + variant);
    const copy = variant === "photos"
      ? { h1: "Three shots is<br>the free lane 📸", lead: "Fridge, door, drawers — three shots cover most kitchens. Premium raises the cap, and it's coming soon." }
      : variant === "scan"
      ? { h1: "That's this week's<br>three scans 📸", lead: "Your fridge has been busy — respect. Premium gets you unlimited scans, and it's coming soon. Typing your ingredients stays free forever." }
      : { h1: "Three recipes<br>unlocked 🔓", lead: "You've used your three unlocks — and cooked them well. Premium opens the whole catalog, and it's coming soon. Your core four (and everything you've unlocked) stay yours forever." };
    h(screenEl("center", `
      <div class="finish-hero">
        <div class="big-emoji" style="font-size:64px">⭐</div>
        <p class="eyebrow" style="margin-top:10px">Premium — coming soon</p>
        <h1 style="margin-top:8px">${copy.h1}</h1>
        <p class="lead" style="margin-top:12px">${copy.lead}</p>
      </div>
      <div class="stack" style="margin-top:26px">
        <button class="btn gradient" id="joinList">Join the list</button>
        <button class="btn ghost" id="upsellBack">Back</button>
      </div>
    `));
    $("#upsellBack").onclick = () => screens.home();
    $("#joinList").onclick = async () => {
      try {
        const r = await API.waitlist(variant);
        trackEvent("waitlist_joined_" + variant);
        $("#joinList").textContent = "You're on the list ✓";
        $("#joinList").disabled = true;
        if (r && r.already) toast("Already on it — you're covered ✓");
      } catch (e) { toast("Couldn't join — try again"); }
    };
  };

  // ---- Home ----

  // ============================================================
  // ACTIVATION SEQUENCE — the one-time post-tutorial onboarding beat.
  // Runs ONCE after the tutorial, gated on prefs.activationComplete; resumes
  // at prefs.activationStep on force-quit/relogin. Captures a first-cook
  // commitment, a same-session action, and the dinnertime return trigger —
  // NO cook is forced here. Reuses the real saved-recipes, fridge-scan,
  // ingredient data, Telemetry, and profile-prefs systems.
  // ============================================================
  let activationPick = null;              // the chosen experience object (this session)
  let resumeActivationOnHome = false;     // Fork-A scan detour → resume at §3 on next home
  const DINNER_BUCKETS = [{ id: "17", label: "~5pm" }, { id: "18", label: "~6pm" }, { id: "19", label: "~7pm" }, { id: "20", label: "~8pm+" }];
  // The return-trigger copy, stored as an interpolated template so it's ready to
  // fire from the native scheduler later. Pulls REAL values (pick name + authored
  // cook time). No cost token — no structured recipe-cost source exists (costs are
  // prose-only in finish cues), so precision isn't invented.
  const DINNER_NUDGE_TEMPLATE = (name, mins) =>
    `It's dinnertime. The takeout app's right there, judging you. You said you'd make the ${name}${mins ? ` — about ${mins} min` : ""}. Let's go.`;

  // §3 return trigger — CAPTURE + SCHEDULE-INTENT only. A logged no-op until the
  // native plugin is wired; deliberately does NOT touch the browser Notification
  // API (Web Push was avoided on purpose).
  const DinnerNudge = {
    scheduleIntent(dinnerHour24, name, mins) {
      const now = new Date();
      const fire = new Date(now); fire.setHours(Number(dinnerHour24), 0, 0, 0);
      if (fire <= now) fire.setDate(fire.getDate() + 1);   // next occurrence
      const body = DINNER_NUDGE_TEMPLATE(name, mins);
      // ── SWAP-POINT: wire to Capacitor Local Notifications on native build ──
      //   LocalNotifications.schedule({ notifications: [{ id: 42, title: "Choppd",
      //     body, schedule: { at: fire, repeats: true, every: "day" } }] });
      // Until then this is intentionally a no-op beyond the log line below —
      // no Web Push, no browser Notification, nothing fires on web.
      try { console.log("[DinnerNudge intent]", fire.toISOString(), "→", body); } catch (e) { }
      return { fireAt: fire.toISOString(), body };
    },
  };

  function persistActivation() {
    // rides the existing prefs round-trip (backend + localStorage profile mirror)
    try { saveProfile(); } catch (e) { }
  }
  // Entry from the tutorial-completion beats and the boot/relogin resume.
  function enterActivation(step) {
    if (state.prefs.activationComplete) { screens.home(); return; }
    if (!step) step = state.prefs.activationStep || "pick";
    if (step === "pick" && !state.prefs.activationStarted) { state.prefs.activationStarted = true; trackEvent("activation_started"); }
    state.prefs.activationStep = step; persistActivation();
    screens.activation(step);
  }

  screens.activation = (step) => {
    step = step || state.prefs.activationStep || "pick";
    // resolve the pick object from persisted id (survives resume)
    if (!activationPick && state.prefs.activationPickId) activationPick = (window.EXPERIENCES || []).find((e) => e.id === state.prefs.activationPickId) || null;
    const wrap = (inner) => h(screenEl("", `<div class="brand-lockup" style="justify-content:center;margin-top:6px"><img class="brand-logo" src="assets/logo.png?v=4" alt="" aria-hidden="true" /><img class="brand-wordmark" src="assets/wordmark.svg?v=1" alt="Choppd" /></div>${inner}`));

    // ── §1 PICK ──
    if (step === "pick") {
      wrap(`
        <div class="act-pick">
        <h1 style="margin-top:14px">One question before I let you loose: what are you making first?</h1>
        <p class="lead" style="margin-top:8px">Pick one. This is the one you become good at.</p>
        <div class="catalog" style="margin-top:12px">
          ${(window.EXPERIENCES || []).map((e, i) => `
            <button class="rcard mexp" data-pickidx="${i}">
              <div class="rthumb">${recipeThumbInner(e)}</div>
              <div class="rinfo"><b>${e.recipe.emoji} ${esc(e.recipe.title)}</b><small>${esc(e.recipe.technique)}</small></div>
            </button>`).join("")}
        </div>
        <div class="mt-auto" style="margin-top:16px;text-align:center"><button class="quit-text" id="pickSkip" style="padding:15px 18px">Skip — I'll pick later</button></div>
        </div>`);
      const pickSkip = $("#pickSkip");
      if (pickSkip) pickSkip.onclick = () => {
        // skip counts as seen — end the flow so home()/boot never re-trap. No recipe
        // saved, no downstream "first meal" expectation (dashboard grid is the pick-later path).
        state.prefs.activationComplete = true; state.prefs.activationStep = null;
        persistActivation(); trackEvent("activation_skipped"); resumeActivationOnHome = false;
        screens.home();
      };
      $$("#app [data-pickidx]").forEach((b) => b.onclick = () => {
        const exp = (window.EXPERIENCES || [])[+b.dataset.pickidx]; if (!exp) return;
        activationPick = exp;
        saveRecipe(exp);                                   // → the REAL saved-recipes list (first investment)
        state.prefs.activationPickId = exp.id;
        trackEvent("first_pick_selected:" + exp.id);
        toast("Locked in. That's the one.");
        vibrate("double");
        enterActivation("fork");
      });
      return;
    }

    const pick = activationPick || (window.EXPERIENCES || [])[0];
    const pickTitle = pick.recipe.title;

    // ── §2 FORK ──
    if (step === "fork") {
      wrap(`
        <h1 style="margin-top:18px">${esc(pick.recipe.emoji)} ${esc(pickTitle)} it is.</h1>
        <p class="lead" style="margin-top:10px">Home right now? Point your camera at the fridge — let's see what you can already pull off tonight.</p>
        <div style="margin-top:20px;display:flex;flex-direction:column;gap:12px">
          <button class="btn" id="forkScan">📸 I'm home — scan my fridge</button>
          <button class="btn secondary" id="forkList">🛒 Not home — show me the list</button>
        </div>`);
      $("#forkScan").onclick = () => {
        trackEvent("fork_choice:scan");
        resumeActivationOnHome = true;                     // scan detour → resume §3 on next home
        state.prefs.activationStep = "dinner"; persistActivation();
        screens.scanCamera();                              // the EXISTING fridge-scan feature
      };
      $("#forkList").onclick = () => { trackEvent("fork_choice:list"); enterActivation("list"); };
      return;
    }

    // ── §2B GROCERY LIST ──
    if (step === "list") {
      const ings = (pick.ingredients || []).filter((i) => !i.optional);
      const opt = (pick.ingredients || []).filter((i) => i.optional);
      const row = (i) => `<li class="grocery-row"><span class="gk">${esc(capFirst(i.label || i.name))}</span><span class="gm muted">${esc(i.measure || "")}</span></li>`;
      // No structured cost source exists → item count only, no invented $ figure.
      wrap(`
        <h1 style="margin-top:18px">Here's everything<br>for the ${esc(pickTitle.toLowerCase())}.</h1>
        <p class="lead" style="margin-top:10px">${ings.length} things — screenshot it, grab it on the way home.</p>
        <ul class="grocery-list" style="margin-top:14px">${ings.map(row).join("")}</ul>
        ${opt.length ? `<p class="section-title" style="margin-top:14px">Nice-to-have</p><ul class="grocery-list">${opt.map(row).join("")}</ul>` : ""}
        <div class="mt-auto" style="margin-top:22px"><button class="btn" id="listNext">Got it — next →</button></div>`);
      $("#listNext").onclick = () => enterActivation("dinner");
      return;
    }

    // ── §2A AFTER-SCAN: nudge if the pick's on hand, else fall to the grocery list ──
    if (step === "afterScan") {
      trackEvent("fridge_scanned");
      const ls = (lastScan && lastScan.matches) ? lastScan.matches : [];
      const m = ls.find((x) => (x.recipe && x.recipe.id === pick.id) || x.recipeId === pick.id);
      const onHand = !!(m && (m.status === "ready" || m.status === "almost"));
      if (!onHand) { return enterActivation("list"); }   // not on hand → grocery path for the pick
      wrap(`
        <div style="margin-top:40px;text-align:center">
          <div style="font-size:44px">${esc(pick.recipe.emoji)}</div>
          <h1 style="margin-top:12px">You've basically got<br>the ${esc(pickTitle.toLowerCase())} already.</h1>
          <p class="lead" style="margin-top:12px">Tonight?</p>
        </div>
        <div class="mt-auto" style="margin-top:22px"><button class="btn" id="scanNudgeNext">One more thing →</button></div>`);
      $("#scanNudgeNext").onclick = () => enterActivation("dinner");
      return;
    }

    // ── §3 DINNERTIME RETURN TRIGGER (capture + intent, no send) ──
    if (step === "dinner") {
      wrap(`
        <h1 style="margin-top:18px">When do you<br>usually eat?</h1>
        <p class="lead" style="margin-top:10px">I'll nudge you at the right time — not to nag, just so the takeout app doesn't win by default.</p>
        <div class="portion" id="dinnerSel" style="margin-top:18px;flex-wrap:wrap">${DINNER_BUCKETS.map((b) => `<button class="pchip ${state.prefs.dinnerTime === b.id ? "on" : ""}" data-dinner="${b.id}">${b.label}</button>`).join("")}</div>
        <div class="mt-auto" style="margin-top:22px"><button class="btn" id="dinnerNext" ${state.prefs.dinnerTime ? "" : "disabled"}>Set it →</button></div>`);
      $$("#dinnerSel .pchip").forEach((b) => b.onclick = () => {
        state.prefs.dinnerTime = b.dataset.dinner;
        $$("#dinnerSel .pchip").forEach((x) => x.classList.toggle("on", x === b));
        $("#dinnerNext").disabled = false;
      });
      $("#dinnerNext").onclick = () => {
        persistActivation();
        trackEvent("dinnertime_set:" + state.prefs.dinnerTime);
        DinnerNudge.scheduleIntent(state.prefs.dinnerTime, pickTitle, pick.totalTimeMin || null);   // logged no-op until native
        enterActivation("progress");
      };
      return;
    }

    // ── §4 ENDOWED PROGRESS (start at 1, not 0) ──
    if (step === "progress") {
      wrap(`
        <div style="margin-top:40px;text-align:center">
          <div style="font-size:44px">✅</div>
          <h1 style="margin-top:12px">Step 1 done —<br>you picked your first cook.</h1>
          <p class="lead" style="margin-top:12px">${esc(pick.recipe.emoji)} ${esc(pickTitle)} is saved and waiting.</p>
        </div>
        <div class="mt-auto" style="margin-top:22px"><button class="btn" id="progNext">Almost there →</button></div>`);
      $("#progNext").onclick = () => enterActivation("close");
      return;
    }

    // ── §5 CLOSE — identity beat → home ──
    wrap(`
      <div style="margin-top:60px;text-align:center">
        <h1>That's step one.</h1>
        <p class="lead" style="margin-top:14px">You're already someone who's about to cook — see you at dinner.</p>
      </div>
      <div class="mt-auto" style="margin-top:22px"><button class="btn gradient" id="actDone">Take me home 🍳</button></div>`);
    $("#actDone").onclick = () => {
      state.prefs.activationComplete = true; state.prefs.activationStep = null;
      persistActivation();
      trackEvent("activation_completed");
      resumeActivationOnHome = false;
      screens.home();
    };
  };

  screens.home = () => {
    if (resumeActivationOnHome && !state.prefs.activationComplete) { resumeActivationOnHome = false; return enterActivation("afterScan"); }
    WakeLock.release();   // back to browse — let the screen sleep again
    const name = state.email ? state.email[0].toUpperCase() : "S";
    const ordered = timeOrderedExperiences(); // time-of-day order; featured = ordered[0]
    const feat = ordered[0];
    h(screenEl("", `
      <div class="topbar">
        <div style="display:flex;align-items:center;gap:12px">
          <button class="icon-btn" id="hamburger" aria-label="Open menu" aria-haspopup="true">☰</button>
          <div class="brand-lockup home-brand"><img class="brand-logo" src="assets/logo.png?v=4" alt="" aria-hidden="true" /><img class="brand-wordmark" src="assets/wordmark.svg?v=1" alt="Choppd" /></div>
        </div>
        <div class="home-id">
          ${streakBadgeHTML()}
          <div class="avatar">${name}</div>
        </div>
      </div>

      <div id="reqShipped"></div>
      <div id="resumeCard"></div>
      <p class="lead">Real food, no nonsense. Pick your cook.</p>

      <p class="section-title">${esc(timeHeaderPhrase())}</p>
      <div class="exp-card ${feat.heroImage ? "has-hero" : ""}" id="featured" ${feat.heroImage ? `style="background:var(--bg-2) url('${esc(feat.heroImage)}') center/cover"` : ""}>
        ${feat.heroImage ? `<div class="hero-overlay"></div>` : `<div class="glow"></div>`}
        ${bookmarkHTML(feat.id, "on-art")}
        ${feat.heroImage ? "" : `<div class="big-emoji">${feat.recipe.emoji}</div>`}
        <span style="position:relative;align-self:flex-start;display:inline-flex;gap:6px">${feat.noMusic ? `<span class="badge-guided">🍳 Guided</span>` : `<span class="badge-sync">🎵 Music Sync</span>`}<span class="pill free">FREE</span></span>
        <h2 style="margin-top:auto">${feat.recipe.title}</h2>
        <p class="song">${feat.noMusic ? feat.recipe.emoji + " " + esc(feat.recipe.technique) + " · cook at your pace" : "🎸 " + feat.song.title + " · " + feat.song.artist}</p>
        <div class="row">
          <span class="pill">⏱ ~${expMins(feat)} min</span>
          <span class="pill">${feat.recipe.technique}</span>
          ${feat.noMusic ? "" : `<span class="card-preview" data-prev="0">👀 Preview</span>`}
        </div>
      </div>
      ${statLineHTML(feat.recipe.title, "margin-top:8px")}

      ${EXPERIENCES.length > 1 ? `
      ${scanAvailable() ? `
      <button class="scan-entry" id="scanEntry"><span class="se-emoji">📸</span><span class="se-body"><b>What can I cook right now?</b><small>Snap your fridge — we'll match recipes to what you've got.</small></span><span class="se-go">→</span></button>` : ""}

      <p class="section-title">🎵 More music cooks</p>
      <div class="catalog">
        ${ordered.slice(1).map((x, i) => `
          <button class="rcard mexp" data-mexp="${i + 1}">
            <div class="rthumb">${recipeThumbInner(x)}${bookmarkHTML(x.id)}</div>
            <div class="rinfo">
              <b>${x.recipe.title}</b>
              <small>${x.noMusic ? x.recipe.emoji + " " + esc(x.recipe.technique) : "🎸 " + x.song.title + " · " + x.song.artist}</small>
              <div class="rrow">${x.noMusic ? `<span class="badge-guided">🍳 Guided</span>` : syncBadge()}${lockBadge(x.id)}<span class="pill">⏱ ~${expMins(x)} min</span>${x.noMusic ? "" : `<span class="card-preview" data-prev="${i + 1}">👀 Preview</span>`}</div>
              ${statLineHTML(x.recipe.title, "margin:4px 0 0;font-size:11px")}
            </div>
          </button>`).join("")}
      </div>` : ""}

      ${LIBRARY_VISIBLE ? `
      <div class="section-title" style="display:flex;justify-content:space-between;align-items:center">
        <span>✅ Easy picks to start</span><span class="pill">Guided mode</span>
      </div>
      <p class="muted" style="font-size:12px;margin:-6px 2px 10px">Picked for right now — your time of day, your skill level${libraryFree() ? "" : " · tap to look, cook with Premium"}.</p>
      <div id="easyPicks" class="catalog"><p class="muted" style="font-size:13px">Loading recipes…</p></div>

      <p class="section-title">🔍 Find any recipe</p>
      <p class="muted" style="font-size:12px;margin:-6px 2px 10px">The whole catalog — free to dig through. No 2,000-word backstory before the recipe${libraryFree() ? "" : "; cooking's a Premium thing"}.</p>
      <div class="searchrow">
        <input class="field" id="rsearch" placeholder="Search all of TheMealDB… e.g. curry, pasta" autocomplete="off" />
        <button class="icon-btn" id="rsearchBtn" title="Search">🔍</button>
      </div>
      <div id="filterbarWrap"></div>
      <div id="searchResults" class="catalog"></div>
      ` : ""}

      <div class="ad"><p>FREE TIER · <b>ad placement</b> · upgrade to remove ads</p></div>
      <p class="attribution" id="attr"></p>
      <div style="height:18px"></div>
    `));
    $("#featured").onclick = () => { EXP = ordered[0]; cookMethod = null; resetPrepPrefs(); screens.prep(); };
    { const se = $("#scanEntry"); if (se) se.onclick = () => screens.scanCamera(); }
    mountResumeCard();   // COOK RESUME: paint from cache, then refresh from the server (cross-device)
    // §4.2 fulfillment loop: "the recipe you asked for is live" (v1 notification)
    if (backendOn()) API.requestsFulfilled().then((r) => {
      const rows = (r && r.fulfilled) || [];
      const slot = $("#reqShipped");
      if (!rows.length || !slot) return;
      const f = rows[0];
      slot.innerHTML = `<button class="req-shipped" id="reqShippedCard">🎉 The recipe you asked for is live: <b>${esc(f.title)}</b> 🔥</button>`;
      $("#reqShippedCard").onclick = () => {
        trackEvent("request_fulfilled_seen");
        try { API.requestSeen(f.id).catch(() => { }); } catch (e) { }
        // watch for the golden metric: did on-demand generation drive a real cook?
        const w = new Set(state.prefs.reqWatch || []); w.add(f.title); state.prefs.reqWatch = [...w]; saveProfile();
        const exp = (window.EXPERIENCES || []).find((x) => x.recipe.title === f.title);
        if (exp) openRecipe({ id: exp.id, title: f.title }, "fulfillment");   // synced → prep flow via the standard router
        else { toast("Find it on the home screen 👇"); $("#reqShipped").innerHTML = ""; }
      };
    }).catch(() => { });
    $$(".mexp").forEach((b) => b.onclick = () => { EXP = ordered[+b.dataset.mexp]; cookMethod = null; resetPrepPrefs(); screens.prep(); });
    $$(".card-preview").forEach((el) => el.onclick = (e) => { e.stopPropagation(); startPreview(ordered[+el.dataset.prev]); });
    wireBookmarks("#app", (id) => EXPERIENCES.find((e) => e.id === id));
    $("#hamburger").onclick = () => Sidebar.open();
    { const sb = $("#streakBadge"); if (sb) sb.onclick = () => screens.cookHistory(); }
    // one-time voice-control announcement for already-onboarded users (never
    // shown mid-cook; unsupported browsers skip it and keep the flag unset)
    if (VoiceCtrl.supported() && !state.prefs.voiceCtrlAsked && state.experience) {
      const wrap = document.createElement("div");
      wrap.className = "confirm-scrim show";
      wrap.innerHTML = `<div class="confirm-box" style="text-align:left;max-width:330px">${voiceOptinCardHTML()}</div>`;
      app.appendChild(wrap);
      const close = () => { if (wrap.parentNode) wrap.remove(); };
      const settle = wireVoiceOptin(close, wrap.querySelector(".confirm-box"));
      wrap.onclick = (e) => { if (e.target === wrap) { settle(false); close(); } };   // dismiss = Not now
    }
    Sidebar.setActive("home");

    // Easy picks + browse/search are free for everyone now; cooking is gated in recipeDetail.
    // LIBRARY HIDDEN: skip the imported-catalog surfaces entirely (no API.recipes call,
    // no TheMealDB attribution needed) — the sections aren't rendered.
    if (LIBRARY_VISIBLE) {
      renderEasyPicks();
      mountSearchSurface();
      loadCatalog().then((d) => { const a = $("#attr"); if (a) a.textContent = d.attribution || ""; });
    }
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
          <p class="eyebrow" style="margin-bottom:6px">Coming soon</p>
          <h2>Cook to your own music</h2>
          <p class="lead" style="margin-top:8px">Premium opens the full recipe library and lets you cook to your own Spotify or Apple Music. We've got bills too — no pressure. We'll ping you when it's live.</p>
        </div>
        <p class="section-title" style="margin-top:20px">Developer / tester access</p>
        <div class="card">
          <p class="muted" style="font-size:13px;margin-bottom:12px">Have a developer code? Enter it below to unlock Premium for testing.</p>
          <div class="searchrow">
            <input class="field" id="devcode" placeholder="Developer code" autocomplete="off" autocapitalize="none" />
            <button class="icon-btn" id="redeem" title="Unlock" style="width:auto;padding:0 16px;font-weight:800;color:var(--white)">Unlock</button>
          </div>
        </div>
      ` : `
        <div class="card" style="margin-top:14px;border-color:var(--success)">
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
        // Codes are validated server-side only (env-configured list) — no client-side
        // fallback: a hardcoded code in shipped JS is readable by anyone.
        toast(backendOn() ? "Sign in first to redeem a code" : "Codes need a connection — try again online");
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
        <p class="muted" style="font-size:12px;line-height:1.5">Paste your own app's <b>Client ID</b> (create one free at <a href="https://developer.spotify.com/dashboard" target="_blank" style="color:var(--accent)">developer.spotify.com/dashboard</a>).</p>
        <div class="searchrow" style="margin-top:12px">
          <input class="field" id="spClient" placeholder="Paste Client ID…" autocomplete="off" autocapitalize="none" />
          <button class="icon-btn" id="spSave" style="width:auto;padding:0 16px;font-weight:800;color:var(--white)">Save</button>
        </div>
        <button class="btn ghost" id="spUseDefault" style="margin-top:8px;font-size:12px">← Use the built-in Choppd app instead</button>`;
      $("#spSave").onclick = () => { const v = $("#spClient").value.trim(); if (!v) return toast("Paste your Client ID first"); sp.setClientId(v); spForceIdEntry = false; toast("Saved ✓"); renderConnectArea(); };
      $("#spUseDefault").onclick = () => { sp.setClientId(""); spForceIdEntry = false; renderConnectArea(); };
      return;
    }

    if (!sp.isLoggedIn()) {
      box.innerHTML = `
        <p class="muted" style="font-size:12px;line-height:1.5;margin-bottom:12px">Just log in with your Spotify account to connect your library. In-app streaming requires <b>Spotify Premium</b>.</p>
        <button class="btn" id="spLogin" style="background:var(--spotify);box-shadow:0 8px 20px rgba(29,185,84,.3)">Log in with Spotify</button>
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

    sp.me().then((m) => { const w = $("#spWho"); if (w && m) w.textContent = `✓ Connected as ${m.display_name || m.email}`; }).catch(() => { });
    const testBtn = $("#spTest");
    if (testBtn) testBtn.onclick = async () => {
      const diag = $("#spDiag");
      testBtn.disabled = true; testBtn.textContent = "Testing…";
      try { await sp.activate(); } catch (e) { }
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
    if (stopBtn) stopBtn.onclick = () => { try { sp.stop(); } catch (e) { } toast("Playback stopped ⏹"); };
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
      : `<p class="muted" style="font-size:12px">Nothing matched that. Try fewer words — fancy names aren't the point here.</p>`;

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

  // ============================================================
  // APPLE MUSIC PILOT — source selection + picker (§1 port of the Spotify queue UX, AM-backed).
  // "Choppd's pick" (the recipe's local track — the spine) vs "Your music" (AM catalog search → an
  // ambient queue). Gated on appleMusicCapable(). NO paywall (MusicKit no-charge rule); any AM
  // failure / no-sub falls back to the local track silently-seamlessly (never an upsell).
  // ============================================================
  const currentAmSel = () => (state.amQueue && state.amQueue.length) ? { ids: state.amQueue.map((x) => x.id), labels: state.amQueue.map((x) => x.label) } : null;
  const clearAmSel = () => { state.amQueue = []; state.amShuffle = false; saveEnt(); };   // new pick resets shuffle
  // Shuffle is offered only when the queue is shuffle-able: a playlist (its own track list) or ≥2 songs.
  const amShuffleable = () => { const q = state.amQueue || []; return q.length >= 2 || q.some((x) => /^am\.pl\./.test(x.id) || x.kind === "🎧"); };
  const _amArt = (img, fb) => img ? `<img class="sp-art" src="${esc(img)}" alt="" loading="lazy">` : `<span class="sp-art ph">${fb || "🎵"}</span>`;
  // Mount the AM source toggle + picker. `onChange` refreshes the caller's "▶ On Start" summary.
  // Copy is DRAFT-PENDING-VOICE-REVIEW.
  function mountAmSource(rootSel, onChange) {
    const root = document.querySelector(rootSel);
    if (!root || !window.AppleMusic_) return;
    root.innerHTML = `
      <p class="section-title" style="margin-top:0">🎵 Your kitchen soundtrack</p>
      <div class="am-src">
        <button class="choice am-opt" id="amChoppd"><span class="emoji">🍳</span><span>Choppd's pick<small>${esc(EXP.song.title || "the recipe track")} — plays automatically</small></span></button>
        <button class="choice am-opt" id="amYours"><span class="emoji">🎧</span><span>Your music<small>Apple Music — plays under the cook</small></span></button>
      </div>
      <div id="amPicker" style="margin-top:12px"></div>`;
    // A-FIX (the dead button): the picker's visibility + highlight track an explicit MODE, NOT whether a
    // queue exists. Tapping "Your music" the first time (nothing queued yet) must open the search — the
    // old code hid it because currentAmSel() was still empty, so the button looked dead. A rendered
    // button never silently ignores a tap.
    let mode = currentAmSel() ? "yours" : "choppd";
    const sync = () => {
      $("#amChoppd").classList.toggle("selected", mode === "choppd");
      $("#amYours").classList.toggle("selected", mode === "yours");
      $("#amPicker").hidden = mode !== "yours";
    };
    const change = () => { if (onChange) onChange(); };   // summary refresh; the picker re-renders itself
    $("#amChoppd").onclick = () => { mode = "choppd"; clearAmSel(); $("#amPicker").innerHTML = ""; sync(); change(); };
    $("#amYours").onclick = () => { mode = "yours"; sync(); mountAmPicker("#amPicker", change); };   // highlight + search render immediately, before anything is queued
    if (mode === "yours") mountAmPicker("#amPicker", change);
    sync();
  }
  function mountAmPicker(rootSel, onChange) {
    const box = document.querySelector(rootSel); if (!box) return;
    const AM = window.AppleMusic_;
    try { AM.warmup(); } catch (e) { }   // C1: establish the player connection at picker open — the first cook isn't the guinea pig
    let tab = "search";
    const summary = () => {
      const q = state.amQueue || [];
      if (!q.length) return `<p class="muted" style="font-size:11px;margin:8px 2px 2px">No song yet — search or pick a playlist, then tap ＋.</p>`;
      // B: 🔀 Shuffle only when shuffle-able (playlist / ≥2 songs); hidden for a single song. DRAFT-PENDING-VOICE-REVIEW.
      const shuf = amShuffleable() ? `<label class="sp-toggle" style="margin-top:8px"><input type="checkbox" id="amShuf" ${state.amShuffle ? "checked" : ""}/> 🔀 Shuffle</label>` : "";
      return `<p class="muted" style="font-size:11px;margin:8px 2px 2px">▶ On Start: <b>${q.length} track${q.length > 1 ? "s" : ""}</b> — plays under the cook.</p>
           <ul class="qlist">${q.map((x, i) => `<li>${_amArt(x.img, x.kind)}<span class="qname">${esc(x.label)}</span><button class="qx" data-i="${i}" title="Remove">✕</button></li>`).join("")}</ul>${shuf}`;
    };
    const refreshSummary = () => { const s = box.querySelector("#amSummary"); if (s) { s.innerHTML = summary(); wireSummary(); } };
    const wireSummary = () => {
      box.querySelectorAll(".qx").forEach((b) => b.onclick = () => { state.amQueue.splice(+b.dataset.i, 1); if (!amShuffleable()) state.amShuffle = false; saveEnt(); refreshSummary(); if (onChange) onChange(); });
      const sh = box.querySelector("#amShuf"); if (sh) sh.onchange = () => { state.amShuffle = sh.checked; saveEnt(); };
    };
    const add = (id, label, img, kind) => { state.amQueue.push({ id, label, img: img || null, kind: kind || "🎵" }); saveEnt(); refreshSummary(); toast("Added ✓"); if (onChange) onChange(); };
    const row = (it) => `<button class="choice sp-item" data-id="${esc(it.id)}" data-label="${esc(it.label)}" data-img="${esc(it.img || "")}" data-kind="${esc(it.kind || "🎵")}">${_amArt(it.img, it.kind)}<span>${esc(it.label)}</span><span class="mini" style="margin-left:auto">＋</span></button>`;
    const wireRows = (host) => host.querySelectorAll(".sp-item").forEach((b) => b.onclick = () => add(b.dataset.id, b.dataset.label, b.dataset.img || null, b.dataset.kind));
    const draw = () => {
      box.innerHTML = `
        <div class="sp-tabs am-tabs"><button class="sp-tab ${tab === "search" ? "active" : ""}" data-t="search">Search</button><button class="sp-tab ${tab === "playlists" ? "active" : ""}" data-t="playlists">Your playlists</button></div>
        <div id="amPanel" style="margin-top:8px"></div>
        <div id="amSummary">${summary()}</div>`;
      box.querySelectorAll(".sp-tab").forEach((b) => b.onclick = () => { tab = b.dataset.t; draw(); });
      panel(); wireSummary();
    };
    const panel = () => {
      const p = box.querySelector("#amPanel"); if (!p) return;
      if (tab === "search") {
        p.innerHTML = `<div class="searchrow"><input class="field" id="amq" placeholder="Search Apple Music…" autocomplete="off"/><button class="icon-btn" id="amclr" title="Clear" hidden>✕</button><button class="icon-btn" id="amgo" title="Search">🔍</button></div><div id="amResults" class="stack" style="margin-top:8px"></div>`;
        const input = $("#amq"), clr = $("#amclr"), res = $("#amResults");
        const run = async () => {
          const q = input.value.trim(); if (!q) return;
          res.innerHTML = `<p class="muted" style="font-size:12px">Searching…</p>`;
          try { const items = await AM.search(q); res.innerHTML = items.length ? items.map(row).join("") : `<p class="muted" style="font-size:12px">No results for “${esc(q)}”.</p>`; wireRows(res); }
          catch (e) { res.innerHTML = `<p class="muted" style="font-size:12px">❌ ${esc((e && e.message) || "Search failed")} — Choppd's pick will play instead.</p>`; }
        };
        input.oninput = () => { clr.hidden = !input.value; };
        // C-FIX (✕ clear): wipe query + results, keep the keyboard up (refocus the input).
        clr.onclick = () => { input.value = ""; res.innerHTML = ""; clr.hidden = true; input.focus(); };
        $("#amgo").onclick = run; input.onkeydown = (e) => { if (e.key === "Enter") run(); };
      } else {
        p.innerHTML = `<p class="muted" style="font-size:12px">Loading your playlists…</p>`;
        AM.userPlaylists().then((pls) => {
          p.innerHTML = (pls && pls.length) ? pls.map((pl) => row({ id: pl.id, label: pl.label, img: pl.img, kind: "🎧" })).join("") : `<p class="muted" style="font-size:12px">No playlists in your library yet.</p>`;
          wireRows(p);
        }).catch(() => { p.innerHTML = `<p class="muted" style="font-size:12px">Couldn't load your playlists.</p>`; });
      }
    };
    draw();
  }
  // AM status rows (Job 2) — Connected / Subscription / Storefront / last-attempt + human error.
  function amStatusRowsHTML() {
    const AM = window.AppleMusic_; const st = AM && AM.authState(), la = AM && AM.lastAttempt();
    const yn = (b) => b ? "✓" : "✗";
    return st ? `
      <div class="am-status">
        <div class="am-row"><span>Connected</span><b>${yn(st.authorized)}</b></div>
        <div class="am-row"><span>Subscription</span><b>${st.subscribed ? "✓" : (st.authorized ? "✗ no active subscription" : "—")}</b></div>
        <div class="am-row"><span>Storefront</span><b>${esc((st.storefront || "—").toUpperCase())}</b></div>
        ${la ? `<div class="am-row"><span>Last playback</span><b>${la.ok ? "✓ OK" : "✗ failed"}</b></div>${la.ok ? "" : `<p class="muted" style="font-size:12px;margin:4px 2px 0">${esc(AM.humanError(la.detail))}</p>`}` : ""}
      </div>` : `<p class="muted" style="font-size:12px;margin:0 2px">Not connected yet — tap Connect below.</p>`;
  }
  // C: test-playback state — ONE track at a time, stopped on tab exit (Sidebar.go / re-entry).
  let _amTestId = null;
  function stopAmTest() { _amTestId = null; try { if (window.AppleMusic_) window.AppleMusic_.stop(); } catch (e) { } }
  // The "Music" sidebar tab — connect + status + troubleshoot + TEST PLAYBACK. One surface, everything
  // music. Native + pilot only (the sidebar entry is gated the same way).
  screens.music = () => {
    Sidebar.setActive("music");
    stopAmTest();
    const AM = window.AppleMusic_;
    const st = AM && AM.authState();
    h(screenEl("", `
      ${sectionHead("🎧 Music")}
      ${amStatusRowsHTML()}
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn secondary" id="amConnect" style="flex:1;font-size:13px">${st && st.authorized ? "Reconnect" : "Connect Apple Music"}</button>
        <button class="btn secondary" id="amRetry" style="flex:1;font-size:13px">Try again</button>
      </div>
      <p class="muted" style="font-size:11px;margin:8px 2px 0">Choppd plays your Apple Music through your device — one tap to allow, no separate sign-in. Free with your subscription; Choppd never charges for it.</p>
      <p class="section-title" style="margin-top:22px">Test playback</p>
      <p class="muted" style="font-size:12px;margin:0 2px 8px">Search a song and tap ▶ to play it right here — proves Apple Music works without starting a cook.</p>
      <div class="searchrow"><input class="field" id="mtq" placeholder="Search Apple Music…" autocomplete="off"/><button class="icon-btn" id="mtclr" title="Clear" hidden>✕</button><button class="icon-btn" id="mtgo" title="Search">🔍</button></div>
      <div id="mtResults" class="stack" style="margin-top:8px"></div>
      <div id="mtNow" style="margin-top:10px"></div>
    `));
    wireSectionHead();
    const probe = async () => { try { await AM.authorize(); } catch (e) { } screens.music(); };   // re-probe + refresh the rows
    const c = $("#amConnect"); if (c) c.onclick = probe;
    const rb = $("#amRetry"); if (rb) rb.onclick = probe;
    const input = $("#mtq"), clr = $("#mtclr"), res = $("#mtResults"), now = $("#mtNow");
    const run = async () => {
      const q = input.value.trim(); if (!q) return;
      res.innerHTML = `<p class="muted" style="font-size:12px">Searching…</p>`;
      try {
        const items = await AM.search(q);
        res.innerHTML = items.length ? items.map((it) => `<button class="choice sp-item" data-id="${esc(it.id)}" data-label="${esc(it.label)}" data-img="${esc(it.img || "")}" data-kind="${esc(it.kind || "🎵")}">${_amArt(it.img, it.kind)}<span>${esc(it.label)}</span><span class="mini" style="margin-left:auto">▶ Test</span></button>`).join("") : `<p class="muted" style="font-size:12px">No results.</p>`;
        res.querySelectorAll(".sp-item").forEach((b) => b.onclick = () => testPlay(b.dataset.id, b.dataset.label));
      } catch (e) { res.innerHTML = `<p class="muted" style="font-size:12px">❌ ${esc((e && e.message) || "Search failed")}</p>`; }
    };
    input.oninput = () => { clr.hidden = !input.value; };
    clr.onclick = () => { input.value = ""; res.innerHTML = ""; clr.hidden = true; input.focus(); };
    $("#mtgo").onclick = run; input.onkeydown = (e) => { if (e.key === "Enter") run(); };
    const renderNow = (ok, err, label) => {
      now.innerHTML = ok
        ? `<div class="am-row" style="margin-top:4px"><span>▶ Playing <b>${esc(label)}</b></span><button class="btn secondary" id="mtStop" style="width:auto;font-size:12px;padding:6px 14px">■ Stop</button></div><p class="muted" style="font-size:12px;margin:4px 2px 0">✓ Apple Music is working.</p>`
        : `<p class="muted" style="font-size:12px;margin:4px 2px 0">✗ ${esc(AM.humanError(err))}</p>`;
      const s = $("#mtStop"); if (s) s.onclick = () => { stopAmTest(); now.innerHTML = `<p class="muted" style="font-size:12px">Stopped.</p>`; };
    };
    async function testPlay(id, label) {
      stopAmTest(); _amTestId = id;
      now.innerHTML = `<p class="muted" style="font-size:12px">Starting <b>${esc(label)}</b>…</p>`;
      try {
        const qr = await AM.queue([id]);
        if (qr && qr.ok === false) { AM.noteAttempt(false, qr.error || "queue-failed"); return renderNow(false, qr.error || "queue-failed", label); }
        const pr = await AM.play();
        if (pr && pr.ok === false) { AM.noteAttempt(false, pr.error || "play-failed"); return renderNow(false, pr.error || "play-failed", label); }
        AM.noteAttempt(true, "ok"); renderNow(true, null, label);
      } catch (e) { AM.noteAttempt(false, "exception:" + (e && e.message)); renderNow(false, "exception:" + (e && e.message), label); }
    }
  };
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
        li.ondragstart = (e) => { dragFrom = +li.dataset.i; li.classList.add("dragging"); try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(dragFrom)); } catch (_) { } };
        li.ondragend = () => { li.classList.remove("dragging"); box.querySelectorAll(".qlist li").forEach((x) => x.classList.remove("dragover")); };
        li.ondragover = (e) => { e.preventDefault(); try { e.dataTransfer.dropEffect = "move"; } catch (_) { } li.classList.add("dragover"); };
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

  // ---- shared recipe THUMBNAIL (hero image over an emoji fallback) -------------
  // ONE helper for every tile/card surface. The hero <img> is absolutely positioned
  // over the recipe's own emoji (lazy-loaded); it covers the emoji once it paints,
  // and on a 404 it removes itself so the emoji shows through — no broken-image
  // icon, no layout shift, no per-recipe wiring. Emoji-in-TEXT is untouched.
  // Reads the image source PER-RECIPE and generically (flagship heroImage via
  // id/title lookup; imported strMealThumb) — no hardcoded flagship path, so
  // imported cards get their own thumbs through the same helper when LIBRARY_VISIBLE.
  const _thumbTitle = (o) => (o && ((o.recipe && o.recipe.title) || (typeof o.recipe === "string" ? o.recipe : null) || o.title)) || null;
  const _thumbFlagship = (o) => {
    if (!o) return null;
    const id = o.id || o.recipeId, title = _thumbTitle(o);
    return (window.EXPERIENCES || []).find((e) => (id && e.id === id) || (title && e.recipe.title === title)) || null;
  };
  function recipeHeroSrc(o) {
    if (!o) return null;
    if (o.heroImage) return o.heroImage;                 // an EXP object passed directly
    const f = _thumbFlagship(o);
    if (f && f.heroImage) return f.heroImage;            // flagship resolved by id/title
    return o.thumb || null;                               // imported strMealThumb (generic)
  }
  function recipeEmoji(o, fallback) {
    const own = o && ((o.recipe && o.recipe.emoji) || o.emoji);
    const f = !own ? _thumbFlagship(o) : null;
    return own || (f && f.recipe.emoji) || fallback || "🍽️";
  }
  // The INNER content for a `.rthumb`/`.hist-emoji` tile: emoji + hero overlay.
  function recipeThumbInner(o, fallbackEmoji) {
    const hero = recipeHeroSrc(o);
    return `${recipeEmoji(o, fallbackEmoji)}${hero ? `<img class="rthumb-hero" src="${esc(hero)}" alt="" loading="lazy" onerror="this.remove()">` : ""}`;
  }
  // Recipe-type badges (data-driven off the music-sync flag): hand-crafted cooks
  // get the premium music-sync badge; TheMealDB imports get a neutral library label.
  const isMusicSyncRecipe = (r) => !!(r && (r.isMusicSync || r.musicSynced));
  const syncBadge = (cls) => `<span class="badge-sync${cls ? " " + cls : ""}">🎵 Music Sync</span>`;
  const guidedBadge = (cls) => `<span class="badge-guided${cls ? " " + cls : ""}">🍳 Guided</span>`;
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
  // launch-origin (scan-flow nav spec): recipe screens learn where they were
  // opened from; back returns THERE. Unknown/absent = dashboard (current behavior).
  let launchOrigin = "dashboard";
  let cookRunning = false;  // mid-cook browser-back guard: a STARTED music cook only (WakeLock's cookActive is broader — any cook context incl. prep)
  // SCOPED pushState: only the scan chain (review → results → recipe). Popstate
  // elsewhere degrades to a no-op (the SPA never routed on history before).
  function pushScanState(scr) { try { history.pushState({ scan: scr }, ""); } catch (e) { } }
  window.addEventListener("popstate", (e) => {
    if (cookRunning) { try { history.pushState({ guard: 1 }, ""); } catch (e2) { } toast("Use Quit to leave the cook"); return; }
    const st = (e.state || {});
    if (st.scan === "results") {
      if (lastScan) { screens.scanResults(lastScan.matches, lastScan.concepts, lastScan.tab); }
      else { toast("That scan expired — snap it again 📸"); screens.scanCamera(); }
      return;
    }
    if (st.scan === "confirm") { screens.scanConfirm(false); return; }
    // anything else: no-op (default SPA behavior, no worse than before)
  });
  let lastScan = null;   // { matches, concepts, tab } — results re-render from memory: NO re-scan, NO vision calls, NO limit debit
  function backFromRecipe() {
    if (launchOrigin === "scan") {
      if (lastScan) { screens.scanResults(lastScan.matches, lastScan.concepts, lastScan.tab); return; }
      toast("That scan expired — snap it again 📸");   // expired state: quiet note, never a blank screen
      screens.scanCamera(); return;
    }
    screens.home();
  }
  async function openRecipe(r, origin) {
    launchOrigin = origin || "dashboard";
    if (origin === "scan") pushScanState("recipe");
    const exp = musicExpFor(r);
    if (exp) { EXP = exp; cookMethod = null; resetPrepPrefs(); screens.prep(); return; }
    // LIBRARY HIDDEN: imported recipes aren't reachable — never open a broken guided
    // detail; route home gracefully (also covers a stale deep link / saved item).
    if (!LIBRARY_VISIBLE) { toast("That recipe isn't available right now"); screens.home(); return; }
    if (r.ingredients || !backendOn()) { screens.recipeDetail(r); return; }
    try { const { recipe } = await API.recipeById(r.id); screens.recipeDetail(recipe || r); }
    catch (e) { if (e && e.status === 404) { toast("That recipe isn't available right now"); screens.home(); return; } screens.recipeDetail(r); }
  }
  const CORE_FREE_IDS = ["scrambled-eggs", "freebird-medium-rare-steak", "one-pot-garlic-parmesan-pasta", "crispy-chicken-thighs"];
  // the wall must never surprise at the gate: locked premium recipes show 🔒 on cards
  function lockBadge(recipeId) {
    if (LIBRARY_OPEN_TO_ALL) return "";   // launch-phase: no 🔒 on library recipes while open
    const l = state.limits;
    if (!l || l.exempt) return "";
    if (CORE_FREE_IDS.includes(recipeId)) return "";
    if ((l.unlockedIds || []).includes(recipeId)) return `<span class="pill" title="Unlocked — yours forever">🔓</span>`;
    return `<span class="pill" title="Premium — uses an unlock">🔒</span>`;
  }
  function recipeCardHTML(r) {
    const musicExp = musicExpFor(r);
    if (musicExp) {
      // music-sync cook: hero photo (emoji fallback) + Music Sync badge
      return `<button class="rcard" data-id="${esc(r.id)}">
        <div class="rthumb">${recipeThumbInner(r, "🎵")}${bookmarkHTML(r.id)}</div>
        <div class="rinfo">
          <b>${r.emoji || ""} ${esc(r.title)}</b>
          <small>${esc([CUISINES.find((c) => c.id === r.cuisine)?.label, r.category].filter(Boolean).join(" · "))}</small>
          <div class="rrow">${musicExp.noMusic ? guidedBadge() : syncBadge()}${lockBadge(r.id)}${diffBadge(r.difficulty)}</div>
          ${statLineHTML(r.title, "margin:4px 0 0;font-size:11px")}
        </div>
      </button>`;
    }
    return `<button class="rcard" data-id="${esc(r.id)}">
        <div class="rthumb">${recipeThumbInner(r)}
          ${r.hasSafetyGate ? `<span class="rsafety" title="Has doneness safety checks">🌡️</span>` : ""}
          ${bookmarkHTML(r.id)}
        </div>
        <div class="rinfo">
          <b>${r.emoji} ${esc(r.title)}</b>
          <small>${esc([r.area, r.category].filter(Boolean).join(" · "))}</small>
          <div class="rrow">${libraryBadge()}${lockBadge(r.id)}${diffBadge(r.difficulty)}<span class="pill">📋 ${r.stepCount} steps</span><span class="pill">⏱ ~${r.estimatedTimeMin}m</span></div>
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
      box.innerHTML = header + `<p class="muted" style="font-size:13px">Nothing jumping out for ${slotName} — <button class="linklike" id="browseAll">dig through the whole catalog ↓</button>.</p>`;
      const ba = box.querySelector("#browseAll"); if (ba) ba.onclick = () => { const si = app.querySelector("#rsearch"); if (si) si.scrollIntoView({ behavior: "smooth" }); };
      wireEasyPrompt(box);
      return;
    }

    const cards = chosen.map((r) => `
      <button class="rcard" data-id="${r.id}">
        <div class="rthumb">${recipeThumbInner(r)}
          ${r.hasSafetyGate ? `<span class="rsafety" title="Has doneness safety checks">🌡️</span>` : ""}
          ${bookmarkHTML(r.id)}
        </div>
        <div class="rinfo">
          <b>${r.emoji} ${esc(r.title)}</b>
          <small class="easy-why">✨ ${esc(pickWhy(r, slot, prefs))}</small>
          <div class="rrow">${libraryBadge()}${lockBadge(r.id)}${diffBadge(r.difficulty)}<span class="pill">📋 ${r.stepCount} steps</span><span class="pill">⏱ ~${r.estimatedTimeMin}m</span></div>
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
  function setUnitSystem(v) { try { localStorage.setItem("seartune_units", v === "metric" ? "metric" : "us"); } catch (e) { } state.prefs.units = unitSystem(); }
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

  // Singularize a spelled-out count noun when the amount is ≤ 1 (for-one defaults
  // make this common): "1 cloves"→"1 clove", "3/4 cups"→"3/4 cup". Abbreviations
  // (tbsp/tsp/oz/lb) are already invariant; only the listed count nouns are touched.
  const _SING = { cups: "cup", cloves: "clove", slices: "slice", breasts: "breast", packets: "packet", pouches: "pouch", thighs: "thigh", tortillas: "tortilla", rolls: "roll", bowls: "bowl", sandwiches: "sandwich", eggs: "egg", patties: "patty", burgers: "burger", steaks: "steak", pancakes: "pancake" };
  function singularizeIfSmall(text, value) {
    if (value > 1) return text;
    return text.replace(/\b(cups|cloves|slices|breasts|packets|pouches|thighs|tortillas|rolls|bowls|sandwiches|eggs|patties|burgers|steaks|pancakes)\b/i, (m) => _SING[m.toLowerCase()] || m);
  }
  // Clean a free-text measure, drop trailing prep words, scale the leading qty.
  function scaleAmount(measure, scale) {
    let clean = FRAC(String(measure || "")).trim()
      .replace(/[,\s]*\b(chopped|diced|minced|sliced|grated|crushed|peeled|cubed|shredded|beaten|melted|softened|finely|roughly|freshly|small|large|bite-sized|bite-size|thinly|thin|thick|to serve|for garnish)\b/gi, "")
      .replace(/\s{2,}/g, " ").replace(/[,\s]+$/, "").trim();
    if (!clean || /^(to taste|for garnish|to serve|as needed|garnish|optional)$/i.test(clean)) return "";
    if (scale === 1) return clean;
    const qty = parseQty(clean);
    if (qty == null) return clean;                 // "a pinch" etc. — don't scale
    const rest = clean.replace(/^[\d\s./]+/, "").trim();
    const v = qty * scale;
    return fmtQty(v) + (rest ? " " + singularizeIfSmall(rest, v) : "");
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
      ? `<li class="opt-ing ${optActive(r.id, i.name) ? "" : "off"}"><label class="opt-ing-label"><input type="checkbox" data-optname="${esc(i.name)}" ${optActive(r.id, i.name) ? "checked" : ""}/><span>${esc(capFirst(i.label || i.name))} <em class="opt">(optional)</em></span></label><span class="muted">${esc(dm(i.measure))}</span></li>`
      : `<li><span>${esc(capFirst(i.label || i.name))}</span><span class="muted">${esc(dm(i.measure))}</span></li>`;
    return `
      <div class="section-title" style="display:flex;justify-content:space-between;align-items:center">
        <span>Ingredients</span>
        <span class="unit-toggle" id="unitToggle" role="button" tabindex="0" aria-label="Switch units" title="Switch units"><span class="${metricOn() ? "" : "on"}">US</span><span class="${metricOn() ? "on" : ""}">Metric</span></span>
      </div>
      <div class="card"><ul class="ing">${r.ingredients.filter((i) => !i.opt || i.opt === (activeMethod() || {}).id).map(li).join("")}</ul></div>
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
      const items = r.ingredients.slice(0, 16).filter((i) => (!i.optional || optActive(r.id, i.name)) && (!i.opt || i.opt === (activeMethod() || {}).id));   // method-opt filter too, so philly's two beef entries don't double-count
      const results = [];
      for (let i = 0; i < items.length; i++) {
        nutriBtn.textContent = `Loading nutrition… ${i + 1}/${items.length}`;
        const measure = dm(items[i].measure);
        try { const d = await API.nutrition(items[i].name); results.push({ name: items[i].name, measure, n: d.nutrition }); }
        catch (e) { results.push({ name: items[i].name, measure, n: null }); }
      }
      let totK = 0, totP = 0, totF = 0, totC = 0, counted = 0, partial = false;
      const rows = results.map(({ name, measure, n }) => {
        if (!n) { partial = true; return `<li><span>${esc(capFirst(name))}</span><span class="muted" style="font-size:11px">no data</span></li>`; }
        const grams = measureToGrams(measure, name);
        if (!grams) { partial = true; return `<li><span>${esc(capFirst(name))}${measure ? ` <em class="opt">${esc(measure)}</em>` : ""}</span><span class="nutri">${n.kcal != null ? `${n.kcal}/100g` : ""}</span></li>`; }
        const f = grams / 100;
        const k = n.kcal != null ? Math.round(n.kcal * f) : null;
        const p = n.protein != null ? Math.round(n.protein * f) : null;
        const ft = n.fat != null ? Math.round(n.fat * f) : null;
        const c = n.carbs != null ? Math.round(n.carbs * f) : null;
        if (k != null) { totK += k; counted++; }
        if (p != null) totP += p; if (ft != null) totF += ft; if (c != null) totC += c;
        return `<li><span>${esc(capFirst(name))}${measure ? ` <em class="opt">${esc(measure)}</em>` : ""}</span><span class="nutri">${k != null ? `<b>${k}</b> kcal` : ""}${p != null ? ` · P${p}` : ""}${ft != null ? ` · F${ft}` : ""}${c != null ? ` · C${c}` : ""}</span></li>`;
      }).join("");
      const totalRow = counted ? `<li class="nutri-total"><span><b>Total (estimated)</b></span><span class="nutri"><b>${totK} kcal</b> · P${totP} · F${totF} · C${totC}</span></li>` : "";
      box.innerHTML = `
        <p class="muted" style="font-size:11px;margin:8px 2px 4px"><b style="color:var(--text)">Key</b> — kcal = calories · <b style="color:var(--text)">P</b> = protein · <b style="color:var(--text)">F</b> = fat · <b style="color:var(--text)">C</b> = carbs (grams)</p>
        <div class="card" style="margin-top:0"><ul class="ing nutri-list">${rows}${totalRow}</ul></div>
        <p class="muted" style="font-size:10px;margin-top:6px">Rough estimate — each ingredient's nutrition is scaled from the listed amount${partial ? " (items marked “no data”/“/100g” aren't in the total)" : ""}. Data: curated staples + <a href="https://world.openfoodfacts.org" target="_blank" style="color:var(--accent)">Open Food Facts</a>. Measures are free-text, so treat the total as a ballpark.</p>`;
      nutriBtn.style.display = "none";
    };
  }

  // ---- Recipe detail ----
  screens.recipeDetail = (r) => {
    WakeLock.release();   // browsing a recipe, not cooking
    cookNeeds = recipeNeeds(r); // what this recipe needs (pan material + tools)
    h(screenEl("", `
      <button class="btn ghost" id="back" style="width:auto;align-self:flex-start;padding-left:0">← Back</button>
      <div class="detail-hero" style="background-image:url('${cssUrl(r.thumb)}')">${bookmarkHTML(r.id, "on-art lg")}</div>
      <h1 style="margin-top:14px">${esc(r.title)}</h1>
      <p class="lead" style="margin-top:6px">${esc([r.area, r.category].filter(Boolean).join(" · "))}</p>
      <div style="margin-top:10px">${libraryBadge("lg")}</div>
      <p class="muted" style="font-size:11px;margin:6px 2px 0">🎵 Music sync coming soon — recipe &amp; ingredients for now.</p>
      <div class="row" style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
        ${diffBadge(r.difficulty)}
        <span class="pill">📋 ${r.stepCount} steps</span>
        <span class="pill">⏱ ~${r.estimatedTimeMin}m (generous est.)</span>
        ${r.hasSafetyGate ? `<span class="pill" style="color:var(--gold)">🌡️ doneness checks</span>` : ""}
      </div>

      ${ingredientsSectionHTML(r)}

      <p class="muted" style="font-size:11px;margin-top:14px">${(CATALOG && CATALOG.attribution) || ""}${safeUrl(r.sourceUrl) ? ` · <a href="${esc(safeUrl(r.sourceUrl))}" target="_blank" rel="noopener noreferrer" style="color:var(--accent)">source</a>` : ""}${safeUrl(r.youtube) ? ` · <a href="${esc(safeUrl(r.youtube))}" target="_blank" rel="noopener noreferrer" style="color:var(--accent)">video</a>` : ""}</p>

      ${cookNeeds.grill ? `<p class="muted" style="font-size:12px;margin-top:14px">🔥 Grill recipe — no pan needed.</p>` : ""}${cookNeeds.tools.length ? `<p class="muted" style="font-size:11px;margin-top:12px">🧰 You'll also need: <b>${cookNeeds.tools.map(esc).join(" · ")}</b></p>` : ""}

      <p class="section-title">Cooking voice</p>
      ${voicePickerHTML()}

      <div class="mt-auto" style="margin-top:18px">
        <p class="muted" style="font-size:12px;text-align:center;margin-bottom:10px">${libraryFree() ? "Guided mode: tap through steps. Doneness steps need a safe-temp check before you continue." : "Browse the ingredients free. Cooking the guided walkthrough is a Premium feature."}</p>
        <button class="btn" id="cook">${(Resume.active() && Resume.active().recipeId === r.id) ? "↩︎ Resume your cook" : (libraryFree() ? "▶ Start guided cook" : "🔒 Start guided cook · Premium")}</button>
      </div>
    `));
    $("#back").onclick = backFromRecipe;   // origin-aware (scan → results, else home)
    wireIngredientsSection(r);
    wireBookmarks("#app", () => r);
    wireVoicePicker();
    if (isKokoro()) ensureKokoroLoaded();
    const cookBtn = $("#cook");
    cookBtn.onclick = async () => {
      const act = Resume.active();
      if (act && act.recipeId === r.id) { resumeInto(act); return; }   // COOK RESUME: detail Resume → straight back into the cook
      // Cooking is Premium — free users can view the recipe but starting redirects to the paywall.
      if (!libraryFree()) { toast("Cooking the walkthrough is Premium — unlock to start 🔓"); screens.premium(); return; }
      // activate() must run inside the user gesture to unlock audio in the browser
      if (currentSpotifySel()) { try { await Spotify_.activate(); } catch (e) { } }
      // the engine-level pan/stove gate — every cook path passes through it
      panStoveGate({ onBack: () => screens.recipeDetail(r), onDone: async () => { if (await cookStartGate(r.id)) guardActiveCook(r.id, () => screens.guidedCook(r)); } });   // COOK RESUME: confirm before replacing a different active cook
    };
  };

  // ---- shared transport cluster (⏮ ⏸ ⏭) — markup only; each cook engine wires its own
  // handlers to #skipBack / #pause / #skipNext. Used by the flagship EXPERIENCE cook AND the
  // library (guided) cook so the control row stays identical across both.
  function transportRow({ skips = true, backDisabled = false } = {}) {
    const back = skips ? `<button class="btn secondary skip-btn" id="skipBack" title="Previous step" aria-label="Previous step"${backDisabled ? " disabled" : ""}>⏮</button>` : "";
    const next = skips ? `<button class="btn secondary skip-btn" id="skipNext" title="Next step" aria-label="Next step">⏭</button>` : "";
    return `<div class="cook-controls-row">${back}<button class="btn secondary" id="pause">⏸ Pause</button>${next}</div>`;
  }

  // ---- Guided cook (tap-through; conservative timing + safety gates) ----
  screens.guidedCook = (r, resume) => {
    WakeLock.acquire();   // tap-through MealDB cook is also hands-busy
    let idx = resume ? Math.min(Math.max(0, resume.stepIdx | 0), r.steps.length - 1) : 0;   // COOK RESUME: land on the saved step (start of it)
    let timer = null, remain = 0, timerEndsAt = 0, timerPaused = false;   // timerPaused: transport-cluster pause freezes the countdown
    const session = { mode: "guided", recipe: r.title, emoji: r.emoji, category: r.category, difficulty: r.difficulty, equipment: { ...state.equipment }, heatSource: state.equipment.heat, pan: activePan(), pansOwned: [...(state.equipment.pans || [])], experience: state.experience, startedAt: Date.now(), steps: [], totalExtends: 0, completed: false };
    // Snapshot started-at survives resumes (persists the ORIGINAL cook start); the
    // telemetry session.startedAt stays the resume moment so it doesn't count the away-gap.
    const cookStartedAt = resume ? resume.startedAt : session.startedAt;
    let stepStart = 0, stepExtends = 0, resumeShown = false;
    // COOK RESUME save: fires on every step change (render) + pause. Fire-and-forget.
    function saveResume() { Resume.save({ ...librarySelection(r), cueIdx: idx, confirmedGates: gatesBelow(r.steps, idx), paused: timerPaused, startedAt: cookStartedAt }); }

    function render() {
      const step = r.steps[idx];
      const isDone = !!step.gate;
      const total = r.steps.length;
      const adj = adjustedSec(step.timing.typicalSec);   // personalized to skill + equipment
      // VIDEO-MATCH: wired timestamp for THIS step (server attaches only wired steps) → a "Watch this moment" button.
      const vt = (r.videoMatch && r.videoMatch.steps && r.videoMatch.steps[idx] != null) ? Number(r.videoMatch.steps[idx]) : null;
      const hLevel = step.heat || inferHeat(step.text);   // authored heat, else inferred from the text
      const hg = hLevel ? heatGuidance(hLevel) : null;
      h(`<section class="cook fade" id="gcook">
        <div class="cook-top">
          <button class="icon-btn" id="gquit" title="Quit">✕</button>
          <div class="now-playing"><b>${r.emoji} ${esc(r.title)}</b></div>
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
          <div class="ring-wrap" style="padding:10px 0 0;text-align:center">
            <div class="ring-label" style="position:static">
              <div class="cd" id="gcd" style="font-size:34px;position:static;line-height:1;margin-bottom:4px">${fmtClock(adj)}</div>
              <div class="next" style="font-size:12px;letter-spacing:1.2px;text-transform:uppercase;color:var(--muted)">${isDone ? "CHECK BEFORE CONTINUING" : "SUGGESTED TIME"}</div>
            </div>
          </div>
          <p id="gtext" style="font-size:19px;margin-top:8px">${esc(displayUnits(injectAmounts(step.text, r.ingredients, 1)))}</p>
          ${isDone ? `<div class="safetybox">🌡️ ${step.gate.prompt}</div>` : ""}
          ${vt != null ? `<button class="watch-moment" id="watchMoment" data-ts="${vt}">📺 Watch this moment</button>` : ""}
        </div>

        <div class="cook-controls" style="flex-direction:column;gap:10px">
          ${isDone
          ? `<button class="btn" id="gnext">✅ ${step.gate.doneLabel}</button>
               <button class="btn secondary" id="gwait">⏳ Not yet</button>`
          : `<button class="btn" id="gnext">${idx === total - 1 ? "🎉 Finish" : "Next step →"}</button>`}
          ${transportRow({ skips: true, backDisabled: idx === 0 })}
        </div>

        <!-- VIDEO-MATCH bottom dock: fixed-bottom overlay (no reflow of the step). The iframe is
             created LAZILY on the first "Watch this moment" tap — never preloaded on step render. -->
        <div class="gvideo-dock" id="gvideoDock" hidden>
          <button class="gvideo-x" id="gvideoX" aria-label="Close video">✕</button>
          <div class="gvideo-frame" id="gvideoFrame"></div>
          ${r.videoMatch ? `<div class="gvideo-credit">Video: ${esc(r.videoMatch.title || "")} — ${esc(r.videoMatch.channel || "")}</div>` : ""}
        </div>
      </section>`);

      speak(step.text + (hg ? ` Use ${hg.label.toLowerCase()}.` : "") + (isDone ? " " + step.gate.prompt : ""));
      startTimer(adj);
      stepStart = performance.now(); stepExtends = 0;

      $("#gquit").onclick = () => confirmDialog("Quit this cook? Your progress will be lost.", "Yes, quit", () => { stopTimer(); stopVoice(); stopBg(); Resume.clear(); screens.recipeDetail(r); });   // explicit quit → DELETE the resume snapshot
      $("#gvoice").onclick = (e) => {
        state.prefs.voice = !state.prefs.voice;
        e.currentTarget.classList.toggle("off", !state.prefs.voice);
        if (!state.prefs.voice) stopVoice();
      };
      $("#gnext").onclick = () => advance();
      const wait = $("#gwait"); if (wait) wait.onclick = () => { stepExtends++; session.totalExtends++; vibrate("tap"); speak(step.gate.notReadyCoach); toast("Take your time ⏳"); startTimer(60); };
      // transport cluster (⏮ prev · ⏸ pause · ⏭ forward) — flagship-parity, wired to the library step engine.
      // Alarm one-tap: forward=advance() (already dismisses), back=dismiss+navigate, pause=dismiss the ring.
      const sBack = $("#skipBack"); if (sBack) sBack.onclick = () => { if (idx <= 0) return; Alarm.dismiss(); vibrate("tap"); idx = Math.max(0, idx - 1); render(); };   // BACK: prev step (fresh countdown on the revisit)
      const sNext = $("#skipNext"); if (sNext) sNext.onclick = () => advance();   // FORWARD: advance (advance() vibrates + Alarm.dismiss())
      const pBtn = $("#pause"); if (pBtn) pBtn.onclick = () => togglePause();
      const sppb = $("#gsppause"); if (sppb) sppb.onclick = () => { sppb.textContent === "⏸" ? Spotify_.pause() : Spotify_.resume(); };
      // VIDEO-MATCH: lazy-mount the embed on tap, seek to this step's timestamp, dock it.
      const wm = $("#watchMoment");
      if (wm) wm.onclick = () => {
        const ts = Math.max(0, Math.floor(Number(wm.dataset.ts) || 0));
        const dock = $("#gvideoDock"), frame = $("#gvideoFrame");
        vibrate("tap");
        try { if (useSpotify) Spotify_.pause(); else Music.stop(); } catch (e) { }   // visible-player ToS: quiet the background while it plays
        frame.innerHTML = `<iframe src="https://www.youtube.com/embed/${encodeURIComponent(r.videoMatch.videoId)}?start=${ts}&autoplay=1&rel=0&modestbranding=1" title="Watch this moment" frameborder="0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
        dock.hidden = false;
      };
      const gvx = $("#gvideoX"); if (gvx) gvx.onclick = () => { const d = $("#gvideoDock"); if (d) { d.hidden = true; $("#gvideoFrame").innerHTML = ""; } };  // dismiss → hidden, iframe torn down

      saveResume();   // COOK RESUME: every step render (start / advance / back) persists the position
      if (resume && !resumeShown) {   // one-shot honest banner: elapsed + raw-protein safety line
        resumeShown = true;
        const protein = resumeSafetyProtein(r.steps, idx, gatesBelow(r.steps, idx), [r.title, r.category]);
        mountResumeBanner(Date.now() - (Date.parse(resume.updatedAt) || cookStartedAt), protein);
      }
    }

    function advance() {
      stopTimer(); Alarm.dismiss(); vibrate("tap");   // advancing (incl. → finish) dismisses a live suggested-time alarm
      const step = r.steps[idx];
      const hl = step.heat || inferHeat(step.text);
      session.steps.push({ i: idx, title: step.text.slice(0, 40), authoredSec: step.timing.typicalSec, actualSec: Math.round((performance.now() - stepStart) / 1000), extends: stepExtends, heat: hl || null, heatHint: hl ? heatHintText(hl) : null });
      if (idx >= r.steps.length - 1) {
        stopVoice(); stopBg(); session.completed = true; session.durationSec = Math.round((Date.now() - session.startedAt) / 1000);
        Resume.clear();   // a completed cook is not resumable → DELETE the snapshot
        pendingSession = session; screens.guidedFinish(r); return;
      }
      idx++; render();
    }

    function startTimer(sec) {
      Alarm.dismiss(); Alarm.prime(); timerPaused = false;   // a new step's countdown clears any prior alarm + primes audio in the tap
      armTimer(sec);
    }
    function armTimer(sec) {   // (re)start the countdown for `sec` s from now — shared by startTimer + resume
      stopTimer(); remain = sec; timerEndsAt = Date.now() + sec * 1000;   // timestamp-based (background-throttle safe)
      const cd = $("#gcd"); if (cd) { cd.classList.remove("go"); cd.textContent = fmtClock(Math.max(0, remain)); }
      timer = setInterval(() => {
        if (timerPaused) return;   // frozen while paused (endsAt re-based on resume so no time is lost)
        remain = Math.round((timerEndsAt - Date.now()) / 1000);
        const c = $("#gcd");
        if (c) {
          if (remain > 0) { c.textContent = fmtClock(remain); }
          else { c.textContent = "⏱ check it"; c.classList.add("go"); }
        }
        if (remain <= 0) { stopTimer(); Alarm.start("Suggested time", Math.max(0, Date.now() - timerEndsAt)); }   // ring-until-dismissed (backdated)
      }, 1000);
    }
    function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }
    // Transport PAUSE (mirrors the flagship pause): freezes the running step countdown with a visible
    // paused state; resume restores it from where it froze. If a countdown alarm is live (finished),
    // there's nothing to freeze — pause just dismisses the ring (per the global alarm one-tap spec).
    function togglePause() {
      if (Alarm.active()) { Alarm.dismiss(); return; }   // ringing/visual: the tap just kills the alarm
      timerPaused = !timerPaused;
      const btn = $("#pause"), sec = $("#gcook"), cd = $("#gcd");
      if (timerPaused) {
        if (timer) remain = Math.max(0, Math.round((timerEndsAt - Date.now()) / 1000));   // capture the frozen remaining
        stopTimer();
        if (btn) btn.textContent = "▶ Resume";
        if (sec) sec.classList.add("paused");   // CSS dims the countdown + shows the PAUSED badge
      } else {
        if (btn) btn.textContent = "⏸ Pause";
        if (sec) sec.classList.remove("paused");
        if (remain > 0) armTimer(remain);   // resume from the frozen remaining
        else if (cd) { cd.textContent = "⏱ check it"; cd.classList.add("go"); }   // it had already elapsed
      }
      saveResume();   // COOK RESUME: pause state is part of the snapshot
    }

    // Premium: optional background music while cooking a TheMealDB recipe.
    // A chosen Spotify selection (song/playlist/queue) takes precedence over a bundled track.
    const spSel = currentSpotifySel();
    const useSpotify = !!spSel;
    const bgMusic = !useSpotify && isConnected() && state.customAudio;
    function stopBg() {
      if (useSpotify) { try { Spotify_.stop(); } catch (e) { } }
      else if (bgMusic) Music.stop();   // stop() resets loop + base volume
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
      Music.setSrc(state.customAudio); Music.setLoop(true); Music.setBaseVolume(0.5); Music.play();
    }

    render();
  };

  function fmtClock(s) { const m = Math.floor(s / 60), x = s % 60; return m ? `${m}:${String(x).padStart(2, "0")}` : `0:${String(x).padStart(2, "0")}`; }

  screens.guidedFinish = (r) => {
    WakeLock.release();   // guided cook complete
    recordCompletion();   // STREAK: bank the guided cook at completion (parity with the flagship finish)
    h(screenEl("center", `
      <div class="finish-hero">
        <div class="medal">🎉</div>
        <p class="eyebrow" style="margin-top:8px">Guided cook complete</p>
        <h1 style="margin-top:8px">You made<br><span class="gradient-text">${esc(r.title)}.</span></h1>
        <div class="streak">🔥 nice work, chef</div>
      </div>
      ${feedbackBlockHTML()}

      <div class="stack" style="margin-top:16px">
        <button class="btn" id="again">Cook it again</button>
        <button class="btn secondary" id="more">Explore more recipes</button>
        <button class="btn ghost" id="home">Back home</button>
      </div>

      ${feedbackFormLinkHTML()}
    `));
    const exitBtns = ["#again", "#more", "#home"];   // always tappable; unrated exit → finishExit save-anyway nudge
    const save = wireFeedback(r.title);   // exits always tappable — unrated leaves route through finishExit's save-anyway nudge
    $("#again").onclick = () => { save(); screens.guidedCook(r); };
    $("#more").onclick = () => finishExit(save, () => screens.home());
    $("#home").onclick = () => finishExit(save, () => screens.home());
  };

  // ============================================================
  // PREP WIZARD — Screen 0 (overview) → pan select → one step per screen → music
  // Driven by EXP.prepSteps (method-aware) or auto-generated from the prep[] list.
  // ============================================================
  const PAN_EXPLAIN = {
    nonstick: {
      id: "nonstick", emoji: "⚫️", label: "Nonstick", short: "Easiest — food won't stick, forgiving for beginners.",
      more: "Low-to-medium heat only (high heat damages the coating). Best for eggs, sauces, anything creamy. <b>Too hot</b> = the surface smokes or food browns too fast — turn it down."
    },
    stainless: {
      id: "stainless", emoji: "🪙", label: "Stainless steel", short: "Better browning — needs more attention, use medium heat.",
      more: "Shiny silver inside, gets very hot. Great for browning garlic & meat. Food sticks if it isn't preheated — let it heat up first. <b>Too hot</b> = smoking oil or fast-darkening food."
    },
    "cast-iron": {
      id: "cast-iron", emoji: "🍳", label: "Cast iron", short: "Holds heat well — heavier, harder to fine-tune.",
      more: "Heavy and dark, retains heat incredibly. Slow to change temperature, so adjust early. Good but harder to control for delicate cream sauces. <b>Too hot</b> = constant smoking — pull it off the heat for a moment."
    },
  };
  const PAN_ORDER = ["nonstick", "stainless", "cast-iron"];

  function prepStepsFor() {
    if (EXP && EXP.id === "one-pot-garlic-parmesan-pasta") return pastaPrepSteps(); // selection-aware
    if (EXP && EXP.id === "scrambled-eggs") return eggsPrepSteps(); // fat-aware
    const m = activeMethod();
    let ps = (m && m.prepSteps) || EXP.prepSteps;
    // Apply per-prep-step methodAlt for any active method (smash single/double, tacos
    // packet/homemade). No-op when a step has no methodAlt, so per-method-prepSteps recipes
    // (steak grill) are unaffected.
    if (m && ps) { const mid = m.id; ps = ps.map((st) => (st.methodAlt && st.methodAlt[mid]) ? { ...st, ...st.methodAlt[mid] } : st); }
    // drop prep steps for a deselected optional component (teriyaki's broccoli step) — mirrors the
    // cue opt-filter; backward-compatible since no other recipe tags a prep step with `opt`.
    if (ps) ps = ps.filter((st) => (!st.opt || optActive(EXP.id, st.opt)) && (!st.optAny || st.optAny.some((id) => optActive(EXP.id, id))));   // optAny: keep the step if ANY listed optional is active (philly veg prep)
    if (ps && ps.length) return ps;
    return mPrep().map((s) => ({ title: s, instructions: "" })); // auto from the gather list
  }
  function equipmentFor() {
    const m = activeMethod();
    return (m && m.equipmentNeeded) || EXP.equipmentNeeded || ["A suitable pan or pot", "Cutting board & knife", "Measuring cups & spoons"];
  }
  function setCookNeeds() {
    if (EXP.cookNeeds) {   // recipe-declared (engine-level): any recipe can restrict pans with honest copy
      const cn = EXP.cookNeeds;
      cookNeeds = cn.grill ? { panSuitable: null, panReason: "", tools: cn.tools || [], grill: true }
        : { panSuitable: cn.pans || null, panReason: cn.panReason || "", tools: cn.tools || [], panBlockedCopy: cn.panBlockedCopy || null };
      return;
    }
    const et = ((mTechnique() || "") + " " + EXP.recipe.title).toLowerCase();
    cookNeeds = /grill/.test(et) ? { panSuitable: null, panReason: "", tools: [], grill: true }
      : /sear|crispy|crisp |pan-fr|chicken/.test(et) ? { panSuitable: ["cast-iron", "stainless"], panReason: "high heat + a crisp crust — non-stick can't take it", tools: [] }
        : /scramble|egg|omelet/.test(et) ? { panSuitable: ["nonstick", "cast-iron"], panReason: "delicate — non-stick works best", tools: ["Whisk"] }
          : { panSuitable: null, panReason: "", tools: [] };
  }

  // ---- pasta: dynamic ingredient model (pure fn of servings + selections) ----
  const isPasta = () => EXP && EXP.id === "one-pot-garlic-parmesan-pasta";
  // ---- scrambled eggs: stove (preheat time) + fat (pan) selections ----
  const isEggs = () => EXP && EXP.id === "scrambled-eggs";
  const EGG_STOVE = { gas: { label: "Gas", sec: 90 }, electric: { label: "Electric", sec: 240 } };
  const EGG_FATS = {
    butter: { ingName: "butter", noun: "butter", amt: "1 tbsp", add: "Add the butter and let it melt and coat the pan", addShort: "add the butter", melt: "it melts fast and coats the pan", into: "into the melted butter" },
    vegetable: { ingName: "vegetable oil", noun: "oil", amt: "1 tbsp", add: "Add the vegetable oil and swirl it to coat the pan", addShort: "add the oil", melt: "swirl until the surface shimmers — that means it's ready. Smoking = too hot; off the heat a beat", into: "into the hot oil", recover: "if the oil's smoking or gone dark, wipe it out, add fresh" },
    olive: { ingName: "olive oil", noun: "oil", amt: "1 tbsp", add: "Add the olive oil and swirl it to coat the pan", addShort: "add the oil", melt: "swirl until the surface shimmers — that means it's ready. Olive smokes sooner than other oils: see smoke, lift the pan off the heat a beat", into: "into the hot oil", recover: "if the oil's smoking or gone dark, wipe it out, add fresh" },
    canola: { ingName: "canola oil", noun: "oil", amt: "1 tbsp", add: "Add the canola oil and swirl it to coat the pan", addShort: "add the oil", melt: "swirl until the surface shimmers — that means it's ready. Smoking = too hot; off the heat a beat", into: "into the hot oil", recover: "if the oil's smoking or gone dark, wipe it out, add fresh" },
    spray: { ingName: "cooking spray", noun: "spray", amt: "a few sprays", add: "Coat the pan with cooking spray — a quick, even pass", addShort: "coat the pan with spray", melt: "a quick, even coat is all you need — lift the pan off the burner to spray, and if it smokes the second it lands, give the pan ten seconds off the heat and carry on", into: "into the coated pan", recover: "if it smokes right away, wipe the pan and re-spray with the pan off the heat" },
  };
  const fmtCups = (n) => (n <= 0 ? "" : `${fmtQty(n)} ${n <= 1 ? "cup" : "cups"}`);
  const LIQUIDS = {
    chicken: { label: "Chicken broth", measure: (s) => `${s} cup${s === 1 ? "" : "s"}` },
    vegetable: { label: "Vegetable broth", measure: (s) => `${s} cup${s === 1 ? "" : "s"}` },
    waterbutter: { label: "Water + butter/oil", measure: (s) => `${s} cup${s === 1 ? "" : "s"} water + ${s} tbsp butter` },
    bouillon: { label: "Water + bouillon", measure: (s) => `${s} cup${s === 1 ? "" : "s"} water + ${s} cube${s === 1 ? "" : "s"} (1 cube = 1 tsp each)` },
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
      <details class="pasta-note"><summary>🥣 No broth? What to use instead</summary><p><b>Vegetable broth</b> — works identically, slightly different flavor.<br><b>Water + butter/oil</b> — 1 tbsp per cup of water; slightly less savory, so add extra salt + a squeeze of lemon at the end.<br><b>Water + bouillon</b> — 1 cube (= 1 tsp) per cup of water, stirred straight into the pot; full flavor.<br><b>Pasta water from a previous cook</b> — 1:1, adds starch + flavor.</p></details>`;
  }

  const pastaAmt = (name) => { const i = pastaIngredients().find((x) => x.name === name); return i ? i.measure : ""; };
  // Rich, selection-aware prep steps for the wizard (Stage 3 technique guides).
  function pastaPrepSteps() {
    const s = portionCount || 2;
    const steps = [
      { title: "Gather your equipment", referenceImage: "assets/recipes/pasta/onepot-prep-1.webp", voice: "Get everything within reach before the heat goes on — this cook moves once it starts.", instructions: "Get everything within reach before the heat goes on — this cook moves once it starts.", techniqueGuide: equipmentFor() },
      { title: "Measure your pasta", referenceImage: "assets/recipes/pasta/onepot-prep-2.webp", voice: "Measure out your pasta — the box tells you the weight, and the screen shows exactly how much you need.", instructions: `You need ${pastaAmt("pasta")}. The weight in oz is printed on the side of the box — 1 lb = 16 oz ≈ 4 cups dry.`, techniqueGuide: ["Use a kitchen scale if you have one — most accurate.", `No scale? ${s} cup${s === 1 ? "" : "s"} of dry short pasta ≈ ${4 * s} oz.`, "A standard box is 1 lb (16 oz) — eyeball the fraction you need."] },
      { title: "Prepare your liquid", referenceImage: cookLiquid === "bouillon" ? "assets/recipes/pasta/onepot-prep-3b.webp" : "assets/recipes/pasta/onepot-prep-3.webp", voice: "Measure out your liquid and have it ready to pour — it goes in fast, right after the garlic.", instructions: `You're using ${LIQUIDS[cookLiquid].label.toLowerCase()} — ${pastaAmt("broth")}. Have it measured and ready to pour.`, techniqueGuide: cookLiquid === "waterbutter" ? ["Water + 1 tbsp butter per cup mimics the fat in broth.", "Add a little extra salt and a squeeze of lemon at the end to compensate."] : cookLiquid === "bouillon" ? ["No pre-dissolving needed — the bouillon goes straight into the pasta water and melts as it heats.", "1 tsp bouillon = 1 cube, per cup of water. Full flavour, works great."] : ["Just measure it out — no prep needed."] },
      { title: "Mince the garlic", referenceImage: "assets/recipes/pasta/onepot-prep-4.webp", voice: "Smash each clove flat so the skin slips off, then rock your knife through until the pieces are tiny — about the size of a grain of rice.", instructions: `You need ${pastaAmt("garlic")}. Here's the easy way:`, techniqueGuide: ["Smash each clove flat with the side of your knife — the skin peels right off.", "Rock the knife back and forth across the garlic until the pieces are very small — about the size of a grain of rice.", "Scrape into a pile and go again. Done when no large chunks remain.", "Set the minced garlic aside in a small bowl — it goes straight into the melted butter at the very first cooking step."] },
      { title: "Grate your cheese", referenceImage: "assets/recipes/pasta/onepot-prep-5.webp", voice: "Grate your parmesan from the block now and set it aside — it goes in off the heat, near the end.", instructions: `Grate ${pastaAmt("parmesan")} of Parmigiano-Reggiano from a block — pre-grated has anti-caking powder that makes sauces grainy.`, techniqueGuide: ["Use the fine holes of a box grater or a microplane.", "Hold the grater at an angle over a bowl or plate.", "Press the block firmly against the grater and pull downward in long strokes.", "Keep your fingers curled back, away from the grater surface.", "1 cup grated ≈ a 2-inch chunk of block — it compresses, so be generous."] },
      { title: "Measure your cream", referenceImage: "assets/recipes/pasta/onepot-prep-6.webp", voice: "Measure your cream and keep it by the stove — it pours in slowly during the music.", instructions: `You need ${pastaAmt("cream")} of heavy cream. Set it by the stove — it goes in once you're off the heat.`, techniqueGuide: [`${pastaAmt("cream")} — fill to the line on a measuring cup; a touch over is fine for a richer sauce.`] },
    ];
    if (addIns.chicken) steps.push({ title: "Cut & season your chicken", referenceImage: "assets/recipes/pasta/onepot-prep-7.webp", voice: "Cut your chicken into bite-size pieces and season them — they cook first, before the butter goes in.", instructions: `Cut ${pastaAmt("chicken")} of chicken into 1-inch pieces and season with salt, pepper, and a pinch of garlic powder. You'll cook it first, then add it back with the cream.`, techniqueGuide: ["Pat the chicken dry first — it browns better.", "1-inch pieces cook evenly in 3–4 minutes per side.", "Season just before it goes in the pan."] });
    return steps;
  }
  // Phase 1 (silent simmer), selection-aware: scaled amounts, chosen liquid,
  // garlic by strength, an optional cook-the-chicken step, timers + stir config.
  // Rotating tips shown during the ~10-min simmer wait (item: make dead time useful).
  const PASTA_SIMMER_TIPS = [
    "Clean up your prep mess now — future you says thanks.",
    "Grate your parmesan while you wait so it's ready to go.",
    "Measure out your cream so it's ready for the music phase.",
    "Give it a stir if you walk by — scrape the bottom of the pan.",
    "Get a warm bowl out — pasta cools fast once it's plated.",
  ];
  function pastaPrePhase() {
    const base = EXP.prePhase, liquid = LIQUIDS[cookLiquid].label.toLowerCase();
    const electric = state.equipment.heat === "electric";
    const boilSec = electric ? 480 : 300;                                  // FALLBACK clock only — the whole-pot rolling boil is the real gate (8 min electric / 5 min gas, generous)
    const boilEst = electric ? "up to 8 minutes" : "up to 5 minutes";
    const steps = [];
    if (addIns.chicken) steps.push({ title: "Cook the chicken", heat: "high", body: `Cook your seasoned chicken (${pastaAmt("chicken")}, 1-inch pieces) — 3–4 minutes per side until no longer pink. Set it aside; you'll add it back with the cream.`, voice: "First, cook your chicken pieces through — about three to four minutes a side, until there's no pink. Then set them aside; they go back in later with the cream." });
    // A1: butter ALONE on max first (garlic scorches if it goes in cold with the butter)
    steps.push(electric
      ? { title: "Melt the butter — MAX heat", heat: "high", referenceImage: "assets/recipes/pasta/onepot-p1-butter-foaming.webp", timerSeconds: 180, timerNote: "Backup clock — the FOAM is the signal, not the timer. Electric coils start slow; three minutes is normal.", body: `🔥 Burner to its HIGHEST — electric starts slow, that's normal
🧈 Butter in (${pastaAmt("butter")}) — butter ONLY, no garlic yet
👀 FOAMING? Move on NOW — max heat doesn't wait
⚠️ Gone dark brown? Wipe it out, fresh butter, carry on`, voice: "Crank the heat all the way up and melt the butter. Electric starts slow — give it a few minutes. It's ready when it's foaming, and it's still just butter — no garlic yet." }
      : { title: "Melt the butter — MAX heat", heat: "high", referenceImage: "assets/recipes/pasta/onepot-p1-butter-foaming.webp", timerSeconds: 45, timerNote: "Backup clock — the FOAM is the signal. On gas it's fast, usually under a minute.", body: `🔥 Burner to its HIGHEST setting
🧈 Butter in (${pastaAmt("butter")}) — butter ONLY, no garlic yet
👀 On gas it foams FAST — foaming means GO NOW
⚠️ Gone dark brown? Wipe it out, fresh butter, carry on`, voice: "Crank the heat all the way up and melt the butter — on gas it foams fast, so move on the moment it's foaming. Just the butter for now — no garlic yet." });
    // A1: garlic goes in AFTER, only 30–45s, then straight to the liquid before it scorches
    steps.push({ title: "Add the garlic", heat: "high", referenceImage: "assets/recipes/pasta/onepot-p1-garlic.webp", timerSeconds: 45, timerNote: "30–45 seconds — the moment it smells amazing, move on.", timerAlert: { atSec: 30, text: "👃 Smell that? That's your cue — get the liquid in NOW, before the garlic browns and turns bitter." }, body: `🧄 Garlic in (${pastaAmt("garlic")}) — stir 30–45 seconds, just until fragrant\n👃 Smells amazing = GO — liquid in NOW\n⚠️ Liquid not in reach? Pan OFF the burner while you grab it — max heat scorches garlic in seconds\n🔁 Gone brown-black? Wipe, re-melt butter, go again`, voice: "Now add the garlic. Stir it for thirty to forty-five seconds, just until it smells amazing — then go straight to the liquid, before it browns." });
    if (cookLiquid === "bouillon") {
      steps.push({ title: "Water + bouillon in", heat: "high", body: `Pour in the water (${pastaAmt("broth")}) and stir in the bouillon until it FULLY dissolves — no lumps. An undissolved cube turns into salty, gritty chunks in the sauce.`, voice: "Pour in the water and stir in the bouillon until it fully dissolves — one cube for every cup of water, no lumps." });
      steps.push({ title: "Pasta in", heat: "high", referenceImage: "assets/recipes/pasta/onepot-p1-pasta-liquid-in.webp", body: `Stir the dry pasta (${pastaAmt("pasta")}) into the broth and keep it on HIGH.`, voice: "Stir the pasta into the broth, and keep it on high." });
    } else {
      steps.push(cookLiquid === "waterbutter"
        ? { title: "Pasta + water + butter in", heat: "high", referenceImage: "assets/recipes/pasta/onepot-p1-pasta-liquid-in.webp", body: `Add the dry pasta (${pastaAmt("pasta")}) and your measured liquid (${pastaAmt("broth")}) — the butter from that measure drops straight in with the water and melts as it heats. Stir, and keep it on HIGH.`, voice: "Add the pasta, the water, and the butter — it melts as it heats. Give it a stir and keep it on high." }
        : { title: "Pasta + broth in", heat: "high", referenceImage: "assets/recipes/pasta/onepot-p1-pasta-liquid-in.webp", body: `Add the dry pasta (${pastaAmt("pasta")}) and the ${liquid} (${pastaAmt("broth")}). Stir, and keep it on HIGH.`, voice: "Add the pasta and the broth, give it a stir, and keep it on high." });
    }
    // A3: dedicated hard-boil step with its own timer — drives off excess liquid up front (runny fix)
    steps.push({ title: "Bring it to a rolling boil", heat: "high", referenceImage: "assets/recipes/pasta/onepot-p1-boil.webp", timerSeconds: boilSec, timerNote: `Backup clock (${boilEst}) — the BUBBLES are the gate, not the timer.`, body: `🔥 Keep it on HIGH until it's properly ROLLING
👀 Rolling = big bubbles across the WHOLE pot, not just the edges
⏱️ Takes ${boilEst} — the pot decides, not the clock
🥄 Stir now and then — pasta welds to the pan the second you leave it
⚠️ Properly rolling? Move on NOW — the simmer drop is next`, voice: "Keep it on high until big bubbles roll across the whole pot — not just the edges. The pot decides when, not the clock. Stir it now and then." });
    // A4: drop to a gentle simmer, uncovered, for the pasta's box time (simmerPicker sets the timer)
    steps.push({ title: "Drop to a simmer", heat: "medium-low", referenceImage: "assets/recipes/pasta/onepot-p1-simmer.webp", simmerPicker: true, body: `Boiling hard? Now DROP the heat to medium-low for a gentle simmer — bubbling, not a rolling boil. Leave it UNCOVERED — a lid traps steam and keeps it runny. Check your pasta box and set the timer below to its cook time.`, voice: "Once it's boiling hard, drop the heat to medium-low for a gentle simmer. Leave it uncovered, and set the timer for your box's cook time." });
    return { title: base.title, intro: base.intro, steps, timer: { sec: 600, referenceImage: "assets/recipes/pasta/onepot-p1-simmer.webp", label: base.timer.label, note: "Keep it at a gentle simmer on medium-low — bubbling, not a rolling boil. Leave it UNCOVERED so the liquid reduces down. Stir every couple of minutes so nothing sticks.", earlyAfterSec: base.timer.earlyAfterSec, earlyLabel: base.timer.earlyLabel, heat: "medium-low", stirEvery: 120, tips: PASTA_SIMMER_TIPS }, gate: base.gate, transition: base.transition };
  }
  // Phase 2 music cues, selection-aware: scaled cream/parmesan, chosen liquid,
  // peas stirred in + chicken added back at the cream step.
  function pastaCues() {
    const cream = pastaAmt("cream"), parm = pastaAmt("parmesan"), liquid = LIQUIDS[cookLiquid].label.toLowerCase();
    const hasBasil = optActive(EXP.id, "basil");
    const hasSeason = optActive(EXP.id, "salt") || optActive(EXP.id, "pepper");
    const electric = state.equipment.heat === "electric";
    // too-thick fix depends on the liquid: bouillon/water → more water; real broth → more broth
    const loosenWith = (cookLiquid === "bouillon" || cookLiquid === "waterbutter") ? "a splash more water" : `a splash more of the reserved ${liquid}`;
    return EXP.cues.map((c) => {
      // Off the heat — describe it in plain terms; electric burners hold heat, so move the pot
      if (/Off the heat/.test(c.title)) {
        const elec = electric ? " Electric burners stay hot a while, so actually move the pot off it — don't just switch it off." : "";
        return {
          ...c,
          body: `Slide the pot to a cold spot on the stove and turn the burner off.${elec} Let it rest while the intro plays.`,
          beginner: `🍲 SLIDE the pot off — to a cold spot or a folded towel\n🔴 Burner OFF too — the dial alone isn't enough, it stays hot for minutes${electric ? "\n⚡ Electric holds heat longest — actually MOVE the pot" : ""}\n🎹 Rest while the intro plays — the residual heat keeps working`,
          voice: `Slide the pot off the burner to a cold spot — don't just turn the dial off; the burner stays hot for minutes. Let it rest while the intro plays.`,
          custom: { beginner: `Take the pot completely off the heat — physically slide it off the burner to a cold spot and turn the burner off. The dial alone isn't enough; the burner stays hot for minutes.${elec} Let it rest a moment — the residual heat keeps working. Don't rush this.`, voice: `Slide the pot off the burner — don't just turn the dial off. Let it rest a moment while the music settles in.` }
        };
      }
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
      if (/Parmesan in/.test(c.title)) return {
        ...c,
        body: `Off the heat, add the parmesan (${parm}) a handful at a time, stirring constantly until glossy.`,
        beginner: `Keep the pot OFF the burner and add the parmesan (${parm}) a handful at a time, stirring constantly — let each handful melt before the next. Off-heat and slow is what keeps it glossy; rushed or over heat, the cheese clumps and strings. Gone clumpy? Splash in a little of the warm liquid from the pan and stir hard — it comes back glossy.`,
        voice: `Still off the burner, add the parmesan a handful at a time, stirring constantly until each melts. If it clumps, splash in a little of the warm liquid from the pan and stir hard.`
      };
      if (/Adjust/.test(c.title)) return {
        ...c,
        body: `Too THIN (watery/soupy/runny)? Back on LOW, simmer 1–2 min uncovered — don't add water. Too THICK (paste-like/clumping)? Loosen with ${loosenWith} (1–2 tbsp).`,
        beginner: `🔥 Too THIN (watery, pooling)? Back on LOW and simmer uncovered 1–2 min — do NOT add water\n🥄 Still loose? Slurry: 1 tsp cornstarch in 1 tbsp COLD water, simmer a minute\n🧀 Too THICK (gluey, clumping)? Loosen with ${loosenWith}, 1–2 tbsp at a time\n⏱️ It firms as it rests — leave it a touch loose`,
        voice: `Too thin and watery? Back on low and simmer it uncovered a minute or two — don't add water. Too thick and pasty? Loosen it with ${loosenWith}, a tablespoon at a time.`
      };
      return c;
    });
  }

  // ---- scrambled eggs: fat/stove-aware ingredient list, controls, prep, cues ----
  // Fat is selectable, so the displayed ingredient list swaps the fat line + scales
  // every amount to the egg count (pre-scaled here, like pasta → overview uses scale=1).
  function eggsIngredients() {
    const p = EXP.portion, n = portionCount || (p ? p.base : 3), s = portionScale();
    const f = EGG_FATS[eggFat] || EGG_FATS.butter;
    return [
      { name: "eggs", measure: String(n), noInline: true },
      { name: f.ingName, measure: scaleAmount(f.amt, s) || f.amt },
      { name: "milk", measure: scaleAmount("1 tbsp", s) || "1 tbsp" },
      { name: "salt", measure: scaleAmount("1 pinch", s) || "1 pinch" },
      { name: "pepper", label: "Black pepper", measure: "to taste", optional: true }, // finish cue seasons with pepper
    ];
  }
  function eggsControlsHTML() {
    const fchip = (id, label) => `<button class="pchip ${eggFat === id ? "on" : ""}" data-fat="${id}">${label}</button>`;
    return `
      <p class="section-title" style="margin-top:16px">Fat for the pan</p>
      <div class="portion" id="fatSel" style="flex-wrap:wrap">${fchip("butter", "🧈 Butter")}${fchip("vegetable", "Vegetable oil")}${fchip("olive", "Olive oil")}${fchip("canola", "Canola oil")}${fchip("spray", "Cooking spray")}</div>
      <p class="muted" style="font-size:12px;margin-top:6px">Butter tastes best — but oil, spray, whatever you've got, it all works. Goes in the pan, not the bowl.</p>`;
  }
  // Prep steps live in cues.js (butter-default); swap the fat name when it isn't butter.
  function eggsPrepSteps() {
    const f = EGG_FATS[eggFat] || EGG_FATS.butter;
    const steps = EXP.prepSteps || [];
    if (eggFat === "butter") return steps;
    const swap = (t) => (typeof t === "string" ? t.replace(/\bbutter\b/gi, f.ingName) : t);
    return steps.map((s) => ({ ...s, instructions: swap(s.instructions), techniqueGuide: Array.isArray(s.techniqueGuide) ? s.techniqueGuide.map(swap) : s.techniqueGuide }));
  }
  // Preheat pre-phase: clone the cues.js template, set the timer by stove type.
  function eggsPrePhase() {
    const base = EXP.prePhase, sec = (EGG_STOVE[eggStove] || EGG_STOVE.gas).sec;
    // stove-aware preheat note (entertain register — the wait is dead time)
    const note = eggStove === "electric"
      ? "Keep the pan empty while it heats — nothing in it yet. Electric burners take their sweet time, so this one's a bit of a wait. Nothing's wrong; the pan's just slow. Think it's already hot? Test it early with the button below. Stepping away? Drop the dial to medium — it holds. When the timer's up, we'll do a quick water-drop test before dropping the heat."
      : "Keep the pan empty while it heats — nothing in it yet. Resist the urge to poke at it; it just needs to get hot. Think it's already hot? Test it early with the button below. Stepping away? Drop the dial to medium — it holds. When the timer's up, we'll do a quick water-drop test before dropping the heat.";
    // skippable: lets the user bypass the preheat timer/water-test if the pan's already hot
    return { ...base, skippable: true, skipWarning: "Only skip if your pan's already hot — eggs poured onto a cold pan stick and turn rubbery.", timer: { ...base.timer, sec, earlyAfterSec: Math.round(sec * 0.5), note } };
  }
  // CHICKEN FRIED RICE preheat (screens.preCook): oil in on medium-high, shimmer gate.
  // Stove-split clock — electric coils heat oil slower, so they STRICTLY exceed gas (gas 2:00 /
  // electric 4:30 to shimmer; generous backup because the shimmer IS the real gate — the timer
  // should never end BEFORE the oil's ready). The base prePhase (skippable + skipWarning) lives
  // in cues.js; this transform only injects the per-stove timer.sec + a stove-aware note.
  // earlyAfterSec halves the clock (the early "it's shimmering" button). Skip → the first
  // chicken cue (see launchCook), pan assumed hot.
  const FRIEDRICE_STOVE = { gas: { sec: 120 }, electric: { sec: 270 } };
  function friedricePrePhase() {
    const base = EXP.prePhase, electric = state.equipment.heat === "electric";
    const sec = (electric ? FRIEDRICE_STOVE.electric : FRIEDRICE_STOVE.gas).sec;
    const note = electric
      ? "The shimmer is the real signal — this timer's just a backup clock. Electric coils heat oil slowly, so four to five minutes is normal; nothing's wrong. When it thins out and flows like water, tilt-test it with the button below."
      : "The shimmer is the real signal — this timer's just a backup clock. Give it a couple of minutes and keep an eye on it — when the oil thins out and flows like water, tilt-test it with the button below.";
    return { ...base, timer: { ...base.timer, sec, earlyAfterSec: Math.round(sec * 0.5), note } };
  }
  // Pancakes preheat — stove-split like fried rice, but the failure mode is the OPPOSITE end:
  // a nonstick pan on medium heats fast and OVERSHOOTS, so electric (coils that keep climbing
  // after you set the dial) gets the LONGER backup clock, not shorter. gas 2:00 / electric 4:00.
  // The drop-test gate is three-state (the ⚠️ too-hot branch), so the timer is only a backstop —
  // it should never end before the pan's ready. Base (skippable + skipWarning) lives in cues.js.
  const PANCAKES_STOVE = { gas: { sec: 120 }, electric: { sec: 240 } };
  function pancakesPrePhase() {
    const base = EXP.prePhase, electric = state.equipment.heat === "electric";
    const sec = (electric ? PANCAKES_STOVE.electric : PANCAKES_STOVE.gas).sec;
    const note = electric
      ? "The drop test below is the real signal — this clock is just a backup. Electric coils keep climbing after you set the dial, so if anything they run HOT: if a drop spatters violently, back the dial off before pancake #1."
      : "The drop test below is the real signal — this clock is just a backup. Medium heats a nonstick pan fast — start drop-testing early so you catch it before it overshoots.";
    return { ...base, timer: { ...base.timer, sec, earlyAfterSec: Math.round(sec * 0.5), note } };
  }
  // Teriyaki preheat — oil shimmer, stove-split like fried rice (electric heats oil slower, so it
  // STRICTLY exceeds gas: gas 1:00 / electric 2:30 to shimmer; the shimmer IS the gate, the clock
  // is a generous backup). Base (skippable + skipWarning + three-state smoking branch) lives in cues.js.
  const TERIYAKI_STOVE = { gas: { sec: 60 }, electric: { sec: 150 } };
  function teriyakiPrePhase() {
    const base = EXP.prePhase, electric = state.equipment.heat === "electric";
    const sec = (electric ? TERIYAKI_STOVE.electric : TERIYAKI_STOVE.gas).sec;
    const note = electric
      ? "The shimmer is the real signal — this clock is just the backup. Electric coils heat oil slowly, so two to three minutes is normal; nothing's wrong. Tilt-test with the button below when it thins out and flows like water."
      : "The shimmer is the real signal — this clock is just the backup. Give it a minute or so, then tilt-test — when the oil thins out and flows like water, you're ready.";
    return { ...base, timer: { ...base.timer, sec, earlyAfterSec: Math.round(sec * 0.5), note } };
  }
  // Quesadilla preheat — EMPTY nonstick pan on medium (butter goes in as cue 0, never sits in a
  // heating pan). Stove-split gas 60 / electric 165 (electric strictly greater — coils reach medium
  // slower); the water-drop sizzle test IS the gate, the clock is a backup. Base (skippable +
  // skipWarning + three-state too-hot branch) lives in cues.js.
  const QUESADILLA_STOVE = { gas: { sec: 60 }, electric: { sec: 165 } };
  function quesadillaPrePhase() {
    const base = EXP.prePhase, electric = state.equipment.heat === "electric";
    const sec = (electric ? QUESADILLA_STOVE.electric : QUESADILLA_STOVE.gas).sec;
    const note = electric
      ? "Medium heat, not high — the water test below is the real check, this clock is just a backup. Electric coils reach medium slowly, so two to three minutes is normal; nothing's wrong."
      : "Medium heat, not high — the water test below is the real check, this clock is just a backup. Give it about a minute, then flick a couple of water drops to test.";
    return { ...base, timer: { ...base.timer, sec, earlyAfterSec: Math.round(sec * 0.5), note } };
  }
  // Upgraded ramen — method-split Phase 1 boil. soup (default) = butter+garlic+packet then water
  // (base = EXP.prePhase); stir-fry = plain water (base = methods[stirfry].prePhase). Stove-split
  // boil clock, electric STRICTLY greater (gas 3:00 / electric 5:00 for a potful): the rolling boil
  // IS the gate, the clock is a generous backup. skipLabel/skipWarning carry the pot + kettle-trick copy.
  const RAMEN_STOVE = { gas: { sec: 180 }, electric: { sec: 300 } };
  function ramenPrePhase() {
    const m = activeMethod();
    const base = (m && m.prePhase) || EXP.prePhase;
    const electric = state.equipment.heat === "electric";
    const sec = (electric ? RAMEN_STOVE.electric : RAMEN_STOVE.gas).sec;
    const note = electric
      ? "The rolling boil below is the real signal — this clock is just a backup. Electric coils climb slowly, so three to five minutes to a full boil is normal; lid on speeds it up."
      : "The rolling boil below is the real signal — this clock is just a backup. Lid on and it'll be rolling in a couple of minutes.";
    return { ...base, timer: { ...base.timer, sec, earlyAfterSec: Math.round(sec * 0.5), note } };
  }
  // Ramen cook cues: when the egg is deselected, the two opt:"egg" cues drop — collapse the poach gap
  // so a no-egg cook doesn't idle on a padded clock. Heat management is NOT lost: the heat-down/noodle
  // checkpoint (soup at:150) is UNTAGGED and always survives; the egg cues are a pure additive overlay.
  // At-shift only — voice text is unchanged, and the DEV collectors + preload enumerate the full egg-on
  // ladder via mCues(), so every clip still generates. Egg ON → the ladder passes through untouched.
  function ramenCues() {
    const base = mCues();
    if (optActive(EXP.id, "egg")) return base;
    const eggAts = base.filter((c) => c.opt === "egg").map((c) => c.at);
    if (!eggAts.length) return base;
    const firstEgg = Math.min(...eggAts), lastEgg = Math.max(...eggAts);
    const after = base.filter((c) => c.opt !== "egg" && c.at > lastEgg).map((c) => c.at);
    if (!after.length) return base;
    const shift = Math.min(...after) - firstEgg;   // pull the post-egg cues up into the vacated gap
    return base.map((c) => (c.opt !== "egg" && c.at > lastEgg) ? { ...c, at: c.at - shift } : c);
  }
  // Philly cheesesteak preheat — MEDIUM + a little butter, stove-split (electric heats butter slower,
  // so it STRICTLY exceeds gas: gas 1:00 / electric 2:30 to a gentle foam; the foam IS the gate, the
  // clock is a backup). Base (3-state foam gate + skip) lives in cues.js.
  const PHILLY_STOVE = { gas: { sec: 60 }, electric: { sec: 150 } };
  function phillyPrePhase() {
    const base = EXP.prePhase, electric = state.equipment.heat === "electric";
    const sec = (electric ? PHILLY_STOVE.electric : PHILLY_STOVE.gas).sec;
    const note = electric
      ? "The foam is the signal — this clock is just the backup. Electric coils melt butter slowly, so a couple of minutes is normal; drop the rolls the moment it melts and foams."
      : "The foam is the signal — this clock is just the backup. Under a minute on gas — the moment the butter melts and foams, you're ready.";
    return { ...base, timer: { ...base.timer, sec, earlyAfterSec: Math.round(sec * 0.5), note } };
  }
  // Philly cook cues: a full witout (NO veg selected — onion AND pepper AND mushrooms all off) drops
  // the veg cue (optAny) — collapse its ~5-min cook gap so a beef-only cook doesn't idle on a padded
  // clock. Any single veg on keeps the cue. Pure at-shift; the ladder is otherwise shared.
  function phillyCues() {
    const base = mCues();
    const veg = base.find((c) => c.optAny);
    if (!veg || veg.optAny.some((id) => optActive(EXP.id, id))) return base;   // some veg on — full ladder
    const after = base.filter((c) => c !== veg && c.at > veg.at).map((c) => c.at);
    if (!after.length) return base;
    const shift = Math.min(...after) - veg.at;   // pull the post-veg cues up into the vacated gap
    return base.map((c) => (c !== veg && c.at > veg.at) ? { ...c, at: c.at - shift } : c);
  }

  // Music cues, fat- AND stove-aware: the fat transform touches only the cues
  // tagged fat:true; electric stoves additionally get the dial-drop reality at
  // the figure-8 cue (a coil holds medium-high for a minute after the turn —
  // lifting the pan off is the real "drop the heat" move there).
  const EGGS_ELECTRIC_FOLD = {
    body: "Turn the dial to MEDIUM-LOW and lift the pan off the coil for 20–30 seconds while it cools — then back on, stirring in a slow figure-8.",
    beginner: "🔥 Dial to MEDIUM-LOW\n⚡ Coil cools slow — lift the pan OFF for 20–30s, then back on\n🥄 Trace a slow figure-8, over and over — gentle, unhurried\n⚠️ Look done already? Pan off the heat — you're ahead, not behind",
    voice: "Turn the dial down to medium-low and lift the pan off the coil for twenty to thirty seconds while it cools — then back on, and trace a gentle figure eight.",
  };
  function eggsCues() {
    const stoveAware = (cues) => eggStove !== "electric" ? cues : cues.map((c) => {
      if (/Figure-8 stir/i.test(c.title)) return { ...c, body: EGGS_ELECTRIC_FOLD.body, beginner: EGGS_ELECTRIC_FOLD.beginner, voice: EGGS_ELECTRIC_FOLD.voice };
      // the overshoot escape must not say "drop the heat" on a coil that holds it — sliding is the real move
      if (/Let them set/i.test(c.title)) return { ...c, beginner: (c.beginner || "").replace("Drop the heat, continue, keep the folding short", "Slide the pan OFF the coil, continue, keep the folding short") };
      return c;
    });
    if (eggFat === "butter") return stoveAware(EXP.cues);
    const f = EGG_FATS[eggFat] || EGG_FATS.butter;
    return stoveAware(EXP.cues.map((c) => {
      if (!c.fat) return c;
      if (/medium-high \+ butter in|Set medium-high/i.test(c.title)) {   // was /Drop to medium-high/ — a stale match after the title rename left the at:0 swap DEAD (the reported bug)
        return {
          // the cue-0 butter-melt image is butter-specific: non-butter paths get a
          // per-fat keyed slot (404-hidden until a free-lane session ships images)
          ...c, referenceImage: `assets/recipes/eggs/eggs-p1-fat-${eggFat}.webp`,
          title: `Set medium-high + ${f.noun} in`,
          body: `Set the heat to MEDIUM-HIGH. ${f.add}. (Parked at medium? Nudge the dial UP; pan off the burner? Back on first.)`,
          beginner: `The pan's hot from preheating — set the dial to MEDIUM-HIGH now, wherever it ended up (parked at medium? that means nudging UP; pan off the burner? put it back on first). ${f.add}; ${f.melt}. This is hot enough to actually set the eggs — we'll drop it lower once they've whitened and you start folding.`,
          voice: `Set the heat to medium-high, then ${f.addShort}.`
        };
      }
      if (/Pour in the eggs/i.test(c.title)) {
        return {
          ...c, referenceImage: `assets/recipes/eggs/eggs-pour-${eggFat}.webp`,   // the pour-into-butter shot is butter-specific too
          body: `Pour the eggs ${f.into}. Now leave them alone — no stirring yet. We're not making rubber.`,
          beginner: `Pour your whisked eggs ${f.into}. Not ready to pour? Slide the pan off the burner while you get set — ${f.recover} — and carry on. Once they're in, leave them completely alone — no stirring. We want them to start setting first. We're not making rubber.`
        };
      }
      return c;
    }));
  }

  // ---- steak (grill method): preheat-driven pre-phase + butter-aware cues ----
  const isSteakGrill = () => !!(EXP && EXP.id === "freebird-medium-rare-steak" && (activeMethod() || {}).id === "grill");
  const isChicken = () => EXP && EXP.id === "crispy-chicken-thighs";
  const isChickenGrill = () => !!(isChicken() && (activeMethod() || {}).id === "grill");
  const isChickenPan = () => !!(isChicken() && (activeMethod() || {}).id !== "grill");
  const isSmash = () => EXP && EXP.id === "smash-burgers";
  const SMASH_STOVE = { gas: { sec: 180 }, electric: { sec: 300 } };   // electric strictly exceeds gas
  // Smash cues: apply the single/double methodAlt, and at 1 burger drop the round-2 cues
  // and pull the terminal cues (burner-off / doneness / finish) earlier so it doesn't idle.
  function smashCues() {
    const method = (activeMethod() || {}).id || "double";
    const n = portionCount || (EXP.portion ? EXP.portion.base : 2);
    let cues = EXP.cues
      .filter((c) => !(c.round && c.round >= 2 && n < 2))
      .map((c) => (c.methodAlt && c.methodAlt[method]) ? { ...c, ...c.methodAlt[method] } : c);
    if (n < 2) cues = cues.map((c) => c.at > 165 ? { ...c, at: c.at - 145 } : c);   // close the dropped round-2 gap (335→190, 355→210, 375→230)
    return cues;
  }
  // pan preheat (hot-start): electric strictly exceeds gas per the standing rule
  const CHICKEN_STOVE = { gas: { sec: 150 }, electric: { sec: 270 } };
  // The grill needs a head start, so lighting it comes FIRST: confirming step 1
  // starts a 9-minute BACKGROUND timer (startsBgTimer) and the remaining prep
  // happens while it runs. When the timer lands, the "ripping hot" gate prompts
  // the cook on to the sear — same completion pattern as the pasta simmer timer.
  function steakGrillPrePhase() {
    return {
      title: "Fire up the grill",
      intro: "The grill needs a head start, so it goes on first — you prep the steak while it heats.",
      skipWarning: "Only skip if the grill's already ripping hot — a cool grate steams the steak instead of searing it.",
      startLabel: "Prep's done ▸",
      steps: [
        {
          title: "Light the grill — HIGH, lid closed", startsBgTimer: true, heat: "high", referenceImage: "assets/recipes/steak/grill-p1-c1.webp",
          body: "Gas: open the propane valve fully, turn a burner to HIGH, and press the igniter — check it lit, then close the lid. It preheats 9 minutes while we prep. (Charcoal? Light it ~20 minutes ahead — and if your coals are already ashed-over and glowing, prep along and take the ready-check as soon as it appears.)",
          voice: "Light the grill. On gas, open the propane valve, turn a burner to high, and press the igniter — check that it lit, then close the lid. It preheats for nine minutes while we prep the steak.",
        },
        {
          title: "Pat the steak dry", referenceImage: "assets/recipes/steak/steak-prep-2.webp",
          body: "Press paper towels firmly against both sides until no more moisture comes off. Wet steak steams; dry steak sears — boring step, biggest payoff.",
          voice: "Pat the steak dry with paper towels — press firmly on both sides until nothing more comes off. Dry steak is what sears.",
        },
        {
          title: "Season it — salt & pepper", referenceImage: "assets/recipes/steak/steak-prep-3.webp",
          body: "Salt both sides more than feels right — most of it falls off on the grill. Add pepper too, and press it in lightly so it sticks.",
          voice: "Season both sides with salt — more than feels right — and pepper. Press it in lightly so it sticks.",
        },
        {
          title: "Tongs & a plate at the grill",
          body: "Tongs, a plate for resting, and your thermometer if you've got one — all within reach. If your grill allows it, keep one burner lower as a cooler escape zone for flare-ups.",
          voice: "Get your tongs, a resting plate, and your thermometer next to the grill. If you can, keep one burner lower as an escape zone for flare-ups.",
        },
      ],
      timer: {
        sec: 540, phaseLabel: "preheat", label: "Preheating the grill",
        note: "Lid stays CLOSED — every peek dumps the heat you're building. High, lid down, 9 minutes total.",
        earlyAfterSec: 300, earlyLabel: "Grates are ripping hot ▸",
      },
      gate: {
        question: "Is the grill ripping hot?", phaseLabel: "grill check",
        referenceImage: "assets/recipes/steak/grill-p1-c4.webp",
        lead: "Open the lid and hold your palm about 5 inches over the grates.\n\n✅ Ready: you have to pull your hand away within 2 seconds — that's ripping hot.\n\n❌ Not ready: you can hold it there longer. Close the lid and give it a few more minutes.\n\n(Palm above the grates, never touching — and keep sleeves clear.)",
        voice: "Hold your palm about five inches over the grates. If you have to pull away within two seconds, it's ready. If not, close the lid and give it a few more minutes.",
        yesLabel: "It's ripping hot ▸", notYetLabel: "Not yet — keep heating", notYetSec: 120, notYetTimerLabel: "Lid closed — a little longer",
      },
      transition: { title: "🎸 Drop it — Free Bird starts now", body: "Steak in hand, tongs ready. Tap play and lay it over direct heat.", voice: "Grill's ready. Grab the steak and your tongs, tap play, and we lay it over direct heat.", button: "Play", emoji: "🔥" },
    };
  }
  // Grill cues, butter-aware: the finish cue carries the rest + an optional butter
  // finish. If the cook unchecked butter on the prep screen, the butter lines go away
  // (the cue system supports conditional copy via these per-recipe transforms).
  function steakGrillCues(butterOn = optActive(EXP.id, "butter")) {
    const cues = mCues();
    if (butterOn) return cues;
    return cues.map((c) => {
      if (c.type !== "finish") return c;
      return {
        ...c,
        body: "Off the grill, onto its plate — now it rests, 5 minutes. Then slice against the grain.",
        beginner: "⏱️ Rest five minutes on the plate — NO cutting\n👀 Let the juices settle — cutting early drains them out\n🔥 Then slice AGAINST the grain (across the lines)\n🎸 The steakhouse wanted forty-five and a reservation. First of many.",
        voice: "Off the grill and onto the plate — now it rests, five minutes. Then slice against the grain. You just grilled a steakhouse steak for about fifteen bucks.",
        custom: { beginner: "⏱️ Rest five minutes on the plate — NO cutting\n👀 Let the juices settle — cutting early drains them out\n🔥 Then slice AGAINST the grain for tender bites\n🎸 The steakhouse wanted forty-five. First of many." },
      };
    });
  }

  // ── CHICKEN PAN preheat (hot-start): high heat + oil to shimmer. Foreground
  // timer (prep's done, you wait on it), stove-aware (electric > gas), sensory gate. ──
  function chickenPanPrePhase() {
    const stove = state.equipment.heat === "electric" ? "electric" : "gas";
    const sec = (CHICKEN_STOVE[stove] || CHICKEN_STOVE.gas).sec;
    const note = stove === "electric"
      ? "Empty pan with a film of oil on high — electric coils take their time, so give it a few minutes. Don't wander off; hot oil left too long starts to smoke. When it shimmers, we're ready."
      : "Empty pan with a film of oil on high — it heats fast on gas. Don't wander off; hot oil left too long starts to smoke. When it shimmers, we're ready.";
    return {
      title: "Heat the pan",
      intro: "Skin-on thighs need a hot, oiled pan to crisp without sticking — so we get it ready first.",
      skippable: true,
      skipWarning: "Only skip if the pan's already hot — skin won't crisp and can stick on a cold start.",
      steps: [
        { title: "Pan on HIGH + a film of oil", heat: "high", referenceImage: "assets/recipes/chicken/chicken-prep-4.webp",
          body: "Cast-iron or stainless on HIGH. Add a thin film of neutral oil — enough to coat the base.",
          voice: "Put your cast iron or stainless pan on high heat, then add a thin film of neutral oil to coat the base." },
      ],
      timer: { sec, phaseLabel: "preheat", label: "Heating the pan", note,
        earlyAfterSec: Math.round(sec * 0.5), earlyLabel: "Oil's shimmering ▸" },
      gate: {
        question: "Is the oil shimmering?", phaseLabel: "heat check",
        lead: "Tilt the pan — the oil should thin out and shimmer with a faint ripple.\n\n✅ Ready: it shimmers and moves like water.\n\n❌ Not ready: still thick and pooling — give it another minute.\n\n⚠️ Smoking or rippling hard? Too hot — take it off the heat for a beat, then back on.",
        voice: "Tilt the pan — when the oil thins out and shimmers like water, it's ready. Smoking means too hot, so take it off the heat for a beat.",
        yesLabel: "It's shimmering ▸", notYetLabel: "Not yet — keep heating", notYetSec: 60, notYetTimerLabel: "A little longer",
      },
      transition: { title: "Skin down — here we go", body: "Thighs in hand. Tap play and lay them skin-side down into the hot oil, away from you.", voice: "Pan's ready. Grab the thighs, tap play, and we lay them skin-side down into the hot oil.", button: "Play", emoji: "🍗" },
    };
  }
  // ── CHICKEN GRILL preheat: two-zone setup. Background timer (runs while you prep),
  // same pattern as the steak grill. One timing (grills are out of the gas/electric rule). ──
  function chickenGrillPrePhase() {
    return {
      title: "Fire up the grill",
      intro: "The grill needs a head start and two heat zones, so it goes on first — you prep the thighs while it heats.",
      skipWarning: "Only skip if the grill's already hot with two zones set — a cold grate won't crisp the skin.",
      startLabel: "Prep's done ▸",
      steps: [
        { title: "Two zones — HIGH one side, OFF the other", startsBgTimer: true, heat: "high", referenceImage: "assets/recipes/steak/grill-p1-c1.webp",
          body: "Gas: light it, turn ONE side (or half the burners) to HIGH and leave the OTHER side OFF — that's your direct + indirect zones. Close the lid; it preheats ~12 min while we prep. (Charcoal: bank the lit coals to ONE side.)",
          voice: "Light the grill and set up two zones — one side high, the other side off. Close the lid; it preheats about twelve minutes while we prep the thighs." },
        { title: "Pat the thighs dry", referenceImage: "assets/recipes/chicken/chicken-prep-1.webp",
          body: "Press paper towels firmly into the skin until no more moisture comes off. Dry skin is what crisps on the grill.",
          voice: "Pat the thighs dry with paper towels — press firmly into the skin until nothing more comes off." },
        { title: "Season both sides", referenceImage: "assets/recipes/chicken/chicken-prep-2.webp",
          body: "Salt and pepper both sides — plus garlic powder and paprika if you have them. Wash up after the raw chicken.",
          voice: "Season both sides with salt and pepper, add garlic powder and paprika if you have them, then wash up after the raw chicken." },
        { title: "Oil the grate + tongs ready", referenceImage: "assets/recipes/chicken/chicken-prep-4.webp",
          body: "When it's hot, fold a paper towel, dip it in a little oil, and wipe the DIRECT-zone grates with tongs — the anti-stick for skin. Have tongs, a plate, and your thermometer at the grill.",
          voice: "Once it's hot, wipe the direct-zone grates with an oiled paper towel using tongs — that's the anti-stick for the skin. Keep tongs, a plate, and a thermometer at the grill." },
      ],
      timer: {
        sec: (typeof window !== "undefined" && window.__fastPreheat) ? 3 : 720, phaseLabel: "preheat", label: "Preheating the grill",
        note: "Lid stays CLOSED — every peek dumps the heat. High on one side, off on the other, about 12 minutes.",
        earlyAfterSec: (typeof window !== "undefined" && window.__fastPreheat) ? 1 : 360, earlyLabel: "Grates are ripping hot ▸",
      },
      gate: {
        question: "Is the direct zone ripping hot?", phaseLabel: "grill check",
        referenceImage: "assets/recipes/steak/grill-p1-c4.webp",
        lead: "Open the lid and hold your palm about 5 inches over the DIRECT (high) zone.\n\n✅ Ready: you have to pull your hand away within 2 seconds.\n\n❌ Not ready: you can hold it there longer. Close the lid and give it a few more minutes.\n\n(Palm above the grates, never touching — sleeves clear.)",
        voice: "Hold your palm about five inches over the direct zone. If you have to pull away within two seconds, it's ready. If not, close the lid and give it a few more minutes.",
        yesLabel: "It's ripping hot ▸", notYetLabel: "Not yet — keep heating", notYetSec: 120, notYetTimerLabel: "Lid closed — a little longer",
      },
      transition: { title: "Skin down — here we go", body: "Thighs in hand, tongs ready. Tap play and lay them skin-side down over the direct heat.", voice: "Grill's ready. Grab the thighs and your tongs, tap play, and we lay them skin-side down over the direct heat.", button: "Play", emoji: "🔥" },
    };
  }

  // SMASH BURGERS preheat: dry empty pan on HIGH, water-drop gate, NON-skippable
  // (an under-heated pan is the failure mode). Stove-aware (electric > gas).
  function smashPrePhase() {
    const stove = state.equipment.heat === "electric" ? "electric" : "gas";
    const sec = (SMASH_STOVE[stove] || SMASH_STOVE.gas).sec;
    return {
      title: "Heat the pan — hotter than feels right",
      intro: "Smash burgers cook in about two minutes, so the pan has to be genuinely ripping hot before the beef goes in — that heat is the whole recipe.",
      skippable: true,
      skipWarning: "Skipping the preheat is how you get a grey steamed patty instead of a crust — only skip if the pan is already ripping hot.",
      steps: [
        { title: "Pan on HIGH — dry and empty", heat: "high", referenceImage: "assets/recipes/smash/prep-stage.webp",
          body: "🔥 Empty DRY pan on HIGH — no oil, no butter, nothing\n🧲 Dry is correct: the beef must grip the pan to crust\n⏳ Walk away and let it get genuinely hot",
          voice: "Put your empty, dry pan on high heat. No oil, no butter — the beef needs to grip the bare pan to build its crust. Let it get seriously hot." },
      ],
      timer: { sec: (typeof window !== "undefined" && window.__fastPreheat) ? 3 : sec, phaseLabel: "preheat", label: "Preheating — hotter than feels right",
        note: "Empty dry pan on high — no oil. Let it go until water flicked in vanishes almost instantly. Fan on, window cracked; the smoke to come is the good kind." },
      gate: {
        question: "Is the pan ripping hot?", phaseLabel: "heat check",
        lead: "Flick a couple of water drops in.\n\n✅ Ready: they hiss, skate, and vanish almost instantly — gone in about a second.\n\n❌ Not ready: they sit and bubble like a hot tub. Give it another minute and flick again.\n\n(Keep your hand high — this pan is hotter than anything else you've cooked on.)",
        voice: "Careful — this pan is hotter than anything you've cooked on. Flick a couple of water drops in: if they hiss, skate, and vanish almost instantly, it's ready. If they sit and bubble, give it another minute.",
        yesLabel: "Vanished instantly — it's ripping ▸", notYetLabel: "Still bubbling — keep heating", notYetSec: 60,
      },
      transition: { title: "Beef out of the fridge — go time 🍔", body: "Balls out of the fridge, parchment and spatula ready. Tap start and we smash.", voice: "Pan's ripping. Grab the cold beef balls, tap start, and we smash the first round.", button: "Start the smash", emoji: "🍔" },
    };
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
      const h = Reminders.schedule(r.minutes, "Choppd", r.done, { onFire: () => { restReminder = null; stopRestTick(); if ($("#restCard")) screens.prep(); } });
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
    const ingRecipe = isPasta() ? { ...EXP, ingredients: pastaIngredients() } : isEggs() ? { ...EXP, ingredients: eggsIngredients() } : { ...EXP, ingredients: mIngredients() };   // method-aware (grill: no oil, butter optional)
    const ingScale = (isPasta() || isEggs()) ? 1 : portionScale();
    h(screenEl("", `
      <div style="display:flex;justify-content:space-between;align-items:center">
        <button class="btn ghost" id="back" style="width:auto;padding-left:0">← Back</button>
        <button class="quit-text" id="previewQuit">Quit</button>
      </div>
      ${EXP.heroImage ? `<div class="prep-hero" style="background-image:url('${esc(EXP.heroImage)}')"></div>` : ""}
      <p class="eyebrow"${EXP.heroImage ? ' style="margin-top:12px"' : ""}>${EXP.song.title} · ${EXP.recipe.title}</p>
      <h1 style="margin-top:8px">${EXP.recipe.emoji} ${esc(EXP.recipe.title)}</h1>
      <div style="margin-top:10px">${EXP.noMusic ? guidedBadge("lg") : syncBadge("lg")}</div>
      <p class="muted" style="font-size:12px;margin-top:8px">⏱ ~${expMins(EXP)} min total${expBreakdown(EXP) ? ` — ${esc(expBreakdown(EXP))}` : ""}</p>
      ${EXP.cookWarning ? `<div class="cook-warning">⚠️ <b>Pull them early.</b> ${esc(EXP.cookWarning)}</div>` : ""}
      ${(EXP.methods && EXP.methods.length > 1) ? `
      <p class="section-title" style="margin-top:16px">Cooking method</p>
      <div class="portion" id="method">${EXP.methods.map((m) => `<button class="pchip ${m.id === (activeMethod() || {}).id ? "on" : ""}" data-method="${m.id}">${m.emoji || ""} ${m.label}</button>`).join("")}</div>
      ${(activeMethod() && activeMethod().note) ? (/^⏰/.test(activeMethod().note) ? `<p class="method-warn" style="font-size:12px;margin-top:8px;padding:8px 10px;border-radius:8px;background:var(--hot-dim);border:1px solid var(--hot);color:var(--text);line-height:1.5">${esc(activeMethod().note)}</p>` : `<p class="muted" style="font-size:12px;margin-top:6px">${esc(activeMethod().note)}</p>`) : ""}` : ""}
      ${EXP.portion ? `
      <p class="section-title" style="margin-top:16px">${EXP.portion.label}</p>
      <div class="portion" id="portion">${EXP.portion.options.map((n) => `<button class="pchip ${n === pn ? "on" : ""}" data-n="${n}">${n}</button>`).join("")}</div>
      <p class="serving-voice">${esc(portionVoiceLine(EXP))}</p>
      <p class="muted serving-fact" style="font-size:12px;margin-top:4px">${esc(EXP.servingNote || `2× is right there for the date-or-roommate case.`)}</p>` : ""}
      ${isPasta() ? pastaControlsHTML() : ""}
      ${isEggs() ? eggsControlsHTML() : ""}
      <div style="margin-top:18px">${ingredientsSectionHTML(ingRecipe, ingScale)}</div>
      ${isPasta() ? pastaNotesHTML() : ""}
      ${(EXP.id === "freebird-medium-rare-steak" && (portionCount || EXP.portion.base) >= 3) ? `<p class="muted" style="font-size:12px;margin-top:10px;background:rgba(255,107,53,.1);border:1px solid rgba(255,107,53,.32);border-radius:12px;padding:10px 12px;line-height:1.5">🍳 <b style="color:var(--text)">Cooking ${portionCount || EXP.portion.base} steaks:</b> ${isSteakGrill() ? "give them space on the grate — steaks that touch steam instead of sear. Spread them over the hot zone, or cook in two rounds." : "make sure your pan is big enough that they don't touch — crowded steaks steam instead of sear. Use a large pan, or cook in two batches."}</p>` : ""}
      <p class="section-title" style="margin-top:18px">You'll need</p>
      <ul class="equip-list">${equipmentFor().map((e) => `<li>${esc(e)}</li>`).join("")}</ul>
      ${EXP.restReminder ? restTimerCardHTML() : ""}
      <div class="mt-auto" style="margin-top:22px">
        <button class="btn" id="next">Looks good → Next</button>
        <button class="btn ghost" id="prevHere" style="margin-top:8px">👀 Preview the cook first</button>
      </div>
    `));
    $("#back").onclick = backFromRecipe;   // origin-aware: scan → results (state intact), else dashboard
    $("#previewQuit").onclick = () => { vibrate("tap"); screens.home(); };   // global quit: one tap home, no modal (nothing in progress); scan session preserved in lastScan
    $("#prevHere").onclick = () => startPreview(EXP);
    $$("#portion .pchip").forEach((b) => b.onclick = () => { portionCount = +b.dataset.n; screens.prep(); });
    $$("#method .pchip").forEach((b) => b.onclick = () => { cookMethod = b.dataset.method; screens.prep(); });
    $$("#garlicSel .pchip").forEach((b) => b.onclick = () => { garlicStrength = b.dataset.garlic; screens.prep(); });
    $$("#liquidSel .pchip").forEach((b) => b.onclick = () => { cookLiquid = b.dataset.liquid; screens.prep(); });
    $$("#addins .opt-toggle").forEach((c) => c.onclick = () => { addIns[c.dataset.add] = !addIns[c.dataset.add]; screens.prep(); });
    $$("#fatSel .pchip").forEach((b) => b.onclick = () => { eggFat = b.dataset.fat; screens.prep(); });
    wireIngredientsSection(ingRecipe, ingScale);
    if (EXP.restReminder) wireRestTimer();
    $("#next").onclick = () => { prepIdx = 1; screens.prep(); };
  }

  // Screen 1 — choose your pan (with per-material explanations).
  // ---- THE PAN/STOVE GATE (engine-level, every recipe) ----
  // Mandatory pre-cook setup: pan + stove before any cook content. Previous picks
  // pre-select (one tap to confirm); both persist as the user's defaults. Recipes
  // never wire this themselves — synced cooks hit it at prep step 1, guided cooks
  // at Start. The only bypass is the tutorial's sandboxed run.
  function panStoveGate(opts) {
    const grill = cookNeeds.grill;
    if (state.cookPan && !panSuitable(state.cookPan)) state.cookPan = null;   // last pick unsuitable here
    h(screenEl("", `
      <button class="btn ghost" id="back" style="width:auto;align-self:flex-start;padding-left:0">← Back</button>
      <p class="wiz-progress">Your setup</p>
      <h1 style="margin-top:6px">${grill ? "Grill + stove check 🔥" : "What are you<br>cooking with? 🍳"}</h1>
      ${grill ? `
      <p class="lead" style="margin-top:12px">You're grilling — no pan needed. Cook over a preheated grill and keep a cooler zone handy for flare-ups.</p>`
        : `
      <p class="section-title" style="margin-top:14px">Your pan</p>
      <div class="pan-opts" id="panOpts">
        ${PAN_ORDER.map((id) => { const x = PAN_EXPLAIN[id]; const suit = panSuitable(id); const on = suit && state.cookPan === id; return `<button class="pan-opt ${on ? "on" : ""}" data-pan="${id}" ${suit ? "" : "disabled style=\"opacity:.45\""}><span class="po-emoji">${x.emoji}</span><span class="po-body"><b>${x.label}</b><small>${suit ? x.short : "not ideal for this recipe"}</small></span></button>`; }).join("")}
      </div>
      ${cookNeeds.panBlockedCopy && !panSuitable("nonstick") ? `<p class="muted" style="font-size:12px;margin-top:6px;line-height:1.5">🚫 ${esc(cookNeeds.panBlockedCopy)}</p>` : (cookNeeds.panReason ? `<p class="muted" style="font-size:12px;margin-top:8px;line-height:1.5">🍳 ${esc(cookNeeds.panReason)}</p>` : (panSuitable("nonstick") ? `<p class="muted" style="font-size:12px;margin-top:4px">Not sure? Choose <b>Nonstick</b>.</p>` : ""))}`}
      <p class="section-title" style="margin-top:14px">Your stove</p>
      <div class="pan-opts" id="stoveOpts">
        <button class="pan-opt ${state.equipment.heat === "gas" ? "on" : ""}" data-stove="gas"><span class="po-emoji">🔥</span><span class="po-body"><b>Gas</b><small>Flame — heat changes fast</small></span></button>
        <button class="pan-opt ${state.equipment.heat === "electric" ? "on" : ""}" data-stove="electric"><span class="po-emoji">⚡</span><span class="po-body"><b>Electric</b><small>Coil or glass-top — heats and cools slower</small></span></button>
      </div>
      <div class="mt-auto" style="margin-top:20px"><button class="btn" id="next" disabled>Next →</button></div>
    `));
    $("#back").onclick = opts.onBack;
    const next = $("#next");
    const check = () => next.disabled = !((grill || state.cookPan) && state.equipment.heat);
    $$("#panOpts .pan-opt:not([disabled])").forEach((b) => b.onclick = () => {
      state.cookPan = b.dataset.pan;
      if (!(state.equipment.pans || []).includes(state.cookPan)) state.equipment.pans.push(state.cookPan);   // owning follows using
      saveProfile(); saveEnt();
      $$("#panOpts .pan-opt").forEach((x) => x.classList.toggle("on", x.dataset.pan === state.cookPan));
      check();
    });
    $$("#stoveOpts .pan-opt").forEach((b) => b.onclick = () => {
      state.equipment.heat = b.dataset.stove;
      eggStove = b.dataset.stove;                       // the stove machinery reads this (eggs preheat etc.)
      saveProfile();
      $$("#stoveOpts .pan-opt").forEach((x) => x.classList.toggle("on", x.dataset.stove === state.equipment.heat));
      check();
    });
    check();
    next.onclick = opts.onDone;
  }
  function prepPanSelect() {
    panStoveGate({ onBack: () => { prepIdx = 0; screens.prep(); }, onDone: () => { prepIdx = 2; screens.prep(); } });
  }

  // Screens 2..N — one prep step per screen (can't skip).
  function prepStepScreen(steps, i) {
    const step = steps[i];
    if (state.prefs.voice && step.voice) { VoicePlayer.unlock(); speak(step.voice); }   // hands-free: read the prep step aloud (pre-generated clip)
    const n = steps.length;
    const pn = EXP.portion ? (portionCount || EXP.portion.base) : null;
    const sub = (t) => (pn != null ? String(t == null ? "" : t).replace(/\{n\}/g, pn) : String(t == null ? "" : t).replace(/\{n\}/g, ""));
    const body = displayUnits(step.instructions ? (isPasta() ? step.instructions : injectAmounts(sub(step.instructions), mIngredients(), portionScale())) : "Have this measured and ready before you start cooking.");
    h(screenEl("", `
      <button class="btn ghost" id="back" style="width:auto;align-self:flex-start;padding-left:0">← Back</button>
      <p class="wiz-progress">Prep step ${i + 1} of ${n}</p>
      <div class="wiz-bar"><i style="width:${Math.round(((i + 1) / n) * 100)}%"></i></div>
      <h1 style="margin-top:12px">${esc(sub(step.title))}</h1>
      <p class="lead" style="margin-top:10px">${esc(body)}</p>
      ${step.referenceImage ? `<div class="cue-img-stack" id="prepImg" hidden style="margin-top:12px"><img class="cue-img-layer" alt="${esc(sub(step.title))}"></div>` : ""}
      ${Array.isArray(step.techniqueGuide) && step.techniqueGuide.length ? `<div class="tech-guide"><p class="section-title" style="margin-top:16px">How to do it</p><ol class="tech-list">${step.techniqueGuide.map((g) => `<li>${esc(displayUnits(sub(g)))}</li>`).join("")}</ol></div>` : ""}
      ${step.equipmentNeeded ? `<p class="muted" style="font-size:12px;margin-top:12px">${esc(step.equipmentNeeded)}</p>` : ""}
      <div class="mt-auto" style="margin-top:22px"><button class="btn" id="next">Done → ${i + 1 < n ? "Next step" : "Music"}</button></div>
    `));
    const wImg = $("#prepImg");
    if (wImg && step.referenceImage) { const im = wImg.querySelector("img"); im.onload = () => { wImg.hidden = false; requestAnimationFrame(() => im.classList.add("on")); }; im.src = step.referenceImage; }
    $("#back").onclick = () => { prepIdx -= 1; screens.prep(); };
    $("#next").onclick = () => { vibrate("tap"); prepIdx += 1; screens.prep(); };
  }

  // Final screen — music + voice, then launch the cook.
  function prepMusicVoice() {
    h(screenEl("", `
      <button class="btn ghost" id="back" style="width:auto;align-self:flex-start;padding-left:0">← Back</button>
      <p class="eyebrow">${EXP.noMusic ? EXP.recipe.title : EXP.song.title + " · " + EXP.recipe.title}</p>
      <h1 style="margin-top:6px">${EXP.noMusic ? "Last thing —<br>voice & haptics 🎙️" : "Last thing —<br>your music 🎸"}</h1>
      <p class="lead" style="margin-top:10px">${EXP.noMusic ? "Voice reads each step aloud and haptics buzz the cues — set them, then we cook at your pace." : "Pick a soundtrack and voice, then we cook."}</p>
      ${(!EXP.noMusic && appleMusicCapable()) ? `<div id="amSource" style="margin-top:18px"></div>` : ""}
      ${EXP.noMusic ? "" : EXP.song.audioFile
        ? `<div class="voicepick" style="margin-top:20px"><p class="section-title" style="margin:0 0 6px">🎵 Music</p><p class="muted" style="font-size:12px">${currentSpotifySel() ? "Your Spotify pick plays during the cook." : (EXP.song.phase2Blurb || "Royalty-free demo track plays automatically when you start.")} ${EXP.song.audioCredit || ""}${(!currentSpotifySel() && activePrePhase()) ? ` ${PHASE1_CREDIT}` : ""}</p></div>`
        : `<div style="margin-top:20px">${musicPickerHTML()}</div>`}
      <div style="margin-top:14px">${voicePickerHTML()}</div>
      <div class="mt-auto" style="margin-top:18px">
        <p class="muted" style="font-size:12px;text-align:center;margin-bottom:10px">${EXP.noMusic ? "Timer-driven — cues fire on the clock. Voice & haptics on — adjust anytime." : "Cues sync to the song. Voice & haptics on — adjust anytime."}</p>
        <button class="btn" id="start">${EXP.noMusic ? "▶ Start cooking " + EXP.recipe.emoji : "▶ Start cooking 🎸"}</button>
      </div>
    `));
    $("#back").onclick = () => { prepIdx -= 1; screens.prep(); };
    if (!EXP.noMusic && !EXP.song.audioFile) wireMusicPicker();
    if (!EXP.noMusic && appleMusicCapable()) mountAmSource("#amSource", () => {});
    wireVoicePicker();
    if (isKokoro()) pregenKokoro();
    $("#start").onclick = async () => {
      VoicePlayer.unlock(); Music.initGraph();   // this tap is our gesture — unlock iOS audio + build the muffle graph
      // Own playlist? Activate Spotify on THIS tap so it can play continuously from
      // the very start of Phase 1. (Default song keeps the calm Phase 1 → tap-to-play
      // Phase 2 structure, where activation happens at the drop instead.)
      if (currentSpotifySel()) { try { await Spotify_.activate(); } catch (e) { } }
      // AM PILOT: "Your music" chosen → authorize + subscription-check on THIS tap. Not subscribed /
      // not authorized / any failure → drop the AM selection and fall back to the recipe's local track
      // SILENTLY (never a friction wall, never an upsell — MusicKit no-charge rule). Then cook proceeds
      // exactly as the local spine.
      if (currentAmSel()) {
        try { const a = await window.AppleMusic_.authorize(); if (!a || !a.authorized || !a.subscribed) { clearAmSel(); toast("Playing the recipe track"); } }
        catch (e) { clearAmSel(); }
      }
      // USAGE LIMITS: first-cook-start enforcement (past the pan/stove gate; the
      // cook mounts on the far side of this call). Server is the authority; the
      // fulfillment-card path routes through here too (no side door). Offline /
      // network failure = fail-open (limits are a product lever, not security).
      const gateOk = await cookStartGate(EXP.id);
      if (!gateOk) return;
      // COOK RESUME: confirm before replacing a different active cook, then commit.
      guardActiveCook(EXP.id, () => { if (activePrePhase()) screens.preCook(); else screens.cook(); });   // recipe- or method-driven Phase 1 (pasta, eggs, steak grill)
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
    const pp = activePrePhase();
    if (!pp) { screens.cook(); return; }
    Sfx.ensure();
    const ownPlaylist = !!currentSpotifySel();
    if (ownPlaylist) {
      // Own playlist: play it continuously from the very start of Phase 1, straight
      // through the simmer and into Phase 2 — no calm placeholder, no fresh start.
      phase1MusicPlaying = true;
      try { Spotify_.playSelection(currentSpotifySel()).catch(() => { }); } catch (e) { }
    } else {
      Ambient.playShuffled(PHASE1_TRACKS);   // default song: shuffled royalty-free chill mix during Phase 1 (fades into the song at the drop)
    }
    let timerId = null, stepTimerId = null, simmerSec = pp.timer.sec, stirOn = true;
    // BACKGROUND phase timer (steak grill preheat): a step flagged startsBgTimer
    // starts the phase-timer clock the moment it's confirmed; the remaining steps
    // run while it counts down (a live chip shows what's left on each step).
    let bgStartAt = null, bgTick = null, bgDone = false;
    const bgRemainSec = () => Math.round(pp.timer.sec - (Date.now() - bgStartAt) / 1000);
    const clearTimer = () => { if (timerId) { clearInterval(timerId); timerId = null; } };
    const clearStepTimer = () => { if (stepTimerId) { clearInterval(stepTimerId); stepTimerId = null; } };
    const clearBgTick = () => { if (bgTick) { clearInterval(bgTick); bgTick = null; } };
    // Skip the rest of the pre-phase (e.g. eggs preheat — pan already hot) and launch the
    // music-synced cook directly. Same launch path as the transition's play button.
    const launchCook = async () => {
      vibrate("tap"); clearTimer(); clearStepTimer(); clearBgTick(); VoicePlayer.unlock(); Music.initGraph();
      if (ownPlaylist) { screens.cook(); return; }          // own playlist already rolling
      if (currentSpotifySel()) { try { await Spotify_.activate(); } catch (e) { } }
      Ambient.fadeOut(900);                                  // fade the calm Phase-1 placeholder into the cook
      screens.cook();
    };
    const quit = () => confirmDialog("Quit this cook? Your progress will be lost.", "Yes, quit", () => { clearTimer(); clearStepTimer(); clearBgTick(); Ambient.stop(); if (ownPlaylist) { try { Spotify_.stop(); } catch (e) { } } phase1MusicPlaying = false; screens.home(); });
    const topBar = (label) => `<div class="cook-top precook-top">
        <button class="icon-btn" id="quit" title="Quit">✕</button>
        <span class="precook-phase">🎵 Phase 1 of 2 · ${esc(label)}</span>
      </div>`;
    const heatHTML = (lvl) => {
      const hg = lvl ? heatGuidance(lvl) : null; return hg
        ? `<div class="heat-badge ${lvl}"><b>${hg.flames} ${hg.label}</b><span>${hg.source}: ${esc(hg.dial)} · ${esc(hg.note)}</span></div>` : "";
    };

    // ---- tap-through prep steps ----
    let idx = 0;
    function renderStep() {
      clearTimer(); clearStepTimer(); clearBgTick();
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
            ${step.referenceImage ? `<div class="cue-img-stack" id="preImg" hidden><img class="cue-img-layer" alt="${esc(step.title)}"></div>` : ""}
            ${step.timerSeconds ? `<div class="step-timer" id="stepTimer"><button class="btn secondary" id="startStepTimer">▶ Start ${step.timerSeconds >= 60 ? fmt(step.timerSeconds) + " timer" : step.timerSeconds + "s timer"}</button><p class="muted" style="font-size:11px;margin:6px 2px 0">${esc(step.timerNote || "Advisory — you can move on whenever it looks right.")}</p></div>` : ""}
            ${step.simmerPicker ? `<div class="simmer-pick"><p class="muted" style="font-size:12px;margin:12px 0 6px"><b style="color:var(--text)">Check the box — set the timer for the cook time it lists.</b> Shapes vary, so the box is the source of truth.</p><div class="portion" id="simmerSel">${[8, 10, 12, 15].map((m) => `<button class="pchip ${simmerSec === m * 60 ? "on" : ""}" data-min="${m}">${m} min</button>`).join("")}</div></div>` : ""}
            ${bgStartAt ? `<div class="st-alert" id="bgRemain" style="margin-top:12px"></div>` : ""}
          </div>
          <div class="mt-auto" style="margin-top:18px">
            ${idx > 0 ? `<button class="btn secondary" id="back" style="margin-bottom:10px">← Back</button>` : ""}
            <button class="btn" id="next">${last ? (pp.startLabel || "Start the simmer ⏱") : "Next ▸"}</button>
            ${(pp.skipWarning && idx === 0) ? `<button class="btn ghost" id="skipPre" style="margin-top:10px">${esc(pp.skipLabel || "Skip — my pan's already hot ▸")}</button><p class="muted" style="font-size:11px;margin-top:6px;line-height:1.5">⚠️ ${esc(pp.skipWarning)}</p>` : ""}
          </div>
        </div>
      </section>`);
      $("#quit").onclick = quit;
      // step image (404-safe: slot stays hidden unless the file loads — same pattern as the cook screen)
      const pImg = $("#preImg");
      if (pImg && step.referenceImage) { const im = pImg.querySelector("img"); im.onload = () => { pImg.hidden = false; requestAnimationFrame(() => im.classList.add("on")); }; im.src = step.referenceImage; }
      if ($("#back")) $("#back").onclick = () => { idx--; renderStep(); };
      if (step.simmerPicker) $$("#simmerSel .pchip").forEach((b) => b.onclick = () => { simmerSec = +b.dataset.min * 60; $$("#simmerSel .pchip").forEach((x) => x.classList.toggle("on", x.dataset.min === b.dataset.min)); });
      if (step.timerSeconds) {
        const btn = $("#startStepTimer");
        btn.onclick = () => {
          if (stepTimerId) return;
          startCountdown();
        };
        const startCountdown = () => {
          if (stepTimerId) return;
          const endsAt = Date.now() + step.timerSeconds * 1000;   // timestamp-based (background-throttle safe)
          let remain = step.timerSeconds;
          $("#stepTimer").innerHTML = `<div class="st-count" id="stCount">${fmt(remain)}</div><div class="st-alert" id="stAlert" hidden></div>`;
          stepTimerId = setInterval(() => {
            remain = Math.round((endsAt - Date.now()) / 1000);
            const c = $("#stCount"); if (c) c.textContent = remain > 0 ? fmt(remain) : "Time!";
            if (step.timerAlert && step.timerSeconds - remain >= step.timerAlert.atSec) { const a = $("#stAlert"); if (a && a.hidden) { a.hidden = false; a.textContent = step.timerAlert.text; vibrate("double"); } }
            if (remain <= 0) { clearStepTimer(); Alarm.start(step.title || "Step timer", Math.max(0, Date.now() - endsAt)); }   // ring-until-dismissed (backdated)
          }, 1000);
        };
        if (step.timerAlert) startCountdown();   // safety-nudge timers don't wait for a tap
      }
      $("#next").onclick = () => {
        Alarm.dismiss(); vibrate("tap"); clearStepTimer();   // advancing the step also dismisses a live step/bg alarm
        if (step.startsBgTimer && !bgStartAt) bgStartAt = Date.now();   // preheat clock starts on THIS confirm
        if (!last) { idx++; renderStep(); return; }
        if (bgStartAt) {
          // background timer already running — pick it up with whatever's left
          // (no 3·2·1 countdown: nothing new is starting). Already elapsed → straight to the gate.
          clearBgTick();
          const remain = Math.max(0, bgRemainSec());
          if (remain <= 0) { vibrate("double"); renderGate(); return; }
          const elapsed = pp.timer.sec - remain;
          const earlyAfter = pp.timer.earlyAfterSec == null ? null : Math.max(0, pp.timer.earlyAfterSec - elapsed);
          renderTimer(remain, pp.timer.label, earlyAfter, pp.timer.earlyLabel);
          return;
        }
        runCountdown(() => renderTimer(simmerSec, pp.timer.label, pp.timer.earlyAfterSec ?? null, pp.timer.earlyLabel));
      };
      // Skip the preheat (pan already hot) → launch the music-synced cook directly.
      const skipBtn = $("#skipPre");
      if (skipBtn) skipBtn.onclick = () => { Alarm.dismiss(); launchCook(); };
      // live background-timer chip (grill preheat): counts down across the remaining
      // steps; when it lands, a chime + haptic prompt the cook to wrap up and move on.
      if (bgStartAt) {
        const el = $("#bgRemain");
        const tick = () => {
          const remain = bgRemainSec();
          if (!el) { clearBgTick(); return; }
          if (remain > 0) { el.textContent = `🔥 Grill preheating — ${fmt(remain)} left · keep the lid closed`; return; }
          el.textContent = "🔥 Grill's preheated — wrap up and keep going";
          if (!bgDone) { bgDone = true; Alarm.start("Grill preheat"); }   // ring-until-dismissed; banner is top-anchored so it doesn't cover the active step
          clearBgTick();
        };
        tick(); bgTick = setInterval(tick, 1000);
      }
      if (step.voice) speak(step.voice);   // hands-free: read the Phase-1 step out loud (pre-generated clip)
    }

    // ---- countdown simmer timer (real-time) with an early-exit ----
    let phase2Preloaded = false;
    function renderTimer(totalSec, label, earlyAfterSec, earlyLabel) {
      clearTimer();
      // The simmer is dead time — use it to warm the browser cache with every Phase-2 cue
      // image so nothing pops in late during the music-synced run. Fire-and-forget.
      if (!phase2Preloaded) {
        phase2Preloaded = true;
        try { (EXP.cues || []).forEach((c) => { const r = c.referenceImage; (Array.isArray(r) ? r : r ? [r] : []).forEach((src) => { new Image().src = src; }); }); } catch (e) { }
      }
      const endsAt = Date.now() + totalSec * 1000;   // timestamp-based: self-corrects after a background stint (throttled interval), so zero is detected on real time — the alarm is right the moment the page foregrounds
      let remain = totalSec;
      const showEarlyNow = earlyAfterSec != null && earlyAfterSec <= 0;
      const stirEvery = pp.timer.stirEvery || 0;
      h(`<section class="screen precook fade">
        ${topBar(pp.timer.phaseLabel || "simmer")}
        <div class="precook-body precook-timer">
          <p class="eyebrow">${esc(EXP.recipe.title)}</p>
          <h1 style="margin:6px 0 0">${esc(label)}</h1>
          ${pp.timer.heat ? heatHTML(pp.timer.heat) : ""}
          <p class="muted" style="font-size:12px;margin-top:8px">${pp.timer.note ? esc(pp.timer.note) : 'The liquid should be <b style="color:var(--text)">gently bubbling, not a rolling boil</b> — reduce the heat if it\'s boiling hard.'}</p>
          ${pp.timer.referenceImage ? `<div class="cue-img-stack" id="timerImg" hidden style="margin-top:10px"><img class="cue-img-layer" alt="${esc(label)}"></div>` : ""}
          ${stirEvery ? `<label class="stir-toggle"><input type="checkbox" id="stirChk" checked> 🔔 Stir reminders (every ${Math.round(stirEvery / 60)} min)</label>` : ""}
          <div class="pt-time" id="ptTime">${fmt(remain)}</div>
          <div class="pt-bar"><i id="ptBar" style="width:0%"></i></div>
          <p class="muted" id="ptElapsed" style="font-size:12px;margin-top:8px">0:00 elapsed · ${fmt(totalSec)} total</p>
          <div id="stirPrompt" class="stir-prompt" hidden>🥄 Give it a stir — scrape the bottom of the pan to prevent sticking</div>
          ${(pp.timer.tips && pp.timer.tips.length) ? `<div id="ptTip" class="precook-tip">💡 ${esc(pp.timer.tips[0])}</div>` : ""}
          <div class="mt-auto" style="margin-top:18px">
            <button class="btn" id="early" style="display:${showEarlyNow ? "block" : "none"}">${esc(earlyLabel || pp.gate.yesLabel)}</button>
            ${pp.skipWarning ? `<button class="btn ghost" id="skipPre2" style="margin-top:10px">${esc(pp.skipLabel || "Skip — my pan's already hot ▸")}</button><p class="muted" style="font-size:11px;margin-top:6px;line-height:1.5">⚠️ ${esc(pp.skipWarning)}</p>` : ""}
          </div>
        </div>
      </section>`);
      $("#quit").onclick = quit;
      const tImg = $("#timerImg");
      if (tImg && pp.timer.referenceImage) { const im = tImg.querySelector("img"); im.onload = () => { tImg.hidden = false; requestAnimationFrame(() => im.classList.add("on")); }; im.src = pp.timer.referenceImage; }
      const stirChk = $("#stirChk"); if (stirChk) stirChk.onchange = () => { stirOn = stirChk.checked; };
      const skip2 = $("#skipPre2"); if (skip2) skip2.onclick = () => { Alarm.dismiss(); launchCook(); };   // skip even mid-preheat
      const earlyBtn = $("#early");
      earlyBtn.onclick = () => { Alarm.dismiss(); clearTimer(); vibrate("tap"); renderGate(); };
      // rotating tips so the dead time is useful (cycle every ~25s)
      const tips = pp.timer.tips || [];
      let tipIdx = 0;
      timerId = setInterval(() => {
        remain = Math.round((endsAt - Date.now()) / 1000);   // real-time remaining (not a decrement) — background-throttle safe
        const elapsed = totalSec - remain;
        const t = $("#ptTime"); if (t) t.textContent = fmt(Math.max(0, remain));
        const bar = $("#ptBar"); if (bar) bar.style.width = Math.min(100, (100 * elapsed) / totalSec) + "%";
        const el = $("#ptElapsed"); if (el) el.textContent = `${fmt(elapsed)} elapsed · ${fmt(totalSec)} total`;
        if (earlyBtn && earlyAfterSec != null && elapsed >= earlyAfterSec) earlyBtn.style.display = "block";
        // stir reminder: louder, cutting alert + strong haptic + a spoken line + on-screen visual
        if (stirEvery && stirOn && elapsed > 0 && elapsed % stirEvery === 0 && remain > 0) {
          vibrate("strong"); Sfx.alert(); speak("Okay — time to stir.");
          const p = $("#stirPrompt"); if (p) { p.hidden = false; clearTimeout(p._h); p._h = setTimeout(() => { p.hidden = true; }, 6000); }
        }
        // rotate the tip every 25s (offset from the 2-min stir beat so they don't collide)
        if (tips.length > 1 && elapsed > 0 && elapsed % 25 === 0) {
          tipIdx = (tipIdx + 1) % tips.length;
          const tp = $("#ptTip"); if (tp) tp.innerHTML = "💡 " + esc(tips[tipIdx]);
        }
        if (remain <= 0) { clearTimer(); Alarm.start(label || "Timer", Math.max(0, Date.now() - endsAt)); renderGate(); }   // ring-until-dismissed (backdated by how long ago it hit zero, so a background-expiry lands in the right ring/visual state); the gate shows but the alarm rings until a tap
      }, 1000);
    }

    // ---- doneness gate ----
    function renderGate() {
      clearTimer();
      h(`<section class="screen precook fade">
        ${topBar(pp.gate.phaseLabel || "doneness check")}
        <div class="precook-body">
          <p class="eyebrow">${esc(EXP.recipe.title)}</p>
          <h1 style="margin-top:6px">${esc(pp.gate.question)}</h1>
          <p class="lead" style="margin-top:10px">${pp.gate.lead ? esc(pp.gate.lead).replace(/\n/g, "<br>") : "Bite a piece — it should be tender (not mushy), with the liquid mostly cooked down into a glossy sauce."}</p>
          ${pp.gate.referenceImage ? `<div class="cue-img-stack" id="gateImg" hidden style="margin-top:14px"><img class="cue-img-layer" alt="${esc(pp.gate.question)}"></div>` : ""}
          <div class="mt-auto" style="margin-top:24px">
            <button class="btn" id="ready">${esc(pp.gate.yesLabel)}</button>
            <button class="btn secondary" id="notyet" style="margin-top:10px">${esc(pp.gate.notYetLabel)}</button>
            ${pp.gate.tooHotLabel ? `<button class="btn secondary" id="toohot" style="margin-top:10px">${esc(pp.gate.tooHotLabel)}</button>` : ""}
          </div>
        </div>
      </section>`);
      $("#quit").onclick = quit;
      const gImg = $("#gateImg");
      if (gImg && pp.gate.referenceImage) { const im = gImg.querySelector("img"); im.onload = () => { gImg.hidden = false; requestAnimationFrame(() => im.classList.add("on")); }; im.src = pp.gate.referenceImage; }
      $("#ready").onclick = () => { Alarm.dismiss(); vibrate("strong"); renderTransition(); };
      $("#notyet").onclick = () => { Alarm.dismiss(); vibrate("tap"); renderTimer(pp.gate.notYetSec || 120, pp.gate.notYetTimerLabel || "2 more minutes — almost there", 0, pp.gate.yesLabel || "It's ready now ▸"); };
      // Optional THIRD gate branch (pancakes' drop-test): an OVER-heat state where "keep heating"
      // is the wrong move — take the pan OFF, cool down, then re-test. Short cooldown timer with the
      // ready button available immediately. Only renders when the gate authors tooHotLabel.
      if ($("#toohot")) $("#toohot").onclick = () => { Alarm.dismiss(); vibrate("tap"); renderTimer(pp.gate.tooHotSec || 30, pp.gate.tooHotTimerLabel || "Off the heat — cooling down", 0, pp.gate.yesLabel || "It's ready now ▸"); };
      if (pp.gate.voice) speak(pp.gate.voice);
    }

    // ---- the drop: launch the music-synced cook ----
    function renderTransition() {
      clearTimer();
      // Own playlist is already playing continuously — this is just the cooking "bring
      // it home" beat, not a music-start moment.
      const title = ownPlaylist ? "Time to bring it home 🎸" : pp.transition.title;
      const body = ownPlaylist ? "Your music keeps rolling — let's cook." : (pp.transition.body || "Tap play to start the music.");
      const btn = ownPlaylist ? "Let's go 🎸" : "▶ " + (pp.transition.button || "Play");
      h(`<section class="screen precook precook-drop fade">
        <div class="drop-inner">
          <div class="big-emoji" style="font-size:72px">${pp.transition.emoji || "🎸"}</div>
          <h1 style="margin:10px 0">${esc(title)}</h1>
          <p class="lead">${esc(body)}</p>
          <button class="btn drop-play" id="drop">${esc(btn)}</button>
        </div>
      </section>`);
      if (!ownPlaylist && pp.transition.voice) speak(pp.transition.voice);
      $("#drop").onclick = async () => {
        VoicePlayer.unlock(); Music.initGraph();   // this tap is our gesture — unlock iOS audio + build the muffle graph
        if (ownPlaylist) { screens.cook(); return; }   // music already rolling — keep it continuous, no restart
        // Default song: the song starts on THIS tap, so the Spotify activation gesture lives here.
        if (currentSpotifySel()) { try { await Spotify_.activate(); } catch (e) { } }
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
    const tutorial = cookTutorial; cookTutorial = false;
    const resume = (resumeCtx && resumeCtx.engine === "flagship" && resumeCtx.recipeId === EXP.id) ? resumeCtx : null;   // COOK RESUME position (read-once)
    resumeCtx = null;
    cookRunning = !preview && !tutorial;  // browser-back guard: a started cook never silently tears down // TUTORIAL = sandboxed real cook (silent, real-time, ends at cue 3, persists nothing)
    if (!preview) { VoicePlayer.unlock(); Music.initGraph(); preloadRecipeVoices(); }   // unlock iOS audio (safety) + muffle graph + preload this recipe's cue clips
    // scale cue times + total to the chosen portion (e.g. # of eggs)
    const pf = portionFactor();
    // pasta cues reflect the chosen servings/liquid/add-ins; others use the static set
    const baseCues = (EXP.id === "one-pot-garlic-parmesan-pasta") ? pastaCues() : (EXP.id === "scrambled-eggs") ? eggsCues() : (EXP.id === "upgraded-ramen") ? ramenCues() : (EXP.id === "philly-cheesesteak") ? phillyCues() : isSteakGrill() ? steakGrillCues() : isSmash() ? smashCues() : mCues();
    // PHASE LABELS (display-only): forward-fill each cue's segment label from the first cue that
    // declares `phaseLabel` (fried rice: "The Chicken" / "Bring it together"), rendered as an
    // eyebrow above the step title. Stamped on the BASE list BEFORE the opt-filter so a label
    // carried by an optional cue (e.g. the veg cue) survives even when that cue is dropped — the
    // fill has already tagged the cues after it. No engine/clock change; purely a header.
    { let ph = null; baseCues.forEach((c) => { if (c && c.phaseLabel) ph = c.phaseLabel; if (c) c._phase = ph; }); }
    // drop cues belonging to any deselected optional component (e.g. garlic butter)
    const active = baseCues.filter((c) => (!c.opt || optActive(EXP.id, c.opt)) && (!c.optAny || c.optAny.some((id) => optActive(EXP.id, id))));   // optAny: keep the cue if ANY listed optional is active (philly veg: onion OR pepper OR mushrooms)
    const cues = pf === 1 ? active : active.map((c) => ({ ...c, at: Math.round(c.at * pf) }));
    // Ramen/philly derive dur from the ACTIVE terminal cue + tail: an opt-drop collapses the ladder
    // (ramenCues egg-off / phillyCues witout), so a single durationSec would strand the ring.
    const dur = (EXP.id === "upgraded-ramen")
      ? Math.round(((active.length ? active[active.length - 1].at : 0) + 20) * pf)
      : (EXP.id === "philly-cheesesteak")
        ? Math.round(((active.length ? active[active.length - 1].at : 0) + 10) * pf)
        : Math.round((((activeMethod() && activeMethod().durationSec) || EXP.durationSec)) * pf);   // method-aware: e.g. steak/other method ladders
    // A chosen Spotify song/playlist plays as live background music (via the SDK);
    // otherwise fall back to the bundled royalty-free track, then YouTube.
    const spSel = tutorial ? null : currentSpotifySel();   // tutorial: no Spotify (SDK needs an in-gesture premium activation) — bundled/embed resolve normally
    const amSel = tutorial ? null : currentAmSel();        // AM PILOT: an Apple Music queue (ambient on the cook clock). The local track stays loaded as the silent fallback.
    // CANONICAL "AM is the live source" flag — the ONE thing every gate/transport branch reads. NO branch
    // may infer the source from queue shape/count/kind. Set on successful queue+play (startAmOrFallback's
    // finish(true)) — optimistically true at start so gates before confirmation still treat AM as the
    // source (never the local element). Now cleared in EXACTLY two places: stop() (cook end) and the
    // panel's "Use Choppd's pick instead" (a USER choice). It is NEVER cleared automatically mid-cook —
    // the founder's rule: the local file never silently takes over an Apple Music cook. Failures route to
    // amRepair (self-heal → repair popup/panel), not to fallback.
    let amActive = !!amSel;
    // The queue's ids are MUTABLE now: the repair panel's "pick different music" swaps in a fresh
    // selection and every re-queue (start / recovery / repair) reads amIds, so a new pick sticks.
    let amIds = amSel ? amSel.ids.slice() : [];
    let amRepairing = false, amRepairTimer = null;   // one self-heal ladder at a time (B)
    let audioEpoch = 0;   // FIX 2: single-owner audio — bumped on pause/resume/stop; voids any in-flight recovery/retry from a prior state
    // Music source: a Spotify selection, an Apple Music queue (amSel), or the recipe's local track.
    // amSel keeps the LOCAL track LOADED too (audioFile below) — it is the silent-fallback spine that
    // plays if Apple Music fails to start/continue (A2). Cues run on the wall-clock either way.
    const audioFile = spSel ? null : (EXP.song.audioFile || null);
    if (audioFile) Music.setSrc(audioFile);
    const R = 32, SV = 2 * R + 12, C = 2 * Math.PI * R;   // compact ring: countdown lives in a slim row, not a hero
    // real audio (YouTube or file) plays in real time — don't run it at demo speed
    if (state.prefs.speed !== 1 && state.prefs.speed !== 2) state.prefs.speed = 1; // only 1×/2× (clamp any old persisted value)
    // PHASE C: beat grid for musical seams
    const bpm = EXP.bpm || 100;
    const beatLen = 60 / bpm;
    const barLen = beatLen * 4;
    const alignToBar = (t) => Math.round(t / barLen) * barLen;

    h(`<section class="cook fade ${preview ? "is-preview" : ""}" id="cook">
      <div class="cook-main">
      ${tutorial ? `<div class="preview-pill">🎓 TUTORIAL</div>` : preview ? `<div class="preview-pill">👀 PREVIEW</div>` : ""}
      <div class="cook-top">
        <div class="now-playing">
          ${EXP.noMusic ? `<span class="eq eq-still"><i></i><i></i><i></i><i></i></span>` : `<span class="eq">${[0, 0, 0, 0].map(() => `<i style="animation-duration:${beatLen}s"></i>`).join("")}</span>`}
          <span><b>${EXP.noMusic ? EXP.recipe.emoji + " " + esc(EXP.recipe.title) : (amSel ? esc(amSel.labels[0]) + (amSel.labels.length > 1 ? " +" + (amSel.labels.length - 1) : "") : spSel ? esc(cookSelectionLabel()) : EXP.song.title)}</b><br><span class="muted">${EXP.noMusic ? "Guided · cook at your pace" : (amSel ? "via Apple Music" : spSel ? "🎧 Spotify" : EXP.song.artist + (bpm ? " · " + bpm + " BPM" : "") + (Music.has() ? "" : " · demo"))}</span></span>
        </div>
        <div class="cook-icons">
          ${amSel ? `<button class="icon-btn" id="tAmEdit" title="Change music">🎵</button>` : ""}
          <button class="icon-btn ${state.prefs.voice ? "" : "off"}" id="tVoice" title="Voice">🔊</button>
          <button class="icon-btn ${state.prefs.haptics ? "" : "off"}" id="tHaptic" title="Haptics">📳</button>
          ${tutorial ? "" : `<button class="icon-btn" id="tSpeed" title="${preview ? "Skip ahead" : "Demo speed"}">${preview ? "⏩" : state.prefs.speed + "×"}</button>`}
        </div>
      </div>

      <div class="ring-row">
        <div class="ring-wrap">
          <svg class="ring" width="${SV}" height="${SV}" viewBox="0 0 ${SV} ${SV}">
            <circle class="track" cx="${SV / 2}" cy="${SV / 2}" r="${R}" fill="none" stroke-width="6"/>
            <circle class="prog" id="ring" cx="${SV / 2}" cy="${SV / 2}" r="${R}" fill="none" stroke-width="6"
              stroke-dasharray="${C}" stroke-dashoffset="${C}"/>
          </svg>
          <div class="cd" id="cd">--</div>
        </div>
        <div class="next" id="nextLabel">NEXT STEP</div>
      </div>

      <div class="stepcard" id="stepcard">
        <div class="eyebrow" id="cookPhase" hidden style="margin:0 0 6px"></div>
        <div class="step-head">
          <h2 id="stepTitle">Press play and let's cook</h2>
          <span class="pill type prep" id="stepType">GET READY</span>
        </div>
        <div class="heat-badge" id="heatBadge" hidden></div>
        <div class="cue-img-stack" id="stepImage" hidden></div>
        <div class="cue-body-scroll"><p id="stepBody">Your first cue lands in a moment. Keep the phone where you can see it.</p></div>
        <div class="cue-warning" id="stepWarning" hidden></div>
        <div class="fade-tip" id="stepFadeTip" hidden></div>
        <div class="beginner-tag" id="beginnerTag" style="${state.isBeginner ? "" : "display:none"}">🌱 Beginner mode: extra guidance on</div>
        <div class="gate-actions" id="gateActions" hidden></div>
        <div class="mic-hint" id="micHint" hidden><span class="mic-dot">🎙️</span> <span class="mic-bars"><i></i><i></i><i></i><i></i><i></i></span> <span id="micHintText">say 'next'</span></div>
        <div class="mic-tip" id="micTip" hidden>🎙️ Tip: enable hands-free voice control in Settings <button class="mic-tip-x" id="micTipX">✕</button></div>
      </div>

      <div class="timeline">
        <div class="tl-track">
          <div class="tl-fill" id="tlFill"></div>
          ${cues.map((c) => `<div class="tl-mark ${c.type === "flip" ? "flip" : ""}" data-at="${c.at}" style="left:${(c.at / dur) * 100}%"></div>`).join("")}
        </div>
        <div class="tl-times"><span id="tElapsed">0:00</span><span>${fmt(dur)}</span></div>
      </div>

      <div class="cook-controls">
        ${transportRow({ skips: !preview })}
        <button class="btn quit-btn" id="quit">${tutorial ? "Skip tutorial" : preview ? "Exit preview" : "Quit"}</button>
      </div>
      </div>
    </section>`);

    // Bug F: land at the ABSOLUTE top on cook-screen entry (and again on the start tap, in begin()).
    // Both platforms. This fires ONLY on entry/start — cue changes never call it, so the viewport
    // never moves mid-cook. Reset window + the scroll roots (WKWebView sometimes scrolls documentElement).
    const scrollCookTop = () => {
      try { window.scrollTo(0, 0); } catch (e) { }
      try { document.documentElement.scrollTop = 0; document.body.scrollTop = 0; } catch (e) { }
      const a = document.getElementById("app"); if (a) a.scrollTop = 0;
    };
    scrollCookTop();
    requestAnimationFrame(scrollCookTop);   // after layout settles (video slot / async cards can shift height)

    // ---- engine ----
    const ring = $("#ring");
    let songPos = 0;             // simulated playback position (sec, in song-time)
    let parkedPaused = false;   // TRANSPORT LANDS PAUSED: a MANUAL jump hard-paused the music at the landed cue; Continue resumes
    const TRANSPORT_RESUME_MS = 600;   // smooth fade-in when Continue resumes from a manual-jump park
    // PHASE-2 MID-COOK START: songPos is the COOK CLOCK. The file plays offset by musicStartAt
    // so it starts from the top (songStartOffset in) when the clock crosses that mark. filePos =
    // clamp(clock - musicStartAt + songStartOffset, >=0) — never a negative seek. musicStartAt=0
    // (every existing recipe) makes filePos the identity map + musicStarted true from tick one, so
    // all music sites below behave EXACTLY as before; only a phase-2 recipe (smash) defers.
    const musicStartAt = (EXP.song && EXP.song.musicStartAt) || 0;
    const songStartOffset = (EXP.song && EXP.song.songStartOffset) || 0;
    const filePos = (t) => Math.max(0, t - musicStartAt + songStartOffset);
    let musicStarted = (musicStartAt === 0);
    let lastTs = performance.now();
    let paused = false;
    let waiting = false;         // PHASE A: parked on a checkpoint, waiting for the cook
    let nudgeTimer = null;
    let parkPos = 0;             // cook position parked during a checkpoint
    let curGate = null;          // the active checkpoint's gate (real doneness or default "Continue")
    let curVoiceText = null;     // the current cue's spoken line — voice "repeat" replays this clip
    let raf = null;
    let fired = new Set();
    let nextIdx = 0;
    let curCueIdx = -1;          // index of the currently-shown cue (drives manual skip nav)
    let fadeTipTimer = null;     // rotating butter-baste fade tips
    let slideshowTimer = null;   // cross-fading reference-image slideshow (motion steps)
    let tutorialSilent = false;  // tutorial fallback: music never started → the shipped silent flow

    const cookEl = $("#cook");

    // ---- telemetry for this session ----
    // songsPlayed = the ACTUAL track(s) heard during the cook (for the share card).
    // Today that's the recipe's default song; a premium playlist would append each
    // track as it plays. The Phase 1 ambient is filler and is intentionally excluded.
    const session = { mode: "music", recipe: EXP.recipe.title, emoji: EXP.recipe.emoji, song: EXP.song.title, artist: EXP.song.artist, songsPlayed: [{ title: EXP.song.title, artist: EXP.song.artist }], portion: EXP.portion ? (portionCount || EXP.portion.base) : undefined, equipment: { ...state.equipment }, heatSource: state.equipment.heat, pan: activePan(), pansOwned: [...(state.equipment.pans || [])], experience: state.experience, startedAt: Date.now(), steps: [], totalExtends: 0, completed: false };
    // COOK RESUME: snapshot started-at survives resumes (original cook start); saved
    // on every position change + pause + gate confirm. Never during preview/tutorial.
    const cookStartedAt = resume ? resume.startedAt : session.startedAt;
    function saveResume() { if (preview || tutorial) return; Resume.save({ ...flagshipSelection(), cueIdx: curCueIdx, confirmedGates: gatesBelow(cues, curCueIdx), paused, startedAt: cookStartedAt }); }
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
      // SOURCE-AWARE GATE (natural checkpoint; a manual-jump park set parkedPaused and is handled by exitWait):
      //   AM (ambient): the system duck HOLDS through the wait — the song keeps PLAYING (ducked), NO seek,
      //     NO pause, NO position bookkeeping, and the LOCAL element is never touched. Confirm releases it.
      //   LOCAL (beat-synced): today's muffle — song plays on under the checkpoint treatment; confirm rewinds.
      if (!parkedPaused) {
        if (amSel && amActive) VoicePlayer.holdDuck();
        else if (musicStarted) Music.enterCheckpoint();
      }
      $("#pause").disabled = true;              // pause is meaningless while held
      const g = $("#gateActions");
      g.hidden = false;
      g.innerHTML =
        `<button class="btn success" id="gDone">${isDoneness ? "✅ " : "▶ "}${curGate.doneLabel}</button>` +
        `<button class="btn secondary" id="gWait">⏳ Not yet</button>`;
      // COME-BACK-NOW: a checkpoint reached after a LONG unattended leg (the ring just counted down
      // from ≥ COMEBACK_SEC — e.g. ramen's egg poach) is a come-back-now, so it rings-until-dismissed
      // like a timer. Short cue-to-cue arrivals stay heads-ups (the cue haptic in showCue, unchanged).
      // Engine-level, no per-recipe authoring: keyed purely off the cue-gap on the cook clock.
      const prevAt = (curCueIdx > 0 && cues[curCueIdx - 1]) ? cues[curCueIdx - 1].at : 0;
      if (!preview && !tutorial && cue.at - prevAt >= COMEBACK_SEC) Alarm.start("Timer");
      $("#gDone").onclick = () => { Alarm.dismiss(); exitWait(cue); };
      $("#gWait").onclick = () => { Alarm.dismiss(); notReady(cue); };
      if (curGate.nudgeSec) scheduleNudge(cue, curGate.nudgeSec);
      // hands-free: the mic lives EXACTLY as long as this checkpoint. Voice
      // commands .click() the same buttons as fingers do — one path per action.
      // BUG B (native): the recognition stop around a voice command flips the
      // AVAudioSession (record→playback) and iOS suspends the WebView music element,
      // so the track goes silent until the next checkpoint. Re-assert playback once the
      // session settles. No-op on web (no mic transition) + when nothing's playing +
      // when deliberately paused/held — so tap-advance and pause stay untouched.
      VoiceCtrl.start({
        advance: () => { vibrate("tap"); const b = $("#gDone"); if (b) b.click(); nativeVoiceMusicKick(); },
        back: () => { const b = $("#skipBack"); if (b) b.click(); nativeVoiceMusicKick(); },
        repeat: () => { repeatCue(); nativeVoiceMusicKick(); },
      });
      voiceTipMaybe();
      if (tutorial) tutorialCheckpoint(cue);
    }

    // Replay the current checkpoint's pre-generated TTS clip. Playing it through
    // the normal speak() path re-triggers duckForTTS/restoreFromTTS exactly like
    // a real cue firing (the voice element's own onplay/onended drive the duck).
    function repeatCue() {
      if (!curVoiceText) return;
      const el = VoicePlayer.el;
      if (el && !el.paused && !el.ended) return;   // clip already playing — no overlap/restart
      vibrate("tap");
      speak(curVoiceText);
    }
    // BUG B — native only: after a VOICE command the mic session release flips the
    // AVAudioSession back to playback; re-assert the music element once it settles so
    // it never sits silent until the next checkpoint. Tier-1 fix (engine-side kick).
    function nativeVoiceMusicKick() {
      if (!isNativeVoice() || !Music.has() || !musicStarted) return;   // web / nothing playing → no-op
      if (amSel && amActive) return;   // B CONTRACT: AM cook → the source-aware VoiceCtrl._musicRecover owns recovery; NEVER kick the local element
      setTimeout(() => {
        if (paused || waiting) return;   // never resurrect a deliberately paused / checkpoint-held track
        try { Music.play(); } catch (e) { }   // play() also resumes a suspended AudioContext (_resumeCtx)
      }, 400);   // after the plugin's stop() hands the record session back to playback
    }

    // One-time re-discovery tip for the "Not now" crowd: 3rd checkpoint ever
    // (persisted count), supported browser, asked + declined, not just denied.
    function voiceTipMaybe() {
      const p = state.prefs;
      if (!VoiceCtrl.supported() || p.voiceControl || !p.voiceCtrlAsked || p.voiceCtrlTipShown || VoiceCtrl.deniedThisSession || preview) return;
      if (p.voiceCtrlCkpts < 3) { p.voiceCtrlCkpts++; saveProfile(); if (p.voiceCtrlCkpts < 3) return; }
      p.voiceCtrlTipShown = true; saveProfile(); trackEvent("mic_tip_shown");
      const tip = $("#micTip"); if (!tip) return;
      tip.hidden = false;
      const x = $("#micTipX"); if (x) x.onclick = (e) => { e.stopPropagation(); tip.hidden = true; };
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
      VoiceCtrl.stop("exit");   // mic off the instant the checkpoint advances (voice or tap)
      clearNudge();
      waiting = false;
      saveResume();   // COOK RESUME: gate confirmed
      if (curStep) { curStep.waitSec = Math.round((performance.now() - waitStart) / 1000); curStep.extends = waitExtends; }
      session.totalExtends += waitExtends;
      $("#stepcard").classList.remove("waiting");
      const g = $("#gateActions"); g.hidden = true; g.innerHTML = "";
      $("#pause").disabled = false;
      // Re-sync the song to the cook clock on continue: the song kept playing
      // (muffled) during the wait, so rewind it to songPos — UNDER the muffle,
      // where the position jump is inaudible — and lift the muffle only once
      // the seek has LANDED ('seeked' event), never concurrently. Spotify /
      // no-track cooks (has() false) just un-muffle; skips re-lock those cues.
      if (parkedPaused) {
        // TRANSPORT LANDS PAUSED — Continue resumes a MANUAL-jump park. The music was HARD-paused at
        // the landed cue; resume from that exact position (cook clock is truth) with a smooth fade-in.
        // Both platforms, pilot or local track. fadeIn seeks to songPos then brings gain up from ~0.
        parkedPaused = false;
        // LANDED-CONTINUE FIX: a Continue at a transport-landed checkpoint must run the SAME authoritative
        // confirm release the NATURAL gate confirm runs (branch below), BEFORE the source resume — else the
        // teardown's deferred setMode(playbackDucked) is never voided (no epoch bump here) and the source
        // resumes at the gate/duck level (40%). Source-aware releaseDuck (bumps coordEpoch → voids the
        // stale re-duck; deactivates the session) exactly as on a natural confirm; then the resume, unchanged.
        VoicePlayer.releaseDuck();
        if (amSel && amActive) {
          try { window.AppleMusic_.play(); } catch (e) { }   // AM (D): resume the song IN PLACE — no seek, no local touch
        } else if (Music.has() && musicStarted && !paused) {
          // DUCK-LEAK FIX (Part C): if a gate ducked/muffled the track before the jump, mode is still
          // "checkpoint" here — fadeIn's target would be the muffle/gate level (music resumes QUIET,
          // duck never released). Clear the checkpoint state FIRST (mode→normal, filter→neutral) so
          // fadeIn ramps to FULL. exitCheckpoint no-ops when already normal (jump from open play).
          Music.exitCheckpoint();
          Music.fadeIn(TRANSPORT_RESUME_MS, filePos(songPos));
        }
        if (spSel) { try { Spotify_.seek(songPos); } catch (e) { } try { Spotify_.play(); } catch (e) { } }
      } else if (amSel && amActive) {
        // AM NATURAL GATE (A): the duck was HELD through the wait — release it (deactivate + runway) so
        // the song swells back WHERE IT NATURALLY IS. NO rewind, NO seek, the local element is untouched.
        VoicePlayer.releaseDuck();
      } else if (musicStarted) {
        // LOCAL NATURAL GATE. LOCAL-PATH AUDIT (fix.3): exitCheckpoint restores only the JS/WebAudio gain —
        // NOBODY returned the native SESSION to full, so the teardown's setMode(playbackDucked) was the only
        // (stale, re-ducking) session write and, unlike AM, no releaseDuck moved the epoch to void it. Give
        // the local confirm the SAME authoritative release the AM path uses: releaseDuck (bumps the epoch →
        // voids the teardown re-duck AND deactivates the session), then the JS un-muffle + resume as before.
        VoicePlayer.releaseDuck();
        if (Music.has()) {
          Music.seek(filePos(songPos), () => { Music.exitCheckpoint({ smooth: true }); if (!paused) Music.play(); });   // hold at full muffle, then the shaped off-ramp (file offset by musicStartAt)
        } else {
          Music.exitCheckpoint();
          if (!paused) Music.play();
        }
      }
      lastTs = performance.now();
      if (tutorial && cues.indexOf(cue) >= 2) {   // the third cue's gate = the tutorial's finish line
        paused = true;                            // the Music.seek callback above fires ASYNC after stop() — its "if (!paused) Music.play()" must not resurrect the track on the outro
        stop(); Music.stop(); stopVoice();        // belt-and-braces: nothing plays past this line
        trackEvent("tutorial_completed"); tutorialActive = false;
        setTimeout(() => { Music.stop(); screens.tutorialOutro(); }, 900);   // and once more after the flash, in case a late seek/duck callback slipped through
        return;
      }
      if (curGate && curGate.doneCoach) speak(curGate.doneCoach);  // only doneness gates speak on continue
    }

    // ---- manual checkpoint navigation (skip buttons) ----
    // Jump the cook clock AND the audio to a target cue's moment, so the cue always
    // lands on the song section it was authored for (confirmed: the song follows the step).
    function jumpToCue(idx) {
      if (preview || idx < 0 || idx >= cues.length) return;
      VoiceCtrl.stop("jump");   // tearing down any active checkpoint (back/skip, voice or tap)
      clearNudge();
      waiting = false;                                   // tear down any active checkpoint wait
      $("#stepcard").classList.remove("waiting");
      const g = $("#gateActions"); g.hidden = true; g.innerHTML = "";
      $("#pause").disabled = false;
      songPos = cues[idx].at;                            // move the cook clock to this cue
      // TRANSPORT LANDS PAUSED (founder rule): a MANUAL back/forward jump PAUSES the music, lands parked;
      // Continue resumes. SOURCE-AWARE: AM (D) just pauses the song IN PLACE (no seek, no local touch);
      // LOCAL pauses + seeks the <audio> element to the target (unchanged).
      if (amSel && amActive) {
        // FIX 1: a manual jump departs a gate WITHOUT the gate-exit path, so a held duck (holdDuck) was
        // never released → AM stayed ducked until the next natural gate. Run the SAME session-release the
        // confirm path runs: release the duck-hold FIRST (voice window already closed above via
        // VoiceCtrl.stop("jump")), THEN pause AM for the parked landing. Continue resumes at full level.
        VoicePlayer.releaseDuck();
        if (VoiceCtrl._recoverTimer) { clearTimeout(VoiceCtrl._recoverTimer); VoiceCtrl._recoverTimer = null; }   // no stale +350ms recover after a jump
        ++audioEpoch;                             // void any in-flight recovery/retry
        parkedPaused = true;
        try { window.AppleMusic_.pause(); } catch (e) { }
      } else if (Music.has() && musicStarted) {
        parkedPaused = true;
        Music.pause();                            // pause BEFORE the seek (order matters)
        Music.seek(filePos(cues[idx].at));        // then land on the target (paused)
      }
      if (spSel) { try { Spotify_.pause(); } catch (e) { } try { Spotify_.seek(cues[idx].at); } catch (e) { } }
      fired.add(idx); applyCue(cues[idx], idx); nextIdx = idx + 1; lastTs = performance.now();
      const cue = cues[idx];                             // re-enter this cue's checkpoint (matches the loop's rule)
      if (cue.type !== "finish" && idx > 0 && (cue.gate || (state.prefs.checkpoints && !cue.noCheckpoint))) {
        enterWait(cue);   // landed on a checkpoint → stays PARKED (Continue resumes; see exitWait's parkedPaused branch)
      } else if (parkedPaused) {
        // Landed on a NON-checkpoint cue (cue 0 / noCheckpoint / checkpoints-off) — no gate to resume
        // from, so play on immediately from the landed position (transport-lands-paused holds only AT
        // checkpoints; a non-checkpoint landing rejoins the natural flow rather than freezing silent).
        parkedPaused = false;
        if (amSel && amActive) { try { window.AppleMusic_.play(); } catch (e) { } }   // AM: resume in place
        else if (Music.has() && musicStarted && !paused) { Music.exitCheckpoint(); Music.fadeIn(TRANSPORT_RESUME_MS, filePos(songPos)); }   // LOCAL: clear muffle + fade in (Part C)
      }
    }
    function skipNext() { if (tutorial && curCueIdx + 1 > 2) return; if (!preview && curCueIdx + 1 < cues.length) { vibrate("tap"); jumpToCue(curCueIdx + 1); } }
    function skipBack() { if (!preview && curCueIdx - 1 >= 0) { vibrate("tap"); jumpToCue(curCueIdx - 1); } }

    // ---- rotating, fading tips layered UNDER the main instruction (never replaces it) ----
    function stopFadeTips() {
      if (fadeTipTimer) { clearInterval(fadeTipTimer); fadeTipTimer = null; }
      const el = $("#stepFadeTip"); if (el) { el.classList.remove("show"); el.hidden = true; }
    }
    function startFadeTips(tips) {
      stopFadeTips();
      const el = $("#stepFadeTip"); if (!el || !tips.length) return;
      let i = 0;
      el.hidden = false; el.textContent = "💡 " + tips[0];
      requestAnimationFrame(() => el.classList.add("show"));
      fadeTipTimer = setInterval(() => {
        el.classList.remove("show");
        setTimeout(() => { i = (i + 1) % tips.length; el.textContent = "💡 " + tips[i]; el.classList.add("show"); }, 450);
      }, 4500);
    }

    // ---- reference image: a single file OR a cross-fading slideshow (motion steps) ----
    function stopSlideshow() { if (slideshowTimer) { clearInterval(slideshowTimer); slideshowTimer = null; } }
    // One <img> LAYER per frame, each fetched exactly once; the cross-fade just toggles
    // opacity between already-loaded layers — never re-fetches (works in dev no-cache AND prod).
    // Handles any number of frames (1 = single image, 2-3 = motion slideshow).
    function setStepImage(ref, fadeMs, title) {
      const slot = $("#stepImage"); if (!slot) return;
      stopSlideshow();
      slot.innerHTML = "";              // drop prior layers — no orphan <img> nodes linger
      slot.onclick = null; slot.hidden = true;
      if (!ref) return;                 // image-less step → stays hidden (graceful, no broken icon)
      const frames = Array.isArray(ref) ? ref : [ref];
      let current = 0, shown = false;
      const layers = frames.map((f, k) => {
        const img = document.createElement("img");
        img.className = "cue-img-layer"; img.alt = k === 0 ? title : "";
        // reveal the slot once the FIRST frame loads (404-safe: if it errors, the slot stays hidden)
        img.onload = () => { if (k === 0 && !shown) { shown = true; slot.hidden = false; requestAnimationFrame(() => img.classList.add("on")); } };
        img.src = f;                    // single fetch per layer, for the life of the cue
        slot.appendChild(img);
        return img;
      });
      slot.onclick = () => lightbox(frames[current], title);
      if (frames.length > 1) {
        const ms = fadeMs || 1800;
        slideshowTimer = setInterval(() => {
          const next = (current + 1) % frames.length;
          if (layers[next].naturalWidth === 0) return;   // skip a frame that failed to load
          layers[current].classList.remove("on");
          layers[next].classList.add("on");
          current = next;
          slot.onclick = () => lightbox(frames[current], title);
        }, ms);
      }
    }

    function applyCue(cue, idx) {
      curCueIdx = idx;
      saveResume();   // COOK RESUME: single choke point for every advance (loop-fire, skip, back)
      // Playing their own Spotify track? Use the cue's generic copy (no Free Bird /
      // "the solo" references); otherwise the song-specific lines for the demo track.
      const src = (spSel && cue.custom) ? { ...cue, ...cue.custom } : cue;
      const body = injectAmounts((state.isBeginner && src.beginner) ? src.beginner : src.body, isEggs() ? eggsIngredients() : mIngredients(), portionScale());
      $("#stepType").className = "pill type " + cue.type;
      $("#stepType").textContent = cue.type.toUpperCase();
      $("#stepTitle").textContent = src.title;
      // phase-segment header (forward-filled onto cue._phase) — persists across the segment
      const cp = $("#cookPhase"); if (cp) { const ph = cue._phase || null; if (ph) { cp.hidden = false; cp.textContent = ph; } else { cp.hidden = true; cp.textContent = ""; } }
      $("#stepBody").textContent = displayUnits(body);
      // fade-mask only when the text actually overflows its capped zone (the scroll hint)
      requestAnimationFrame(() => { const bs = document.querySelector(".cue-body-scroll"); if (bs) { bs.scrollTop = 0; bs.classList.toggle("clipped", bs.scrollHeight > bs.clientHeight + 1); } });
      // heat level for this cue → concrete dial setting tuned to gas/electric
      const hb = $("#heatBadge"); const hg = (cue.heat && !preview) ? heatGuidance(cue.heat) : null; // preview hides heat badges
      if (hb) {
        if (hg) {
          hb.hidden = false; hb.className = "heat-badge " + cue.heat;
          hb.innerHTML = `<div class="hb-line"><b>${hg.flames} ${hg.label}</b><span class="hb-dial">· ${hg.source}: ${esc(hg.dial)}</span><span class="hb-more">ⓘ</span></div><span class="hb-note">${esc(hg.note)}</span>`;
          hb.onclick = () => hb.classList.toggle("open");   // the long stove note expands on tap — costs one line by default
        }
        else { hb.hidden = true; hb.innerHTML = ""; }
      }
      // optional reference image(s): a single stored file (eggs pilot) OR an array that
      // cross-fades as a slideshow for motion steps. Missing/404 stays hidden (text-only).
      setStepImage(cue.referenceImage, cue.referenceImageFadeMs, src.title);
      // prominent quality/safety warning (e.g. don't-cut-early on the rest step) — stands out below the instruction
      const sw = $("#stepWarning"); const warn = src.warning || cue.warning;
      if (sw) { if (warn) { sw.hidden = false; sw.textContent = "⚠️ " + warn; } else { sw.hidden = true; sw.textContent = ""; } }
      // fading butter-baste tips — rotating reminder layered UNDER the instruction, never replacing it
      if (cue.fadeTips && cue.fadeTips.length) startFadeTips(cue.fadeTips); else stopFadeTips();
      const sc = $("#stepcard");
      sc.classList.remove("flash"); void sc.offsetWidth; sc.classList.add("flash");
      vibrate(cue.haptic);
      curVoiceText = src.voice || null;   // "repeat" replays this checkpoint's clip
      speak(src.voice);   // heat is shown on the (persistent) badge, not spoken — pre-gen files are per-line
      const mark = app.querySelector(`.tl-mark[data-at="${cue.at}"]`);
      if (mark) mark.classList.add("done");
      if (cue.haptic && !navigator.vibrate) toast("📳 buzz");
      session.steps.push({ title: src.title, type: cue.type, atSec: cue.at, firedSec: Math.round(songPos), waitSec: 0, extends: 0, heat: cue.heat || null, heatHint: cue.heat ? heatHintText(cue.heat) : null });
      curStep = session.steps[session.steps.length - 1];
      // finish: auto-end, UNLESS the finish cue carries reference image(s) — then dwell on the
      // "you made this" shot with a Done button so it's actually seen (the slideshow keeps cross-fading).
      if (cue.type === "finish" && !preview) {
        // GLOBAL: the cook is DONE at this cue — the music stops IMMEDIATELY (hard
        // cut, every recipe; replaces the old per-recipe ~1s stopMusic fade). The
        // finish voice line plays on its own element, fully audible after the cut.
        Music.stop(); VoiceDuck.cancel();
        if (cue.referenceImage) {
          waiting = true; $("#stepcard").classList.add("waiting"); $("#pause").disabled = true;
          const g = $("#gateActions"); g.hidden = false; g.innerHTML = `<button class="btn success" id="gDone">✅ Done — rate it</button>`;
          $("#gDone").onclick = () => { stopSlideshow(); finish(); };
        } else finish();
      }
      // a non-finish "admire it" beat (noCheckpoint, song still playing) can offer an early
      // "Done — rate it" so the user isn't forced to wait out the song before rating
      if (cue.finishButton && !preview && cue.type !== "finish") {
        // TERMINAL when it's the last cue on the ladder (e.g. pancakes' repeat cue): PARK the clock
        // here — no phantom timer running to a distant finish — and make this the honest end. A
        // non-terminal finishButton (pasta's "admire it", with a real finish cue still ahead) keeps
        // riding the clock as before.
        const terminal = idx === cues.length - 1;
        if (terminal) { waiting = true; $("#stepcard").classList.add("waiting"); $("#pause").disabled = true; }
        const g = $("#gateActions");
        if (g) {
          g.hidden = false;
          g.innerHTML = `<button class="btn success" id="gDoneEarly">${esc(cue.finishLabel || "✅ Done — rate it")}</button>`;
          const b = $("#gDoneEarly");
          if (b) b.onclick = () => {
            stopSlideshow();
            // Play the payoff line (money-punch) and keep it alive INTO the rating screen.
            if (cue.finishVoice) { speak(cue.finishVoice); finish(true); } else finish();
          };
        }
      }
    }

    // ---- TUTORIAL layer (sandbox only): coachmarks + the voice lesson ----
    // Coachmarks: one at a time, anchored, tap-anywhere; the cook clock HOLDS while
    // one is open (paused flag) and resumes on dismiss — except at checkpoints,
    // where the clock is already parked.
    const coachShown = {};
    function coach(sel, text, then) {
      const t = $(sel);
      if (!t || t.hidden || t.offsetParent === null) { if (then) then(); return; }
      const wasPaused = paused; if (!waiting) paused = true;
      t.classList.add("coach-hi");
      const ov = document.createElement("div"); ov.className = "coach-ov";
      const box = document.createElement("div"); box.className = "coach-box";
      box.innerHTML = `<p>${text}</p><small>tap anywhere to continue</small>`;
      document.body.appendChild(ov); document.body.appendChild(box);
      const r = t.getBoundingClientRect();
      const below = r.bottom < window.innerHeight * 0.55;
      box.style.left = Math.max(12, Math.min(window.innerWidth - 340, r.left)) + "px";
      if (below) box.style.top = (r.bottom + 10) + "px"; else box.style.bottom = (window.innerHeight - r.top + 10) + "px";
      ov.onclick = () => {
        ov.remove(); box.remove(); t.classList.remove("coach-hi");
        if (!waiting) paused = wasPaused;
        if (then) then();
      };
    }
    function coachOnce(key, sel, text, then) { if (coachShown[key]) { if (then) then(); return; } coachShown[key] = true; coach(sel, text, then); }
    function tutorialKickoff() {
      setTimeout(() => {
        coachOnce("card", "#stepcard", "This card is the whole cook: one instruction at a time. Glance, do the thing, glance back.", () =>
          coachOnce("ring", ".ring-row", "The ring counts down to the next cue — in a real cook the music carries this timing, so you never watch a clock.", () =>
            coachOnce("heat", "#heatBadge", "The heat badge always shows where your dial should be right now.")));
      }, 1400);
    }
    function tutorialCheckpoint(cue) {
      const idx = cues.indexOf(cue);
      if (idx === 1) {
        coachOnce("adv", "#gDone", "Checkpoints wait for YOU — nothing moves on until you confirm, and “⏳ Not yet” is always a safe answer.", () =>
          coachOnce("nav", "#skipBack", "Missed something? ⏮ replays the last step — or say “repeat” to hear it again."));
      } else if (idx >= 2) {
        const g = $("#gateActions");
        if (g && !$("#tutMuffle")) g.insertAdjacentHTML("beforeend", `<p class="tut-muffle" id="tutMuffle">${Music.has() ? "🎵 Hear that? Your music never stops — it just ducks under." : "🎵 In a real cook your music muffles here — it never stops."}</p>`);
        const real = VoiceCtrl.enabled();
        coachOnce("mic", "#gateActions",
          real ? "Hands messy? This checkpoint listens — the bars move when it hears you. Your browser may ask to use the mic first."
               : "With voice control on, this checkpoint would listen for you — the bars move when it hears you.",
          () => tutorialVoiceLesson(real));
      }
    }
    function tutorialVoiceLesson(real) {
      trackEvent(real ? "tutorial_voice_real" : "tutorial_voice_simulated");
      const banner = document.createElement("div"); banner.className = "tut-speak"; document.body.appendChild(banner);
      const done = () => banner.remove();
      if (real) {
        // GESTURE ANCHOR (first-run fix): this runs inside the coachmark-dismiss TAP.
        // The mic is TTS-gated (never opens while a clip speaks), so ARM — banner,
        // kick, and the retry clocks — only once the clip has finished; the trace
        // showed "Speak now" racing the gate clip by several seconds otherwise.
        const BARS = ` <span class="mic-bars"><i></i><i></i><i></i><i></i><i></i></span>`;
        banner.innerHTML = `🎙️ Get ready…${BARS}`;
        const iv = setInterval(() => {
          if (!waiting) { clearInterval(iv); banner.textContent = "✓ “next” — nice!"; banner.classList.add("ok"); setTimeout(done, 1000); return; }
          if (VoiceCtrl.deniedThisSession) { clearInterval(iv); done(); coach("#gDone", "Mic's not available — just tap. Voice is optional, always."); }
        }, 400);
        const arm = () => {
          VoiceCtrl.kick();   // (re)open inside the tap when possible; the liveness watchdog covers the permission-grant race either way
          banner.innerHTML = `🎙️ Speak now — say “next”${BARS}`;
          setTimeout(() => { if (waiting && !VoiceCtrl.deniedThisSession) banner.innerHTML = `🎙️ One more try — say “next”${BARS}`; }, 8000);
          setTimeout(() => { if (waiting) { clearInterval(iv); done(); coach("#gDone", "Or just tap — voice is optional, always."); } }, 16000);
        };
        if (!VoicePlayer.speaking) arm();
        else { const w = setInterval(() => { if (!VoicePlayer.speaking) { clearInterval(w); arm(); } if (!waiting) clearInterval(w); }, 250); }
      } else {
        // SIMULATED demo: SpeechRecognition is never constructed on this branch
        // (VoiceCtrl.start no-ops when the pref is off — asserted in tests).
        banner.innerHTML = `🎙️ With voice control you'd say <b>“next”</b>… <span class="mic-bars demo"><i></i><i></i><i></i><i></i><i></i></span>`;
        setTimeout(() => { banner.innerHTML = `“next” <b style="color:var(--success)">✓</b>`; banner.classList.add("ok"); }, 1600);
        setTimeout(() => { done(); toast("Enable voice control in Settings to do this for real 🎙️"); const b = $("#gDone"); if (b) b.click(); }, 2900);
      }
    }

    function loop(now) {
      const dt = (now - lastTs) / 1000; lastTs = now;
      // The cook TIMER pauses at checkpoints; the song plays continuously underneath (never rewound).
      // songPos is the cook clock (wall-clock), independent of the audio's actual position — Apple
      // Music / Spotify / the local track all ride it ambiently (RATIFIED: no slaving to playbackTime).
      if (!waiting && !paused) { songPos += dt * (tutorial ? 1 : state.prefs.speed); }
      songPos = Math.min(songPos, dur);
      // PHASE-2: the clock crossed musicStartAt (on real forward motion, never a frozen linger) —
      // start the track clean from the top with a short fade-in (no pop). Only fires for a phase-2
      // recipe (musicStarted was false); musicStartAt=0 recipes started at cook begin.
      // B CONTRACT: on an ACTIVE Apple Music cook the loop may NEVER start the local element (the founder's
      // gate-hole: this phase-2 crossing fired local on smash-burgers = Hotel California at :190, over/instead
      // of AM, in any state incl. repair). AM stays the sole source; local starts ONLY via userChoseLocal.
      if (!musicStarted && !waiting && !paused && songPos >= musicStartAt && Music.loaded && !(amSel && amActive)) {
        musicStarted = true;
        Music.rate(tutorial ? 1 : state.prefs.speed);
        Music.fadeIn(500, filePos(songPos));
      }

      // fire cues whose time has arrived. Every cue is a checkpoint EXCEPT the
      // very first step (auto-starts) and the finish cue.
      while (!waiting && nextIdx < cues.length && songPos >= cues[nextIdx].at) {
        const cue = cues[nextIdx];
        if (!fired.has(nextIdx)) { fired.add(nextIdx); applyCue(cue, nextIdx); }
        nextIdx++;
        // doneness gates always wait; generic checkpoints only when enabled; never
        // the first step, the finish, or a cue flagged noCheckpoint (e.g. the final
        // "admire it" beat, which lets the song play out instead of pausing).
        if (cue.type !== "finish" && nextIdx > 1 && (cue.gate || ((tutorial || state.prefs.checkpoints) && !cue.noCheckpoint))) { enterWait(cue); break; }
      }

      // countdown ring + label (the screen may already be gone on the last frame after finish)
      if (!$("#nextLabel")) return;
      if (waiting) {
        $("#nextLabel").textContent = "READY WHEN YOU ARE";
        const cd = $("#cd"); cd.textContent = "⏳"; cd.classList.remove("go");
        ring.style.strokeDashoffset = 0;
      } else {
        // Bug D: the next cue is nextIdx (the engine's live pointer), NOT cues[fired.size]. Those
        // are equal ONLY when fired is contiguous (forward-only cooking); after a back-jump `fired`
        // still holds the cues ahead, so cues[fired.size] pointed PAST the landed cue and the ring
        // counted down to a far cue (two+ segments combined). nextIdx is reset correctly by both
        // jumpToCue (idx+1) and the loop, so it always names the immediate next cue.
        const upcoming = cues[nextIdx] || null;
        if (upcoming) {
          const remain = Math.max(0, upcoming.at - songPos);
          $("#nextLabel").textContent = "NEXT: " + upcoming.title.replace(/[🥩🎸🔥🌡️]/g, "").trim().toUpperCase();
          const cd = $("#cd");
          cd.textContent = remain > 1 ? Math.ceil(remain) : "GO";
          cd.classList.toggle("go", remain <= 1);
          // ring shows progress toward next cue (segment-based)
          const prevAt = nextIdx > 0 ? cues[nextIdx - 1].at : 0;
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

    function stop(keepVoice) {
      cookRunning = false;
      // B (QUIT-LOOP): kill the voice-recovery machinery FIRST — null the cook's recover hook so
      // VoiceCtrl.stop()'s teardown can't resurrect the music, and cancel its 350ms retry. Then a stopped
      // cook makes NO sound 500ms later (Music.stop clears _wantPlay + bumps the epoch that voids any
      // pending seek/fade callback; AppleMusic_.stop halts the queue; amActive false blocks late AM plays).
      VoiceCtrl._musicRecover = null; VoiceCtrl._listening = false;
      if (VoiceCtrl._recoverTimer) { clearTimeout(VoiceCtrl._recoverTimer); VoiceCtrl._recoverTimer = null; }
      amRepairing = false; if (amRepairTimer) { clearTimeout(amRepairTimer); amRepairTimer = null; }   // B: tear down any in-flight repair + its overlays
      ++audioEpoch;   // FIX 2: void any in-flight resume/recovery retry so a stopped cook can't be resurrected
      bumpCoordEpoch("cook-stop");   // cook end/quit is authoritative — void any straggler teardown setMode
      try { hideAmRepairUI(); } catch (e) { }
      if (raf) cancelAnimationFrame(raf); raf = null;
      VoiceCtrl.stop();
      clearNudge(); stopFadeTips(); stopSlideshow();
      if (!keepVoice) stopVoice();
      Music.stop();
      if (spSel) { try { Spotify_.stop(); } catch (e) { } }
      if (amSel) { amActive = false; try { window.AppleMusic_.stop(); } catch (e) { } }
      if (navigator.vibrate) navigator.vibrate(0);
    }

    function finish(keepVoice) {
      stop(keepVoice); state.streak += 1;
      Resume.clear();   // a completed cook is not resumable → DELETE the snapshot
      session.completed = true; session.durationSec = Math.round((Date.now() - session.startedAt) / 1000);
      // §5 golden metric: a requester actually cooked the recipe they asked for
      if ((state.prefs.reqWatch || []).includes(session.recipe)) {
        trackEvent("request_to_cook");
        state.prefs.reqWatch = state.prefs.reqWatch.filter((t) => t !== session.recipe); saveProfile();
      }
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
    const greeting = EXP.noMusic
      ? (state.isBeginner ? "Alright — I've got you. Let's cook." : "Let's cook.")
      : spSel
        ? (state.isBeginner ? "Alright — I've got you. Your music's rolling, let's cook." : "Let's cook. Your music's rolling.")
        : (state.isBeginner ? `Alright — I've got you. ${EXP.song.title} is rolling, let's cook.` : `Let's cook. ${EXP.song.title} is rolling.`);

    // COOK RESUME: jump the cook clock to the START of the saved cue and start the
    // loop (no countdown, no music). Seeding songPos + nextIdx + fired makes the
    // loop fire that cue — and re-enter its checkpoint — on the first tick.
    function resumeToCue() {
      const target = Math.min(Math.max(0, resume.cueIdx | 0), cues.length - 1);
      songPos = cues[target].at;         // clock at the step's start → fresh ring, timer resets
      nextIdx = target; fired = new Set();
      for (let i = 0; i < target; i++) fired.add(i);
      curCueIdx = Math.max(0, target - 1);
      paused = !!resume.paused;
      cookEl.classList.toggle("paused", paused);
      const pb = $("#pause"); if (pb) pb.textContent = paused ? "▶ Resume" : "⏸ Pause";
      speak(state.isBeginner ? "Welcome back — let's pick up where you left off." : "Welcome back. Picking up where you left off.");
      lastTs = performance.now();
      raf = requestAnimationFrame(loop);
      // Honest banner: elapsed-since-left + raw-protein safety line (if an unconfirmed
      // safetyCritical gate sits at/ahead of here). Derived — no per-recipe authoring.
      const protein = resumeSafetyProtein(cues, target, gatesBelow(cues, target), [EXP.recipe.title, EXP.recipe.category, mTechnique()]);
      mountResumeBanner(Date.now() - (Date.parse(resume.updatedAt) || cookStartedAt), protein);
    }

    function begin() {
      if (started) return;
      started = true; paused = false;
      scrollCookTop();   // Bug F: the start tap also lands at the absolute top (both platforms)
      // COOK RESUME: skip the 3·2·1 + music start (resume SILENT). Seed the cook
      // clock at the START of the saved cue; the loop fires it + re-enters its
      // checkpoint on tick one, so the position is exact, the ring is fresh, and
      // any unconfirmed gate is re-checked. Music_ready recipes stay silent.
      if (resume) { resumeToCue(); return; }
      if (tutorial) {
        const startLoop = () => { lastTs = performance.now(); raf = requestAnimationFrame(loop); tutorialKickoff(); };
        if (tutorialSilent || !Music.loaded) { startLoop(); return; }   // the shipped silent flow = the fallback, not the design
        runCountdown(() => {
          if (Music.loaded) { Music.rate(1); Music.seek(0); Music.play(); }
          startLoop();
        });
        return;
      }
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
        if (amSel) { startAmOrFallback(); }   // AM PILOT: ambient under the cook (wall-clock, no slaving); ANY failure → local track (A2)
        else if (spSel) { Spotify_.playSelection(spSel).catch((e) => toast("Couldn't start Spotify (" + (e.message || "error") + ") — cooking without music.")); }
        else if (Music.loaded && musicStartAt === 0) { Music.rate(state.prefs.speed); Music.seek(0); Music.play(); }   // phase-2 (musicStartAt>0): stay silent; the loop's crossing trigger starts it
        // Part B — SPINE diagnosis (native only): the local track was just told to play. Log the pipeline
        // now and again after the greeting's duck cycle, so the Eye shows whether it starts (paused:false,
        // ct advancing, ctx:running) and whether it SURVIVES the first ChoppdAudio activate/deactivate.
        if (isNativeVoice() && Music.loaded) { try { console.log("SPINE start " + JSON.stringify(Music.audioState())); setTimeout(() => { try { console.log("SPINE +800 " + JSON.stringify(Music.audioState())); } catch (e) { } }, 800); } catch (e) { } }
        speak(greeting);
        lastTs = performance.now();
        raf = requestAnimationFrame(loop);
      });
    }

    // AM start: warm the connection (C1 — the first cook is never the connection's guinea pig), queue,
    // play. ANY failure now routes to amRepair (self-heal → repair popup/panel), NEVER to an automatic
    // local switch (founder's rule). Pre-start resolution failure gets the SAME repair flow — the cook may
    // start silent and the user picks in the panel.
    function startAmOrFallback() {
      if (!amActive) return;
      try { window.AppleMusic_.warmup(); } catch (e) { }   // C1: idempotent, non-blocking
      let settled = false, guard;
      const finish = (ok, detail) => { if (settled) return; settled = true; clearTimeout(guard); if (ok) { amActive = true; AppleMusic_.noteAttempt(true, "ok"); } else amRepair(detail); };   // canonical flag CONFIRMED on play; failure → repair (not local)
      guard = setTimeout(() => { if (!(window.AppleMusic_.time() > 0.2)) finish(false, "timeout"); }, 12000);
      try {
        window.AppleMusic_.queue(amIds, { shuffle: !!state.amShuffle }).then((r) => {
          if (settled) return null;
          // C3 EMPTY-QUEUE: 0 songs resolved (ok:false / count 0) routes to repair, NEVER to a play call.
          if (r && (r.ok === false || r.count === 0)) { finish(false, r.error || "queue-failed"); return null; }
          return window.AppleMusic_.play();
        }).then((r) => {
          if (settled || r == null) return;
          if (r && r.ok === false) { finish(false, r.error || "play-failed"); return; }
          finish(true);
        }).catch((e) => finish(false, "exception:" + (e && e.message)));
      } catch (e) { finish(false, "throw:" + (e && e.message)); }
    }

    // ═══ B — the AM repair flow (mid-cook, the local file NEVER auto-takes-over) ═══
    // amRepair = SELF-HEAL FIRST (silent): the founder's recovery-play-failure ladder — retry play at
    // +500ms, retry at +1.5s, re-queue the current picks — before ANYTHING is shown. Most hiccups heal
    // here (nothing surfaces). If not healed → a non-blocking popup on the cook screen. amActive HOLDS
    // throughout (music silent rather than switching sources uninvited).
    function amRepair(reason) {
      if (!amSel || !amActive) return;             // only a live AM cook
      if (amRepairing) return;                     // one ladder at a time (a burst of state-errors = one repair)
      if (VoiceCtrl.inGrace()) return;             // A: inside listen-exit grace — interruption aftermath, not a failure
      amRepairing = true;
      try { console.log("AM-REPAIR start (" + reason + ")"); } catch (e) { }
      const mark = window.AppleMusic_.time();
      const healedYet = () => window.AppleMusic_.time() > mark + 0.3;   // clock advancing = playing again
      try { window.AppleMusic_.play(); } catch (e) { }                 // attempt 0
      amRepairTimer = setTimeout(() => {
        if (!amRepairing) return;
        if (healedYet()) return amHealed();
        try { window.AppleMusic_.play(); } catch (e) { }               // +500ms retry play
        amRepairTimer = setTimeout(() => {
          if (!amRepairing) return;
          if (healedYet()) return amHealed();                          // +1.5s re-queue the current picks + play (re-establish the connection)
          try { window.AppleMusic_.warmup(); window.AppleMusic_.queue(amIds, { shuffle: !!state.amShuffle }).then(() => window.AppleMusic_.play()).catch(() => { }); } catch (e) { }
          amRepairTimer = setTimeout(() => {
            if (!amRepairing) return;
            if (healedYet()) return amHealed();
            amEscalate(reason);                                        // still dead → surface the popup
          }, 1700);
        }, 1500);
      }, 500);
    }
    function amHealed() { amRepairing = false; clearTimeout(amRepairTimer); try { console.log("AM-REPAIR healed"); } catch (e) { } AppleMusic_.noteAttempt(true, "repaired"); hideAmRepairUI(); }
    function amEscalate(reason) { amRepairing = false; try { console.log("AM-REPAIR escalate (" + reason + ")"); } catch (e) { } AppleMusic_.noteAttempt(false, "unhealed:" + reason); showAmRepairPopup(); }

    // The ONE place local takes over an AM cook — a USER choice from the repair panel, never automatic.
    function userChoseLocal(reason) {
      amActive = false;
      try { console.log("AM → local (USER choice: " + reason + ")"); } catch (e) { }
      AppleMusic_.noteAttempt(false, "user-local:" + reason);
      try { window.AppleMusic_.stop(); } catch (e) { }
      try { toast("Playing Choppd's pick"); } catch (e) { }   // DRAFT-PENDING-VOICE-REVIEW
      const lf = EXP.song && EXP.song.audioFile;
      if (!lf) return;
      if (!Music.loaded) Music.setSrc(lf);
      Music.rate(state.prefs.speed);
      musicStarted = true;   // B: userChoseLocal now OWNS the local element — the phase-2 crossing must not also fire
      if (paused || waiting) return;
      Music.seek(filePos(songPos), () => { if (!paused && !waiting) Music.play(); });
    }

    // ══ repair / edit UI — ONE mode-driven component (fixed overlays; removed on cook stop) ══════════
    // Clean, App-Store-grade: classes in styles.css (.amr-*), orange owns actions, 390px budget, bottom-
    // anchored sheet (no layout jump). Strings DRAFT-PENDING-VOICE-REVIEW.
    function hideAmRepairUI() { ["amRepairPopup", "amRepairChip", "amRepairPanel"].forEach((id) => { const el = document.getElementById(id); if (el) el.remove(); }); }
    function amNowPlayingLabel() { const s = (typeof currentAmSel === "function" && currentAmSel()) || (amSel && { labels: amSel.labels }); const L = (s && s.labels) || []; return L.length ? esc(L[0]) + (L.length > 1 ? " +" + (L.length - 1) + " more" : "") : "your music"; }

    // Step 2 of B: a NON-BLOCKING popup. Cook keeps running; music stays silent (never switches source
    // uninvited). Dismiss = a persistent chip.
    function showAmRepairPopup() {
      hideAmRepairUI();
      const el = document.createElement("div"); el.id = "amRepairPopup"; el.className = "amr-pop";
      el.innerHTML = '<div class="amr-head"><div class="amr-ico">🎵</div>' +
        '<div class="amr-txt"><b>Apple Music stopped</b><span>Want me to fix it? Your cook keeps going.</span></div></div>' +
        '<div class="amr-btns"><button class="btn secondary" id="amrpDismiss">Not now</button>' +
        '<button class="btn" id="amrpFix">Fix it</button></div>';
      app.appendChild(el);
      $("#amrpFix").onclick = () => { hideAmRepairUI(); showAmRepairPanel("repair"); };
      $("#amrpDismiss").onclick = () => { hideAmRepairUI(); showAmRepairChip(); };
    }
    function showAmRepairChip() {
      hideAmRepairUI();
      const el = document.createElement("div"); el.id = "amRepairChip"; el.className = "amr-chip";
      el.textContent = "Music paused · Fix";
      app.appendChild(el);
      el.onclick = () => { hideAmRepairUI(); showAmRepairPanel("repair"); };
    }
    // Step 3 of B + D (the 🎵 icon): the sheet — "repair" (self-heal live, then choices) or "edit" (change
    // the queue anytime). Same component; mode drives the title + whether the self-heal sequence runs.
    function showAmRepairPanel(mode) {
      mode = mode || "repair";
      hideAmRepairUI();
      const el = document.createElement("div"); el.id = "amRepairPanel"; el.className = "amr-scrim";
      el.innerHTML = '<div class="amr-sheet" role="dialog" aria-modal="true">' +
        '<div class="amr-sheet-head"><b>' + (mode === "edit" ? "Change music" : "Fix Apple Music") + '</b><button class="amr-x" id="amrPanelClose" aria-label="Close">✕</button></div>' +
        '<div class="amr-now">Now: <b>' + amNowPlayingLabel() + '</b></div>' +
        '<div class="amr-status" id="amrStatus" style="display:none"></div>' +
        '<div id="amrPicker" style="display:none"></div>' +
        '<div class="amr-actions" id="amrActions">' +
        (mode === "edit" ? "" : '<button class="btn" id="amrRetry">Try again</button>') +
        '<button class="btn secondary" id="amrNewQueue">Pick different music</button>' +
        '<button class="btn secondary" id="amrUseLocal">Use Choppd’s pick instead</button>' +
        '</div></div>';
      app.appendChild(el);
      const status = $("#amrStatus"), actions = $("#amrActions");
      const setStatus = (h, cls) => { if (!status) return; status.style.display = "flex"; status.className = "amr-status" + (cls ? " " + cls : ""); status.innerHTML = h; };
      const showActions = (v) => { if (actions) actions.style.display = v ? "flex" : "none"; };
      el.onclick = (e) => { if (e.target === el) { hideAmRepairUI(); if (mode !== "edit") showAmRepairChip(); } };   // tap the scrim to dismiss
      $("#amrPanelClose").onclick = () => { hideAmRepairUI(); if (mode !== "edit") showAmRepairChip(); };
      $("#amrUseLocal").onclick = () => { hideAmRepairUI(); amRepairing = false; clearTimeout(amRepairTimer); userChoseLocal(mode); };
      $("#amrNewQueue").onclick = () => {
        const p = $("#amrPicker"); if (!p) return;
        showActions(false); p.style.display = "block";
        setStatus('<span>Pick a song or playlist, then tap ' + (mode === "edit" ? "Play this" : "Try again") + '.</span>');
        mountAmPicker("#amrPicker", () => { });   // reuse the picker (search + your playlists); writes state.amQueue
        if (mode === "edit" && !$("#amrRetry")) { const b = document.createElement("button"); b.className = "btn"; b.id = "amrRetry"; b.textContent = "Play this"; actions.insertBefore(b, actions.firstChild); }
        wireRetry(); showActions(true);
      };
      function wireRetry() { const r = $("#amrRetry"); if (!r) return; r.onclick = () => { const fresh = (typeof currentAmSel === "function" && currentAmSel()); if (fresh && fresh.ids && fresh.ids.length) amIds = fresh.ids.slice(); const p = $("#amrPicker"); if (p) p.style.display = "none"; showActions(false); runPanelRepair(); }; }
      wireRetry();
      if (mode === "repair") { showActions(false); runPanelRepair(); } else { showActions(true); }   // edit → straight to choices

      function runPanelRepair() {
        amActive = true;   // re-arm the AM source (the user is fixing/playing, not switching to local)
        setStatus('<span class="amr-spin"></span><span>Reconnecting to Apple Music…</span>');
        setTimeout(async () => {
          let authed = true;
          try { const a = await window.AppleMusic_.authorize(); authed = !(a && a.authorized === false); } catch (e) { authed = false; }
          setStatus('<span class="amr-spin"></span><span>' + (authed ? "Connected — re-queuing your music…" : "Reconnecting…") + '</span>');
          try { await window.AppleMusic_.warmup(); } catch (e) { }
          let ok = false;
          try { const q = await window.AppleMusic_.queue(amIds, { shuffle: !!state.amShuffle }); if (!(q && (q.ok === false || q.count === 0))) { const pl = await window.AppleMusic_.play(); ok = !(pl && pl.ok === false); } } catch (e) { ok = false; }
          setTimeout(() => {
            if (ok && window.AppleMusic_.time() > 0.1) { setStatus('<span>✅ Playing again</span>', "ok"); AppleMusic_.noteAttempt(true, "panel-repair"); showActions(false); setTimeout(hideAmRepairUI, 1200); }
            else { setStatus('<span>Couldn’t get Apple Music going. Your cook keeps running — pick one:</span>'); showActions(true); }
          }, 900);
        }, 500);
      }
    }
    // Dev-only screenshot/sim seam (never in a real run): drive the overlay states without a live failure.
    if (window.AM_FORCE_REPAIR) window.__amDemo = { popup: showAmRepairPopup, chip: showAmRepairChip, panel: (m) => showAmRepairPanel(m), hide: hideAmRepairUI, repair: (r) => amRepair(r || "demo") };

    // A2 mid-cook safety: if Apple Music errors AFTER it started, run the repair flow (never auto-local).
    // A GRACE: a listen (mic) window interrupts AM via iOS — that is NOT an AM failure. inGrace() covers
    // the listen window AND ~3s after it closes (the founder's error landed the beat AFTER the window).
    // amActive stays true so the listen-exit RESUMES AM.
    if (amSel) { try { window.AppleMusic_.onState((s) => { if (s && s.status === "error" && amActive && !VoiceCtrl.inGrace()) amRepair("state-error"); }); } catch (e) { } }
    // A.1/A.2 RECOVERY: after each voice listen window closes, restore the source the record session
    // interrupted. For AM the recovery play() itself can fail (MPMusicPlayerControllerError Code=1) — so a
    // failed recovery RETRIES (verify at +600ms) and, only if still not sounding, escalates to amRepair —
    // never straight to local. Intent-aware: only when the engine expects music (cook alive, not
    // user-paused, not transport-parked). Music.kick self-gates on _wantPlay too.
    // FIX 2 — THE SINGLE RESUME OWNER. The ONLY code allowed to (re)start audio after a pause / voice
    // window / recovery. Reads the canonical state and does exactly ONE source-aware thing; every call
    // bumps audioEpoch so any in-flight retry from a PRIOR call (pause→resume roulette) is voided —
    // last-owner-wins, no races. reason "user-resume" un-parks the local element (Music.play); any other
    // reason (voice-recover) self-gates via Music.kick. AM cooks NEVER touch the local element here.
    function resumeAudio(reason) {
      if (amRepairing) return;                 // a repair/chip owns recovery — never fight it
      const ep = ++audioEpoch;
      if (amSel && amActive) {
        const before = window.AppleMusic_.time();
        try { window.AppleMusic_.play(); } catch (e) { }
        setTimeout(() => {                      // recovery-play failure ≠ AM death — one epoch-guarded retry, then amRepair
          if (ep !== audioEpoch || !cookRunning || paused || parkedPaused || !amActive || amRepairing || VoiceCtrl.listening()) return;
          if (window.AppleMusic_.time() > before + 0.2) return;   // playing again
          try { window.AppleMusic_.play(); } catch (e) { }
          setTimeout(() => { if (ep === audioEpoch && cookRunning && !paused && !parkedPaused && amActive && !amRepairing && !VoiceCtrl.listening() && !(window.AppleMusic_.time() > before + 0.2)) amRepair("resume-failed"); }, 900);
        }, 500);
      } else if (Music.has()) {                 // local cook, OR the user switched to Choppd's pick (amActive false)
        if (reason === "user-resume") { try { Music.play(); } catch (e) { } }   // un-park a user pause (kick would no-op — pause cleared _wantPlay)
        else { try { Music.kick(); } catch (e) { } }                            // voice-recover: self-gating re-assert
      }
    }
    // Voice teardown recovery routes through the ONE owner (intent-guarded: only when music should sound).
    VoiceCtrl._musicRecover = () => {
      if (!cookRunning || paused || parkedPaused) return;
      resumeAudio("voice-recover");
    };
    if (isNativeVoice() && NATIVE_VOICE_V2) VoiceCtrl.rearm();   // JOB B: a NEW COOK re-arms the per-cook auto-disable
    // TEST PROBE (CHOPPD_TEST only): expose the audio-relevant cook state + spies so the regression-lock
    // asserts can drive jumps / pause / resume and prove the contracts (esp. "zero local starts on an AM cook").
    if (window.CHOPPD_TEST) {
      const K = window.__cookCounters = window.__cookCounters || { ls: 0, rd: 0, xc: 0, ec: 0 };   // stable across launches
      const wrap = (obj, m, cnt) => { const key = "__tw_" + m; if (obj[key]) return; obj[key] = true; const o = obj[m].bind(obj); obj[m] = function () { cnt(); return o.apply(obj, arguments); }; };
      wrap(Music, "play", () => K.ls++); wrap(Music, "fadeIn", () => K.ls++);
      wrap(Music, "exitCheckpoint", () => K.xc++); wrap(Music, "enterCheckpoint", () => K.ec++);
      wrap(VoicePlayer, "releaseDuck", () => K.rd++);
      window.__cook = {
        st: () => ({ amActive, paused, parkedPaused, waiting, amRepairing, audioEpoch, amSel: !!amSel, cookRunning, localStarts: K.ls, duckReleases: K.rd, exitCheckpoints: K.xc, enterCheckpoints: K.ec }),
        audio: () => (Music.audioState ? Music.audioState() : null),
        reset: () => { K.ls = 0; K.rd = 0; K.xc = 0; K.ec = 0; },
        amT: () => window.AppleMusic_.time(),
        jump: (i) => jumpToCue(i),
        setPos: (t) => { songPos = t; },
        musicStarted: () => musicStarted,
        enterGate: (i) => { if (cues[i]) enterWait(cues[i]); },
        confirm: () => { const b = $("#gDone"); if (b) { b.click(); return true; } return false; },
        injectVoice: (t) => { const SP = nativeSpeech(); if (SP && SP.injectTranscript) { SP.injectTranscript({ transcript: t }); return true; } return false; },
        listening: () => VoiceCtrl.listening(),
        gateIdxs: () => cues.map((c, i) => ({ i, at: c.at, gate: !!c.gate, type: c.type, noCp: !!c.noCheckpoint })),
        coordLog: () => (window.__coordLog || []).slice(),
        coordReset: () => { if (window.__coordLog) window.__coordLog.length = 0; },
        pauseClick: () => { const b = $("#pause"); if (b) b.click(); },
      };
    }
    begin();   // no video to gate behind — start immediately (or on the AM/local music start inside begin)
    if (resume && !started) begin();   // COOK RESUME auto-starts (no tap gate) even for music recipes

    // ---- controls ----
    $("#pause").onclick = (e) => {
      if (preview) { previewPause(); return; }
      paused = !paused;
      cookEl.classList.toggle("paused", paused);
      e.target.textContent = paused ? "▶ Resume" : "⏸ Pause";
      if (paused) {
        // PAUSE: bump the epoch (voids any in-flight recovery/retry), cancel the pending voice recover,
        // park an in-flight repair, then stop every source. No play calls.
        ++audioEpoch;
        if (VoiceCtrl._recoverTimer) { clearTimeout(VoiceCtrl._recoverTimer); VoiceCtrl._recoverTimer = null; }
        if (amRepairing) { amRepairing = false; if (amRepairTimer) { clearTimeout(amRepairTimer); amRepairTimer = null; } }
        stopVoice(); Music.pause(); if (spSel) Spotify_.pause();
        if (amSel) { try { window.AppleMusic_.pause(); } catch (e) { } }
      } else {
        // RESUME: the single owner starts exactly the right source (AM cooks NEVER start the local element).
        resumeAudio("user-resume");
        if (spSel) Spotify_.resume();
      }
      lastTs = performance.now();
      saveResume();   // COOK RESUME: pause state is part of the snapshot
    };
    { const sn = $("#skipNext"), sb = $("#skipBack"); if (sn) sn.onclick = skipNext; if (sb) sb.onclick = skipBack; }
    $("#quit").onclick = tutorial
      ? (() => { paused = true; stop(); Music.stop(); stopVoice(); trackEvent("tutorial_skipped_cue" + Math.max(0, curCueIdx)); tutorialActive = false; screens.home(); })
      : preview
        ? (() => previewExit())
        : (() => confirmDialog("Quit this cook? Your progress will be lost.", "Yes, quit", () => { stop(); Resume.clear(); screens.home(); }));   // explicit quit → DELETE the snapshot
    if ($("#tAmEdit")) $("#tAmEdit").onclick = () => showAmRepairPanel("edit");   // D: change the queue / switch source anytime
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
    if ($("#tSpeed")) $("#tSpeed").onclick = (e) => {
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
        <h1 style="margin-top:8px">That's the<br><span class="gradient-text">Choppd experience.</span></h1>
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
    h(screenEl("center", `
      <div class="finish-hero">
        <div class="big-emoji" style="font-size:64px">🎓</div>
        <p class="eyebrow" style="margin-top:10px">You're all set</p>
        <h1 style="margin-top:8px">See how a cook<br><span class="gradient-text">works</span> 👀</h1>
        <p class="lead" style="margin-top:12px">A two-minute hands-on tutorial: the real cook screen, real cues, nothing to burn. Totally optional — it lives in Settings whenever you want it.</p>
      </div>
      <div class="stack" style="margin-top:26px">
        <button class="btn gradient" id="goTut">Try the 2-minute tutorial ▶</button>
        <button class="btn ghost" id="skipTut">Skip for now</button>
      </div>
    `));
    $("#goTut").onclick = () => startTutorial(false);
    $("#skipTut").onclick = () => enterActivation("pick");
  };

  // ---- the tutorial outro: the transformation note, then the dashboard ----
  screens.tutorialOutro = () => {
    h(screenEl("center", `
      <div class="finish-hero">
        <div class="big-emoji" style="font-size:64px">🍳</div>
        <p class="eyebrow" style="margin-top:10px">Tutorial complete</p>
        <h1 style="margin-top:8px">That was the<br><span class="gradient-text">whole game</span></h1>
        <p class="lead" style="margin-top:12px">Cues tell you <b style="color:var(--text)">what</b>. The music tells you <b style="color:var(--text)">when</b>. Checkpoints wait for you. That's all a cook is — follow the cues, trust the timing.</p>
        <p class="lead" style="margin-top:10px">You just ran one with zero stakes. The next one ends in dinner.</p>
      </div>
      <div class="stack" style="margin-top:26px">
        <button class="btn gradient" id="tutDone">Let's cook for real 🍳</button>
      </div>
    `));
    $("#tutDone").onclick = () => enterActivation("pick");
  };

  // ---- Finish / share ----
  // ---- post-cook feedback (mandatory 5-star, half-star steps; emoji is display-only) ----
  // Subtle, optional external-feedback link for the finish cards — opens the Google Form in a new
  // tab (rel=noopener so the app keeps its state). Sits below everything; never gated/required.
  const FEEDBACK_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSe3G86_BHbIE4kooMYSrt6Pal8aQuYMpqp75xafYqIHzVALhQ/viewform";
  function feedbackFormLinkHTML() {
    return `<a class="feedback-link" href="${FEEDBACK_FORM_URL}" target="_blank" rel="noopener noreferrer">Got feedback? Help make Choppd better 💬</a>`;
  }

  function feedbackBlockHTML() {
    return `
      <p class="section-title" style="text-align:center;margin-top:6px">How did it go?</p>
      <div class="rate-emoji" id="rateEmoji">🙂</div>
      <div class="stars" id="stars" aria-label="Rate out of five">
        ${[1, 2, 3, 4, 5].map((n) => `<span class="star"><span class="star-bg">★</span><span class="star-fill"><span>★</span></span><button class="half" data-v="${n - 0.5}" aria-label="${n - 0.5} of 5"></button><button class="half" data-v="${n}" aria-label="${n} of 5"></button></span>`).join("")}
      </div>
      <p class="rate-val" id="rateVal">Tap the stars to rate</p>
      <label class="btn secondary" id="photoBtn" style="margin-top:14px">Show off your plate 📸 (optional)<input type="file" id="photoInput" accept="image/*" hidden></label>
      <div id="photoPrev"></div>
      <p class="section-title" style="text-align:center;margin-top:16px">Comments & recommendations</p>
      <textarea id="fbComment" class="field" placeholder="How did it go? What worked, what should we improve? (optional)" style="width:100%;min-height:84px;resize:vertical;line-height:1.45"></textarea>`;
  }

  function wireFeedback(recipeName, onReadyChange) {
    const fb = { recipe: recipeName, rating: null, comment: "", hasPhoto: false, at: new Date().toISOString() };
    cookCardData = { rating: null, photoFile: null }; // fresh per cook, for the share card
    let saved = false, savePromise = null;
    const emojiFor = (v) => v <= 1 ? "😞" : v <= 2 ? "😐" : v <= 3 ? "🙂" : v <= 4 ? "😋" : "🤩";
    const paint = (v) => $$("#stars .star").forEach((st, i) => { st.querySelector(".star-fill").style.width = (Math.max(0, Math.min(1, v - i)) * 100) + "%"; });
    // ready to leave only once BOTH a rating and a non-empty comment are given
    const checkReady = () => { if (onReadyChange) onReadyChange(fb.rating != null); };   // comment is OPTIONAL (founder decision 2026-07-08) — rating alone saves
    function setRating(v) {
      fb.rating = v; if (cookCardData) cookCardData.rating = v; paint(v);
      $("#rateEmoji").textContent = emojiFor(v);
      $("#rateVal").textContent = (v % 1 ? v.toFixed(1) : v) + " / 5";
      // match the headline to how it actually went — warm register for a rough cook, never celebrate a failure
      const eb = $("#finishEyebrow"), wm = $("#finishWarmth");
      if (eb && wm) {
        if (v <= 2) { eb.textContent = "That one fought back."; wm.textContent = "Happens to everyone — even the people who pretend it doesn't. Run it back, you'll get it."; }
        else { eb.textContent = finishIsFirstCook ? "First one down." : "Another one done."; wm.textContent = "That's a real meal. Beats whatever you were about to order."; }
      }
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
    return (force) => {                  // persist once RATED (comment optional); force = save unrated on exit — never silently discard a completed cook
      if (saved) return savePromise;     // idempotent — return the in-flight save
      if (fb.rating == null && !force) return null;
      saved = true;
      const comment = (fb.comment || "").trim();
      if (completionRecorded) {
        // Streak already banked at the finish hook — attach the rating to that one session
        // (no 2nd cook_sessions row). If the POST hasn't resolved yet we simply skip the
        // rating write; the completion (and its streak) is already recorded.
        savePromise = (completionSessionId && backendOn() && API.isLoggedIn())
          ? API.rateSession(completionSessionId, fb.rating != null ? fb.rating : null, comment || null, fb.hasPhoto).catch(() => null)
          : Promise.resolve(null);
      }
      else if (pendingSession) { if (fb.rating != null) pendingSession.rating = fb.rating; if (comment) pendingSession.comment = comment; pendingSession.hasPhoto = fb.hasPhoto; pendingSession.finishedAt = new Date().toISOString(); savePromise = Telemetry.save(pendingSession); pendingSession = null; }
      else { savePromise = Telemetry.save({ mode: "unknown", recipe: fb.recipe, rating: fb.rating ?? undefined, comment: comment || undefined, hasPhoto: fb.hasPhoto, at: fb.at, completed: true }); }
      return savePromise;
    };
  }

  // Apply a session-save response's streak to state, then show a celebratory
  // full-width flame banner before the caller navigates home. No-op offline.
  function applyStreakResp(res) {
    if (res && typeof res.currentStreak === "number") state.currentStreak = res.currentStreak;
    if (res && typeof res.longestStreak === "number") state.longestStreak = res.longestStreak;
  }
  // COMPLETION HOOK — bank the cook the instant it finishes, at the SAME point Receipt.record
  // + Skills.record fire (screens.finish / screens.guidedFinish). This decouples streak
  // recording from the exit path: "Cook it again", a nav away, or leaving unrated all still
  // record the streak. The rating attaches to THIS session later (POST /sessions/rate), so
  // there is exactly one cook_sessions row per cook and the same-day dedupe holds server-side.
  // Offline/anonymous falls through to the exit-save (Telemetry.save + flushPending on login) —
  // parity with the pre-existing local behavior, unchanged.
  function recordCompletion() {
    completionSessionId = null; completionRecorded = false;
    if (!(pendingSession && backendOn() && API.isLoggedIn())) return;   // offline/anon → exit-save owns it
    const s = pendingSession; completionRecorded = true; pendingSession = null;   // this record is authoritative
    try { const log = Telemetry.read(); log.push(s); localStorage.setItem("seartune_sessions", JSON.stringify(log.slice(-200))); } catch (e) { }
    API.logSession(s).then((res) => { if (res && res.id) completionSessionId = res.id; applyStreakResp(res); }).catch(() => { });
  }
  // Current cook streak for display — server truth when logged in, else a local day-based
  // count over the on-device session log (real consecutive-day logic, not the legacy naive
  // counter). FOUNDER RULE (final): TWO states only — current >= 1 shows 🔥N, current == 0
  // hides the badge entirely. Never-cooked and lapsed render identically (nothing); no warm
  // "restart" state. Recording is unchanged — this is display only.
  function currentStreakValue() {
    if (backendOn() && API.isLoggedIn()) return state.currentStreak || 0;
    let sessions = []; try { sessions = Telemetry.read().filter((s) => s && s.completed); } catch (e) { }
    const dates = [...new Set(sessions.map((s) => String(s.finishedAt || s.at || "").slice(0, 10)).filter(Boolean))].sort();
    if (!dates.length) return 0;
    const addDay = (d, n) => { const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
    const today = new Date().toISOString().slice(0, 10), last = dates[dates.length - 1];
    if (last !== today && last !== addDay(today, -1)) return 0;   // lapsed → 0 → hidden
    let current = 1; for (let i = dates.length - 2; i >= 0; i--) { if (addDay(dates[i], 1) === dates[i + 1]) current++; else break; }
    return current;
  }
  // Home streak badge markup — single source for the home header AND the __streak dev hook.
  // Two states: n>=1 → 🔥N; n==0 → "" (no element in the DOM at all).
  function streakBadgeHTML() {
    const n = currentStreakValue();
    return n > 0 ? `<button class="streak-badge" id="streakBadge" title="${n}-day cook streak">🔥 ${n}</button>` : "";
  }
  // DEV: headless streak verification (mirrors __receipt/__skills). Harmless.
  window.__streak = { current: () => currentStreakValue(), badge: () => streakBadgeHTML() };
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
    let res = await Promise.resolve(save());
    if (res == null) {
      // unrated exit: the cook SAVES anyway — one gentle tap, never a silent discard
      await new Promise((resolve) => {
        const wrap = document.createElement("div");
        wrap.className = "confirm-scrim";
        wrap.innerHTML = `<div class="confirm-box"><p>No rating? No problem — <b>your cook is saved</b>. Star it next time and tell us how it went. 🍳</p><div class="btn-row"><button class="btn" data-yes>Done</button></div></div>`;
        (document.querySelector(".phone") || app).appendChild(wrap);
        requestAnimationFrame(() => wrap.classList.add("show"));
        wrap.querySelector("[data-yes]").onclick = () => { wrap.classList.remove("show"); setTimeout(() => { wrap.remove(); resolve(); }, 200); };
      });
      res = await Promise.resolve(save(true));
    }
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
  // Load a user photo the right way up. iPhone shots carry EXIF rotation; createImageBitmap with
  // imageOrientation applies it explicitly. Fall back to <img> (modern iOS Safari auto-applies EXIF
  // there too) so it degrades gracefully — either path, never double-rotated.
  async function loadPhotoUpright(file) {
    if (window.createImageBitmap) {
      try { return await createImageBitmap(file, { imageOrientation: "from-image" }); } catch (e) { }
    }
    return await loadImage(URL.createObjectURL(file));
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
    try { await document.fonts.ready; } catch (e) { }
    const cssVar = (n, fb) => ((getComputedStyle(document.documentElement).getPropertyValue(n) || "").trim() || fb);
    const ORANGE = cssVar("--brand", "#ff6b35"), VIOLET = cssVar("--accent", "#c44dff"), MUTED = cssVar("--text-dim", "#9a9ab0"), TEXT = cssVar("--text", "#f4f4f7"), cx = CARD_W / 2;
    const fireGrad = (x0, x1) => { const g = ctx.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, ORANGE); g.addColorStop(1, VIOLET); return g; };
    ctx.fillStyle = "#0b0b0f"; ctx.fillRect(0, 0, CARD_W, CARD_H);
    const glow = ctx.createRadialGradient(cx, 220, 60, cx, 220, 760);
    glow.addColorStop(0, "rgba(255,107,53,.22)"); glow.addColorStop(1, "rgba(255,107,53,0)");
    ctx.fillStyle = glow; ctx.fillRect(0, 0, CARD_W, 920);

    // logo lockup
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    let logoY = 96;
    try { const logo = await loadImage("assets/logo.png?v=4"); const lh = 100, lw = logo.width * (lh / logo.height); ctx.drawImage(logo, cx - lw / 2, logoY, lw, lh); logoY += lh + 18; } catch (e) { logoY += 10; }
    // brand wordmark — draw the choppd SVG; fall back to fire-gradient text if it can't rasterize.
    // wmBottom tracks the real bottom of whatever we drew so the dish name can clear it.
    let wmBottom;
    try {
      const wm = await loadImage("assets/wordmark.svg?v=1");
      const ww = 300, wh = ww * ((wm.height / wm.width) || 0.2703);
      ctx.drawImage(wm, cx - ww / 2, logoY, ww, wh);
      wmBottom = logoY + wh;
    } catch (e) {
      ctx.font = "800 46px 'Instrument Sans', system-ui, sans-serif";
      try { ctx.letterSpacing = "10px"; } catch (e2) { }
      ctx.fillStyle = fireGrad(cx - 130, cx + 130); ctx.fillText("CHOPPD", cx + 5, logoY + 38);
      try { ctx.letterSpacing = "0px"; } catch (e2) { }
      wmBottom = logoY + 46;
    }

    // dish name (bold, wrapping) — starts below the wordmark (dynamic, so it never intersects)
    ctx.font = "800 78px 'Instrument Sans', system-ui, sans-serif"; ctx.fillStyle = TEXT;
    const maxNameW = CARD_W - 120, words = (data.recipe || "Your Cook").split(" "), lines = []; let curL = "";
    for (const w of words) { const t = curL ? curL + " " + w : w; if (ctx.measureText(t).width > maxNameW && curL) { lines.push(curL); curL = w; } else curL = t; }
    if (curL) lines.push(curL);
    let ny = Math.round(wmBottom + 92); for (const ln of lines) { ctx.fillText(ln, cx, ny); ny += 88; }

    // achievement line — "I made {recipe} to {song} 🎸" (own-track / no song → "with Choppd").
    // Wraps to extra lines (never shrink-to-fit); ny accumulates so the photo box follows it.
    const song1 = (Array.isArray(data.songs) && data.songs[0] && data.songs[0].title) ? data.songs[0].title : (data.song || null);
    const ach = song1 ? `I made ${data.recipe || "this"} to ${song1} 🎸` : `I made ${data.recipe || "this"} with Choppd 🎸`;
    ctx.font = "600 38px 'Inter', system-ui, sans-serif"; ctx.fillStyle = ORANGE;
    const achMax = CARD_W - 150, aw = ach.split(" "), aL = []; let aC = "";
    for (const w of aw) { const t = aC ? aC + " " + w : w; if (ctx.measureText(t).width > achMax && aC) { aL.push(aC); aC = w; } else aC = t; }
    if (aC) aL.push(aC);
    ny += 8; for (const ln of aL) { ctx.fillText(ln, cx, ny); ny += 50; }

    // hero photo (or fire-gradient fallback). Stat band is bottom-anchored (bandY), so the photo
    // box fills whatever space is left above it — no overlap even when name+achievement run long.
    const boxX = 72, boxW = CARD_W - 144, boxY = ny + 12;
    const bandY = 1360, bandH = 220;
    const boxH = Math.max(340, bandY - 44 - boxY);
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
    const bandX = 72, bandW = CARD_W - 144;
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
        const logo = await loadImage("assets/logo.png?v=4"); const lh = 66, lw = logo.width * (lh / logo.height);
        ctx.drawImage(logo, cx - 158, barY + 52, lw, lh);
        ctx.textAlign = "left"; ctx.font = "800 40px 'Instrument Sans', system-ui, sans-serif"; ctx.fillStyle = TEXT; ctx.fillText("Made with Choppd", cx - 158 + lw + 20, barY + 100);
        ctx.textAlign = "center";
      } catch (e) { ctx.font = "800 44px 'Instrument Sans', system-ui, sans-serif"; ctx.fillStyle = TEXT; ctx.fillText("Made with Choppd", cx, barY + 104); }
    } else if (PREMIUM_CARD_BRANDING === "corner") {
      ctx.textAlign = "right"; ctx.font = "700 30px 'Instrument Sans', system-ui, sans-serif"; ctx.fillStyle = "rgba(154,154,176,.65)";
      ctx.fillText("Choppd", CARD_W - 60, CARD_H - 56); ctx.textAlign = "center";
    }
    // JPEG keeps the share/save file light. 0.92 (not 0.9) guards against banding in the
    // orange→violet gradient + blocking on the near-black bg — the brand's whole look.
    return await new Promise((res) => cv.toBlob((b) => res(b), "image/jpeg", 0.92));
  }

  // SAVINGS CARD FACE (second face of the one share pipeline). SCREENSHOT-FIRST: the
  // dollar total is the hero at glanceable size, branding small, legible in a dark
  // group chat at thumbnail; the honest "estimated vs. takeout" sub-line rides along.
  async function buildSavingsCard(data) {
    const cv = document.createElement("canvas"); cv.width = CARD_W; cv.height = CARD_H;
    const ctx = cv.getContext("2d");
    try { await document.fonts.ready; } catch (e) { }
    const cssVar = (n, fb) => ((getComputedStyle(document.documentElement).getPropertyValue(n) || "").trim() || fb);
    const ORANGE = cssVar("--brand", "#ff6b35"), GREEN = cssVar("--success", "#34d399"), MUTED = cssVar("--text-dim", "#9a9ab0"), TEXT = cssVar("--text", "#f4f4f7"), cx = CARD_W / 2;
    const fireGrad = (x0, x1) => { const g = ctx.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, ORANGE); g.addColorStop(1, cssVar("--accent", "#c44dff")); return g; };
    ctx.fillStyle = "#0b0b0f"; ctx.fillRect(0, 0, CARD_W, CARD_H);
    const glow = ctx.createRadialGradient(cx, 900, 90, cx, 900, 940);   // green money-win glow
    glow.addColorStop(0, "rgba(52,211,153,.20)"); glow.addColorStop(1, "rgba(52,211,153,0)");
    ctx.fillStyle = glow; ctx.fillRect(0, 0, CARD_W, CARD_H);
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    // small brand lockup up top (branding present but not the hero)
    let topY = 190;
    try { const logo = await loadImage("assets/logo.png?v=4"); const lh = 76, lw = logo.width * (lh / logo.height); ctx.drawImage(logo, cx - lw / 2, topY, lw, lh); topY += lh + 14; } catch (e) { }
    try { const wm = await loadImage("assets/wordmark.svg?v=1"); const ww = 210, wh = ww * ((wm.height / wm.width) || 0.27); ctx.drawImage(wm, cx - ww / 2, topY, ww, wh); } catch (e) { ctx.font = "800 44px 'Instrument Sans', system-ui, sans-serif"; ctx.fillStyle = fireGrad(cx - 100, cx + 100); ctx.fillText("CHOPPD", cx, topY + 40); }
    // kicker
    ctx.font = "600 52px 'Inter', system-ui, sans-serif"; ctx.fillStyle = MUTED;
    ctx.fillText("I've saved", cx, 700);
    // THE HERO — the dollar number, as big as fits (glanceable at thumbnail)
    const dollarStr = money(data.totalCents);
    let fs = 460; ctx.font = `800 ${fs}px 'Instrument Sans', system-ui, sans-serif`;
    while (ctx.measureText(dollarStr).width > CARD_W - 150 && fs > 140) { fs -= 20; ctx.font = `800 ${fs}px 'Instrument Sans', system-ui, sans-serif`; }
    const heroBaseline = 700 + Math.round(fs * 0.82);
    ctx.fillStyle = GREEN; ctx.fillText(dollarStr, cx, heroBaseline);
    // "out of the delivery app." — the win, framed on the situation not the meal
    ctx.font = "italic 700 58px 'Instrument Sans', system-ui, sans-serif"; ctx.fillStyle = TEXT;
    ctx.fillText(RECEIPT_COPY.cardKicker, cx, heroBaseline + 130);
    // cooks + honest small print
    ctx.font = "600 42px 'Inter', system-ui, sans-serif"; ctx.fillStyle = ORANGE;
    ctx.fillText(`${data.cooks} real dinner${data.cooks === 1 ? "" : "s"}, cooked`, cx, heroBaseline + 232);
    ctx.font = "500 32px 'Inter', system-ui, sans-serif"; ctx.fillStyle = MUTED;
    ctx.fillText(RECEIPT_COPY.cardSub, cx, heroBaseline + 292);
    // branding bar (same treatment as the cook card)
    if (data.free) {
      const barY = CARD_H - 172;
      ctx.fillStyle = "#101018"; ctx.fillRect(0, barY, CARD_W, 172);
      ctx.fillStyle = fireGrad(0, CARD_W); ctx.fillRect(0, barY, CARD_W, 5);
      try {
        const logo = await loadImage("assets/logo.png?v=4"); const lh = 66, lw = logo.width * (lh / logo.height);
        ctx.drawImage(logo, cx - 158, barY + 52, lw, lh);
        ctx.textAlign = "left"; ctx.font = "800 40px 'Instrument Sans', system-ui, sans-serif"; ctx.fillStyle = TEXT; ctx.fillText("Made with Choppd", cx - 158 + lw + 20, barY + 100); ctx.textAlign = "center";
      } catch (e) { ctx.font = "800 44px 'Instrument Sans', system-ui, sans-serif"; ctx.fillStyle = TEXT; ctx.fillText("Made with Choppd", cx, barY + 104); }
    } else {
      ctx.textAlign = "right"; ctx.font = "700 30px 'Instrument Sans', system-ui, sans-serif"; ctx.fillStyle = "rgba(154,154,176,.65)"; ctx.fillText("Choppd", CARD_W - 60, CARD_H - 56); ctx.textAlign = "center";
    }
    return await new Promise((res) => cv.toBlob((b) => res(b), "image/jpeg", 0.92));
  }

  function trackCard(type) { try { if (backendOn()) API.event(type, (EXP && EXP.recipe) ? EXP.recipe.title : null).catch(() => { }); } catch (e) { } }
  function downloadBlob(blob, name) { const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name || "choppd-cook.jpg"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 5000); }
  async function shareCardBlob(blob) {
    const file = new File([blob], "choppd-cook.jpg", { type: "image/jpeg" });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: "My Choppd cook", text: "Cooked this to a song 🎶🔥" }); trackCard("card_shared"); return "shared"; }
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
  // One preview screen, up to TWO faces (cook + savings) sharing the one share path.
  function showCookCard(blob, free, altBlob) {
    const cookUrl = URL.createObjectURL(blob);
    const altUrl = altBlob ? URL.createObjectURL(altBlob) : null;
    let current = blob;
    h(screenEl("cookcard-screen", `
      <button class="btn ghost" id="ccBack" style="width:auto;align-self:flex-start;padding-left:0">← Back</button>
      <p class="eyebrow" style="text-align:center;margin-top:2px">Your cook card</p>
      ${altBlob ? `<div class="cc-faces"><button class="cc-face on" data-face="cook">🍳 Cook</button><button class="cc-face" data-face="savings">💰 Savings</button></div>` : ""}
      <div class="cc-preview"><img id="ccImg" src="${cookUrl}" alt="your cook card"></div>
      ${free ? `<button class="cc-upsell" id="ccUpsell">✨ Remove the watermark with <b>Premium</b></button>` : ""}
      <div class="stack" style="margin-top:14px">
        <button class="btn" id="ccShare">Share 📲</button>
        <button class="btn secondary" id="ccDownload">Save image ⬇</button>
        <button class="btn ghost" id="ccHome">Back home</button>
      </div>
    `));
    $("#ccBack").onclick = () => screens.home();
    $("#ccHome").onclick = () => screens.home();
    if (altBlob) $$(".cc-face").forEach((b) => b.onclick = () => {
      $$(".cc-face").forEach((x) => x.classList.toggle("on", x === b));
      const savings = b.dataset.face === "savings";
      current = savings ? altBlob : blob;
      const img = $("#ccImg"); if (img) img.src = savings ? altUrl : cookUrl;
    });
    $("#ccShare").onclick = () => shareCardBlob(current);
    $("#ccDownload").onclick = () => { downloadBlob(current); trackCard("card_shared"); };
    const up = $("#ccUpsell"); if (up) up.onclick = () => screens.premium();
  }
  // Build the card from the finished cook, with a photo nudge, then preview it.
  async function makeAndShowCard(save, btn) {
    const orig = btn ? btn.textContent : "";
    if (btn) { btn.disabled = true; btn.textContent = "Building your card…"; }
    const dur = pendingSession ? pendingSession.durationSec : null;
    const songs = (pendingSession && pendingSession.songsPlayed && pendingSession.songsPlayed.length) ? pendingSession.songsPlayed : [{ title: EXP.song.title, artist: EXP.song.artist }];
    try { applyStreakResp(await Promise.resolve(save ? save() : null)); } catch (e) { }
    if (!cookCardData || !cookCardData.photoFile) {
      const r = await photoNudge();
      if (r === "add") { if (btn) { btn.disabled = false; btn.textContent = orig; } const inp = $("#photoInput"); if (inp) inp.click(); return; }
    }
    let photo = null;
    try { if (cookCardData && cookCardData.photoFile) photo = await loadPhotoUpright(cookCardData.photoFile); } catch (e) { }
    trackCard("card_generated");
    const blob = await buildCookCard({ recipe: EXP.recipe.title, emoji: EXP.recipe.emoji, songs, rating: cookCardData ? cookCardData.rating : null, durationSec: dur, streak: state.currentStreak, photo, free: !isPremium() });
    // MONEY RECEIPT: second face — the running-tab savings card (enabled + logged-in with a tab).
    let altBlob = null;
    if (RECEIPTS_ENABLED && backendOn() && API.isLoggedIn()) {
      try { const t = await API.receiptTab(); if (t && t.enabled && t.totalCents > 0) altBlob = await buildSavingsCard({ totalCents: t.totalCents, cooks: t.cooks, free: !isPremium() }); } catch (e) { }
    }
    if (btn) { btn.disabled = false; btn.textContent = orig; }
    showCookCard(blob, !isPremium(), altBlob);
  }

  screens.finish = () => {
    WakeLock.release();   // cook complete
    finishIsFirstCook = Telemetry.read().length === 0; // no prior completed cooks → genuine first cook
    // MONEY RECEIPT: compute once, record to the tab (logged-in) or hold for signup
    // (anonymous). No-op entirely when RECEIPTS_ENABLED is false → finish unchanged.
    const receiptRC = Receipt.compute(EXP, portionCount);
    Receipt.record(receiptRC);
    // SKILL GRAPH (dark): a completed flagship cook confirms every gate (gates block
    // advancement) → gatesConfirmed = true. The server owns the skill mapping; this
    // fire-and-forget POST never blocks finish and no-ops for unmapped recipes.
    Skills.record(EXP.id, true);
    // STREAK: bank the cook here — same completion hook as Receipt + Skills — so it records
    // regardless of how the cook leaves this screen. The rating attaches to this session.
    recordCompletion();
    h(screenEl("center", `
      <div class="finish-hero">
        <div class="medal">🏅</div>
        <p class="eyebrow" id="finishEyebrow" style="margin-top:8px">${finishIsFirstCook ? "First one down." : "Another one done."}</p>
        <h1 style="margin-top:8px">You made<br><span class="gradient-text">${EXP.recipe.title.toLowerCase()}.</span></h1>
        <p class="lead" id="finishWarmth" style="margin-top:8px">That's a real meal. Beats whatever you were about to order.</p>
        ${receiptBlockHTML(EXP, portionCount)}
        <div class="streak">🔥 Rate it to bank your streak</div>
      </div>

      <div class="share-card">
        <div class="glow"></div>
        <div class="big">${EXP.recipe.emoji}🎵</div>
        <h2 style="position:relative;margin-top:8px">Cooked to ${EXP.song.title}</h2>
        <p class="muted" style="position:relative">${EXP.song.artist} · Choppd</p>
      </div>

      ${feedbackBlockHTML()}

      <div class="stack" style="margin-top:16px">
        <button class="btn" id="share">Share my cook 📲</button>
        <button class="btn secondary" id="again">Cook it again</button>
        <button class="btn ghost" id="home">Back home</button>
      </div>

      ${feedbackFormLinkHTML()}
    `));
    const exitBtns = ["#share", "#again", "#home"];   // always tappable; unrated exit → finishExit save-anyway nudge
    const save = wireFeedback(`${EXP.song.title} — ${EXP.recipe.title}`);   // exits always tappable — unrated leaves route through finishExit's save-anyway nudge
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
          <span class="brand-lockup"><img class="brand-logo" src="assets/logo.png?v=4" alt="" aria-hidden="true" /><img class="brand-wordmark" src="assets/wordmark.svg?v=1" alt="Choppd" /></span>
          <button class="icon-btn" id="sbClose" aria-label="Close menu">✕</button>
        </div>
        <nav class="sb-nav">
          <button class="sb-item" data-nav="profile"><span class="sb-ico">👤</span><span>Profile</span></button>
          ${LIBRARY_VISIBLE ? `<button class="sb-item" data-nav="search"><span class="sb-ico">🔍</span><span>Search recipes</span></button>` : ""}
          <button class="sb-item" data-nav="premium"><span class="sb-ico">⭐</span><span>Premium</span></button>
          ${(AM_PILOT && isNativeVoice()) ? `<button class="sb-item" data-nav="music"><span class="sb-ico">🎧</span><span>Music</span></button>` : ""}
          <button class="sb-item" data-nav="history"><span class="sb-ico">📅</span><span>Cook History</span></button>
          <button class="sb-item" data-nav="saved"><span class="sb-ico">🔖</span><span>Saved</span></button>
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
      try { stopAmTest(); } catch (e) { }   // C: test playback stops on tab exit
      if (name === "profile") screens.profile();
      else if (name === "music") screens.music();
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
      <div class="hist-emoji">${recipeThumbInner(s, sessionEmoji(s))}</div>
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
      <div id="histSavings"></div>
      <div id="histStreak"></div>
      <div id="histBody"><p class="muted" style="font-size:13px">Loading your cook story…</p></div>
      <div style="height:18px"></div>
    `));
    wireSectionHead();
    mountHistorySavings();

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
      <div id="histSavings"></div>
      <div class="hist-tabs">
        <button class="ht-tab" data-htab="history">📜 History</button>
        <button class="ht-tab" data-htab="streak">🔥 Streak</button>
        <button class="ht-tab" data-htab="records">🏆 Records</button>
      </div>
      <div id="histPanel"><p class="muted" style="font-size:13px">Loading…</p></div>
      <div style="height:18px"></div>
    `));
    wireSectionHead();
    mountHistorySavings();
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
      <div class="hist-emoji">${recipeThumbInner(s, sessionEmoji(s))}</div>
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
          <b style="font-family:'Instrument Sans'">${state.email || "guest@choppd.io"}</b>
          <div style="margin-top:4px"><span class="pill tier">${state.tier === "premium" ? "PREMIUM" : "FREE TIER"}</span></div>
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
        ${(() => { const n = currentStreakValue();
          return n > 0 ? `<div class="prow"><span class="muted">Cooking streak</span><div class="pval"><span>🔥 ${n}</span></div></div>` : ""; })()}
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
        <div class="prow" id="savingsRow" hidden><span class="muted">Saved vs. takeout</span><div class="pval"><span id="savingsVal">—</span></div></div>
      </div>
      <p class="muted" style="font-size:11px;margin-top:8px">We learn your real pace from each cook and time future steps to match — no questionnaire needed.</p>

      <div class="mt-auto" style="margin-top:18px">
        <button class="btn ghost" id="signout">Sign out</button>
      </div>
    `));
    wireSectionHead();
    mountSavingsTab();   // MONEY RECEIPT: fill the running-tab row when enabled (async, non-blocking)
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
    const thumb = `<div class="rthumb">${recipeThumbInner(s, "🎵")}</div>`;
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
    // LIBRARY HIDDEN: imported saved items stay in localStorage but don't show
    // (reversible — they reappear when the flag flips back to true).
    const list = savedList().slice().reverse().filter((s) => LIBRARY_VISIBLE || s.isMusicSync); // newest first
    const body = list.length
      ? `<div class="catalog">${list.map(savedCardHTML).join("")}</div>`
      : `<div class="empty-state">
           <div class="empty-emoji">🔖</div>
           <h2 style="margin:6px 0">Nothing saved yet</h2>
           <p class="lead">Kind of like your fridge, honestly. Bookmark any recipe and it lands right here.</p>
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
      <p class="lead" style="margin-top:8px">Every recipe we've got. Search it, filter it, cook it${isPremium() ? "" : " — cooking's a Premium thing."}</p>
      <div class="searchrow" style="margin-top:14px">
        <input class="field" id="rsearch" placeholder="e.g. curry, pasta, cake" autocomplete="off" autofocus />
        <button class="icon-btn" id="rsearchBtn" title="Search">🔍</button>
      </div>
      ${scanAvailable() ? `<button class="linklike" id="scanEntry2" style="margin:-4px 2px 10px;font-size:12px;text-align:left">📸 Or scan your fridge — see what you can cook right now</button>` : ""}
      <div id="filterbarWrap"></div>
      <div id="searchResults" class="catalog"></div>
      <p class="attribution" id="attr"></p>
      <div style="height:18px"></div>
    `));
    wireSectionHead();
    { const se = $("#scanEntry2"); if (se) se.onclick = () => screens.scanCamera(); }
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
        <label class="choice toggle" id="tutReplay"><span class="emoji">🎓</span><span style="flex:1">Replay the tutorial<small>The two-minute cook-screen walkthrough — coachmarks and all. Uses your current voice-control setting.</small></span><span class="sw">PLAY</span></label>
        ${FLAG_DUCK_TEST ? `<label class="choice toggle" id="dtEntry"><span class="emoji">🔊</span><span style="flex:1">Duck Test <span class="muted">(dev)</span><small>iOS system-ducking harness — device only. Never in shipped builds.</small></span><span class="sw">RUN</span></label>` : ""}
        <label class="choice toggle" id="stoveSetting"><span class="emoji">${state.equipment.heat === "electric" ? "⚡" : "🔥"}</span><span style="flex:1">Stove type<small>Feeds preheat timing and heat guidance. The pre-cook setup asks this too — same setting.</small></span><span class="sw">${state.equipment.heat ? (state.equipment.heat === "electric" ? "ELECTRIC" : "GAS") : "NOT SET"}</span></label>
        ${isNativeVoice() ? (NATIVE_VOICE_V2 ? `
        <div class="choice" style="display:block;cursor:default">
          <p style="font-weight:700;margin:0 0 6px">🎙️ Voice control</p>
          <div class="am-status">
            <div class="am-row"><span>Backend</span><b>${choppdSpeech() ? "ChoppdSpeech (v2)" : "MISSING — rebuild"}</b></div>
            <div class="am-row"><span>State</span><b>${VoiceCtrl.autoDisabled() ? "PAUSED · " + esc(VoiceCtrl.autoDisableReason()) : (state.prefs.voiceControl ? "ON" : "OFF")}</b></div>
            <div class="am-row"><span>Permissions</span><b id="vcPerm">checking…</b></div>
            <div class="am-row"><span>Engine</span><b id="vcEngine">—</b></div>
          </div>
          <div id="vcTranscript" class="muted" style="font-size:12px;margin:8px 2px 0;min-height:16px"></div>
          <div style="display:flex;gap:8px;margin-top:10px">
            <button class="btn secondary" id="vcToggle" style="flex:1;font-size:13px">${(state.prefs.voiceControl && !VoiceCtrl.autoDisabled()) ? "Turn off" : "Turn on"}</button>
            <button class="btn secondary" id="vcTestMic" style="flex:1;font-size:13px">🎤 Test mic</button>
          </div>
          <p class="muted" style="font-size:11px;margin:8px 2px 0">Say “next”, “back” or “repeat” at checkpoints. The mic only listens at checkpoints while you cook — nothing is recorded or stored.</p>
        </div>` : `<div class="choice" style="display:block;cursor:default"><p style="font-weight:700;margin:0">🎙️ Voice control</p><p class="muted" style="font-size:12px;margin:4px 0 0">Voice is disabled in this build.</p></div>`) : ""}
        ${isNativeVoice() ? "" : `<label class="choice toggle" id="tgVoiceCtrl" style="${VoiceCtrl.supported() ? "" : "opacity:.5;cursor:default"}"><span class="emoji">🎙️</span><span style="flex:1">Voice control <span class="muted" style="font-weight:500">(experimental)</span><small>${VoiceCtrl.supported() ? "Say 'next', 'back' or 'repeat' at checkpoints — after the voice finishes talking. Uses your device's speech recognition — nothing is recorded or stored by Choppd; the mic only listens at checkpoints while you cook." : (isNativeVoice() ? "Voice isn't available in this build — tapping works as always." : "Not supported in this browser — try Safari (iPhone) or Chrome.")}</small></span><span class="sw">${VoiceCtrl.supported() ? (state.prefs.voiceControl ? "ON" : "OFF") : "N/A"}</span></label>
        <label class="choice toggle" id="vcTestRow" style="${VoiceCtrl.supported() && state.prefs.voiceControl ? "" : "opacity:.5;cursor:default"}"><span class="emoji">🧪</span><span style="flex:1">Test voice control<small>${VoiceCtrl.supported() ? (state.prefs.voiceControl ? "Run the practice checkpoint anytime — rehearse \u201cnext\u201d, \u201cback\u201d and \u201crepeat\u201d as often as you like." : "Turn voice control on to test it.") : (isNativeVoice() ? "Voice isn't available in this build." : "Voice control isn't supported in this browser.")}</small></span><span class="sw">${VoiceCtrl.supported() && state.prefs.voiceControl ? "TEST" : "N/A"}</span></label>`}
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
        <button class="choice toggle" id="clearAll" style="color:var(--red)"><span class="emoji">🗑️</span><span style="flex:1">Clear ALL user data</span><span class="sw" style="color:var(--red)">WIPE</span></button>
      </div>

      <div class="mt-auto"></div>

      <div class="danger-zone">
        <button class="btn danger" id="deleteAccount">Delete account</button>
        <p class="muted" style="font-size:11px;margin:8px 2px 0;text-align:center">Permanently deletes your account and all your data. Cannot be undone. Anonymous usage limits may persist to prevent abuse.</p>
      </div>
    `));
    wireSectionHead();
    // THE EYE — device-mode opt-in (hidden): 7 quick taps on the Settings title prompts for the dev
    // log sink URL (a LAN seam server, e.g. http://192.168.1.20:8788/debug/log). Blank clears it.
    // Reload (un)loads the tap. Undiscoverable by accident; prod-safe (prod has no /debug/log route).
    { const hd = app.querySelector("h1"); let taps = 0, last = 0;
      if (hd) hd.onclick = () => {
        const now = Date.now(); taps = (now - last < 800) ? taps + 1 : 1; last = now;
        if (taps < 7) return;
        taps = 0;
        let cur = ""; try { cur = localStorage.getItem("choppd_eye_url") || ""; } catch (e) { }
        const v = prompt("Eye device-mode log sink URL (blank = off):", cur);
        if (v === null) return;
        try { if (v.trim()) localStorage.setItem("choppd_eye_url", v.trim()); else localStorage.removeItem("choppd_eye_url"); } catch (e) { }
        toast(v.trim() ? "Eye device mode ON → reloading" : "Eye device mode OFF → reloading");
        setTimeout(() => location.reload(), 700);
      };
    }
    wireVoicePicker();
    { const dt = $("#dtEntry"); if (dt) dt.onclick = () => screens.duckTest(); }   // FLAG_DUCK_TEST only
    $("#deleteAccount").onclick = () => deleteAccountFlow();
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
    $("#tutReplay").onclick = () => startTutorial(true);
    $("#stoveSetting").onclick = () => {   // tap cycles gas ↔ electric (same field the gate writes)
      state.equipment.heat = state.equipment.heat === "gas" ? "electric" : "gas";
      eggStove = state.equipment.heat;
      saveProfile(); vibrate("tap"); screens.settings();
    };
    const _tvc = $("#tgVoiceCtrl"); if (_tvc) _tvc.onclick = () => {   // absent on native (voice dark, §3)
      if (!VoiceCtrl.supported()) return;   // disabled state — informational only
      state.prefs.voiceControl = !state.prefs.voiceControl;
      state.prefs.voiceCtrlAsked = true;    // enabling/disabling here also settles the ask
      if (!state.prefs.voiceControl) VoiceCtrl.stop();   // kill the mic instantly if mid-toggle
      $("#tgVoiceCtrl .sw").textContent = state.prefs.voiceControl ? "ON" : "OFF";
      saveProfile();
      if (state.prefs.voiceControl) {
        trackEvent("voice_optin_enabled");
        // NATIVE: skip the rehearsal only if it already passed this install (permission still
        // granted); otherwise run it — this tap is the explicit-enable gesture for the OS prompt.
        if (isNativeVoice() && state.prefs.voiceRehearsedOk) { screens.settings(); return; }
        // enable-time test, right here (this tap is the gesture for the mic prompt)
        openVoiceTestSheet(() => screens.settings());   // re-render: the test's "turn it off" path updates both rows
      } else {
        const tr = $("#vcTestRow"); if (tr) screens.settings();   // refresh the test row's disabled state
      }
    };
    // JOB B — the self-diagnosing native Voice row (never blank). Populate live status + wire the toggle
    // + a real Test-mic diagnostic.
    if (isNativeVoice() && NATIVE_VOICE_V2) {
      const CS = choppdSpeech(), CO = choppdAudioCoord();
      // live permissions + engine (non-prompting)
      (async () => {
        try {
          if (CS && CS.checkPermissions) { const p = await CS.checkPermissions(); const el = $("#vcPerm"); if (el) el.textContent = "mic " + (p.microphone || "?") + " · speech " + (p.speechRecognition || "?"); }
          else { const el = $("#vcPerm"); if (el) el.textContent = "plugin missing"; }
          if (CS && CS.status) { const s = await CS.status(); const el = $("#vcEngine"); if (el) el.textContent = (s.engine || "—") + (s.available === false ? " (unavailable)" : ""); }
        } catch (e) { const el = $("#vcPerm"); if (el) el.textContent = "check failed"; }
      })();
      // TURN ON / OFF — re-arms the per-cook auto-disable; rehearsal only if permissions are missing.
      const _tog = $("#vcToggle");
      if (_tog) _tog.onclick = () => {
        if (VoiceCtrl.autoDisabled()) { VoiceCtrl.rearm(); state.prefs.voiceControl = true; state.prefs.voiceCtrlAsked = true; saveProfile(); toast("Voice re-enabled ✓"); screens.settings(); return; }
        const turningOn = !state.prefs.voiceControl;
        state.prefs.voiceControl = turningOn; state.prefs.voiceCtrlAsked = true;
        if (!turningOn) { VoiceCtrl.stop("toggle-off"); saveProfile(); screens.settings(); return; }
        VoiceCtrl.rearm(); trackEvent("voice_optin_enabled");
        if (state.prefs.voiceRehearsedOk) { saveProfile(); toast("Voice on ✓"); screens.settings(); return; }
        saveProfile(); openVoiceTestSheet(() => screens.settings());   // perms missing → rehearsal (OS prompts)
      };
      // 🎤 TEST MIC — opens a REAL listen window right here, shows the live transcript, passes on "next".
      // A 10-second diagnostic without starting a cook (the founder's "test voice in Settings").
      const _tm = $("#vcTestMic");
      if (_tm) _tm.onclick = async () => {
        const tr = $("#vcTranscript");
        if (!CS) { if (tr) tr.textContent = "❌ ChoppdSpeech plugin MISSING — git pull → cap sync → Debug build."; return; }
        if (tr) tr.textContent = "Requesting mic…";
        try {
          const perm = await CS.requestPermissions();
          if (perm.speechRecognition !== "granted" || (perm.microphone && perm.microphone !== "granted")) {
            if (tr) tr.textContent = "❌ Permission needed — speech " + perm.speechRecognition + " · mic " + (perm.microphone || "?") + " (enable in iOS Settings).";
            return;
          }
          let passed = false, done = false;
          const finish = (msg) => { if (done) return; done = true; try { CS.stop(); } catch (e) { } try { CS.removeAllListeners(); } catch (e) { } if (CO) { try { CO.setMode({ mode: "playback" }); } catch (e) { } } if (tr && msg) tr.textContent = msg; };
          await CS.removeAllListeners();
          await CS.addListener("partialResults", (d) => {
            const t = (d && d.matches && d.matches[0]) || "";
            if (tr && !passed) tr.textContent = "🎤 " + (t || "…");
            if (!passed && matchVoiceCommand(t) === "advance") { passed = true; finish("✅ Heard “next” — voice works!"); }
          });
          await CS.addListener("error", (d) => { if (!passed) finish("⚠️ " + ((d && d.message) || "recognizer error") + " — tap Test mic to retry."); });
          if (CO) { try { await CO.setMode({ mode: "listen" }); } catch (e) { } }
          await CS.start({ language: "en-US", partialResults: true });
          if (tr) tr.textContent = "🎤 Listening — say “next”…";
          setTimeout(() => finish(passed ? null : "⏱ Didn't catch it — tap Test mic to try again."), 10000);
        } catch (e) { if (tr) tr.textContent = "❌ " + (e && (e.message || e)); }
      };
    }
    { const tr = $("#vcTestRow"); if (tr) tr.onclick = () => {
      if (!VoiceCtrl.supported() || !state.prefs.voiceControl) return;   // grayed — informational only
      openVoiceTestSheet(() => screens.settings());
    }; }
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
      a.download = `choppd-sessions-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast("Downloaded JSON ✓");
    };
    $("#clearLog").onclick = () => { Telemetry.clear(); toast("Log cleared"); screens.sessionLog(); };
  };

  // ── DUCK TEST (dev-only, FLAG_DUCK_TEST) — iOS system-ducking harness. Runs the §5 runway per cue:
  // configureSession → activate → preRoll → playVoice (NATIVE, required) → voiceEnd → postRoll →
  // deactivate. YT-WebView source = the real target; hosted-control source = the measurable RMS
  // baseline. All labels dev-internal. Unreachable in prod (FLAG_DUCK_TEST false + plugin #if DEBUG).
  const _dtBeepB64 = () => {
    // a self-contained 900ms sine "voice" (WAV) so the harness runs without depending on a bundled
    // clip. Swap a real Kokoro clip via the URL field for the by-ear "voice over ducked bed" judgment.
    const sr = 22050, dur = 0.9, n = Math.floor(sr * dur), bytes = 44 + n * 2, buf = new ArrayBuffer(bytes), v = new DataView(buf);
    const wr = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    wr(0, "RIFF"); v.setUint32(4, bytes - 8, true); wr(8, "WAVE"); wr(12, "fmt "); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true); wr(36, "data"); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) { const s = Math.sin(2 * Math.PI * 440 * i / sr) * 0.7 * Math.min(1, i / 1000, (n - i) / 1000); v.setInt16(44 + i * 2, s * 32767, true); }
    let bin = ""; const u8 = new Uint8Array(buf); for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]); return btoa(bin);
  };
  const _dtToB64 = async (url) => { const r = await fetch(url); const b = await r.blob(); return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(",")[1]); fr.onerror = rej; fr.readAsDataURL(b); }); };
  screens.duckTest = () => {
    // harness version marker — bump on every screen change so a STALE build is self-diagnosing
    // (compare against what the report says). If the plugin call below rejects/absents, the founder's
    // build didn't pull this file / the pbxproj / the DEBUG condition.
    const DT_HARNESS = "harness v5 (+ VR rows)";
    const DT = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.DuckTest;
    h(screenEl("", `
      ${sectionHead("🔊 Duck Test (dev)")}
      <p style="font-size:12px;margin:6px 0"><b>${DT_HARNESS}</b> · plugin <b id="dtStatus" style="color:${DT ? "#5f5" : "#f66"}">${DT ? "probing…" : "MISSING (git pull → cap sync → Debug build)"}</b></p>
      <div class="stack" style="gap:8px;font-size:13px">
        <label class="choice toggle"><span style="flex:1">Music source</span><select id="dtSource"><option value="webview">WebView local track (the spine)</option><option value="applemusic">Apple Music (ChoppdMusic)</option><option value="control">Hosted control (measurable)</option></select></label>
        <div style="background:#161620;border-radius:8px;padding:8px">
          <p style="font-size:11px;margin:0 0 6px;color:#8fe"><b>NATIVE VOICE v2 · VR rows</b> — start a source above, then open a mic window and LISTEN: does the music survive?</p>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            <button class="btn secondary" id="dtVrMix" style="flex:1;min-width:130px;font-size:12px">🎤 VR-1/2 window · mix</button>
            <button class="btn secondary" id="dtVrDuckMix" style="flex:1;min-width:130px;font-size:12px">🎤 VR-3 window · duck+mix</button>
            <button class="btn secondary" id="dtVrStop" style="flex:1;min-width:130px;font-size:12px">⏹ Close mic window</button>
          </div>
          <p style="font-size:10px;margin:6px 0 0;color:#889">Orange mic dot is expected. PASS = music alive (full or ducked). FAIL = music silent.</p>
        </div>
        <div id="dtYtSlot" style="height:0;overflow:hidden"></div>
        <input id="dtCtrlUrl" placeholder="control mp3 URL (Hosted control source)" style="width:100%;padding:8px">
        <input id="dtVoiceUrl" placeholder="voice clip URL (blank = built-in 900ms tone)" style="width:100%;padding:8px">
        <div style="display:flex;gap:8px"><button class="btn secondary" id="dtStartMusic" style="flex:1">▶ Start music</button><button class="btn secondary" id="dtStopMusic" style="flex:1">⏹ Stop</button></div>
        <label class="choice toggle"><span style="flex:1">Session mode</span><select id="dtMode"><option value="playback">.playback</option><option value="playAndRecord">.playAndRecord</option></select></label>
        <label class="choice toggle"><span style="flex:1">Mode hint</span><select id="dtHint"><option value="voicePrompt">.voicePrompt</option><option value="default">.default</option><option value="spokenAudio">.spokenAudio</option></select></label>
        <div style="display:flex;flex-wrap:wrap;gap:10px">Options: <label><input type="checkbox" id="dtDuck" checked> duckOthers</label><label><input type="checkbox" id="dtMix"> mixWithOthers</label><label><input type="checkbox" id="dtInt"> interruptSpoken…</label><label><input type="checkbox" id="dtBt"> allowBluetooth</label></div>
        <label><input type="checkbox" id="dtNoSess"> NO SESSION — row 5 negative control (fire voice with no configure/activate; music must NOT duck)</label>
        <div>Pre-roll <input type="range" id="dtPre" min="0" max="500" value="200"><span id="dtPreV">200</span> ms</div>
        <div>Post-roll <input type="range" id="dtPost" min="0" max="800" value="400"><span id="dtPostV">400</span> ms</div>
        <div>Voice vol <input type="range" id="dtVol" min="0" max="100" value="100"><span id="dtVolV">100</span></div>
        <button class="btn" id="dtFire">🎤 Fire voice cue (runs the runway)</button>
        <pre id="dtLog" style="height:200px;overflow:auto;font-size:10px;background:#0d0d12;color:#8fe;padding:8px;border-radius:8px;white-space:pre-wrap"></pre>
      </div>`));
    wireSectionHead();
    const logEl = $("#dtLog");
    // logLine → panel AND console.log (so The Eye captures the whole story in a sim/device run)
    const logLine = (s) => { try { logEl.textContent += s + "\n"; logEl.scrollTop = logEl.scrollHeight; } catch (e) { } try { console.log("[DT] " + s); } catch (e) { } };
    ["Pre", "Post", "Vol"].forEach((k) => { const s = $("#dt" + k), o = $("#dt" + k + "V"); if (s) s.oninput = () => { o.textContent = s.value; }; });
    logLine(DT_HARNESS + " mounted");
    // mount PROBE: prove the plugin actually responds (not just present as an object)
    (async () => {
      if (!DT) { logLine("plugin: MISSING — the DuckTest class isn't in this build. git pull → npx cap sync ios → build DEBUG (not Release)."); return; }
      try { const r = await DT.effectiveSession(); const st = $("#dtStatus"); if (st) { st.textContent = "registered ✓"; st.style.color = "#5f5"; } logLine("plugin: registered ✓ · effective " + (r && r.effective)); }
      catch (e) { const st = $("#dtStatus"); if (st) { st.textContent = "present but ERRORED"; st.style.color = "#fa0"; } logLine("plugin probe FAILED verbatim: " + (e && (e.message || e))); }
    })();
    if (DT) {
      DT.addListener("log", (e) => logLine(e.line));
      DT.addListener("voiceStart", (e) => logLine("· voiceStart t=" + Math.round(e.t) + " dur=" + (e.duration || 0).toFixed(2) + "s"));
      DT.addListener("voiceEnd", (e) => logLine("· voiceEnd t=" + Math.round(e.t)));
      DT.addListener("rms", (e) => logLine("  RMS " + e.db.toFixed(1) + " dB"));
    }
    // ALL handlers wired UNCONDITIONALLY — a missing plugin must log loudly, never do nothing.
    $("#dtStartMusic").onclick = async () => {
      const src = $("#dtSource").value;
      logLine("START MUSIC pressed (source=" + src + ")");
      if (src === "webview") {
        // the actual WebView local track (the launch spine) through the WebAudio graph
        try { Music.initGraph(); Music.setSrc("audio/eggs-music.mp3"); Music.rate(1); Music.play(); logLine("WebView local track playing (eggs-music.mp3)"); } catch (e) { logLine("webview track FAILED: " + (e && (e.message || e))); }
      } else if (src === "applemusic") {
        // Apple Music via ChoppdMusic (VR-2's different audio pipe)
        try {
          logLine("AM: searching…"); const r = await window.AppleMusic_.search("here comes the sun");
          if (!r.length) { logLine("AM: no results (real token needed — .p8 placed?)"); return; }
          const qr = await window.AppleMusic_.queue([r[0].id]); logLine("AM queue: " + JSON.stringify(qr));
          const pr = await window.AppleMusic_.play(); logLine("AM play: " + JSON.stringify(pr) + " — " + r[0].label);
        } catch (e) { logLine("AM FAILED verbatim: " + (e && (e.message || e))); }
      } else {
        if (!DT) { logLine("control needs the plugin — MISSING."); return; }
        const url = $("#dtCtrlUrl").value.trim(); if (!url) { logLine("paste a control mp3 URL first"); return; }
        try { logLine("fetching control " + url + "…"); const b64 = await _dtToB64(url); await DT.startControlMusic({ base64: b64 }); logLine("control started"); } catch (e) { logLine("control FAILED verbatim: " + (e && (e.message || e))); }
      }
    };
    $("#dtStopMusic").onclick = () => { logLine("STOP pressed"); try { Music.stop(); } catch (e) { } try { if (DT) DT.stopControlMusic(); } catch (e) { } try { if (window.AppleMusic_) window.AppleMusic_.stop(); } catch (e) { } };
    // ── VR ROWS (native-voice-v2 §1): open a REAL mic window over whatever source is playing ──
    const vrStart = async (variant) => {
      logLine("── VR window (" + variant + ") — LISTEN: does the music survive? ──");
      if (!DT) { logLine("ABORT: DuckTest plugin MISSING."); return; }
      try { const r = await DT.startRecordWindow({ options: variant }); logLine("VR window ON · " + (r && r.effective) + " · otherAudioPlaying=" + (r && r.otherAudioPlaying)); }
      catch (e) { logLine("VR window FAILED verbatim: " + (e && (e.message || e))); }
    };
    $("#dtVrMix").onclick = () => vrStart("mix");
    $("#dtVrDuckMix").onclick = () => vrStart("duckmix");
    $("#dtVrStop").onclick = async () => { logLine("── VR window CLOSE — music should recover ──"); try { if (DT) await DT.stopRecordWindow(); logLine("VR window OFF"); } catch (e) { logLine("VR close FAILED: " + (e && (e.message || e))); } };
    $("#dtFire").onclick = async () => {
      logLine("── FIRE pressed ──");   // ALWAYS line one, before anything can fail
      if (!DT) { logLine("ABORT: DuckTest plugin MISSING — nothing to fire. Rebuild with the plugin (see status line)."); return; }
      try {
        const opts = []; if ($("#dtDuck").checked) opts.push("duckOthers"); if ($("#dtMix").checked) opts.push("mixWithOthers"); if ($("#dtInt").checked) opts.push("interruptSpokenAudioAndMixWithOthers"); if ($("#dtBt").checked) opts.push("allowBluetooth");
        const preRoll = +$("#dtPre").value, postRoll = +$("#dtPost").value, vol = +$("#dtVol").value / 100;
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const noSess = $("#dtNoSess").checked;   // row 5: negative control — no session at all
        if (!noSess) {
          const cfg = await DT.configureSession({ category: $("#dtMode").value, mode: $("#dtHint").value, options: opts });
          logLine("configured → " + (cfg && cfg.effective));
          const act = await DT.activate();
          logLine("→ ACTIVATED t=" + Math.round(act && act.t) + " effective " + (act && act.effective) + "; preRoll " + preRoll + "ms (music should be ducking)");
          await wait(preRoll);
        } else { logLine("→ NO SESSION (neg. control) — firing voice raw; music must NOT duck"); }
        const vUrl = $("#dtVoiceUrl").value.trim();
        logLine("preparing voice (" + (vUrl ? "url" : "built-in 900ms tone") + ")…");
        const b64 = vUrl ? await _dtToB64(vUrl) : _dtBeepB64();
        // voiceEnd OR a 6s safety timeout (never hang). addListener may return a handle OR a Promise
        // depending on the bridge — don't chain .then (that broke the cycle in v3); fire-and-forget.
        const ended = new Promise((res) => {
          let done = false; const fin = () => { if (!done) { done = true; res(); } };
          try { DT.addListener("voiceEnd", fin); } catch (e) { }
          setTimeout(fin, 6000);
        });
        const pv = await DT.playVoice({ base64: b64, volume: vol });
        logLine("playVoice returned ok=" + (pv && pv.ok) + " dur=" + (pv && pv.duration));
        await ended;
        if (!noSess) { logLine("→ voice ended; postRoll " + postRoll + "ms"); await wait(postRoll); await DT.deactivate(); logLine("→ DEACTIVATED · cycle complete\n"); }
        else { logLine("→ voice ended · cycle complete (no session)\n"); }
      } catch (e) { logLine("CYCLE FAILED verbatim: " + (e && (e.message || e))); }
    };
  };

  // boot
  (async () => {
    let returned = false;
    if (window.Spotify_) { try { returned = await Spotify_.handleRedirect(); } catch (e) { } }
    loadEnt();
    // Connect to the backend; if we already hold a token, hydrate the account.
    let hydrated = false;
    if (window.API) {
      try {
        await API.init();
        if (API.online && API.isLoggedIn()) { const { user } = await API.me(); applyServerUser(user); hydrated = !!(user && user.experience); Resume.fetchActive().catch(() => { }); }   // COOK RESUME: prime the active-cook cache (non-blocking)
        // Log one app-open per browser session (monthly active users — even anonymous).
        if (API.online && !sessionStorage.getItem("seartune_visited")) {
          sessionStorage.setItem("seartune_visited", "1");
          let vid = localStorage.getItem("seartune_visitor");
          if (!vid) { vid = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()); localStorage.setItem("seartune_visitor", vid); }
          API.visit(vid).catch(() => { });
        }
      } catch (e) { }
    }
    if (returned && isPremium()) { state.musicPlatform = "spotify"; state.spotifyConnected = true; saveEnt(); Spotify_.loadSdk(); }
    Sidebar.mount();
    if (returned) screens.premium();
    else if (hydrated) screens.home();           // logged-in returning account
    else screens.welcome();
    // one-shot notice after an account deletion (set just before the wiping reload)
    try { if (sessionStorage.getItem("seartune_deleted_notice")) { sessionStorage.removeItem("seartune_deleted_notice"); toast("Your account was deleted"); } } catch (e) { }
  })();
})();
