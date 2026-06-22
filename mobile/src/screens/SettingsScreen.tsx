import React, { useEffect, useState } from "react";
import { View, Text, Pressable, Switch, ScrollView, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../../App";
import { getPrefs, setPrefs, Prefs } from "../engine/prefs";
import { C } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Settings">;

export default function SettingsScreen({ navigation }: Props) {
  const [prefs, setP] = useState<Prefs | null>(null);
  useEffect(() => { getPrefs().then(setP); }, []);
  if (!prefs) return <View style={{ flex: 1, backgroundColor: C.bg }} />;

  const update = (patch: Partial<Prefs>) => { const next = { ...prefs, ...patch }; setP(next); setPrefs(next); };

  const Row = ({ emoji, label, sub, value, onChange }: any) => (
    <View style={styles.row}>
      <Text style={styles.rowEmoji}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sub && <Text style={styles.rowSub}>{sub}</Text>}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: C.flame2, false: C.card2 }} thumbColor="#fff" />
    </View>
  );

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={styles.wrap}>
      <Pressable onPress={() => navigation.goBack()}><Text style={styles.back}>← Back</Text></Pressable>
      <Text style={styles.h1}>⚙️ Settings</Text>

      <Text style={styles.section}>Voice & feedback</Text>
      <View style={styles.card}>
        <Row emoji="🔊" label="Voice prompts" value={prefs.voice} onChange={(v: boolean) => update({ voice: v })} />
        <View style={styles.divider} />
        <Row emoji="⏯️" label="Step checkpoints" sub="Confirm “Continue” at each step" value={prefs.checkpoints} onChange={(v: boolean) => update({ checkpoints: v })} />
        <View style={styles.divider} />
        <Row emoji="📳" label="Haptics" value={prefs.haptics} onChange={(v: boolean) => update({ haptics: v })} />
      </View>

      <Text style={styles.section}>Appearance</Text>
      <View style={styles.card}>
        <Row emoji={prefs.theme === "light" ? "☀️" : "🌙"} label="Light theme" sub="Dark-first · light mode coming soon" value={prefs.theme === "light"} onChange={(v: boolean) => update({ theme: v ? "light" : "dark" })} />
      </View>

      <Text style={styles.section}>Developer</Text>
      <View style={styles.card}>
        <Pressable style={styles.row} onPress={() => navigation.navigate("SessionLog")}>
          <Text style={styles.rowEmoji}>📊</Text>
          <Text style={[styles.rowLabel, { flex: 1 }]}>Session log</Text>
          <Text style={styles.chev}>›</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 18, paddingTop: 54, gap: 6 },
  back: { color: C.muted, fontSize: 16, marginBottom: 6 },
  h1: { color: C.text, fontSize: 30, fontWeight: "800", marginBottom: 8 },
  section: { color: C.muted, fontSize: 13, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginTop: 18, marginBottom: 6 },
  card: { backgroundColor: C.card, borderColor: C.line, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
  rowEmoji: { fontSize: 20, width: 24, textAlign: "center" },
  rowLabel: { color: C.text, fontSize: 15, fontWeight: "600" },
  rowSub: { color: C.muted, fontSize: 12, marginTop: 2 },
  divider: { height: 1, backgroundColor: C.line },
  chev: { color: C.muted, fontSize: 22 },
});
