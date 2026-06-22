# Launch Plan — your outline, sequenced & reality-checked

Your four items, in build order, with **what's done**, **what I can build here**,
and **what needs your dev machine + accounts** (this machine has no Node/Expo and
no Apple/Spotify credentials, and the `mvp/` demo is browser-only).

---

## 1. Embed YouTube videos  ✅ mostly done
- **Web demo (`mvp/`):** official video embedded above the timer, one-tap start,
  error-code fallback ("Watch on YouTube"). Browser can't fake origin, so VEVO
  tracks often hit Error 150 → fallback. *Done.*
- **Mobile (`mobile/src/music/CookVideoPlayer.tsx`):** the real fix — WebView `baseUrl`
  makes the Referer your domain, clearing Error 150 for standard tracks. *Drop-in
  ready; needs the Expo app to run.*
- **Next:** scaffold the Expo app and mount `CookVideoPlayer`. (Needs Node/Expo.)

## 2. Spotify + Apple Music SDKs  🟡 reference scaffolded, needs app + credentials
What I built here: **`mobile/src/music/MusicProvider.ts`** — the provider interface +
Spotify/Apple Music/YouTube stubs, and `pickProvider()` enforcing the
"custom song needs app-Premium **AND** platform-Premium" rule.

To make it real (on your machine):
- **Spotify:** register an app at developer.spotify.com → clientID, redirect URI,
  iOS URL scheme; `npx expo install react-native-spotify-remote`; Premium account
  required for playback. Wire into `SpotifyProvider`.
- **Apple Music:** Apple Developer account → MusicKit entitlement + a signed
  **Developer Token (JWT)**; bridge MusicKit natively (no first-party RN lib).
  Wire into `AppleMusicProvider`.
- **Backend:** the OAuth token exchange / refresh + the entitlement check belong
  on the Node/EC2 API (PLAN.md §4.3 `music` + `entitlements`), not the client.

> ⚠️ I can't run or auth these here (no native toolchain, no credentials). The
> scaffold is correct against each SDK's API; you supply keys on your dev setup.

## 3. Cook info JSON: meal + star rating  ✅ done (already captured)
The session telemetry **already records the meal and the stars.** I added a
`finishedAt` ISO timestamp. Current shape per completed cook (in
`localStorage["seartune_sessions"]`, viewable in **Settings → Session log**):

```jsonc
{
  "mode": "music" | "guided",
  "recipe": "Medium-Rare Steak",      // ← the MEAL the person cooked
  "rating": 4.5,                       // ← STARS (0.5–5, half-steps)
  "song": "Free Bird",                 // music cooks only
  "category": "Beef", "difficulty": "easy",   // guided cooks only
  "experience": "beginner",            // self-reported skill
  "equipment": { "pan": "cast-iron", "heat": "gas" },
  "startedAt": 1718995200000,
  "finishedAt": "2026-06-22T18:40:00.000Z",
  "durationSec": 512,
  "completed": true,
  "hasPhoto": true,
  "totalExtends": 3,                   // total "not yet" presses
  "steps": [                           // per-step behavior (flywheel seed)
    { "title": "Flip it — once", "authoredSec": 210, "actualSec": 268, "extends": 2 }
    // music cooks: { title, type, atSec, firedSec, waitSec, extends }
  ]
}
```
**So: meal = `recipe`, stars = `rating`.** Both present. *Done.* (In production this
streams to the backend instead of localStorage — same schema.)

## 4. Launch on App Store for Dev Testing  🔴 needs accounts + the native build
Can't be done from here — requires the Expo app, an **Apple Developer Program**
membership ($99/yr), and a Mac with Xcode. The sequence once the app exists:
1. `eas build --platform ios` (Expo EAS) → signed build.
2. App Store Connect: create the app record, bundle ID, privacy labels.
3. Upload build → **TestFlight** → invite internal/external testers (dev testing).
4. Iterate; later submit for App Store review.

> Items 1–3 of *your* outline must land first (the Expo app must exist and embed
> the player + a provider). #4 is the wrapper around them.

---

## Recommended order
1. ✅ **Expo app scaffolded** in `mobile/` (Home → Cook → Finish, engine ported,
   `CookVideoPlayer` mounted). Run on your Mac: `cd mobile && npm install && npx expo install && npx expo start`.
2. Mount **`CookVideoPlayer`** (item 1) → confirm Error 150 is gone on a device. *(done in CookScreen)*
3. Wire **Spotify** first via `MusicProvider` (item 2); Apple Music after.
4. Point telemetry (item 3) at the backend; keep the same JSON.
5. **EAS build → TestFlight** (item 4).

## What I can do next from here
- Write the **full minimal Expo project skeleton** (package.json, App.tsx,
  navigation, a cook screen mounting `CookVideoPlayer`) so it's `npm install &&
  expo start`-ready on your machine.
- Port the cook engine (cues, gates, telemetry) from `mvp/` into RN/TS modules.
- Flesh out `SpotifyProvider` to a complete (credential-pending) implementation.
