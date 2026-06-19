/* ============================================================
   SearTune MVP — front-end demo of the core loop.
   Backend (Cognito/Spotify/RDS) is mocked; the cook engine is real.
   ============================================================ */
(function () {
  "use strict";

  const app = document.getElementById("app");
  const EXP = window.FREEBIRD_STEAK;

  // ---- session state (would live server-side / in secure storage) ----
  const state = {
    email: "",
    isBeginner: null,        // derived from `experience` for cook-session verbosity
    experience: null,        // one of EXPERIENCE_LEVELS ids
    equipment: { pan: null, heat: null },
    spotifyConnected: false,
    tier: "free",
    prefs: { voice: true, haptics: true, theme: "dark", speed: 8, voiceURI: null, engine: "webspeech", kokoroVoice: "af_heart" }, // speed = demo multiplier
    streak: 0,
  };

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

  // ---- tiny helpers ----
  const h = (html) => { app.innerHTML = ""; const w = document.createElement("div"); w.innerHTML = html; while (w.firstChild) app.appendChild(w.firstChild); };
  const $ = (sel) => app.querySelector(sel);
  const $$ = (sel) => Array.from(app.querySelectorAll(sel));
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const screenEl = (cls, inner) => `<section class="screen ${cls} fade">${inner}</section>`;

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

  // ---- music engine ----
  // Plays a real audio file the user supplies (we can't ship the copyrighted
  // track). The cook clock is driven by audio.currentTime — same model the
  // production app uses with the Spotify Premium SDK's playback position.
  const Music = {
    el: null,
    loaded: false,
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
    play() { if (this.el) this.el.play().catch(() => { }); },
    pause() { if (this.el) this.el.pause(); },
    stop() { if (this.el) { this.el.pause(); try { this.el.currentTime = 0; } catch (e) { } } },
    seek(t) { if (this.el) try { this.el.currentTime = t; } catch (e) { } },
    rate(r) {
      if (!this.el) return;
      this.el.preservesPitch = this.el.mozPreservesPitch = this.el.webkitPreservesPitch = true;
      this.el.playbackRate = Math.max(0.5, Math.min(r, 4)); // keep music listenable
    },
    pos() { return this.el ? this.el.currentTime : 0; },
    bg: false,                                        // background mode (during doneness checks)
    duck() { if (this.el) this.el.volume = this.bg ? 0.12 : 0.22; },  // under the voice
    unduck() { if (this.el) this.el.volume = this.bg ? 0.40 : 1; },   // background vs full
    background(on) { this.bg = on; this.unduck(); },  // keep playing, just quieter
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
    if (!html) html = `<option value="">System default</option>`; // last resort (e.g. Safari w/o Kokoro)
    sel.innerHTML = html;

    // sensible default now that generic system voices are gone
    if (state.prefs.engine === "webspeech" && !state.prefs.voiceURI) {
      if (googles.length) state.prefs.voiceURI = googles[0].voiceURI;
      else if (window.Kokoro) { state.prefs.engine = "kokoro"; }
    }
    sel.value = state.prefs.engine === "kokoro" ? "kokoro:" + state.prefs.kokoroVoice : (state.prefs.voiceURI || "");

    const hint = app.querySelector("#voiceHint");
    if (hint && !hint.textContent) hint.textContent = window.Kokoro
      ? "✨ Kokoro = most natural (downloads once, runs on-device). Google voices are instant & free."
      : "Pick a Google voice — instant and free in Chrome/Edge.";
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
        <p class="section-title" style="margin:0 0 8px">🎵 Song · Free Bird</p>
        <div class="vp-row">
          <div style="flex:1" id="musicStatus"></div>
          <button class="icon-btn" id="songPrev" title="Preview 6s">▶</button>
        </div>
        <label class="btn secondary" style="margin-top:10px;display:flex;align-items:center;justify-content:center">
          <span id="songBtnLabel">Load your Free Bird file (.mp3)</span>
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
    if (lbl) lbl.textContent = Music.loaded ? "Replace song file" : "Load your Free Bird file (.mp3)";
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
        <div class="hero-emoji">🔥🎸</div>
        <p class="brand gradient-text" style="margin-top:18px">SearTune</p>
        <h1 style="margin-top:10px">Learn to cook<br>to the <span class="gradient-text">music</span>.</h1>
        <p class="lead" style="margin-top:14px">No experience needed. Press play, follow the cues, and cook your first real meal — in rhythm.</p>
      </div>
      <div class="mt-auto" style="margin-top:34px">
        <button class="btn" id="go">Get started</button>
        <button class="btn ghost" id="signin" style="margin-top:8px">I already have an account</button>
      </div>
    `));
    $("#go").onclick = () => screens.login();
    $("#signin").onclick = () => screens.login();
  };

  // ---- Email login (Cognito OTP — mocked) ----
  screens.login = () => {
    h(screenEl("", `
      <p class="eyebrow">Step 1 · Sign in</p>
      <h1 style="margin-top:10px">What's your email?</h1>
      <p class="lead" style="margin-top:10px">We'll send a 6-digit code. No passwords, ever.</p>
      <div class="stack" style="margin-top:24px">
        <input class="field" id="email" type="email" placeholder="you@email.com" autocomplete="email" />
        <button class="btn" id="send">Send code</button>
      </div>
      <p class="muted" style="font-size:12px;margin-top:14px">Demo: any email works, code is pre-filled.</p>
    `));
    $("#send").onclick = () => {
      const v = $("#email").value.trim();
      if (!v || !v.includes("@")) { toast("Enter a valid email"); return; }
      state.email = v;
      screens.otp();
    };
  };

  screens.otp = () => {
    h(screenEl("", `
      <p class="eyebrow">Step 1 · Verify</p>
      <h1 style="margin-top:10px">Enter your code</h1>
      <p class="lead" style="margin-top:10px">Sent to <b style="color:var(--text)">${state.email}</b></p>
      <div class="stack" style="margin-top:24px">
        <input class="field" id="code" inputmode="numeric" maxlength="6" value="481516"
          style="letter-spacing:10px;text-align:center;font-size:24px;font-weight:700" />
        <button class="btn" id="verify">Verify & continue</button>
        <button class="btn ghost" id="back">Use a different email</button>
      </div>
    `));
    $("#verify").onclick = () => screens.disclaimer();
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
      <p class="section-title" style="margin-top:18px">Pan</p>
      <div class="stack" data-group="pan">
        <button class="choice" data-v="cast-iron"><span class="emoji">🍳</span> Cast iron</button>
        <button class="choice" data-v="stainless"><span class="emoji">🪙</span> Stainless steel</button>
        <button class="choice" data-v="nonstick"><span class="emoji">⚫️</span> Non-stick</button>
      </div>
      <p class="section-title">Heat</p>
      <div class="stack" data-group="heat">
        <button class="choice" data-v="gas"><span class="emoji">🔥</span> Gas</button>
        <button class="choice" data-v="electric"><span class="emoji">♨️</span> Electric / induction</button>
      </div>
      <div class="mt-auto" style="margin-top:20px">
        <button class="btn" id="next" disabled>Continue</button>
      </div>
    `));
    const check = () => $("#next").disabled = !(state.equipment.pan && state.equipment.heat);
    $$("[data-group] .choice").forEach((c) => c.onclick = () => {
      const group = c.parentElement.dataset.group;
      c.parentElement.querySelectorAll(".choice").forEach((x) => x.classList.remove("selected"));
      c.classList.add("selected");
      state.equipment[group] = c.dataset.v;
      check();
    });
    $("#next").onclick = () => screens.connect();
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
    $("#spotify").onclick = () => { state.spotifyConnected = true; toast("Spotify connected ✓"); setTimeout(screens.home, 350); };
    $("#skip").onclick = () => screens.home();
  };

  // ---- Home ----
  screens.home = () => {
    const name = state.email ? state.email[0].toUpperCase() : "S";
    h(screenEl("", `
      <div class="topbar">
        <div style="display:flex;align-items:center;gap:12px">
          <button class="icon-btn" id="hamburger" aria-label="Open menu" aria-haspopup="true">☰</button>
          <div>
            <p class="muted" style="font-size:13px">${greeting()}</p>
            <p class="brand gradient-text">SearTune</p>
          </div>
        </div>
        <div class="avatar">${name}</div>
      </div>

      <p class="lead">${state.isBeginner ? "First cook? Let's make it a good one." : "Pick tonight's vibe."}</p>

      <p class="section-title">Tonight's cook</p>
      <div class="exp-card" id="featured">
        <div class="glow"></div>
        <div class="big-emoji">${EXP.recipe.emoji}</div>
        <span class="pill free" style="position:relative;align-self:flex-start">★ FREE</span>
        <h2 style="margin-top:auto">${EXP.recipe.title}</h2>
        <p class="song">🎸 ${EXP.song.title} · ${EXP.song.artist}</p>
        <div class="row">
          <span class="pill">⏱ ~8 min</span>
          <span class="pill">${EXP.recipe.technique}</span>
          <span class="pill">🟢 Beginner-proof</span>
        </div>
      </div>
      <p class="muted" style="font-size:12px;margin-top:8px">🔥 1,204 people cooked this · 4.8★</p>

      <p class="section-title">Unlock with Premium</p>
      <div class="exp-card locked">
        <div class="big-emoji">🍝</div>
        <span class="pill premium" style="position:relative;align-self:flex-start">🔒 PREMIUM</span>
        <h2 style="margin-top:auto">Cook anything to <i>your</i> playlist</h2>
        <p class="song">Needs SearTune Premium + Spotify Premium</p>
      </div>

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

      <div class="ad"><p>FREE TIER · <b>ad placement</b> · upgrade to remove ads</p></div>
      <p class="attribution" id="attr"></p>
      <div style="height:18px"></div>
    `));
    $("#featured").onclick = () => screens.prep();
    $("#hamburger").onclick = () => Sidebar.open();
    Sidebar.setActive("home");
    renderEasyPicks();

    // live search across all of TheMealDB
    const si = app.querySelector("#rsearch"), sb = app.querySelector("#rsearchBtn");
    const run = () => doSearch(si.value.trim());
    if (sb) sb.onclick = run;
    if (si) si.onkeydown = (e) => { if (e.key === "Enter") run(); };
  };

  function greeting() {
    const hr = new Date().getHours();
    return hr < 12 ? "Good morning 👋" : hr < 18 ? "Good afternoon 👋" : "Good evening 👋";
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

  // ---- Recipe detail ----
  screens.recipeDetail = (r) => {
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
        ${r.ingredients.map((i) => `<li><span>${i.name}${i.optional ? ` <em class="opt">(optional but recommended)</em>` : ""}</span><span class="muted">${i.measure || ""}</span></li>`).join("")}
      </ul></div>

      <p class="muted" style="font-size:11px;margin-top:14px">${(CATALOG && CATALOG.attribution) || ""}${r.sourceUrl ? ` · <a href="${r.sourceUrl}" target="_blank" style="color:var(--flame-2)">source</a>` : ""}${r.youtube ? ` · <a href="${r.youtube}" target="_blank" style="color:var(--flame-2)">video</a>` : ""}</p>

      <p class="section-title">Cooking voice</p>
      ${voicePickerHTML()}

      <div class="mt-auto" style="margin-top:18px">
        <p class="muted" style="font-size:12px;text-align:center;margin-bottom:10px">Guided mode: tap through steps. Doneness steps need a safe-temp check before you continue.</p>
        <button class="btn" id="cook">▶ Start guided cook</button>
      </div>
    `));
    $("#back").onclick = () => screens.home();
    wireVoicePicker();
    if (isKokoro()) ensureKokoroLoaded();
    $("#cook").onclick = () => screens.guidedCook(r);
  };

  // ---- Guided cook (tap-through; conservative timing + safety gates) ----
  screens.guidedCook = (r) => {
    let idx = 0;
    let timer = null, remain = 0;

    function render() {
      const step = r.steps[idx];
      const isDone = !!step.gate;
      const total = r.steps.length;
      h(`<section class="cook fade" id="gcook">
        <div class="cook-top">
          <button class="icon-btn" id="gquit" title="Quit">✕</button>
          <div class="now-playing"><b>${r.emoji} ${r.title}</b></div>
          <button class="icon-btn ${state.prefs.voice ? "" : "off"}" id="gvoice" title="Voice">🔊</button>
        </div>

        <div class="gprogress"><div class="gfill" style="width:${(idx / total) * 100}%"></div></div>
        <p class="muted" style="text-align:center;font-size:12px;margin:8px 0 0">Step ${idx + 1} of ${total} · guide ${step.guide}</p>

        <div class="stepcard ${isDone ? "" : ""}" id="gstepcard" style="margin:14px 20px 0">
          <span class="pill type ${isDone ? "temp" : "action"}">${isDone ? "DONENESS CHECK" : step.active ? "DO THIS" : "WAIT"}</span>
          <div class="ring-wrap" style="padding:10px 0 0">
            <div class="ring-label" style="position:static">
              <div class="cd" id="gcd" style="font-size:34px">${fmtClock(step.timing.typicalSec)}</div>
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

      speak(step.text + (isDone ? " " + step.gate.prompt : ""));
      startTimer(step.timing.typicalSec);

      $("#gquit").onclick = () => { stopTimer(); stopVoice(); screens.recipeDetail(r); };
      $("#gvoice").onclick = (e) => {
        state.prefs.voice = !state.prefs.voice;
        e.currentTarget.classList.toggle("off", !state.prefs.voice);
        if (!state.prefs.voice) stopVoice();
      };
      $("#gnext").onclick = () => advance();
      const wait = $("#gwait"); if (wait) wait.onclick = () => { vibrate("tap"); speak(step.gate.notReadyCoach); toast("Take your time ⏳"); startTimer(60); };
      const back = $("#gback"); if (back) back.onclick = () => { idx = Math.max(0, idx - 1); render(); };
    }

    function advance() {
      stopTimer(); vibrate("tap");
      if (idx >= r.steps.length - 1) { stopVoice(); screens.guidedFinish(r); return; }
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
    const save = wireFeedback(r.title);
    $("#again").onclick = () => { save(); screens.guidedCook(r); };
    $("#more").onclick = () => { save(); screens.home(); };
    $("#home").onclick = () => { save(); screens.home(); };
  };

  // ---- Prep checklist ----
  screens.prep = () => {
    h(screenEl("", `
      <button class="btn ghost" id="back" style="width:auto;align-self:flex-start;padding-left:0">← Back</button>
      <p class="eyebrow">${EXP.song.title} · ${EXP.recipe.title}</p>
      <h1 style="margin-top:8px">Before we press<br>play 🥩</h1>
      <p class="lead" style="margin-top:10px">Get these ready. Tap each as you go.</p>
      <div class="stack" style="margin-top:18px" id="prep">
        ${EXP.prep.map((p, i) => `<label class="choice" data-i="${i}"><span class="emoji">⬜️</span><span>${p}</span></label>`).join("")}
      </div>
      <div style="margin-top:20px">${musicPickerHTML()}</div>
      <div style="margin-top:14px">${voicePickerHTML()}</div>
      <div class="mt-auto" style="margin-top:18px">
        <p class="muted" style="font-size:12px;text-align:center;margin-bottom:10px">Cues sync to the song. Voice & haptics on — adjust anytime.</p>
        <button class="btn" id="start">▶ Start cooking to Free Bird</button>
      </div>
    `));
    $("#back").onclick = () => screens.home();
    $$("#prep .choice").forEach((c) => c.onclick = () => {
      c.classList.toggle("selected");
      c.querySelector(".emoji").textContent = c.classList.contains("selected") ? "✅" : "⬜️";
    });
    wireMusicPicker();
    wireVoicePicker();
    if (isKokoro()) pregenKokoro(); // warm up the model + cache cue lines while they prep
    $("#start").onclick = () => screens.cook();
  };

  // ============================================================
  // COOK SESSION — the hero
  // ============================================================
  screens.cook = () => {
    const cues = EXP.cues;
    const R = 92, C = 2 * Math.PI * R;
    // real audio plays in real time — don't run it at demo speed
    if (Music.loaded && state.prefs.speed > 2) state.prefs.speed = 1;

    h(`<section class="cook fade" id="cook">
      <div class="cook-top">
        <div class="now-playing">
          <span class="eq"><i></i><i></i><i></i><i></i></span>
          <span><b>${EXP.song.title}</b><br><span class="muted">${EXP.song.artist}${Music.loaded ? "" : " · demo"}</span></span>
        </div>
        <div class="cook-icons">
          <button class="icon-btn ${state.prefs.voice ? "" : "off"}" id="tVoice" title="Voice">🔊</button>
          <button class="icon-btn ${state.prefs.haptics ? "" : "off"}" id="tHaptic" title="Haptics">📳</button>
          <button class="icon-btn" id="tSpeed" title="Demo speed">${state.prefs.speed}×</button>
        </div>
      </div>

      <div class="ring-wrap">
        <svg class="ring" width="220" height="220" viewBox="0 0 220 220">
          <defs><linearGradient id="flameGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#ff6b35"/><stop offset="1" stop-color="#c44dff"/></linearGradient></defs>
          <circle class="track" cx="110" cy="110" r="${R}" fill="none" stroke-width="10"/>
          <circle class="prog" id="ring" cx="110" cy="110" r="${R}" fill="none" stroke-width="10"
            stroke-dasharray="${C}" stroke-dashoffset="${C}"/>
        </svg>
        <div class="ring-label">
          <div class="next" id="nextLabel">NEXT STEP</div>
          <div class="cd" id="cd">--</div>
        </div>
      </div>

      <div class="stepcard" id="stepcard">
        <span class="pill type prep" id="stepType">GET READY</span>
        <h2 id="stepTitle">Press play and let's cook</h2>
        <p id="stepBody">Your first cue lands in a moment. Keep the phone where you can see it.</p>
        <div class="beginner-tag" id="beginnerTag" style="${state.isBeginner ? "" : "display:none"}">🌱 Beginner mode: extra guidance on</div>
        <div class="gate-actions" id="gateActions" hidden></div>
      </div>

      <div class="timeline">
        <div class="tl-track">
          <div class="tl-fill" id="tlFill"></div>
          ${cues.map((c) => `<div class="tl-mark ${c.type === "flip" ? "flip" : ""}" data-at="${c.at}" style="left:${(c.at / EXP.durationSec) * 100}%"></div>`).join("")}
        </div>
        <div class="tl-times"><span id="tElapsed">0:00</span><span>${fmt(EXP.durationSec)}</span></div>
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
    let waiting = false;         // PHASE A: parked on a confirm gate, waiting for the cook
    let nudgeTimer = null;
    let parkPos = 0;             // cook position parked during a doneness check
    let raf = null;
    let fired = new Set();
    let nextIdx = 0;

    const cookEl = $("#cook");

    // ---- PHASE A: gate handling (cues wait for readiness) ----
    function clearNudge() { if (nudgeTimer) { clearTimeout(nudgeTimer); nudgeTimer = null; } }

    function enterWait(cue) {
      waiting = true;
      parkPos = songPos;                        // remember where the cook is
      $("#stepcard").classList.add("waiting");
      Music.background(true);                   // keep the song PLAYING, ducked to background
      $("#pause").disabled = true;              // pause is meaningless while held
      const g = $("#gateActions");
      g.hidden = false;
      g.innerHTML =
        `<button class="btn" id="gDone">✅ ${cue.gate.doneLabel || "Done — next"}</button>` +
        `<button class="btn secondary" id="gWait">⏳ Not yet</button>`;
      $("#gDone").onclick = () => exitWait(cue);
      $("#gWait").onclick = () => notReady(cue);
      if (cue.gate.nudgeSec) scheduleNudge(cue, cue.gate.nudgeSec);
    }

    function notReady(cue) {
      toast("Take your time ⏳");
      speak(cue.gate.notReadyCoach || "No rush. Give it a little longer, then check again.");
      if (cue.gate.nudgeSec) scheduleNudge(cue, cue.gate.nudgeSec);
    }

    function scheduleNudge(cue, sec) {
      clearNudge();
      nudgeTimer = setTimeout(() => {
        if (waiting) { speak(cue.gate.checkCoach || "Ready? Tap done when you are."); }
      }, sec * 1000);
    }

    function exitWait(cue) {
      clearNudge();
      waiting = false;
      $("#stepcard").classList.remove("waiting");
      const g = $("#gateActions"); g.hidden = true; g.innerHTML = "";
      $("#pause").disabled = false;
      Music.background(false);                  // back to full volume
      if (Music.loaded) { Music.seek(parkPos); if (!paused) Music.play(); }  // re-align song to the cook clock
      lastTs = performance.now();
      speak(cue.gate.doneCoach || "Nice.");
    }

    function applyCue(cue, idx) {
      const body = (state.isBeginner && cue.beginner) ? cue.beginner : cue.body;
      $("#stepType").className = "pill type " + cue.type;
      $("#stepType").textContent = cue.type.toUpperCase();
      $("#stepTitle").textContent = cue.title;
      $("#stepBody").textContent = body;
      const sc = $("#stepcard");
      sc.classList.remove("flash"); void sc.offsetWidth; sc.classList.add("flash");
      vibrate(cue.haptic);
      speak(cue.voice);
      const mark = app.querySelector(`.tl-mark[data-at="${cue.at}"]`);
      if (mark) mark.classList.add("done");
      if (cue.haptic && !navigator.vibrate) toast("📳 buzz");
      if (cue.type === "finish") finish();
    }

    function loop(now) {
      const dt = (now - lastTs) / 1000; lastTs = now;
      // PHASE A: while parked on a gate, the clock (and song) hold still
      if (!waiting) {
        if (Music.loaded) {
          songPos = Music.pos();              // clock driven by real playback position
        } else if (!paused) {
          songPos += dt * state.prefs.speed;  // simulated timer fallback
        }
      }
      songPos = Math.min(songPos, EXP.durationSec);

      // fire cues whose time has arrived (paused while waiting on a gate)
      while (!waiting && nextIdx < cues.length && songPos >= cues[nextIdx].at) {
        const cue = cues[nextIdx];
        if (!fired.has(nextIdx)) { fired.add(nextIdx); applyCue(cue, nextIdx); }
        nextIdx++;
        if (cue.gate && cue.gate.kind === "confirm") { enterWait(cue); break; }
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
      $("#tlFill").style.width = (songPos / EXP.durationSec) * 100 + "%";
      $("#tElapsed").textContent = fmt(songPos);

      if (songPos < EXP.durationSec) raf = requestAnimationFrame(loop);
    }

    function stop() { if (raf) cancelAnimationFrame(raf); raf = null; clearNudge(); stopVoice(); Music.stop(); if (navigator.vibrate) navigator.vibrate(0); }

    function finish() { stop(); state.streak += 1; setTimeout(screens.finish, 900); }

    // kick off audio (gesture came from the Start button, so playback is allowed)
    if (Music.loaded) { Music.rate(state.prefs.speed); Music.seek(0); Music.play(); }

    // greet + kick off
    speak(state.isBeginner
      ? "Alright, first steak — I've got you. Free Bird's rolling, let's cook."
      : "Let's cook. Free Bird's rolling.");
    lastTs = performance.now();
    raf = requestAnimationFrame(loop);

    // ---- controls ----
    $("#pause").onclick = (e) => {
      paused = !paused;
      cookEl.classList.toggle("paused", paused);
      e.target.textContent = paused ? "▶ Resume" : "⏸ Pause";
      if (paused) { stopVoice(); Music.pause(); } else { Music.play(); }
      lastTs = performance.now();
    };
    $("#quit").onclick = () => { stop(); screens.home(); };
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
      const opts = Music.loaded ? [1, 2] : [8, 4, 2, 1]; // real audio stays near real-time
      const i = (opts.indexOf(state.prefs.speed) + 1) % opts.length;
      state.prefs.speed = opts[i];
      if (Music.loaded) Music.rate(state.prefs.speed);
      e.currentTarget.textContent = state.prefs.speed + "×";
      toast(state.prefs.speed === 1 ? "Real-time" : "Speed " + state.prefs.speed + "×");
    };
  };

  // ---- Finish / share ----
  // ---- post-cook feedback (rating + optional photo, saved to a local cook log) ----
  function feedbackBlockHTML() {
    const rates = [["😞", "bad"], ["😐", "ok"], ["😋", "good"], ["🤩", "great"]];
    return `
      <p class="section-title" style="text-align:center;margin-top:6px">How did it go?</p>
      <div class="rate" id="rate">${rates.map(([e, v]) => `<button class="rbtn" data-v="${v}" aria-label="${v}">${e}</button>`).join("")}</div>
      <label class="btn secondary" id="photoBtn" style="margin-top:12px">📸 Add a photo (optional)<input type="file" id="photoInput" accept="image/*" hidden></label>
      <div id="photoPrev"></div>`;
  }

  function wireFeedback(recipeName) {
    const fb = { recipe: recipeName, rating: null, hasPhoto: false, at: new Date().toISOString() };
    let saved = false;
    $$("#rate .rbtn").forEach((b) => b.onclick = () => {
      fb.rating = b.dataset.v;
      $$("#rate .rbtn").forEach((x) => x.classList.toggle("sel", x === b));
      vibrate("tap"); toast("Thanks for the feedback!");
    });
    const inp = $("#photoInput");
    if (inp) inp.onchange = (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) { fb.hasPhoto = true; $("#photoPrev").innerHTML = `<img class="cook-photo" src="${URL.createObjectURL(f)}" alt="your cook">`; toast("Looks delicious 😋"); }
    };
    return () => {                       // call on exit to persist
      if (saved || (!fb.rating && !fb.hasPhoto)) return;
      saved = true;
      try { const log = JSON.parse(localStorage.getItem("seartune_cooklog") || "[]"); log.push(fb); localStorage.setItem("seartune_cooklog", JSON.stringify(log.slice(-100))); } catch (e) {}
    };
  }

  screens.finish = () => {
    h(screenEl("center", `
      <div class="finish-hero">
        <div class="medal">🏅</div>
        <p class="eyebrow" style="margin-top:8px">First cook complete</p>
        <h1 style="margin-top:8px">You made a<br><span class="gradient-text">medium-rare steak.</span></h1>
        <div class="streak">🔥 ${state.streak}-cook streak started</div>
      </div>

      <div class="share-card">
        <div class="glow"></div>
        <div class="big">🥩🎸</div>
        <h2 style="position:relative;margin-top:8px">Cooked to Free Bird</h2>
        <p class="muted" style="position:relative">Lynyrd Skynyrd · SearTune</p>
      </div>

      ${feedbackBlockHTML()}

      <div class="stack" style="margin-top:16px">
        <button class="btn" id="share">Share my cook 📲</button>
        <button class="btn secondary" id="again">Cook it again</button>
        <button class="btn ghost" id="home">Back home</button>
      </div>
    `));
    const save = wireFeedback("Free Bird — Medium-rare steak");
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
          <span class="brand gradient-text">SearTune</span>
          <button class="icon-btn" id="sbClose" aria-label="Close menu">✕</button>
        </div>
        <nav class="sb-nav">
          <button class="sb-item" data-nav="profile"><span class="sb-ico">👤</span><span>Profile</span></button>
          <button class="sb-item" data-nav="search"><span class="sb-ico">🔍</span><span>Search recipes</span></button>
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
          <span class="muted">Pan</span>
          <div class="pval"><span>${optLabel(PAN_OPTIONS, eq.pan)}</span><button class="pedit" data-edit="pan">Edit</button></div>
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

      <div class="mt-auto" style="margin-top:18px">
        <button class="btn ghost" id="signout">Sign out</button>
      </div>
    `));
    wireSectionHead();
    $$(".pedit").forEach((b) => b.onclick = () => {
      const f = b.dataset.edit;
      if (f === "spotify") { toast("🔒 Upgrade to Premium to connect Spotify"); return; }
      editProfileField(f);
    });
    $("#signout").onclick = () => { state.email = ""; toast("Signed out"); screens.welcome(); };
  };

  // edit a single profile field, then return to the profile
  function editProfileField(field) {
    const cfg = {
      experience: { title: "Experience", opts: EXPERIENCE_LEVELS, get: () => state.experience, set: (v) => setExperience(v) },
      pan: { title: "Pan", opts: PAN_OPTIONS, get: () => state.equipment.pan, set: (v) => (state.equipment.pan = v) },
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
      toast(cfg.title + " updated ✓");
      screens.profile();
    });
  }

  // ---- Search recipes (dedicated section) ----
  screens.searchRecipes = () => {
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
        <label class="choice toggle" id="tgHaptic"><span class="emoji">📳</span><span style="flex:1">Haptics</span><span class="sw">${state.prefs.haptics ? "ON" : "OFF"}</span></label>
      </div>

      <p class="section-title">Cooking voice</p>
      ${voicePickerHTML()}

      <p class="section-title">Appearance</p>
      <div class="stack">
        <label class="choice toggle" id="tgTheme"><span class="emoji">${state.prefs.theme === "light" ? "☀️" : "🌙"}</span><span style="flex:1">Theme</span><span class="sw">${state.prefs.theme === "light" ? "LIGHT" : "DARK"}</span></label>
      </div>

      <div class="mt-auto"></div>
    `));
    wireSectionHead();
    wireVoicePicker();
    $("#tgVoice").onclick = () => {
      state.prefs.voice = !state.prefs.voice;
      $("#tgVoice .sw").textContent = state.prefs.voice ? "ON" : "OFF";
      if (!state.prefs.voice) stopVoice(); else speak("Voice on.");
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

  // boot
  Sidebar.mount();
  screens.welcome();
})();
