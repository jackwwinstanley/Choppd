import React from "react";
import { View, Text, Image, Pressable, ScrollView, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../../App";
import { Recipe, ATTRIBUTION } from "../data/recipeMap";
import { C } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "RecipeDetail">;

const diffColor = (d: Recipe["difficulty"]) => (d === "easy" ? C.pop : d === "hard" ? C.danger : C.amber);

export default function RecipeDetailScreen({ route, navigation }: Props) {
  const r = route.params.recipe;
  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={styles.wrap}>
      <Pressable onPress={() => navigation.goBack()}><Text style={styles.back}>← Back</Text></Pressable>
      <Image source={{ uri: r.thumb }} style={styles.hero} />
      <Text style={styles.h1}>{r.title}</Text>
      <Text style={styles.sub}>{[r.area, r.category].filter(Boolean).join(" · ")}</Text>
      <View style={styles.row}>
        <Text style={[styles.pill, { color: diffColor(r.difficulty) }]}>{r.difficulty.toUpperCase()}</Text>
        <Text style={styles.pill}>📋 {r.stepCount} steps</Text>
        <Text style={styles.pill}>⏱ ~{r.estimatedTimeMin}m</Text>
        {r.hasSafetyGate && <Text style={[styles.pill, { color: C.amber }]}>🌡️ doneness checks</Text>}
      </View>

      <Text style={styles.section}>Ingredients</Text>
      <View style={styles.card}>
        {r.ingredients.map((i, idx) => (
          <View key={idx} style={[styles.ing, idx > 0 && styles.ingBorder]}>
            <Text style={styles.ingName}>
              {i.name}{i.optional && <Text style={styles.opt}>  (optional but recommended)</Text>}
            </Text>
            <Text style={styles.ingMeasure}>{i.measure}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.attr}>{ATTRIBUTION}</Text>

      <Pressable style={styles.btn} onPress={() => navigation.navigate("GuidedCook", { recipe: r })}>
        <Text style={styles.btnText}>▶ Start guided cook</Text>
      </Pressable>
      <Text style={styles.note}>Guided mode: tap through steps. Doneness steps need a safe-temp check before you continue.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 18, paddingTop: 54, gap: 6 },
  back: { color: C.muted, fontSize: 16, marginBottom: 6 },
  hero: { width: "100%", height: 180, borderRadius: 18, backgroundColor: C.card2 },
  h1: { color: C.text, fontSize: 26, fontWeight: "800", marginTop: 12 },
  sub: { color: C.muted, fontSize: 14, marginTop: 4 },
  row: { flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" },
  pill: { color: C.muted, fontSize: 12, fontWeight: "700", backgroundColor: C.card2, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, overflow: "hidden" },
  section: { color: C.muted, fontSize: 13, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginTop: 20, marginBottom: 6 },
  card: { backgroundColor: C.card, borderColor: C.line, borderWidth: 1, borderRadius: 14, paddingHorizontal: 16 },
  ing: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 10 },
  ingBorder: { borderTopColor: C.line, borderTopWidth: 1 },
  ingName: { color: C.text, fontSize: 14, flex: 1 },
  opt: { color: C.muted, fontSize: 12 },
  ingMeasure: { color: C.muted, fontSize: 13 },
  attr: { color: C.muted, fontSize: 11, marginTop: 12 },
  btn: { backgroundColor: C.flame2, borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 18 },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  note: { color: C.muted, fontSize: 12, textAlign: "center", marginTop: 10 },
});
