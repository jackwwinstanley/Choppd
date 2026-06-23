# Spotify Playback — play real Spotify songs on any TheMealDB recipe

**Goal:** a Premium user connects Spotify, picks **any song or playlist**, and when
they cook **any TheMealDB recipe** (guided cook) that track streams live through the
Spotify Web Playback SDK — start, pause, resume, and stop driven from the cook UI.

Files: [`mvp/spotify.js`](mvp/spotify.js) (auth + Web Playback SDK),
[`mvp/app.js`](mvp/app.js) (Premium screen, recipe detail, guided cook engine).

---

## 1. Hard requirements (can't be coded around)

- **The listener's Spotify account must be Premium.** The Web Playback SDK only
  streams full tracks for Premium accounts; free accounts fire `account_error`.
  This is a Spotify rule — for non-Premium users we fall back to a demo track.
- **A Spotify app Client ID** (free, from the Spotify dashboard), with this exact
  **Redirect URI** registered: whatever `Spotify_.redirectUri()` shows
  (`http://127.0.0.1:4173/` for local dev; the `https://…` origin in production).
- **Served over a secure context** (localhost/127.0.0.1 or https) for the SDK's
  encrypted-media playback.

## 2. What already works

- OAuth (PKCE) login, token refresh, and library reads (`me`, `search`,
  `myPlaylists`, `myTopTracks`). Picking an item stores `state.spotifyUri` /
  `state.spotifyLabel`, which already applies globally to every guided cook.
- A partial playback path exists in the guided cook ([`app.js:1167`](mvp/app.js#L1167))
  but it's missing gesture-activation, device transfer, Premium detection, and
  error surfacing — so it silently fails.

---

## 3. Implementation

### Step 1 — Harden the playback core (`mvp/spotify.js`)

Add/replace these so playback is reliable:

- **`activate()`** — `await player.activateElement()`. Browsers only allow audio
  that begins inside a user gesture; this must be called from the click that starts
  the cook (see Step 3).
- **`ensureDevice()`** — `loadSdk()` then `whenReady()`, returning a real
  `device_id`; reject clearly if the SDK never readies (typically a non-Premium
  account or blocked media).
- **`transferTo(deviceId)`** — `PUT /me/player` with `{device_ids:[id], play:false}`
  so our browser becomes the active Spotify device.
- **`play(uri)`** — `ensureDevice()` → `transferTo()` → `PUT /me/player/play?device_id=…`
  with `{uris:[uri]}` for a track or `{context_uri:uri}` for a playlist/album;
  **retry once** on `404 Device not found` after re-transfer. Throw a structured
  error `{status, code}` instead of swallowing it.
- **`isPremiumAccount()`** — resolve `me().product === "premium"`; cache it on connect.
- **`onState(cb)`** — wire `player.addListener("player_state_changed", cb)` so the
  cook UI can show now-playing + paused state.

Keep `pause()` / `resume()` / `stop()` (already present) and make `stop()` also
clear the active track.

### Step 2 — Choose a Spotify track per recipe (`mvp/app.js`, recipe detail)

On the TheMealDB recipe detail screen ([`screens.recipeDetail`](mvp/app.js#L997)),
when Premium + Spotify-connected:

- Show the current pick ("▶ Spotify: *<name>*") and a **"Choose Spotify music"**
  button that opens the same library panel used on the Premium screen (playlists /
  top tracks / search) inline, OR routes to it and returns. Selecting sets
  `state.spotifyUri` / `state.spotifyLabel` (already wired) and clears
  `state.customAudio`.
- The selection is global, so it automatically applies to **any** TheMealDB recipe
  the user cooks next — satisfying "play on any of the recipes."

### Step 3 — Stream during the guided cook (`mvp/app.js`, `screens.guidedCook`)

- On the **Start cook** button click (the user gesture), in this order:
  `await Spotify_.activate()` → `await Spotify_.play(state.spotifyUri)`.
  Doing both inside the click is what unlocks audio.
- Gate on Premium: if `!await Spotify_.isPremiumAccount()`, skip the SDK, play the
  bundled demo track, and toast once: *"Spotify Premium required for in-app
  playback — playing a demo track instead."*
- On a real `play()` error, surface the reason (status/code) and fall back to the
  demo track rather than failing silently.
- `Spotify_.stop()` on quit and on finish (extend the existing cleanup).

### Step 4 — In-cook now-playing controls

- A small bar in the guided-cook screen: track name, **⏯ pause/resume**, volume,
  fed by `Spotify_.onState()`. Pause when the user leaves the screen; resume on return.

---

## 4. Files & touch-points

| Change | Where |
|---|---|
| `activate`, `ensureDevice`, `transferTo`, robust `play`, `isPremiumAccount`, `onState` | `mvp/spotify.js` |
| Inline "Choose Spotify music" picker on recipe detail | `mvp/app.js` `screens.recipeDetail` (~L997) |
| Activate + play on Start gesture; Premium gate; fallback; stop on quit/finish | `mvp/app.js` `screens.guidedCook` (~L1167) |
| Now-playing bar + controls | `mvp/app.js` guided-cook render |

## 5. Acceptance criteria

- [ ] Connect a **Premium** Spotify account, pick any song/playlist, start **any**
      TheMealDB recipe → that track streams audibly, beginning on the Start tap.
- [ ] Pause/resume/stop from the cook screen control real Spotify playback.
- [ ] Switching to a different TheMealDB recipe uses the same chosen track (or a new
      one if changed on that recipe's detail screen).
- [ ] **Free** account → clear message + demo-track fallback (no silent failure).
- [ ] Real errors (`account_error`, `404`, `401`) are surfaced, not swallowed.

## 6. Quick verification

1. `cd mvp && python3 serve.py`, open `http://127.0.0.1:4173/`.
2. Premium → enter `Dev123` → Spotify → paste Client ID → log in (Premium account).
3. Pick a playlist → Explore a TheMealDB recipe → Start guided cook → hear it play;
   test pause/resume/stop.
