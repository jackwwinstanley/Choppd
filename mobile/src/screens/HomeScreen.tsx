import React from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../../App";
import { EXPERIENCES } from "../data/experiences";
import { C } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export default function HomeScreen({ navigation }: Props) {
  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={styles.wrap}>
      <Text style={styles.lead}>First cook? Let's make it a good one.</Text>
      <Text style={styles.section}>🎵 Music cooks</Text>

      {EXPERIENCES.map((x) => (
        <Pressable key={x.id} style={styles.card} onPress={() => navigation.navigate("Cook", { expId: x.id })}>
          <Text style={styles.emoji}>{x.recipe.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{x.recipe.title}</Text>
            <Text style={styles.song}>🎸 {x.song.title} · {x.song.artist}</Text>
            <View style={styles.row}>
              <Text style={styles.pill}>★ FREE</Text>
              <Text style={styles.pill}>⏱ ~{Math.round(x.durationSec / 60)} min</Text>
              <Text style={styles.pill}>{x.recipe.technique}</Text>
            </View>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 18, gap: 8 },
  lead: { color: C.muted, fontSize: 15, marginBottom: 6 },
  section: { color: C.muted, fontSize: 13, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginTop: 8, marginBottom: 6 },
  card: { flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: C.card, borderColor: C.line, borderWidth: 1, borderRadius: 18, padding: 16 },
  emoji: { fontSize: 40 },
  title: { color: C.text, fontSize: 18, fontWeight: "800" },
  song: { color: C.muted, fontSize: 13, marginTop: 2 },
  row: { flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" },
  pill: { color: C.muted, fontSize: 12, fontWeight: "700", backgroundColor: C.card2, borderColor: C.line, borderWidth: 1, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, overflow: "hidden" },
});
