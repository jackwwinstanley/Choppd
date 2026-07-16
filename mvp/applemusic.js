/*
 * applemusic.js  (window.AppleMusic_) — the Apple Music engine seam for the AM PILOT (§2).
 *
 * Mirrors the shape of window.Spotify_ so the ported picker + the cook engine talk to ONE surface.
 * The RATIFIED design holds: AM is AMBIENT on the cook clock — cues run on wall-clock elapsed, NOTHING
 * slaves songPos to playbackTime, no beat-matched authoring against AM tracks (the sync-rights fence).
 *
 * Playback is NATIVE: search UI stays JS, but a WKWebView cannot play the Apple Music catalog — that
 * goes through the `ChoppdMusic` Capacitor plugin (ApplicationMusicPlayer). Catalog SEARCH is the
 * Apple Music REST API, authorized by a short-lived developer token minted SERVER-SIDE
 * (/api/music/token — the .p8 never touches the client).
 *
 * MOCK_AM seam (mirrors MOCK_AI): with `window.MOCK_AM` on, OR whenever the native ChoppdMusic plugin
 * is absent (web, or native before the key lands), the whole engine runs against a canned catalog + a
 * simulated transport — so the picker, source selection, the fallback ladder, and the cook behaviors
 * are all sim-testable BEFORE the founder's MusicKit key exists. `capable()` stays false in mock, so
 * source selection still offers "Your music" only where a REAL device+plugin+subscription exist.
 *
 * NO-CHARGE RULE (MusicKit / App Review §5.2.3): nothing in this engine may sit behind a Choppd
 * paywall — AM is offered FREE to subscribers; non-subscribers silently get the local track.
 */
(() => {
  const cap = () => window.Capacitor;
  const isNative = () => !!(cap() && typeof cap().isNativePlatform === "function" && cap().isNativePlatform());
  const plugin = () => (cap() && cap().Plugins && cap().Plugins.ChoppdMusic) || null;

  // MOCK when explicitly forced OR when there's no native plugin to do real playback.
  const mockMode = () => !!window.MOCK_AM || !plugin();

  // ---- MOCK catalog (canned; ids are shaped like AM catalog ids but are fake) ------------------
  const MOCK_CATALOG = [
    { id: "am.1441164426", label: "Here Comes the Sun — The Beatles", artist: "The Beatles", kind: "🎵", img: null },
    { id: "am.1440826532", label: "Hotel California — Eagles", artist: "Eagles", kind: "🎵", img: null },
    { id: "am.1051394215", label: "Free Bird — Lynyrd Skynyrd", artist: "Lynyrd Skynyrd", kind: "🎵", img: null },
    { id: "am.1440806041", label: "Bohemian Rhapsody — Queen", artist: "Queen", kind: "🎵", img: null },
    { id: "am.pl.mock1", label: "Kitchen Sunrise · playlist", artist: "", kind: "🎧", img: null },
    { id: "am.pl.mock2", label: "Dinner Party Funk · playlist", artist: "", kind: "🎧", img: null },
  ];

  // ---- simulated native transport (so gates/transport/end are testable headlessly) -------------
  const mockT = {
    ids: [], playing: false, _pos: 0, _t0: 0, _timer: null, listeners: [],
    _emit(state) { this.listeners.forEach((cb) => { try { cb(state); } catch (e) {} }); },
    queue(ids, shuffle) { this.ids = ids.slice(); this._pos = 0; this._emit({ status: "queued", ids: this.ids }); return { ok: true, count: this.ids.length, shuffle: !!shuffle }; },
    play() { if (this.playing) return; this.playing = true; this._t0 = performance.now() - this._pos * 1000;
      this._timer = setInterval(() => { this._pos = (performance.now() - this._t0) / 1000; }, 200); this._emit({ status: "playing", pos: this._pos }); },
    pause() { if (!this.playing) return; this.playing = false; if (this._timer) clearInterval(this._timer); this._timer = null; this._emit({ status: "paused", pos: this._pos }); },
    seek(t) { this._pos = Math.max(0, t); this._t0 = performance.now() - this._pos * 1000; this._emit({ status: "seek", pos: this._pos }); },
    time() { return this.playing ? (performance.now() - this._t0) / 1000 : this._pos; },
    stop() { this.pause(); this.ids = []; this._pos = 0; this._emit({ status: "stopped" }); },
  };

  // ---- server-minted developer token (cached to its ttl) ---------------------------------------
  let _tok = null, _tokExp = 0, _tokMock = false;
  async function devToken() {
    if (_tok && Date.now() < _tokExp) return { token: _tok, mock: _tokMock };
    const fallbackMock = () => { _tok = "MOCK_AM_DEV_TOKEN"; _tokMock = true; _tokExp = Date.now() + 60000; return { token: _tok, mock: true }; };
    if (!(window.API && window.API.musicToken)) return fallbackMock();
    try {
      const r = await window.API.musicToken();             // { token, mock, ttl }
      if (!r || !r.token) return fallbackMock();
      _tok = r.token; _tokMock = !!r.mock; _tokExp = Date.now() + Math.max(30, (r.ttl || 3600) - 60) * 1000;
      return { token: _tok, mock: _tokMock };
    } catch (e) { return fallbackMock(); }                  // 401 / offline / network → mock (never throw into search)
  }

  let _storefront = "us";
  let _authState = null;      // { authorized, subscribed, storefront, mock } from the last authorize()
  let _lastAttempt = null;    // { ok, detail, at } — last playback attempt (for the AM status tab)
  let _nativePos = 0;         // last playbackTime pushed by the native "state" event — drives time() so the
                              // start-timeout guard can tell AM is actually progressing (was reading an
                              // undefined _lastTime → always 0 → spurious fallback on a slow playlist play()).

  const AM = {
    // ---- capability / auth -----------------------------------------------------------------------
    // capable() = a REAL Apple Music source is possible here (native + plugin). Drives whether source
    // selection even OFFERS "Your music". Mock never claims capable (so web/pre-key never shows it live).
    capable() { return window.AM_FORCE_CAPABLE ? true : (isNative() && !!plugin() && !window.MOCK_AM); },   // AM_FORCE_CAPABLE: dev/sim-only harness override to exercise the picker off-device (never set in prod)
    isMock() { return mockMode(); },
    // authorize + subscription check at cook start. Mock: authorized+subscribed so the ladder is testable.
    async authorize() {
      let r;
      if (mockMode()) { r = { authorized: true, subscribed: true, storefront: _storefront, mock: true }; }
      else {
        try { r = await plugin().authorize(); if (r && r.storefront) _storefront = r.storefront; }   // { authorized, subscribed, storefront }
        catch (e) { r = { authorized: false, subscribed: false, error: (e && e.message) || "authorize failed" }; }
      }
      _authState = { authorized: !!(r && r.authorized), subscribed: !!(r && r.subscribed), storefront: (r && r.storefront) || _storefront, mock: !!(r && r.mock) };
      return r || { authorized: false, subscribed: false };
    },
    async devToken() { return devToken(); },
    storefront() { return _storefront; },
    // ---- STATUS for the AM tab (Job 2) -----------------------------------------------------------
    authState() { return _authState; },                    // last authorize() result, or null
    lastAttempt() { return _lastAttempt; },                // { ok, detail, at } of the last play attempt
    noteAttempt(ok, detail) { _lastAttempt = { ok: !!ok, detail: String(detail || ""), at: Date.now() }; },
    // Map a verbatim native/CM error to a human line. -8200 / "not registered" = the portal MusicKit
    // registration still propagating; unknown → show verbatim so nothing is hidden.
    humanError(detail) {
      const d = String(detail || "").toLowerCase();
      if (!d) return "";
      if (d.includes("-8200") || d.includes("not registered") || d.includes("valid client identifier") || d.includes("token service"))
        return "Apple hasn't finished registering Choppd for Apple Music yet — this is on our side, not yours. It usually clears within a day.";
      if (d.includes("no_catalog_songs") || d.includes("not found"))
        return "That track isn't available in your Apple Music region.";
      if (d.includes("timeout")) return "Apple Music didn't start in time — check your connection.";
      if (d.includes("no-am") || d.includes("not authorized") || d.includes("unauth")) return "Apple Music isn't connected.";
      return "Apple Music error: " + detail;               // unknown → verbatim
    },

    // ---- catalog search --------------------------------------------------------------------------
    // Search is DECOUPLED from playback: it runs against the real Apple Music REST API whenever the
    // server hands back a REAL dev token (the .p8 is placed) — even on web / before the native plugin —
    // so the picker can be exercised with a real catalog. Only forced-mock or a mock token → canned list.
    async search(q) {
      q = (q || "").trim(); if (!q) return [];
      const { token, mock } = await devToken();
      if (window.MOCK_AM || mock) {
        const s = q.toLowerCase();
        return MOCK_CATALOG.filter((x) => (x.label + " " + x.artist).toLowerCase().includes(s));
      }
      const sf = _storefront || "us";
      const url = `https://api.music.apple.com/v1/catalog/${sf}/search?term=${encodeURIComponent(q)}&types=songs,playlists&limit=10`;
      const res = await fetch(url, { headers: { Authorization: "Bearer " + token } });
      if (!res.ok) { const e = new Error("search failed"); e.status = res.status; throw e; }
      const d = await res.json();
      const songs = (((d.results || {}).songs || {}).data || []).map((s) => ({
        id: s.id, kind: "🎵",
        label: `${s.attributes.name} — ${s.attributes.artistName}`, artist: s.attributes.artistName,
        img: artURL(s.attributes.artwork),
      }));
      const pls = (((d.results || {}).playlists || {}).data || []).map((p) => ({
        id: p.id, kind: "🎧", label: `${p.attributes.name} · playlist`, artist: "", img: artURL(p.attributes.artwork),
      }));
      return [...songs, ...pls];
    },

    // ---- the user's own playlists (library scope — rides the same authorization) -----------------
    async userPlaylists() {
      if (mockMode()) return [
        { id: "am.pl.kitchen", label: "Kitchen Sunrise", img: null },
        { id: "am.pl.funk", label: "Dinner Party Funk", img: null },
        { id: "am.pl.chill", label: "Sunday Chill", img: null },
      ];
      try { const r = await plugin().userPlaylists(); return (r && r.playlists) || []; }
      catch (e) { return []; }
    },

    // C1 WARM-UP: establish the native ApplicationMusicPlayer connection ahead of the first cook (called
    // at picker open + cook start). Idempotent, non-blocking, best-effort — never throws to the caller.
    // Mock is a no-op ok. The cold-start "relaunch fixes it" pattern lives here + the native cold-retry.
    async warmup() {
      if (mockMode()) return { ok: true, warmed: true, mock: true };
      try { return await plugin().warmup(); } catch (e) { return { ok: false, error: (e && e.message) || "warmup failed" }; }
    },

    // ---- transport (native ApplicationMusicPlayer, or the mock simulator) ------------------------
    async queue(ids, opts) {
      ids = ids.filter(Boolean);
      const shuffle = !!(opts && opts.shuffle);
      if (mockMode()) {
        if (window.MOCK_AM_FAIL) return { ok: false, error: window.MOCK_AM_FAIL === "timeout" ? "timeout" : "no_catalog_songs" };   // dev/sim: exercise the fallback ladder
        // mirror native playlist resolution: a mock playlist id (am.pl.*) flattens to its tracks IN ORDER
        let flat = []; ids.forEach((id) => { if (/^am\.pl\./.test(id)) { flat.push(id + ".t1", id + ".t2", id + ".t3"); } else flat.push(id); });
        if (shuffle && flat.length > 1) flat = flat.map((x) => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);   // mock reshuffle (native uses shuffleMode, reshuffles per loop)
        return mockT.queue(flat, shuffle);   // { ok:true, count, shuffle } — the mock transport loops
      }
      return plugin().queue({ ids, shuffle });
    },
    async play() { if (mockMode()) return mockT.play(); return plugin().play(); },
    async pause() { if (mockMode()) return mockT.pause(); return plugin().pause(); },
    async seek(t) { if (mockMode()) return mockT.seek(t); return plugin().seek({ time: t }); },
    async stop() { if (mockMode()) return mockT.stop(); return plugin().stop(); },
    // playbackTime — READ ONLY for now-playing/attribution + drift checks; NOT used to drive songPos
    // (the sync fence). Mock returns the simulated clock; native reads ApplicationMusicPlayer.playbackTime.
    time() { if (mockMode()) return mockT.time(); return _nativePos; },   // native pos, tracked from the plugin's "state" events (ChoppdMusic pushes { pos } ~4x/s)

    // ---- state events (queued/playing/paused/seek/stopped/ended) ---------------------------------
    onState(cb) {
      if (mockMode()) { mockT.listeners.push(cb); return; }
      try { plugin().addListener("state", cb); } catch (e) {}
    },
  };

  function artURL(a) {
    if (!a || !a.url) return null;
    return a.url.replace("{w}", "80").replace("{h}", "80");   // smallest — playback-only per the artwork rights fence
  }

  // A1: forward native ChoppdMusic logs to the console so the Eye captures them on a silent device run.
  try { if (plugin()) plugin().addListener("log", (e) => { try { console.log("CM " + (e && e.msg)); } catch (x) {} }); } catch (e) {}
  // Track the native playback position from "state" events → time() (see _nativePos). Reset on stop.
  try { if (plugin()) plugin().addListener("state", (e) => { if (e && typeof e.pos === "number") _nativePos = e.pos; if (e && e.status === "stopped") _nativePos = 0; }); } catch (e) {}

  window.AppleMusic_ = AM;
})();
