/*
 * Real Spotify integration for the web demo.
 *   - Auth: Authorization Code + PKCE (no server, no client secret).
 *   - Playback: Web Playback SDK (https://sdk.scdn.co/spotify-player.js).
 *
 * Requirements to go live (the bits that aren't code):
 *   1. Create a free app at https://developer.spotify.com/dashboard → copy its
 *      Client ID. Paste it in-app (Premium → Spotify) — it's saved to localStorage.
 *   2. In that app's settings, add this exact Redirect URI:  Spotify_.redirectUri()
 *      (shown in-app). Spotify allows loopback http://127.0.0.1:<port>/… for dev.
 *   3. The END USER must have Spotify Premium — the Web Playback SDK refuses to
 *      stream for free accounts (account_error). Free users keep the demo tracks.
 *
 * Everything below is real; it just can't be exercised without (1)–(3).
 */
(() => {
  const LS = { clientId: "seartune_sp_client", verifier: "seartune_sp_verifier", token: "seartune_sp_token" };
  const SCOPES = "streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state playlist-read-private playlist-read-collaborative user-library-read user-top-read";
  const redirectUri = () => location.origin + location.pathname;

  // Shared SearTune Spotify app — users just log in with their own account, no pasting.
  // A custom Client ID in localStorage (advanced "use your own app") overrides this.
  const DEFAULT_CLIENT_ID = "a5460c0a16534c99ad819c5b6d91c5b7";
  const getClientId = () => ((localStorage.getItem(LS.clientId) || "").trim() || DEFAULT_CLIENT_ID);
  const hasCustomClientId = () => !!(localStorage.getItem(LS.clientId) || "").trim();
  const setClientId = (id) => localStorage.setItem(LS.clientId, (id || "").trim());

  // ---- PKCE ----
  const randStr = (n) => {
    const a = new Uint8Array(n); crypto.getRandomValues(a);
    return Array.from(a, (b) => ("0" + (b & 0xff).toString(16)).slice(-2)).join("");
  };
  async function sha256b64url(str) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  async function login() {
    const clientId = getClientId();
    if (!clientId) throw new Error("no-client-id");
    const verifier = randStr(64);
    localStorage.setItem(LS.verifier, verifier);
    const challenge = await sha256b64url(verifier);
    const p = new URLSearchParams({
      client_id: clientId, response_type: "code", redirect_uri: redirectUri(),
      scope: SCOPES, code_challenge_method: "S256", code_challenge: challenge,
    });
    location.href = "https://accounts.spotify.com/authorize?" + p.toString();
  }

  // Call on page load: if we came back from Spotify with ?code=, exchange it.
  async function handleRedirect() {
    const u = new URL(location.href);
    const code = u.searchParams.get("code");
    if (!code) return false;
    const verifier = localStorage.getItem(LS.verifier) || "";
    const body = new URLSearchParams({
      client_id: getClientId(), grant_type: "authorization_code", code,
      redirect_uri: redirectUri(), code_verifier: verifier,
    });
    let ok = false;
    try {
      const res = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body,
      });
      const data = await res.json();
      if (data.access_token) { storeToken(data); ok = true; }
    } catch (e) { /* network */ }
    history.replaceState({}, "", redirectUri()); // strip ?code=… from the URL
    return ok;
  }

  function storeToken(d) {
    const cur = readToken() || {};
    localStorage.setItem(LS.token, JSON.stringify({
      access_token: d.access_token,
      refresh_token: d.refresh_token || cur.refresh_token,
      expires_at: Date.now() + (d.expires_in || 3600) * 1000 - 60000,
    }));
  }
  const readToken = () => { try { return JSON.parse(localStorage.getItem(LS.token) || "null"); } catch (e) { return null; } };
  const isLoggedIn = () => !!readToken();
  function logout() { localStorage.removeItem(LS.token); if (player) { try { player.disconnect(); } catch (e) {} player = null; deviceId = null; } }

  async function getToken() {
    const t = readToken();
    if (!t) throw new Error("not-logged-in");
    if (Date.now() < t.expires_at) return t.access_token;
    const body = new URLSearchParams({ client_id: getClientId(), grant_type: "refresh_token", refresh_token: t.refresh_token });
    const res = await fetch("https://accounts.spotify.com/api/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
    const data = await res.json();
    if (data.access_token) { storeToken(data); return data.access_token; }
    throw new Error("refresh-failed");
  }

  async function api(path, opts = {}) {
    const token = await getToken();
    const res = await fetch("https://api.spotify.com/v1" + path, {
      ...opts, headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", ...(opts.headers || {}) },
    });
    if (res.status === 204) return null;
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      // Surface the real reason instead of returning a silent error object.
      const msg = (data && data.error && data.error.message) || ("HTTP " + res.status);
      throw Object.assign(new Error(msg), { status: res.status });
    }
    return data;
  }
  const me = () => api("/me");
  // search any song/playlist/album on Spotify (limit is per-type; keep it modest)
  const search = (q, types = "track,playlist,album") => api("/search?q=" + encodeURIComponent(q) + "&type=" + types + "&limit=10");
  const myPlaylists = () => api("/me/playlists?limit=50");
  const myTopTracks = () => api("/me/top/tracks?limit=10&time_range=medium_term");
  const mySavedTracks = () => api("/me/tracks?limit=20");

  // ---- Web Playback SDK ----
  let player = null, deviceId = null, readyWaiters = [], lastError = null, stateListeners = [];
  let _premiumCache = null;

  function loadSdk() {
    if (document.getElementById("spotify-sdk")) { initPlayer(); return; }
    window.onSpotifyWebPlaybackSDKReady = initPlayer;
    const s = document.createElement("script");
    s.id = "spotify-sdk"; s.src = "https://sdk.scdn.co/spotify-player.js";
    document.head.appendChild(s);
  }
  function initPlayer() {
    if (player || !window.Spotify || !isLoggedIn()) return;
    player = new Spotify.Player({ name: "SearTune", volume: 0.5, getOAuthToken: (cb) => getToken().then(cb).catch(() => {}) });
    player.addListener("ready", ({ device_id }) => { deviceId = device_id; readyWaiters.forEach((r) => r(device_id)); readyWaiters = []; });
    player.addListener("not_ready", () => { deviceId = null; });
    player.addListener("initialization_error", (e) => { lastError = e.message; readyWaiters.forEach((_, i, a) => {}); });
    player.addListener("authentication_error", (e) => { lastError = e.message; });
    player.addListener("account_error", () => { lastError = "Spotify Premium required to stream in-app."; });
    stateListeners.forEach((cb) => player.addListener("player_state_changed", cb));
    player.connect();
  }
  function whenReady() {
    return deviceId ? Promise.resolve(deviceId) : new Promise((res, rej) => {
      readyWaiters.push(res);
      setTimeout(() => rej(new Error(lastError || "player-timeout")), 12000);
    });
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Call inside a user-gesture click to unlock audio (required on iOS/Safari, harmless
  // elsewhere). Makes sure the player object exists first so activateElement can run.
  async function activate() {
    loadSdk();
    // Player is created async when the SDK script loads; give it a brief moment.
    for (let i = 0; i < 30 && !player; i++) await sleep(50);
    if (player && player.activateElement) { try { await player.activateElement(); } catch (e) {} }
  }

  function ensureDevice() {
    loadSdk();
    return whenReady();
  }

  async function transferTo(id) {
    await api("/me/player", { method: "PUT", body: JSON.stringify({ device_ids: [id], play: true }) });
  }

  // Send a raw play body for a given device. Returns on 2xx/204; throws {status,code} otherwise.
  async function _playBody(id, body) {
    const token = await getToken();
    const res = await fetch("https://api.spotify.com/v1/me/player/play?device_id=" + id, {
      method: "PUT",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 204 || res.status === 200) return;
    const data = await res.json().catch(() => ({}));
    const msg = (data.error && data.error.message) || "play-failed";
    throw Object.assign(new Error(msg), { status: res.status, code: data.error && data.error.reason });
  }

  // Start playback on our SDK device. The ?device_id= param on /play performs the
  // transfer itself, so we don't pre-transfer (that caused a 404 race). We retry a
  // few times because a freshly-registered device needs a beat before it accepts play.
  async function playBody(body) {
    lastError = null;
    let id = await ensureDevice();
    let lastErr = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        await _playBody(id, body);
        return;
      } catch (e) {
        lastErr = e;
        if (e.status === 404) {
          // Device not ready / evicted — nudge a transfer, wait, re-register, retry.
          try { await transferTo(id); } catch (_) {}
          await sleep(700);
          if (attempt >= 1) { deviceId = null; id = await ensureDevice(); }
          continue;
        }
        throw e; // 401/403/account_error etc. — surface immediately
      }
    }
    throw lastErr || new Error("play-failed");
  }
  const play = (uri) => playBody(uri.includes(":track:") ? { uris: [uri] } : { context_uri: uri });
  const playUris = (uris) => playBody({ uris: uris.slice(0, 50) }); // explicit track list (Spotify caps the array)

  // ---- playback shaping: shuffle / repeat / queue ----
  const sleep2 = (ms) => new Promise((r) => setTimeout(r, ms));
  async function setShuffle(on) {
    try { await api("/me/player/shuffle?state=" + (on ? "true" : "false") + (deviceId ? "&device_id=" + deviceId : ""), { method: "PUT" }); } catch (e) {}
  }
  async function setRepeat(mode) { // 'track' | 'context' | 'off'
    try { await api("/me/player/repeat?state=" + mode + (deviceId ? "&device_id=" + deviceId : ""), { method: "PUT" }); } catch (e) {}
  }
  async function queueUri(uri) {
    try { await api("/me/player/queue?uri=" + encodeURIComponent(uri) + (deviceId ? "&device_id=" + deviceId : ""), { method: "POST" }); } catch (e) {}
  }
  async function next() { try { await api("/me/player/next" + (deviceId ? "?device_id=" + deviceId : ""), { method: "POST" }); } catch (e) {} }

  // Fetch every playable track URI in a playlist (paginated, market-aware so we
  // skip tracks unplayable in the user's region).
  async function playlistTrackUris(playlistUri) {
    const id = String(playlistUri).split(":").pop();
    const uris = [];
    let path = "/playlists/" + id + "/tracks?market=from_token&fields=items(track(uri,type,is_playable)),next&limit=100";
    for (let page = 0; page < 6 && path; page++) {
      const data = await api(path);
      if (!data || !data.items) break;
      data.items.forEach((it) => {
        const t = it && it.track;
        if (t && t.type === "track" && t.uri && t.uri.indexOf(":track:") > -1 && t.is_playable !== false) uris.push(t.uri);
      });
      path = data.next ? data.next.replace("https://api.spotify.com/v1", "") : null;
    }
    return uris;
  }

  function shuffleInPlace(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  // High-level: start a chosen selection. A shuffled playlist plays a genuinely
  // random ordering of ITS OWN tracks (different every time); a single looping
  // track; or a queue of searched songs in order.
  async function playSelection(sel) {
    if (!sel) return;
    if (sel.kind === "playlist") {
      if (sel.shuffle) {
        let uris = [];
        try { uris = await playlistTrackUris(sel.uri); } catch (e) {}
        if (uris.length) {
          shuffleInPlace(uris);
          await setShuffle(false);              // we control the order ourselves
          await playUris(uris);                 // play our randomized subset (only playlist songs)
          await setRepeat("off");
          return;
        }
        // fallback: couldn't read tracks → use Spotify's own shuffle on the context
        await play(sel.uri); await setShuffle(true); await setRepeat("context"); return;
      }
      await play(sel.uri);                       // in-order playlist
      await setShuffle(false);
      await setRepeat("context");
    } else if (sel.kind === "queue" && sel.queue && sel.queue.length) {
      await setShuffle(false);
      await play(sel.queue[0].uri);              // first song now
      for (let i = 1; i < sel.queue.length; i++) await queueUri(sel.queue[i].uri); // rest queued in order
      await setRepeat("off");
    } else if (sel.uri) {                        // single track
      await setShuffle(false);
      await play(sel.uri);
      await setRepeat(sel.loop ? "track" : "off");
    }
  }

  // Don't cache negative/failed lookups — a transient network error must not lock a
  // real Premium user out for the rest of the session.
  async function isPremiumAccount() {
    if (_premiumCache === true) return true;
    try {
      const u = await me();
      if (u && u.product) { _premiumCache = u.product === "premium"; return _premiumCache; }
    } catch (e) {}
    return false;
  }

  // Raw, unfiltered probe of a Web API endpoint — returns Spotify's exact status,
  // body text, and key headers so we can see WHAT it's actually complaining about.
  async function rawProbe(path = "/me") {
    let token = "";
    try { token = await getToken(); } catch (e) { return { error: "token: " + (e.message || String(e)) }; }
    const t = readToken() || {};
    try {
      const res = await fetch("https://api.spotify.com/v1" + path, { headers: { Authorization: "Bearer " + token } });
      const bodyText = await res.text().catch(() => "");
      return {
        path,
        status: res.status,
        statusText: res.statusText,
        body: (bodyText || "(empty body)").slice(0, 300),
        reason: res.headers.get("www-authenticate") || res.headers.get("x-spotify-error") || null,
        tokenPreview: token ? token.slice(0, 8) + "…" + token.slice(-4) + " (len " + token.length + ")" : "(none)",
        tokenExpired: t.expires_at ? Date.now() > t.expires_at : null,
        hasRefresh: !!t.refresh_token,
      };
    } catch (e) {
      return { path, fetchError: String(e), tokenPreview: token ? "present (len " + token.length + ")" : "(none)" };
    }
  }

  // Diagnostic snapshot for troubleshooting (used by the in-app "Test playback" button).
  async function status() {
    let product = null, who = null, meErr = null, searchErr = null, searchCount = null;
    try { const u = await me(); product = u && u.product; who = u && (u.display_name || u.email); }
    catch (e) { meErr = (e.status ? "HTTP " + e.status + " — " : "") + (e.message || String(e)); }
    try { const d = await search("test"); searchCount = ((d && d.tracks && d.tracks.items) || []).length; }
    catch (e) { searchErr = (e.status ? "HTTP " + e.status + " — " : "") + (e.message || String(e)); }
    return {
      loggedIn: isLoggedIn(),
      clientId: getClientId() || null,
      redirectUri: redirectUri(),
      sdkScript: !!document.getElementById("spotify-sdk"),
      playerCreated: !!player,
      deviceId: deviceId || null,
      product, who, meErr, searchErr, searchCount,
      lastError: lastError,
    };
  }

  // Register a callback for Spotify player state changes (track changes, pause/resume).
  // Safe to call before the SDK loads — listener is attached when the player is ready.
  function onState(cb) {
    stateListeners.push(cb);
    if (player) player.addListener("player_state_changed", cb);
  }

  const pause = () => { try { player && player.pause(); } catch (e) {} };
  const resume = () => { try { player && player.resume(); } catch (e) {} };
  const stop = () => { try { player && player.pause(); } catch (e) {} };

  window.Spotify_ = {
    redirectUri, getClientId, hasCustomClientId, setClientId, login, handleRedirect, isLoggedIn, logout,
    getToken, me, search, myPlaylists, myTopTracks, mySavedTracks,
    loadSdk, activate, ensureDevice, transferTo, play, pause, resume, stop, whenReady,
    setShuffle, setRepeat, queueUri, next, playSelection,
    isPremiumAccount, onState, status, rawProbe,
    get deviceId() { return deviceId; },
    get lastError() { return lastError; },
  };
})();
