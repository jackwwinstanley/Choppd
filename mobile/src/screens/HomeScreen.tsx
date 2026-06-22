import React, { useState, useCallback } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../../App";
import { EXPERIENCES } from "../data/experiences";
import { getEntitlement } from "../engine/entitlement";
import { C } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export default function HomeScreen({ navigation }: Props) {
  const [premium, setPremium] = useState(false);
  useFocusEffect(useCallback(() => { getEntitlement().then((e) => setPremium(e.appPremium)); }, []));

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.lead}>First cook? Let's make it a good one.</Text>
        <Pressable style={[styles.premPill, premium && styles.premPillOn]} onPress={() => navigation.navigate("Premium")}>
          <Text style={[styles.premText, premium && { color: "#ffd56b" }]}>{premium ? "★ Premium" : "Go Premium"}</Text>
        </Pressable>
      </View>
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

      <Pressable style={styles.explore} onPress={() => navigation.navigate("Explore")}>
        <Text style={styles.exploreText}>🌍 Explore recipes</Text>
        <Text style={styles.exploreSub}>Search the full TheMealDB catalog →</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 18, gap: 8 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  premPill: { backgroundColor: C.card2, borderColor: C.line, borderWidth: 1, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 7 },
  premPillOn: { borderColor: "#ffd56b" },
  premText: { color: C.flame2, fontWeight: "800", fontSize: 13 },
  lead: { color: C.muted, fontSize: 15, marginBottom: 6, flex: 1 },
  section: { color: C.muted, fontSize: 13, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginTop: 8, marginBottom: 6 },
  card: { flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: C.card, borderColor: C.line, borderWidth: 1, borderRadius: 18, padding: 16 },
  emoji: { fontSize: 40 },
  title: { color: C.text, fontSize: 18, fontWeight: "800" },
  song: { color: C.muted, fontSize: 13, marginTop: 2 },
  row: { flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" },
  pill: { color: C.muted, fontSize: 12, fontWeight: "700", backgroundColor: C.card2, borderColor: C.line, borderWidth: 1, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, overflow: "hidden" },
  explore: { backgroundColor: C.card, borderColor: C.line, borderWidth: 1, borderRadius: 18, padding: 16, marginTop: 8 },
  exploreText: { color: C.text, fontSize: 16, fontWeight: "800" },
  exploreSub: { color: C.muted, fontSize: 13, marginTop: 2 },
});
