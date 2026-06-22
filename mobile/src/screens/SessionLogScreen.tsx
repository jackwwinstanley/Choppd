import React, { useCallback, useState } from "react";
import { View, Text, Pressable, ScrollView, Alert, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../../App";
import { readSessions, clearSessions, CookSession } from "../engine/telemetry";
import { C, F } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "SessionLog">;

export default function SessionLogScreen({ navigation }: Props) {
  const [sessions, setSessions] = useState<CookSession[]>([]);
  const load = useCallback(() => { readSessions().then((s) => setSessions([...s].reverse())); }, []);
  useFocusEffect(load);

  const ratings = sessions.filter((s) => s.rating != null).map((s) => s.rating as number);
  const avg = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : "—";

  const clear = () => Alert.alert("Clear session log?", "This deletes all logged cooks.", [
    { text: "Cancel", style: "cancel" },
    { text: "Clear", style: "destructive", onPress: async () => { await clearSessions(); load(); } },
  ]);

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={styles.wrap}>
      <Pressable onPress={() => navigation.goBack()}><Text style={styles.back}>← Settings</Text></Pressable>
      <Text style={styles.h1}>📊 Session log</Text>
      <Text style={styles.lead}>{sessions.length} session{sessions.length === 1 ? "" : "s"} · avg {avg}★</Text>
      <Pressable style={styles.clearBtn} onPress={clear}><Text style={styles.clearText}>Clear log</Text></Pressable>

      {sessions.length === 0 && <Text style={styles.empty}>No sessions yet. Finish a cook (and rate it) to log one.</Text>}

      {sessions.map((s, i) => (
        <View key={i} style={styles.card}>
          <View style={styles.cardTop}>
            <Text style={styles.cardTitle}>{s.mode === "music" ? "🎵" : "🍳"} {s.recipe}</Text>
            <Text style={styles.rating}>{s.rating != null ? `${s.rating}★` : "—"}</Text>
          </View>
          <Text style={styles.meta}>
            {s.finishedAt ? new Date(s.finishedAt).toLocaleString() : ""} · {s.completed ? "completed" : "incomplete"} · {s.durationSec || 0}s · {s.experience || "—"} · {s.totalExtends} extends
          </Text>
          {(s.steps || []).slice(0, 12).map((st, j) => (
            <View key={j} style={styles.step}>
              <Text style={styles.stepTitle} numberOfLines={1}>{st.title}</Text>
              <Text style={styles.stepMeta}>
                {s.mode === "guided"
                  ? `${st.authoredSec}s → ${st.actualSec}s${st.extends ? ` · ${st.extends}×` : ""}`
                  : `@${st.firedSec}s${st.waitSec ? ` · wait ${st.waitSec}s` : ""}${st.extends ? ` · ${st.extends}×` : ""}`}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 18, paddingTop: 54, gap: 6 },
  back: { color: C.muted, fontSize: 16, marginBottom: 6 },
  h1: { color: C.text, fontSize: 30, fontFamily: F.display },
  lead: { color: C.muted, fontSize: 14, marginTop: 6 },
  clearBtn: { alignSelf: "flex-start", backgroundColor: C.card2, borderColor: C.line, borderWidth: 1, borderRadius: 99, paddingHorizontal: 16, paddingVertical: 8, marginTop: 10 },
  clearText: { color: C.danger, fontWeight: "700", fontSize: 13 },
  empty: { color: C.muted, fontSize: 13, marginTop: 18 },
  card: { backgroundColor: C.card, borderColor: C.line, borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 12 },
  cardTop: { flexDirection: "row", justifyContent: "space-between" },
  cardTitle: { color: C.text, fontWeight: "800", fontSize: 15, flex: 1 },
  rating: { color: C.amber, fontWeight: "800" },
  meta: { color: C.muted, fontSize: 11, marginTop: 4 },
  step: { flexDirection: "row", justifyContent: "space-between", gap: 10, paddingVertical: 4, marginTop: 4 },
  stepTitle: { color: C.text, fontSize: 12, flex: 1 },
  stepMeta: { color: C.muted, fontSize: 12 },
});
