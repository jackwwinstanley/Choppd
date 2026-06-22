import React, { useState } from "react";
import { View, Text, TextInput, Pressable, FlatList, Image, ActivityIndicator, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../../App";
import { searchMeals, Recipe, ATTRIBUTION } from "../data/recipeMap";
import { C } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Explore">;

const diffColor = (d: Recipe["difficulty"]) => (d === "easy" ? C.pop : d === "hard" ? C.danger : C.amber);

export default function ExploreScreen({ navigation }: Props) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Recipe[] | null>(null);

  const run = async () => {
    if (!q.trim()) return;
    setLoading(true);
    try { setResults(await searchMeals(q.trim())); } catch { setResults([]); }
    setLoading(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: 54 }}>
      <View style={styles.head}>
        <Pressable onPress={() => navigation.goBack()}><Text style={styles.back}>← Back</Text></Pressable>
        <Text style={styles.h1}>🔍 Search recipes</Text>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.input} placeholder="e.g. curry, pasta, cake" placeholderTextColor={C.muted}
            autoCapitalize="none" value={q} onChangeText={setQ} returnKeyType="search" onSubmitEditing={run}
          />
          <Pressable style={styles.searchBtn} onPress={run}><Text style={styles.searchIcon}>🔍</Text></Pressable>
        </View>
      </View>

      {loading && <ActivityIndicator color={C.flame2} style={{ marginTop: 24 }} />}
      {!loading && results && results.length === 0 && <Text style={styles.empty}>No recipes found. Try another word.</Text>}
      {!loading && !results && <Text style={styles.empty}>Search the full TheMealDB catalog — easy, medium & hard.</Text>}

      <FlatList
        data={results ?? []}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        renderItem={({ item: r }) => (
          <Pressable style={styles.card} onPress={() => navigation.navigate("RecipeDetail", { recipe: r })}>
            <Image source={{ uri: r.thumb }} style={styles.thumb} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{r.emoji} {r.title}</Text>
              <Text style={styles.sub}>{[r.area, r.category].filter(Boolean).join(" · ")}</Text>
              <View style={styles.row}>
                <Text style={[styles.pill, { color: diffColor(r.difficulty) }]}>{r.difficulty.toUpperCase()}</Text>
                <Text style={styles.pill}>📋 {r.stepCount}</Text>
                <Text style={styles.pill}>⏱ ~{r.estimatedTimeMin}m</Text>
                {r.hasSafetyGate && <Text style={[styles.pill, { color: C.amber }]}>🌡️</Text>}
              </View>
            </View>
          </Pressable>
        )}
        ListFooterComponent={results && results.length ? <Text style={styles.attr}>{ATTRIBUTION}</Text> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: 18 },
  back: { color: C.muted, fontSize: 16, marginBottom: 6 },
  h1: { color: C.text, fontSize: 26, fontWeight: "800" },
  searchRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  input: { flex: 1, backgroundColor: C.card, borderColor: C.line, borderWidth: 1, borderRadius: 12, color: C.text, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  searchBtn: { width: 50, backgroundColor: C.flame2, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  searchIcon: { fontSize: 18 },
  empty: { color: C.muted, fontSize: 13, padding: 18 },
  card: { flexDirection: "row", gap: 12, backgroundColor: C.card, borderColor: C.line, borderWidth: 1, borderRadius: 14, padding: 10 },
  thumb: { width: 84, height: 84, borderRadius: 12, backgroundColor: C.card2 },
  title: { color: C.text, fontSize: 15, fontWeight: "800" },
  sub: { color: C.muted, fontSize: 12, marginTop: 2 },
  row: { flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" },
  pill: { color: C.muted, fontSize: 11, fontWeight: "700", backgroundColor: C.card2, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4, overflow: "hidden" },
  attr: { color: C.muted, fontSize: 11, textAlign: "center", padding: 14 },
});
