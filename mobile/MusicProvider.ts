/**
 * MusicProvider — the abstraction the cook engine talks to, so Spotify,
 * Apple Music, and the YouTube embed are interchangeable (PLAN.md §4.3 `music`).
 *
 * The cook engine never imports a vendor SDK directly — it calls this interface.
 * Swap providers based on the user's connected account + entitlement.
 *
 * ⚠️ These are reference implementations. They require:
 *   - the React Native app (no Node/Expo on the current machine)
 *   - real developer credentials & native config (below)
 * so they are documented stubs, not runnable here.
 */

export type PlayerState = "idle" | "playing" | "paused" | "ended" | "error";

export interface MusicProvider {
  readonly id: "spotify" | "appleMusic" | "youtube";
  connect(): Promise<boolean>;               // OAuth / authorization
  isConnected(): Promise<boolean>;
  isPremium(): Promise<boolean>;             // gates custom-song selection (PLAN.md)
  load(trackRef: string): Promise<void>;     // provider-specific id/uri
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(sec: number): Promise<void>;
  position(): Promise<number>;               // seconds — drives the cue clock
  setVolume(pct: number): Promise<void>;     // duck under voice / background at checkpoints
  on(event: "state", cb: (s: PlayerState) => void): void;
}

/* ============================================================
   Spotify — react-native-spotify-remote (Premium accounts only)
   npm: react-native-spotify-remote
   Needs: Spotify app registered at developer.spotify.com,
          redirect URI, iOS URL scheme, the Spotify app installed.
   ============================================================ */
// import { remote, auth } from "react-native-spotify-remote";
export const SpotifyProvider: MusicProvider = {
  id: "spotify",
  async connect() {
    // const token = await auth.authorize({ clientID, redirectURL, scopes: [...] });
    // await remote.connect(token.accessToken);
    return true;
  },
  async isConnected() { /* return remote.isConnectedAsync() */ return false; },
  async isPremium() { /* check via Web API /v1/me → product === "premium" */ return false; },
  async load(uri) { /* await remote.playUri(uri) */ },
  async play() { /* await remote.resume() */ },
  async pause() { /* await remote.pause() */ },
  async seek(sec) { /* await remote.seek(sec * 1000) */ },
  async position() { /* const s = await remote.getPlayerState(); return s.playbackPosition / 1000 */ return 0; },
  async setVolume(_pct) { /* remote has no per-track volume on mobile — duck the VOICE instead */ },
  on(_e, _cb) { /* remote.addListener("playerStateChanged", ...) */ },
};

/* ============================================================
   Apple Music — MusicKit (iOS). No first-party RN lib; bridge MusicKit
   natively, or use a community module. Needs the MusicKit entitlement +
   a Developer Token (signed JWT) from your Apple Developer account.
   ============================================================ */
export const AppleMusicProvider: MusicProvider = {
  id: "appleMusic",
  async connect() { /* SKCloudServiceController / MusicKit authorization */ return true; },
  async isConnected() { return false; },
  async isPremium() { /* MusicKit subscription status */ return false; },
  async load(_id) { /* MPMusicPlayerController setQueue */ },
  async play() {},
  async pause() {},
  async seek(_sec) {},
  async position() { return 0; },
  async setVolume(_pct) {},
  on(_e, _cb) {},
};

/* ============================================================
   YouTube — wraps CookVideoPlayer (free tier). position() comes from the
   embed; volume via the player ref. See CookVideoPlayer.tsx.
   ============================================================ */
// Built from the CookVideoHandle ref in CookVideoPlayer.tsx.

export function pickProvider(opts: {
  appPremium: boolean;
  spotifyPremium: boolean;
  appleMusicConnected: boolean;
}): MusicProvider {
  // Custom song selection needs BOTH app Premium AND platform Premium (PLAN.md).
  if (opts.appPremium && opts.spotifyPremium) return SpotifyProvider;
  if (opts.appPremium && opts.appleMusicConnected) return AppleMusicProvider;
  // free tier → curated YouTube experiences (handled by CookVideoPlayer)
  return SpotifyProvider; // placeholder; wire the YouTube provider in the app
}
