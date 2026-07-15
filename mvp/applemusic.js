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
    queue(ids) { this.ids = ids.slice(); this._pos = 0; this._emit({ status: "queued", ids: this.ids }); },
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
    if (!(window.API && window.API.musicToken)) { _tok = "MOCK_AM_DEV_TOKEN"; _tokMock = true; _tokExp = Date.now() + 60000; return { token: _tok, mock: true }; }
    const r = await window.API.musicToken();               // { token, mock, ttl }
    _tok = r.token; _tokMock = !!r.mock; _tokExp = Date.now() + Math.max(30, (r.ttl || 3600) - 60) * 1000;
    return { token: _tok, mock: _tokMock };
  }

  let _storefront = "us";

  const AM = {
    // ---- capability / auth -----------------------------------------------------------------------
    // capable() = a REAL Apple Music source is possible here (native + plugin). Drives whether source
    // selection even OFFERS "Your music". Mock never claims capable (so web/pre-key never shows it live).
    capable() { return isNative() && !!plugin() && !window.MOCK_AM; },
    isMock() { return mockMode(); },
    // authorize + subscription check at cook start. Mock: authorized+subscribed so the ladder is testable.
    async authorize() {
      if (mockMode()) return { authorized: true, subscribed: true, storefront: _storefront, mock: true };
      try {
        const r = await plugin().authorize();               // { authorized, subscribed, storefront }
        if (r && r.storefront) _storefront = r.storefront;
        return r || { authorized: false, subscribed: false };
      } catch (e) { return { authorized: false, subscribed: false, error: (e && e.message) || "authorize failed" }; }
    },
    async devToken() { return devToken(); },
    storefront() { return _storefront; },

    // ---- catalog search --------------------------------------------------------------------------
    async search(q) {
      q = (q || "").trim(); if (!q) return [];
      if (mockMode()) {
        const s = q.toLowerCase();
        return MOCK_CATALOG.filter((x) => (x.label + " " + x.artist).toLowerCase().includes(s));
      }
      const { token } = await devToken();
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

    // ---- transport (native ApplicationMusicPlayer, or the mock simulator) ------------------------
    async queue(ids) { ids = ids.filter(Boolean); if (mockMode()) return mockT.queue(ids); return plugin().queue({ ids }); },
    async play() { if (mockMode()) return mockT.play(); return plugin().play(); },
    async pause() { if (mockMode()) return mockT.pause(); return plugin().pause(); },
    async seek(t) { if (mockMode()) return mockT.seek(t); return plugin().seek({ time: t }); },
    async stop() { if (mockMode()) return mockT.stop(); return plugin().stop(); },
    // playbackTime — READ ONLY for now-playing/attribution + drift checks; NOT used to drive songPos
    // (the sync fence). Mock returns the simulated clock; native reads ApplicationMusicPlayer.playbackTime.
    time() { if (mockMode()) return mockT.time(); return (plugin()._lastTime || 0); },

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

  window.AppleMusic_ = AM;
})();
