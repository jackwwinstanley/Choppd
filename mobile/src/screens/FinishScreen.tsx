import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../../App";
import { saveSession } from "../engine/telemetry";
import { C } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Finish">;

const emojiFor = (v: number) => (v <= 1 ? "😞" : v <= 2 ? "😐" : v <= 3 ? "🙂" : v <= 4 ? "😋" : "🤩");

export default function FinishScreen({ route, navigation }: Props) {
  const { session } = route.params;
  const [rating, setRating] = useState<number | null>(null);

  async function exit() {
    if (rating == null) return; // mandatory
    await saveSession({ ...session, rating, finishedAt: new Date().toISOString() });
    navigation.popToTop();
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.medal}>🏅</Text>
      <Text style={styles.eyebrow}>Cook complete</Text>
      <Text style={styles.h1}>You made{"\n"}<Text style={{ color: C.flame2 }}>{session.recipe.toLowerCase()}.</Text></Text>

      <Text style={styles.q}>How did it go?</Text>
      <Text style={styles.emoji}>{emojiFor(rating ?? 3)}</Text>

      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <View key={n} style={styles.star}>
            <Text style={[styles.starGlyph, { color: (rating ?? 0) >= n - 0.5 ? C.amber : C.line }]}>
              {(rating ?? 0) >= n ? "★" : (rating ?? 0) >= n - 0.5 ? "⯨" : "★"}
            </Text>
            {/* left half = n-0.5, right half = n */}
            <Pressable style={styles.half} onPress={() => setRating(n - 0.5)} />
            <Pressable style={[styles.half, { right: 0 }]} onPress={() => setRating(n)} />
          </View>
        ))}
      </View>
      <Text style={styles.rateVal}>{rating == null ? "Tap the stars to rate (required)" : `${rating} / 5`}</Text>

      <Pressable style={[styles.btn, rating == null && styles.btnDisabled]} disabled={rating == null} onPress={exit}>
        <Text style={styles.btnText}>Back home</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center", padding: 24, gap: 6 },
  medal: { fontSize: 72 },
  eyebrow: { color: C.flame2, fontWeight: "800", letterSpacing: 2, textTransform: "uppercase", fontSize: 12, marginTop: 8 },
  h1: { color: C.text, fontSize: 30, fontWeight: "800", textAlign: "center", marginTop: 6 },
  q: { color: C.muted, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", fontSize: 13, marginTop: 22 },
  emoji: { fontSize: 40, marginVertical: 4 },
  stars: { flexDirection: "row", gap: 6 },
  star: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  starGlyph: { fontSize: 36 },
  half: { position: "absolute", top: 0, left: 0, width: "50%", height: "100%" },
  rateVal: { color: C.muted, fontWeight: "600", fontSize: 13, marginTop: 8 },
  btn: { backgroundColor: C.flame2, paddingVertical: 16, paddingHorizontal: 40, borderRadius: 14, marginTop: 26 },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
