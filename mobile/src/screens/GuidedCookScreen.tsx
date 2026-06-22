import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, Alert, ScrollView, StyleSheet } from "react-native";
import * as Speech from "expo-speech";
import * as Haptics from "expo-haptics";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../../App";
import { C } from "../theme";
import { getProfile, detectedPace, makeAdjuster, isBeginner, Profile } from "../engine/user";
import { getPrefs } from "../engine/prefs";
import type { CookSession } from "../engine/telemetry";

type Props = NativeStackScreenProps<RootStackParamList, "GuidedCook">;

const fmtClock = (s: number) => { const m = Math.floor(s / 60), x = s % 60; return m ? `${m}:${String(x).padStart(2, "0")}` : `0:${String(x).padStart(2, "0")}`; };

export default function GuidedCookScreen({ route, navigation }: Props) {
  const r = route.params.recipe;
  const [profile, setProf] = useState<Profile | null>(null);
  const adjust = useRef<(b: number) => number>((b) => b);
  const [idx, setIdx] = useState(0);
  const [remain, setRemain] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepStart = useRef(0);
  const stepExtends = useRef(0);
  const session = useRef<CookSession | null>(null);
  const voiceOn = useRef(true);
  const hapticsOn = useRef(true);

  useEffect(() => {
    (async () => {
      const p = await getProfile();
      const pace = await detectedPace();
      const pr = await getPrefs();
      voiceOn.current = pr.voice; hapticsOn.current = pr.haptics;
      adjust.current = makeAdjuster(p, pace);
      setProf(p);
      session.current = {
        mode: "guided", recipe: r.title, equipment: { pan: p.pan, heat: p.heat },
        experience: p.experience, startedAt: Date.now(), steps: [], totalExtends: 0, completed: false,
      };
    })();
    return () => { if (timer.current) clearInterval(timer.current); Speech.stop(); };
  }, []);

  // (re)start the advisory countdown + voice whenever the step changes
  useEffect(() => {
    if (!profile) return;
    const step = r.steps[idx];
    const adj = adjust.current(step.timing.typicalSec);
    stepStart.current = Date.now();
    stepExtends.current = 0;
    setRemain(adj);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => setRemain((x) => (x > 0 ? x - 1 : 0)), 1000);
    if (voiceOn.current) Speech.speak(step.text + (step.gate ? " " + step.gate.prompt : ""));
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [idx, profile]);

  if (!profile) return <View style={{ flex: 1, backgroundColor: C.bg }} />;

  const step = r.steps[idx];
  const isDone = !!step.gate;
  const total = r.steps.length;

  const advance = () => {
    if (timer.current) clearInterval(timer.current);
    if (hapticsOn.current) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const s = session.current!;
    s.steps.push({ title: step.text.slice(0, 40), authoredSec: step.timing.typicalSec, actualSec: Math.round((Date.now() - stepStart.current) / 1000), extends: stepExtends.current });
    if (idx >= total - 1) {
      Speech.stop();
      s.completed = true; s.durationSec = Math.round((Date.now() - s.startedAt) / 1000);
      navigation.replace("Finish", { session: s });
      return;
    }
    setIdx(idx + 1);
  };
  const notReady = () => { stepExtends.current += 1; session.current!.totalExtends += 1; if (hapticsOn.current) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); if (voiceOn.current) Speech.speak(step.gate!.notReadyCoach); setRemain(60); };
  const quit = () => Alert.alert("Quit this cook?", "Your progress will be lost.", [
    { text: "No", style: "cancel" },
    { text: "Yes, quit", style: "destructive", onPress: () => { if (timer.current) clearInterval(timer.current); Speech.stop(); navigation.goBack(); } },
  ]);

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={styles.wrap}>
      <View style={styles.top}>
        <Pressable onPress={quit}><Text style={styles.quit}>✕</Text></Pressable>
        <Text style={styles.title}>{r.emoji} {r.title}</Text>
        <View style={{ width: 20 }} />
      </View>

      <View style={styles.bar}><View style={[styles.fill, { width: `${(idx / total) * 100}%` }]} /></View>
      <Text style={styles.stepNo}>Step {idx + 1} of {total} · ⏱ {fmtClock(adjust.current(step.timing.typicalSec))} timed for you</Text>

      <View style={styles.card}>
        <Text style={[styles.tag, isDone && styles.tagDone]}>{isDone ? "DONENESS CHECK" : step.active ? "DO THIS" : "WAIT"}</Text>
        <Text style={[styles.cd, remain === 0 && { color: C.pop }]}>{remain > 0 ? fmtClock(remain) : "⏱ check it"}</Text>
        <Text style={styles.text}>{step.text}</Text>
        {isDone && <Text style={styles.safety}>🌡️ {step.gate!.prompt}</Text>}
      </View>

      <View style={styles.controls}>
        {isDone ? (
          <>
            <Pressable style={[styles.btn, styles.primary]} onPress={advance}><Text style={styles.btnText}>✅ {step.gate!.doneLabel}</Text></Pressable>
            <Pressable style={[styles.btn, styles.secondary]} onPress={notReady}><Text style={styles.btnText}>⏳ Not yet</Text></Pressable>
          </>
        ) : (
          <Pressable style={[styles.btn, styles.primary]} onPress={advance}><Text style={styles.btnText}>{idx === total - 1 ? "🎉 Finish" : "Next step →"}</Text></Pressable>
        )}
      </View>
      {idx > 0 && <Pressable onPress={() => setIdx(idx - 1)}><Text style={styles.back}>← Previous</Text></Pressable>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, paddingTop: 54, gap: 12 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  quit: { color: C.muted, fontSize: 20 },
  title: { color: C.text, fontWeight: "800", fontSize: 15 },
  bar: { height: 6, backgroundColor: C.card2, borderRadius: 99, overflow: "hidden" },
  fill: { height: "100%", backgroundColor: C.flame2 },
  stepNo: { color: C.muted, fontSize: 12, textAlign: "center" },
  card: { backgroundColor: C.card, borderColor: C.line, borderWidth: 1, borderRadius: 18, padding: 20, alignItems: "center", minHeight: 180 },
  tag: { color: C.flame1, backgroundColor: "rgba(255,107,53,0.14)", fontSize: 11, fontWeight: "800", letterSpacing: 1, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 99, overflow: "hidden" },
  tagDone: { color: C.amber, backgroundColor: "rgba(255,213,107,0.14)" },
  cd: { color: C.text, fontSize: 34, fontWeight: "800", marginVertical: 10, fontVariant: ["tabular-nums"] },
  text: { color: C.text, fontSize: 18, lineHeight: 25, textAlign: "center" },
  safety: { color: C.amber, backgroundColor: "rgba(255,213,107,0.12)", borderColor: "rgba(255,213,107,0.3)", borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 14, fontWeight: "600", fontSize: 14 },
  controls: { gap: 10 },
  btn: { paddingVertical: 16, borderRadius: 14, alignItems: "center" },
  primary: { backgroundColor: C.flame2 },
  secondary: { backgroundColor: C.card2, borderColor: C.line, borderWidth: 1 },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  back: { color: C.muted, textAlign: "center", marginTop: 4, fontSize: 14 },
});
