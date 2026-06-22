import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Alert, ScrollView } from "react-native";
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from "react-native-svg";
import * as Speech from "expo-speech";
import * as Haptics from "expo-haptics";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../../App";
import { EXPERIENCES, Cue, Gate } from "../data/experiences";
import CookVideoPlayer, { CookVideoHandle } from "../music/CookVideoPlayer";
import type { CookSession, StepStat } from "../engine/telemetry";
import { getProfile, isBeginner as isBeg } from "../engine/user";
import { getPrefs } from "../engine/prefs";
import { C, F } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Cook">;

const DEFAULT_GATE: Gate = {
  doneLabel: "Continue",
  notReadyCoach: "No rush — take your time. Tap continue when you're ready for the next step.",
  checkCoach: "Ready for the next step? Tap continue when you are.",
  nudgeSec: 0,
};

const R = 70, STROKE = 10, SIZE = 2 * R + STROKE + 8, CIRC = 2 * Math.PI * R;
const fmtClock = (s: number) => { const m = Math.floor(s / 60), x = Math.floor(s % 60); return `${m}:${String(x).padStart(2, "0")}`; };

export default function CookScreen({ route, navigation }: Props) {
  const exp = EXPERIENCES.find((e) => e.id === route.params.expId)!;

  const begRef = useRef(true); // beginner verbosity, loaded from saved profile
  const video = useRef<CookVideoHandle>(null);

  // ---- engine refs ----
  const songPos = useRef(0);
  const lastTs = useRef(0);
  const nextIdx = useRef(0);
  const fired = useRef<Set<number>>(new Set());
  const waiting = useRef(false);
  const paused = useRef(false);
  const started = useRef(false);
  const raf = useRef<number | null>(null);
  const curGate = useRef<Gate | null>(null);
  const waitStart = useRef(0);
  const waitExtends = useRef(0);
  const curStep = useRef<StepStat | null>(null);
  const voiceOn = useRef(true);
  const hapticsOn = useRef(true);
  const checkpointsOn = useRef(true);
  const session = useRef<CookSession>({
    mode: "music", recipe: exp.recipe.title, song: exp.song.title,
    equipment: { pan: null, heat: null }, experience: null, startedAt: Date.now(), steps: [], totalExtends: 0, completed: false,
  });

  const lastUiTs = useRef(0);
  const [ui, setUi] = useState({
    title: "Tap the video to begin", body: "One tap starts the music, the timer, and the voice.",
    nextLabel: "READY", cd: "--", waiting: false, doneLabel: "Continue", isDoneness: false, paused: false,
    ringFrac: 0, elapsedSec: 0,
  });
  const set = (p: Partial<typeof ui>) => setUi((u) => ({ ...u, ...p }));

  // stable onStart so the memoized video player never re-renders
  const beginRef = useRef(() => {});
  const onStart = useCallback(() => beginRef.current(), []);

  useEffect(() => {
    getProfile().then((p) => {
      begRef.current = isBeg(p);
      session.current.experience = p.experience;
      session.current.equipment = { pan: p.pan, heat: p.heat };
    });
    getPrefs().then((pr) => { voiceOn.current = pr.voice; hapticsOn.current = pr.haptics; checkpointsOn.current = pr.checkpoints; });
    return () => { if (raf.current) cancelAnimationFrame(raf.current); Speech.stop(); };
  }, []);

  function speak(text?: string) {
    if (!text || !voiceOn.current) return;
    Speech.stop();
    Speech.speak(text, {
      onStart: () => video.current?.duck(),
      onDone: () => video.current?.unduck(),
      onStopped: () => video.current?.unduck(),
    });
  }
  function haptic(p: Cue["haptic"]) {
    if (!hapticsOn.current) return;
    if (p === "tap") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    else if (p === "double") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (p === "strong") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }

  function applyCue(cue: Cue) {
    set({ title: cue.title, body: begRef.current ? cue.beginner : cue.body });
    haptic(cue.haptic);
    speak(cue.voice);
    const step: StepStat = { title: cue.title, type: cue.type, atSec: cue.at, firedSec: Math.round(songPos.current), waitSec: 0, extends: 0 };
    session.current.steps.push(step);
    curStep.current = step;
    if (cue.type === "finish") finishCook();
  }

  function enterWait(cue: Cue) {
    waiting.current = true;
    waitStart.current = Date.now();
    waitExtends.current = 0;
    curGate.current = cue.gate ?? DEFAULT_GATE;
    video.current?.setBackground(true); // keep playing, ducked
    set({ waiting: true, isDoneness: !!cue.gate, doneLabel: curGate.current.doneLabel, nextLabel: "READY WHEN YOU ARE", cd: "⏳" });
  }
  function notReady() {
    waitExtends.current += 1;
    speak(curGate.current?.notReadyCoach);
  }
  function onContinue() {
    if (!waiting.current) return;
    waiting.current = false;
    if (curStep.current) { curStep.current.waitSec = Math.round((Date.now() - waitStart.current) / 1000); curStep.current.extends = waitExtends.current; }
    session.current.totalExtends += waitExtends.current;
    video.current?.setBackground(false); // back to full volume — song never stopped or rewound
    lastTs.current = Date.now();
    set({ waiting: false });
    if (curGate.current?.doneCoach) speak(curGate.current.doneCoach);
  }

  function loop() {
    const now = Date.now();
    const dt = (now - lastTs.current) / 1000;
    lastTs.current = now;
    if (!waiting.current && !paused.current) songPos.current = Math.min(songPos.current + dt, exp.durationSec);

    // fire cues — every cue is a checkpoint except the first step + finish
    while (!waiting.current && nextIdx.current < exp.cues.length && songPos.current >= exp.cues[nextIdx.current].at) {
      const cue = exp.cues[nextIdx.current];
      if (!fired.current.has(nextIdx.current)) { fired.current.add(nextIdx.current); applyCue(cue); }
      nextIdx.current += 1;
      if (cue.type !== "finish" && nextIdx.current > 1 && (cue.gate || checkpointsOn.current)) { enterWait(cue); break; }
    }

    // throttle HUD/ring updates (~8fps) so the SVG + texts stay smooth without thrash
    if (now - lastUiTs.current >= 120) {
      lastUiTs.current = now;
      if (waiting.current) {
        set({ ringFrac: 1, elapsedSec: songPos.current });
      } else {
        const upcoming = exp.cues[fired.current.size];
        if (upcoming) {
          const remain = Math.max(0, upcoming.at - songPos.current);
          const prevAt = fired.current.size ? exp.cues[fired.current.size - 1].at : 0;
          const seg = Math.max(1, upcoming.at - prevAt);
          set({
            nextLabel: "NEXT: " + upcoming.title.toUpperCase(),
            cd: remain > 1 ? String(Math.ceil(remain)) : "GO",
            ringFrac: Math.min(1, (songPos.current - prevAt) / seg),
            elapsedSec: songPos.current,
          });
        } else {
          set({ nextLabel: "FINISHED", cd: "🎸", ringFrac: 1, elapsedSec: songPos.current });
        }
      }
    }
    if (songPos.current < exp.durationSec) raf.current = requestAnimationFrame(loop);
  }

  function begin() {
    if (started.current) return;
    started.current = true; paused.current = false;
    video.current?.resume();
    speak(begRef.current ? `Alright — I've got you. ${exp.song.title} is rolling, let's cook.` : `Let's cook. ${exp.song.title} is rolling.`);
    lastTs.current = Date.now();
    raf.current = requestAnimationFrame(loop);
  }
  beginRef.current = begin;

  function finishCook() {
    if (raf.current) cancelAnimationFrame(raf.current);
    Speech.stop();
    session.current.completed = true;
    session.current.durationSec = Math.round((Date.now() - session.current.startedAt) / 1000);
    setTimeout(() => navigation.replace("Finish", { session: session.current }), 600);
  }
  function stopAll() {
    if (raf.current) cancelAnimationFrame(raf.current);
    Speech.stop();
  }
  function confirmQuit() {
    Alert.alert("Quit this cook?", "Your progress will be lost.", [
      { text: "No", style: "cancel" },
      { text: "Yes, quit", style: "destructive", onPress: () => { stopAll(); navigation.goBack(); } },
    ]);
  }
  function togglePause() {
    paused.current = !paused.current;
    if (paused.current) { Speech.stop(); video.current?.pause(); } else { video.current?.resume(); }
    lastTs.current = Date.now();
    set({ paused: paused.current });
  }

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={styles.wrap}>
      <View style={styles.top}>
        <Text style={styles.np}><Text style={{ fontWeight: "800" }}>{exp.song.title}</Text>  ·  {exp.song.artist} · {exp.song.bpm} BPM</Text>
        <Pressable onPress={() => { voiceOn.current = !voiceOn.current; if (!voiceOn.current) Speech.stop(); }}>
          <Text style={styles.icon}>🔊</Text>
        </Pressable>
      </View>

      <CookVideoPlayer ref={video} videoId={exp.song.youtubeId} height={200} onStart={onStart} />

      <View style={styles.ringWrap}>
        <Svg width={SIZE} height={SIZE}>
          <Defs>
            <SvgGradient id="ring" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={C.flame1} />
              <Stop offset="1" stopColor={C.flame2} />
            </SvgGradient>
          </Defs>
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={C.line} strokeWidth={STROKE} fill="none" />
          <Circle
            cx={SIZE / 2} cy={SIZE / 2} r={R} stroke="url(#ring)" strokeWidth={STROKE} fill="none"
            strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - ui.ringFrac)} strokeLinecap="round"
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        </Svg>
        <View style={styles.ringLabel}>
          <Text style={styles.cdNext} numberOfLines={1}>{ui.nextLabel}</Text>
          <Text style={[styles.cd, ui.cd === "GO" && { color: C.pop }]}>{ui.cd}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{ui.title}</Text>
        <Text style={styles.cardBody}>{ui.body}</Text>
        {ui.waiting && (
          <View style={styles.gate}>
            <Pressable style={[styles.btn, styles.btnPrimary]} onPress={onContinue}>
              <Text style={styles.btnText}>{ui.isDoneness ? "✅ " : "▶ "}{ui.doneLabel}</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnSecondary]} onPress={notReady}>
              <Text style={styles.btnText}>⏳ Not yet</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.timeline}>
        <View style={styles.tlTrack}>
          <View style={[styles.tlFill, { width: `${(ui.elapsedSec / exp.durationSec) * 100}%` }]} />
          {exp.cues.map((c, i) => (
            <View key={i} style={[styles.tlMark, { left: `${(c.at / exp.durationSec) * 100}%` }, c.at <= ui.elapsedSec && styles.tlMarkDone]} />
          ))}
        </View>
        <View style={styles.tlTimes}>
          <Text style={styles.tlTime}>{fmtClock(ui.elapsedSec)}</Text>
          <Text style={styles.tlTime}>{fmtClock(exp.durationSec)}</Text>
        </View>
      </View>

      <View style={styles.controls}>
        <Pressable style={[styles.btn, styles.btnSecondary, { flex: 1 }]} onPress={togglePause}>
          <Text style={styles.btnText}>{ui.paused ? "▶ Resume" : "⏸ Pause"}</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.btnGhost]} onPress={confirmQuit}>
          <Text style={[styles.btnText, { color: C.muted }]}>Quit</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, paddingTop: 54, gap: 12 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  np: { color: C.muted, fontSize: 12, flex: 1 },
  icon: { fontSize: 18 },
  ringWrap: { alignItems: "center", justifyContent: "center", paddingVertical: 2 },
  ringLabel: { position: "absolute", alignItems: "center", justifyContent: "center", width: SIZE },
  cdNext: { color: C.muted, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", maxWidth: SIZE - 30, textAlign: "center" },
  cd: { color: C.text, fontSize: 38, fontFamily: F.display, fontVariant: ["tabular-nums"], marginTop: 2 },
  timeline: { gap: 8 },
  tlTrack: { height: 8, backgroundColor: C.card2, borderRadius: 99, justifyContent: "center" },
  tlFill: { position: "absolute", left: 0, height: 8, backgroundColor: C.flame2, borderRadius: 99 },
  tlMark: { position: "absolute", width: 10, height: 10, borderRadius: 5, marginLeft: -5, backgroundColor: C.bg, borderColor: C.line, borderWidth: 2 },
  tlMarkDone: { backgroundColor: C.flame2, borderColor: C.flame2 },
  tlTimes: { flexDirection: "row", justifyContent: "space-between" },
  tlTime: { color: C.muted, fontSize: 11 },
  card: { backgroundColor: C.card, borderColor: C.line, borderWidth: 1, borderRadius: 18, padding: 20, minHeight: 150 },
  cardTitle: { color: C.text, fontSize: 26, fontFamily: F.display },
  cardBody: { color: C.text, fontSize: 16, lineHeight: 23, marginTop: 10 },
  gate: { flexDirection: "row", gap: 10, marginTop: 16 },
  controls: { flexDirection: "row", gap: 10 },
  btn: { paddingVertical: 15, paddingHorizontal: 18, borderRadius: 14, alignItems: "center" },
  btnPrimary: { backgroundColor: C.flame2, flex: 1 },
  btnSecondary: { backgroundColor: C.card2, borderColor: C.line, borderWidth: 1, flex: 1 },
  btnGhost: { backgroundColor: "transparent" },
  btnText: { color: C.text, fontWeight: "800", fontSize: 16 },
});
