import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../../App";
import { EXPERIENCE_LEVELS, PAN_OPTIONS, HEAT_OPTIONS, setProfile, Experience } from "../engine/user";
import GradientButton from "../components/GradientButton";
import { C, F } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Onboarding">;

export default function OnboardingScreen({ navigation }: Props) {
  const [exp, setExp] = useState<Experience | null>(null);
  const [pan, setPan] = useState<string | null>(null);
  const [heat, setHeat] = useState<string | null>(null);
  const ready = exp && pan && heat;

  const done = async () => {
    if (!ready) return;
    await setProfile({ experience: exp, pan, heat });
    navigation.replace("Home");
  };

  const Choice = ({ on, emoji, label, blurb, onPress }: any) => (
    <Pressable style={[styles.choice, on && styles.choiceOn]} onPress={onPress}>
      <Text style={styles.cEmoji}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.cLabel}>{label}</Text>
        {blurb && <Text style={styles.cBlurb}>{blurb}</Text>}
      </View>
    </Pressable>
  );

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={styles.wrap}>
      <Text style={styles.h1}>How much have{"\n"}you cooked?</Text>
      <Text style={styles.lead}>No judgment — this just sets how much we guide you.</Text>
      <View style={styles.stack}>
        {EXPERIENCE_LEVELS.map((e) => (
          <Choice key={e.id} on={exp === e.id} emoji={e.emoji} label={e.label} blurb={e.blurb} onPress={() => setExp(e.id as Experience)} />
        ))}
      </View>

      <Text style={styles.section}>Pan</Text>
      <View style={styles.stack}>
        {PAN_OPTIONS.map((o) => <Choice key={o.id} on={pan === o.id} emoji={o.emoji} label={o.label} onPress={() => setPan(o.id)} />)}
      </View>

      <Text style={styles.section}>Heat</Text>
      <View style={styles.stack}>
        {HEAT_OPTIONS.map((o) => <Choice key={o.id} on={heat === o.id} emoji={o.emoji} label={o.label} onPress={() => setHeat(o.id)} />)}
      </View>

      <GradientButton label="Start cooking" onPress={done} disabled={!ready} style={{ marginTop: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 18, paddingTop: 60, gap: 8 },
  h1: { color: C.text, fontSize: 30, fontFamily: F.display },
  lead: { color: C.muted, fontSize: 15, marginTop: 6, marginBottom: 8 },
  section: { color: C.muted, fontSize: 13, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginTop: 18, marginBottom: 6 },
  stack: { gap: 10 },
  choice: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.card, borderColor: C.line, borderWidth: 1.5, borderRadius: 14, padding: 14 },
  choiceOn: { borderColor: C.flame2 },
  cEmoji: { fontSize: 22 },
  cLabel: { color: C.text, fontSize: 16, fontWeight: "700" },
  cBlurb: { color: C.muted, fontSize: 13, marginTop: 2 },
  btn: { backgroundColor: C.flame2, borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 24 },
  btnOff: { opacity: 0.4 },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
