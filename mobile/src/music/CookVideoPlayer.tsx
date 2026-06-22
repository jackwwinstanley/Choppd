/**
 * CookVideoPlayer — React Native YouTube player for the free-tier cook.
 *
 * THE FIX FOR YOUTUBE ERROR 150:
 * react-native-webview lets us load the embed *as* a real domain via
 * `webViewProps.baseUrl`. That makes the browser send a real
 * `Referer: https://nodaysoff.pro`, which satisfies YouTube's origin check and
 * clears the "embedding disabled" Error 150 for standard tracks. (A plain web
 * browser can't do this — it can't fake the document origin — which is why the
 * mvp/ web demo only has a "Watch on YouTube" fallback.)
 *
 * Caveat: if a label hard-whitelists embeds to youtube.com/vevo.com ONLY, no
 * referer trick bypasses it — handle that with the onError fallback below.
 *
 * Deps:  expo install react-native-youtube-iframe react-native-webview
 */
import React, { useCallback, useImperativeHandle, useRef, useState, forwardRef } from "react";
import { View, Text, Pressable, Linking, StyleSheet } from "react-native";
import YoutubePlayer, { YoutubeIframeRef } from "react-native-youtube-iframe";

// Your verified, real public domain. This is the whole fix.
const SITE_ORIGIN = "https://nodaysoff.pro";

const ERR_TEXT: Record<string, string> = {
  embed_not_allowed: "embedding disabled by owner (150/101)",
  video_not_found: "video not found / private (100)",
  invalid_parameter: "invalid video ID (2)",
  HTML5_error: "HTML5 player error (5)",
};

export type CookVideoHandle = {
  /** duck the music under a voice cue / down to background during a checkpoint */
  duck: () => void;
  unduck: () => void;
  setBackground: (on: boolean) => void;
  seekTo: (sec: number) => void;
  getTime: () => Promise<number>;
  pause: () => void;
  resume: () => void;
};

type Props = {
  videoId: string;
  height?: number;
  /** called when the user taps to start — kick off the cook timer + voice here */
  onStart?: () => void;
};

const CookVideoPlayer = forwardRef<CookVideoHandle, Props>(function CookVideoPlayer(
  { videoId, height = 210, onStart },
  ref
) {
  const player = useRef<YoutubeIframeRef>(null);
  // Autoplay MUTED from mount (allowed without a webview gesture); the single
  // tap then UN-mutes (the tap is a valid gesture) → music starts on first press.
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(100);
  const [started, setStarted] = useState(false);
  const bg = useRef(false);
  const [error, setError] = useState<string | null>(null);

  // The whole cook (video + timer + voice) starts on this single tap.
  const start = useCallback(() => {
    if (started) return;
    setStarted(true);
    setMuted(false);          // un-mute on the user gesture → audio plays immediately
    setVolume(100);
    onStart?.();
  }, [started, onStart]);

  useImperativeHandle(ref, () => ({
    duck: () => setVolume(bg.current ? 8 : 18),
    unduck: () => setVolume(bg.current ? 40 : 100),
    setBackground: (on: boolean) => { bg.current = on; setVolume(on ? 40 : 100); },
    seekTo: (sec: number) => player.current?.seekTo(sec, true),
    getTime: async () => (await player.current?.getCurrentTime()) ?? 0,
    pause: () => setPlaying(false),
    resume: () => setPlaying(true),
  }));

  const onError = useCallback((e: string) => setError(e), []);
  const onChangeState = useCallback((s: string) => {
    if (s === "playing") setError(null);
    if (s === "ended") setPlaying(false);
  }, []);

  const openOnYouTube = () => {
    // native app first, then web fallback
    Linking.openURL(`youtube://www.youtube.com/watch?v=${videoId}`).catch(() =>
      Linking.openURL(`https://www.youtube.com/watch?v=${videoId}`)
    );
  };

  return (
    <View style={[styles.wrap, { height }]}>
      <YoutubePlayer
        ref={player}
        height={height}
        play={playing}
        mute={muted}
        volume={volume}
        forceAndroidAutoplay
        videoId={videoId}
        onError={onError}
        onChangeState={onChangeState}
        webViewProps={{
          // ← the fix: the WebView loads as your real domain
          baseUrl: SITE_ORIGIN,
          androidLayerType: "hardware",
          allowsInlineMediaPlayback: true,
          mediaPlaybackRequiresUserAction: false,
        }}
        initialPlayerParams={{
          origin: SITE_ORIGIN,
          modestbranding: true,
          rel: false,
          controls: true,
        }}
      />

      {(!started || error) && (
        <Pressable style={styles.overlay} onPress={error ? undefined : start}>
          {!error && <View style={styles.playBtn}><Text style={styles.playIcon}>▶</Text></View>}
          <Text style={styles.label}>
            {error ? "Couldn't embed this track" : "Tap to start cooking"}
          </Text>
          {error && (
            <>
              <Text style={styles.err}>YouTube error · {ERR_TEXT[error] ?? error}</Text>
              <Text style={styles.link} onPress={openOnYouTube}>Watch on YouTube ↗</Text>
              <Text style={styles.linkAlt} onPress={start}>or tap to cook without music</Text>
            </>
          )}
        </Pressable>
      )}
    </View>
  );
});

export default CookVideoPlayer;

const styles = StyleSheet.create({
  wrap: { borderRadius: 16, overflow: "hidden", backgroundColor: "#000", borderWidth: 1, borderColor: "#33334a" },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "rgba(12,7,16,0.86)" },
  playBtn: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center", backgroundColor: "#ff2d7e" },
  playIcon: { color: "#fff", fontSize: 24, marginLeft: 4 },
  label: { color: "#fff", fontWeight: "700", fontSize: 14 },
  err: { color: "#ff8a9c", fontSize: 12, fontWeight: "600" },
  link: { color: "#fff", textDecorationLine: "underline", fontSize: 13 },
  linkAlt: { color: "#9a9ab0", fontSize: 12 },
});
