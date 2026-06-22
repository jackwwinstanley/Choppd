# mobile/ — SearTune (Expo / React Native)

The native app skeleton: ports the web demo's cook engine to React Native and
embeds YouTube the **mobile** way (WebView `baseUrl` → clears Error 150, which a
browser can't do). Written on a machine without Node/Expo, so it's a **drop-in
to run on your Mac** — not built/tested here.

## Run it

> Safest path if dependency versions have drifted: create a fresh Expo app and
> copy `src/`, `App.tsx`, `index.ts` into it.

```bash
cd mobile
npm install
npx expo install            # aligns native deps to your Expo SDK
npx expo start              # press i for iOS simulator (needs Xcode)
```

Key deps (see package.json): `react-native-youtube-iframe`, `react-native-webview`,
`@react-navigation/*`, `expo-speech`, `expo-haptics`, `@react-native-async-storage/async-storage`.

## Structure

```
mobile/
  App.tsx                       navigation (Home → Cook → Finish)
  src/
    theme.ts                    dark violet palette (matches the web demo)
    data/experiences.ts         Free Bird steak + Here Comes the Sun eggs (cues, gates, youtubeId, bpm)
    engine/telemetry.ts         cook-session log (meal + stars) via AsyncStorage
    music/
      CookVideoPlayer.tsx       YouTube embed + baseUrl/origin fix + tap-to-start + error fallback
      MusicProvider.ts          Spotify / Apple Music / YouTube provider interface (item 2)
    screens/
      HomeScreen.tsx            list of music cooks
      CookScreen.tsx            the engine: timer + cues + checkpoints + voice + haptics + telemetry
      FinishScreen.tsx          mandatory half-star rating → saves the session
```

## What's wired vs. TODO

**Wired:** YouTube embed with the origin fix, one-tap start of the whole cook,
per-step Continue/Not-yet checkpoints, doneness gates, voice (expo-speech),
haptics, the song-keeps-playing model, telemetry (meal + stars), finish rating.

**TODO (next):**
- **Onboarding** (experience + equipment) — CookScreen currently uses defaults.
- **Parametric timing / skill detection** — port `adjustedSec`/`detectedPace`.
- **Spotify / Apple Music** — fill in `MusicProvider.ts` with real SDK calls +
  credentials (see LAUNCH_PLAN.md). The cook engine should read `position()` from
  the provider for true playback-position sync (premium tiers).
- **TheMealDB catalog + guided cook** — port from the web demo.
- **Video ducking:** `react-native-youtube-iframe` may not expose `setVolume`;
  duck via its `mute`/injected JS or just duck the voice. (`CookVideoPlayer`
  calls `setVolume` defensively — it no-ops if unavailable.)

## Set your domain
In `src/music/CookVideoPlayer.tsx`, set `SITE_ORIGIN = "https://nodaysoff.pro"`
(your verified domain) — that's the Error-150 fix.
