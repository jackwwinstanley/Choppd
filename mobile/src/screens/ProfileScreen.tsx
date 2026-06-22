import React, { useCallback, useState } from "react";
import { View, Text, Pressable, ScrollView, Alert, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../../App";
import {
  getProfile, setProfile, detectedPace, Profile,
  EXPERIENCE_LEVELS, PAN_OPTIONS, HEAT_OPTIONS,
} from "../engine/user";
import { readSessions } from "../engine/telemetry";
import { C } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Profile">;

const labelFrom = (opts: readonly { id: string; label: string }[], id: string | null) => opts.find((o) => o.id === id)?.label ?? "—";
const paceLabel = (p: number | null) => (p == null ? "Learning your pace" : p < 0.9 ? "Brisk" : p <= 1.15 ? "On pace" : "Relaxed");

export default function ProfileScreen({ navigation }: Props) {
  const [profile, setProf] = useState<Profile | null>(null);
  const [stats, setStats] = useState({ count: 0, avg: null as number | null, pace: null as number | null });

  const load = useCallback(() => {
    getProfile().then(setProf);
    Promise.all([readSessions(), detectedPace()]).then(([sessions, pace]) => {
      const done = sessions.filter((s) => s.completed);
      const ratings = done.map((s) => s.rating).filter((v): v is number => v != null);
      setStats({ count: done.length, avg: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null, pace });
    });
  }, []);
  useFocusEffect(load);

  if (!profile) return <View style={{ flex: 1, backgroundColor: C.bg }} />;

  const edit = (title: string, opts: readonly { id: string; label: string; emoji?: string }[], key: keyof Profile) => {
    Alert.alert(`Edit ${title.toLowerCase()}`, undefined, [
      ...opts.map((o) => ({ text: `${o.emoji ?? ""} ${o.label}`.trim(), onPress: async () => { const next = { ...profile, [key]: o.id }; setProf(next); await setProfile(next); } })),
      { text: "Cancel", style: "cancel" as const },
    ]);
  };

  const EditRow = ({ label, value, onPress }: any) => (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        <Text style={styles.rowValue}>{value}</Text>
        {onPress && <Pressable style={styles.editBtn} onPress={onPress}><Text style={styles.editText}>Edit</Text></Pressable>}
      </View>
    </View>
  );

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={styles.wrap}>
      <Pressable onPress={() => navigation.goBack()}><Text style={styles.back}>← Back</Text></Pressable>
      <Text style={styles.h1}>👤 Profile</Text>

      <Text style={styles.section}>Your cooking profile</Text>
      <View style={styles.card}>
        <EditRow label="Experience" value={labelFrom(EXPERIENCE_LEVELS, profile.experience)} onPress={() => edit("Experience", EXPERIENCE_LEVELS, "experience")} />
        <View style={styles.divider} />
        <EditRow label="Pan" value={labelFrom(PAN_OPTIONS, profile.pan)} onPress={() => edit("Pan", PAN_OPTIONS, "pan")} />
        <View style={styles.divider} />
        <EditRow label="Heat source" value={labelFrom(HEAT_OPTIONS, profile.heat)} onPress={() => edit("Heat", HEAT_OPTIONS, "heat")} />
      </View>

      <Text style={styles.section}>📊 Cooking insights</Text>
      <View style={styles.card}>
        <EditRow label="Cooks completed" value={String(stats.count)} />
        <View style={styles.divider} />
        <EditRow label="Average rating" value={stats.avg != null ? `⭐ ${stats.avg.toFixed(1)}` : "—"} />
        <View style={styles.divider} />
        <EditRow label="Detected pace" value={`${paceLabel(stats.pace)}${stats.pace != null ? ` (${stats.pace.toFixed(2)}×)` : ""}`} />
      </View>
      <Text style={styles.note}>We learn your real pace from each cook and time future steps to match — no questionnaire needed.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 18, paddingTop: 54, gap: 6 },
  back: { color: C.muted, fontSize: 16, marginBottom: 6 },
  h1: { color: C.text, fontSize: 30, fontWeight: "800", marginBottom: 8 },
  section: { color: C.muted, fontSize: 13, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginTop: 18, marginBottom: 6 },
  card: { backgroundColor: C.card, borderColor: C.line, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, gap: 12 },
  rowLabel: { color: C.muted, fontSize: 14 },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  rowValue: { color: C.text, fontSize: 14, fontWeight: "700" },
  editBtn: { backgroundColor: C.card2, borderColor: C.line, borderWidth: 1, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 5 },
  editText: { color: C.flame2, fontWeight: "800", fontSize: 12 },
  divider: { height: 1, backgroundColor: C.line },
  note: { color: C.muted, fontSize: 11, marginTop: 8 },
});
