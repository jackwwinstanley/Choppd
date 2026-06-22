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
  const SCOPES = "streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state";
  const redirectUri = () => location.origin + location.pathname;

  const getClientId = () => (localStorage.getItem(LS.clientId) || "").trim();
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
    return res.json().catch(() => null);
  }
  const me = () => api("/me");
  const search = (q, types = "track,playlist") => api("/search?q=" + encodeURIComponent(q) + "&type=" + types + "&limit=8");

  // ---- Web Playback SDK ----
  let player = null, deviceId = null, readyWaiters = [], lastError = null;
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
    player.addListener("initialization_error", (e) => { lastError = e.message; });
    player.addListener("authentication_error", (e) => { lastError = e.message; });
    player.addListener("account_error", (e) => { lastError = "Spotify Premium required to stream in-app."; });
    player.connect();
  }
  function whenReady() {
    return deviceId ? Promise.resolve(deviceId) : new Promise((r, j) => {
      readyWaiters.push(r);
      setTimeout(() => j(new Error(lastError || "player-timeout")), 12000);
    });
  }

  async function play(uri) {
    loadSdk();
    const id = await whenReady();
    const body = uri.includes(":track:") ? { uris: [uri] } : { context_uri: uri };
    await api("/me/player/play?device_id=" + id, { method: "PUT", body: JSON.stringify(body) });
  }
  const pause = () => { try { player && player.pause(); } catch (e) {} };
  const resume = () => { try { player && player.resume(); } catch (e) {} };
  const stop = () => { try { player && player.pause(); } catch (e) {} };

  window.Spotify_ = {
    redirectUri, getClientId, setClientId, login, handleRedirect, isLoggedIn, logout,
    getToken, me, search, loadSdk, play, pause, resume, stop, whenReady,
    get deviceId() { return deviceId; },
    get lastError() { return lastError; },
  };
})();
