# mobile/ — React Native YouTube fix (Error 150)

This folder holds the **mobile-app** implementation of the YouTube embed, which
is where your `baseUrl`/`origin` idea actually works.

## Why this is here (and not in the web demo)

| | Web demo (`mvp/`) | Mobile app (React Native) |
|---|---|---|
| Can fake the document origin? | ❌ browser forbids it | ✅ via WebView `baseUrl` |
| Real `Referer` sent to YouTube | `127.0.0.1` (triggers Error 150) | `https://nodaysoff.pro` |
| Result for VEVO tracks | usually blocked → fallback | usually plays |

A browser sets `Referer`/origin from the real page URL and JS can't change it,
so the web demo can only offer a "Watch on YouTube" fallback. A React Native
**WebView can load the embed as your domain**, which is the legitimate fix.

## The fix, in one place

`CookVideoPlayer.tsx` passes your domain through both layers:

```tsx
webViewProps={{ baseUrl: "https://nodaysoff.pro" }}        // WebView document origin → real Referer
initialPlayerParams={{ origin: "https://nodaysoff.pro" }}  // YouTube IFrame API handshake
```

Change `SITE_ORIGIN` at the top of the file to your verified domain.

## Using it in the Expo app

```bash
# in your Expo project (not this machine — no Node/Expo here)
npx create-expo-app@latest seartune --template
cd seartune
npx expo install react-native-youtube-iframe react-native-webview
# copy CookVideoPlayer.tsx into the project
```

```tsx
import CookVideoPlayer, { CookVideoHandle } from "./CookVideoPlayer";

const videoRef = useRef<CookVideoHandle>(null);

<CookVideoPlayer
  ref={videoRef}
  videoId="0LwcvjNJTuM"            // Free Bird (eggs: KQetemT1sWc)
  onStart={() => startCookTimerAndVoice()}  // one tap starts everything
/>

// from the cook engine:
videoRef.current?.duck();             // under a voice cue
videoRef.current?.setBackground(true);// during a doneness checkpoint
videoRef.current?.pause();            // on Pause
```

`onStart` mirrors the web demo: **one tap on the player starts the video, the
cook timer, and the voice together.**

## Honest limits

- I can't build/run this here (no Node/Expo on this machine) — it's a drop-in
  for when you scaffold the Expo app. The code follows
  `react-native-youtube-iframe`'s documented API.
- `baseUrl` clears origin/referer-based Error 150. If a label **hard-whitelists**
  embeds to youtube.com/vevo.com only, no referer trick bypasses it — that's
  what the `onError` → "Watch on YouTube" fallback (with the error code) is for.
- For a fully licensed free tier with **background audio + your own ads**, a
  royalty-free/licensed catalog is still the durable path (see PLAN.md / the
  competitive analysis). YouTube embed is a great free-tier option where it
  plays; the fallback covers where it doesn't.
