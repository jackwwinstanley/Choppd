# Spotify Playback — Make "cook to your own music" actually play

**Status:** auth + library browsing work; **in-app playback does not.** This doc
explains *why*, then lays out a phased plan to fix it, plus how to test it with
the Playwright MCP going forward.

Files involved: [`mvp/spotify.js`](mvp/spotify.js) (auth + Web Playback SDK),
[`mvp/app.js`](mvp/app.js) (Premium screen, cook engines).

---

## 1. What already works

- **OAuth (PKCE, no server/secret).** Paste Client ID → "Log in with Spotify" →
  token stored + auto-refreshed. (`spotify.js` `login`/`handleRedirect`/`getToken`.)
- **Library reads.** `me`, `search`, `myPlaylists`, `myTopTracks` all hit the Web
  API and render in the Premium → Spotify panel. Picking an item stores
  `state.spotifyUri` / `state.spotifyLabel`.
- **Entitlement.** Free by default; Dev123 unlocks Premium; gating is correct.

So the problem is **strictly the playback step**, not auth or selection.

---

## 2. Why playback doesn't work today (root causes)

Confirmed from the current code:

1. **Playback is only wired into guided (TheMealDB) cooks — not the steak/eggs
   cooks.** `Spotify_.play()` is called *only* in `screens.guidedCook`
   ([`app.js:1167`](mvp/app.js#L1167)). The flagship cooks (steak, eggs) use the
   bundled royalty-free `<audio>` and never call Spotify. So a user who connects
   Spotify and then cooks the obvious demo recipes hears the demo track and
   concludes "Spotify doesn't play." **This is the most likely thing you hit.**

2. **No user-gesture activation.** Browsers block audio that isn't started inside
   a user gesture. The Web Playback SDK exposes `player.activateElement()` which
   **must be called synchronously in a click handler** to unlock audio (required
   on mobile, increasingly on desktop Chrome). We never call it, and `play()` runs
   several async ticks after the click — so even with Premium it can silently fail.

3. **Spotify Premium is mandatory for the Web Playback SDK.** Free accounts fire
   `account_error` and **cannot stream in-app, ever.** If the connected account
   isn't Premium, no amount of code fixes it — but right now we don't *detect* or
   *clearly say* this; we just swallow the error.

4. **Device-registration / transfer race.** After `player.connect()` the SDK
   registers a `device_id` asynchronously. Calling `PUT /me/player/play?device_id=…`
   too early (or when another device is active) returns `404 Device not found` or
   `502`. We don't transfer playback to our device first, and we don't retry.

5. **Errors are swallowed.** `play().catch(() => toast("needs Premium"))`
   ([`app.js:1174`](mvp/app.js#L1174)) hides the real status (401/403/404/
   account_error), so we can't tell *which* of the above is happening.

---

## 3. The plan (phased)

### Phase 0 — Diagnose (fast, do first)
Goal: see the real failure on your account in <5 min.

- In `spotify.js`, stop swallowing errors: have `play()` throw structured errors
  (`{status, code, body}`) and log SDK events (`initialization_error`,
  `authentication_error`, `account_error`, `playback_error`).
- Store `me().product` on connect; show **"Premium ✓ / Free — in-app playback
  unavailable"** in the Premium panel.
- Add a **"▶ Test playback (30s)"** button to the connected Spotify panel that
  calls the new robust `play()` on the selected track and surfaces the exact error.

**Exit check:** the Test button either plays audio or tells you precisely why
(free account vs device vs gesture).

### Phase 1 — Robust playback core (`spotify.js`)
- `activate()` → `player.activateElement()`; call it from the cook's Start click.
- `ensureDevice()` → `loadSdk()` + `whenReady()` returning a valid `device_id`
  (reject clearly if SDK never readies, e.g. non-Premium).
- `transferTo(deviceId)` → `PUT /me/player {device_ids:[id], play:false}`.
- `play(uri)` → ensure device → transfer if needed → `PUT …/play` →
  **retry once** on 404 after re-transfer; throw structured errors otherwise.
- `requirePremium()` → resolve `me().product === "premium"`; callers gate on it.
- `onState(cb)` via `player.addListener("player_state_changed", …)` for a
  now-playing UI (track name, paused, position).

### Phase 2 — Wire into the cook engines (`app.js`)
- **Start playback from the Start gesture.** In `screens.cook` (steak/eggs) and
  `screens.guidedCook`, on the Start button click: `await Spotify_.activate()` then
  `Spotify_.play(state.spotifyUri)` — same synchronous gesture.
- **Decide the synced-cook behavior** (see §4). Recommended: guided cooks stream
  the chosen Spotify track; music-synced cooks keep the bundled track for cue
  timing but show *"Music-synced cooks use the original track so cues stay in time —
  your Spotify pick plays on guided recipes."*
- **Premium-account gate + fallback.** If not Premium, don't attempt the SDK; play
  the bundled demo track and toast once explaining why.
- **Stop/cleanup.** `Spotify_.stop()` on quit/finish (already partially done for
  guided) and pause on app backgrounding.

### Phase 3 — Cook UX & resilience
- Now-playing bar in the cook screen: track, ⏯ pause/resume, volume.
- Auto-fallback to the demo track if `play()` rejects mid-cook.
- Reconnect handling on token refresh / `not_ready`.

---

## 4. Decisions needed

1. **Synced cooks (steak/eggs) + arbitrary Spotify song:** the cue clock is driven
   by the bundled track's position, and cues are authored to *that* track. Options:
   - **(A, recommended)** Keep bundled audio for synced cooks (timing stays
     correct); offer Spotify only on guided/TheMealDB cooks. Clear, honest.
   - **(B)** Drive the synced-cook clock from a plain timer and play the Spotify
     song decoratively (cues no longer line up with the music — defeats the point).
2. **Non-Premium users:** confirm the fallback copy ("Spotify Premium required for
   in-app playback — playing the demo track instead").

---

## 5. Testing with the Playwright MCP

A Playwright MCP server is now configured in [`.mcp.json`](.mcp.json)
(`@playwright/mcp` via the local Node). **To activate:** restart Claude Code and
approve the project MCP server when prompted (or run `/mcp` to check status). The
no-cache dev server must be running (`cd mvp && python3 serve.py`).

### What Playwright CAN test (deterministic, no Spotify account)
- **Gating:** free user sees the locked "Unlock the full recipe library" card and
  no TheMealDB list; Premium user sees Easy picks + search.
- **Dev code flow:** Premium screen shows "coming soon", `Dev123` unlocks, wrong
  code rejects, and **login does not** auto-grant Premium.
- **Routing:** "Connect your music" / onboarding "Connect Spotify" → Premium screen.
- **Connect panel:** Client ID field + exact Redirect URI render; saving advances
  to "Log in with Spotify".
- **Cook flows** with the bundled demo audio (steak/eggs/guided), portion scaling,
  required end-of-cook feedback, Reset/Clear-data.

### What Playwright CANNOT test directly
- **Real Spotify OAuth** (external accounts.spotify.com login, 2FA/captcha) and
- **actual audio output** (EME/Widevine + a live Premium account).

### How to test our Spotify *logic* anyway — a mock seam
Add a one-line guard to `spotify.js` so a test can inject a fake before the real
module defines itself:

```js
// at the top of the IIFE body in spotify.js
if (window.Spotify_) return;   // a test (or future native bridge) may pre-define it
```

Then in a Playwright test, `addInitScript` (runs before page scripts) to inject a
stub that returns fixtures and records calls:

```js
window.Spotify_ = {
  isLoggedIn: () => true,
  getClientId: () => "test", redirectUri: () => location.href,
  me: async () => ({ display_name: "Test", product: "premium" }),
  myPlaylists: async () => ({ items: [{ uri: "spotify:playlist:1", name: "Dinner", tracks:{total:12} }] }),
  myTopTracks: async () => ({ items: [] }),
  search: async () => ({ tracks:{items:[]}, playlists:{items:[]} }),
  loadSdk(){}, activate: async()=>{},
  _played: [], play(uri){ this._played.push(uri); return Promise.resolve(); },
  pause(){}, resume(){}, stop(){}, logout(){},
};
```

Now assert real integration behavior: selecting a playlist sets the soundtrack,
starting a guided cook calls `Spotify_.play("spotify:playlist:1")`, a rejecting
`play()` shows the fallback toast, etc. Deterministic, no Spotify needed.

### Example MCP test scenarios (sketch)
1. **Free gating:** open `/` → snapshot → assert "Unlock the full recipe library"
   visible, no "Easy picks".
2. **Unlock:** open sidebar → Premium → fill `Dev123` → Unlock → assert
   "Premium active" + Spotify/Apple tabs.
3. **Soundtrack → cook (mocked Spotify):** inject stub → Premium → Spotify →
   pick "Dinner" → start a TheMealDB guided cook → assert `Spotify_._played`
   contains `spotify:playlist:1`.

---

## 6. Acceptance criteria

- [ ] Connecting a **Premium** account and pressing Start on a guided cook streams
      the selected track (audible), starting on the Start gesture.
- [ ] A **free** account gets a clear message and the demo-track fallback (no
      silent failure).
- [ ] Real `play()` errors are surfaced (status/code), not swallowed.
- [ ] "Test playback" button on the Premium panel works as a quick diagnostic.
- [ ] Playwright MCP suite covers gating, Dev123, routing, and (mocked) play wiring.
