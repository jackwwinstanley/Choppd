# Dev build — real Spotify / Apple Music SDKs

The native music SDKs (`react-native-spotify-remote`, Apple MusicKit) **cannot run
in Expo Go** — Expo Go only ships Expo's built-in native modules. You need a
**custom development build** (your own app binary that includes the native code),
then `expo start` connects to it just like Expo Go.

Everything else (the cook engine, YouTube embed, telemetry, premium gating) already
works in Expo Go — this is only needed to replace the **simulated** Spotify/Apple
connect in `PremiumScreen` with the real thing.

## One-time setup

```bash
npm i -g eas-cli
cd mobile
eas login                 # your Expo account
eas init                  # creates the project + writes extra.eas.projectId into app.json
npx expo install expo-dev-client
```

## Add the Spotify SDK

```bash
npx expo install react-native-spotify-remote
```

1. Register an app at **developer.spotify.com** → get a **Client ID** and set a
   **Redirect URI** (e.g. `seartune://spotify-auth-callback`).
2. In `app.json`, add the iOS URL scheme so the OAuth callback returns to the app:

```jsonc
"ios": {
  "bundleIdentifier": "pro.nodaysoff.seartune",
  "infoPlist": {
    "LSApplicationQueriesSchemes": ["spotify"],
    "CFBundleURLTypes": [{ "CFBundleURLSchemes": ["seartune"] }]
  }
}
```

3. Fill in `src/music/MusicProvider.ts → SpotifyProvider` (the stubs map 1:1 to
   `react-native-spotify-remote`'s `auth` + `remote` API). Premium playback
   requires the user to have **Spotify Premium** and the Spotify app installed.

> Apple Music: bridge **MusicKit** natively (no first-party RN lib) — needs the
> MusicKit entitlement + a signed Developer Token (JWT) from your Apple Developer
> account. Wire it into `AppleMusicProvider`.

## Build & run the dev client

```bash
# iOS device (needs an Apple Developer account for signing)
eas build --profile development --platform ios

# install the build on your iPhone (TestFlight or the QR EAS gives you), then:
npx expo start --dev-client
```

## App Store / TestFlight (your outline item 4)

```bash
eas build --profile production --platform ios
eas submit --platform ios          # uploads to App Store Connect → TestFlight
```

Then in **App Store Connect**: add testers to **TestFlight** for dev testing.

## Where the simulation lives now

`PremiumScreen.tsx → connect()` currently fakes the OAuth + premium check so the
**gating logic is testable in Expo Go**. In a dev build, replace that call with
`SpotifyProvider.connect()` / `.isPremium()` from `MusicProvider.ts`, and persist
the result into the same `entitlement` store — the rest of the app already reads it.
