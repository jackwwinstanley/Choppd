import React, { useEffect, useState } from "react";
import { View, Text, Pressable, TextInput, ScrollView, Alert, Linking, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../../App";
import { C } from "../theme";
import {
  Entitlement, getEntitlement, setEntitlement, canSelectCustom, DEV_CODE,
} from "../engine/entitlement";

type Props = NativeStackScreenProps<RootStackParamList, "Premium">;

// Empty for now — wire your Stripe/IAP / landing URL here.
const BUY_PREMIUM_URL = "";

export default function PremiumScreen({ navigation }: Props) {
  const [ent, setEnt] = useState<Entitlement | null>(null);
  const [code, setCode] = useState("");

  useEffect(() => { getEntitlement().then(setEnt); }, []);
  if (!ent) return <View style={{ flex: 1, backgroundColor: C.bg }} />;

  const save = async (next: Entitlement) => { setEnt(next); await setEntitlement(next); };

  // Real Spotify/Apple SDKs need a native dev build (not Expo Go) + credentials —
  // simulated here so the gating logic is testable end-to-end.
  const connect = (which: "spotify" | "apple", label: string) => {
    Alert.alert(`${label} (simulated)`, `Does this ${label} account have Premium?`, [
      { text: "No (Free)", onPress: () => save({ ...ent, [which]: { connected: true, premium: false } }) },
      { text: "Yes (Premium)", onPress: () => save({ ...ent, [which]: { connected: true, premium: true } }) },
    ]);
  };

  const buyPremium = () => {
    if (BUY_PREMIUM_URL) Linking.openURL(BUY_PREMIUM_URL);
    else Alert.alert("Coming soon", "The purchase link isn't set up yet.");
  };
  const redeem = () => {
    if (code.trim() === DEV_CODE) {
      save({ ...ent, appPremium: true });
      Alert.alert("Unlocked 🎉", "Developer Premium enabled — ads off, custom songs available.");
      setCode("");
    } else {
      Alert.alert("Invalid code", "That developer code isn't right.");
    }
  };

  const acct = (which: "spotify" | "apple", label: string, emoji: string) => {
    const a = ent[which];
    return (
      <View style={styles.row}>
        <Text style={styles.rowLabel}>{emoji} {label}</Text>
        {a.connected ? (
          <Text style={[styles.badge, a.premium ? styles.badgePrem : styles.badgeFree]}>
            {a.premium ? "PREMIUM" : "FREE"}
          </Text>
        ) : (
          <Pressable style={styles.connectBtn} onPress={() => connect(which, label)}>
            <Text style={styles.connectText}>Connect</Text>
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={styles.wrap}>
      <Pressable onPress={() => navigation.goBack()}><Text style={styles.back}>← Back</Text></Pressable>
      <Text style={styles.h1}>Premium</Text>

      <View style={[styles.card, ent.appPremium && styles.cardActive]}>
        <Text style={styles.cardTitle}>{ent.appPremium ? "✓ SearTune Premium active" : "SearTune Premium"}</Text>
        <Text style={styles.muted}>No ads · cook to any song · full catalog.</Text>
        {!ent.appPremium && (
          <>
            <Pressable style={styles.btnPrimary} onPress={buyPremium}>
              <Text style={styles.btnPrimaryText}>Buy Premium</Text>
            </Pressable>
            <Text style={[styles.muted, { textAlign: "center", marginTop: 10 }]}>or enter a developer code</Text>
            <View style={styles.codeRow}>
              <TextInput
                style={styles.input}
                placeholder="Developer code"
                placeholderTextColor={C.muted}
                autoCapitalize="none"
                autoCorrect={false}
                value={code}
                onChangeText={setCode}
              />
              <Pressable style={styles.redeemBtn} onPress={redeem}>
                <Text style={styles.redeemText}>Unlock</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>

      <Text style={styles.section}>Connect your music</Text>
      <View style={styles.card}>
        {acct("spotify", "Spotify", "🟢")}
        <View style={styles.divider} />
        {acct("apple", "Apple Music", "")}
      </View>

      <View style={[styles.card, { marginTop: 14 }]}>
        <Text style={styles.cardTitle}>Cook to your own song</Text>
        <Text style={styles.muted}>
          Needs SearTune Premium {ent.appPremium ? "✅" : "⛔️"} AND a connected Premium account{" "}
          {(ent.spotify.premium && ent.spotify.connected) || (ent.apple.premium && ent.apple.connected) ? "✅" : "⛔️"}.
        </Text>
        <Text style={[styles.status, { color: canSelectCustom(ent) ? C.pop : C.danger }]}>
          {canSelectCustom(ent) ? "Unlocked — pick any song 🎉" : "Locked"}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 18, paddingTop: 54, gap: 8 },
  back: { color: C.muted, fontSize: 16, marginBottom: 6 },
  h1: { color: C.text, fontSize: 30, fontWeight: "800", marginBottom: 8 },
  section: { color: C.muted, fontSize: 13, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginTop: 18, marginBottom: 6 },
  card: { backgroundColor: C.card, borderColor: C.line, borderWidth: 1, borderRadius: 18, padding: 18 },
  cardActive: { borderColor: C.pop },
  cardTitle: { color: C.text, fontSize: 17, fontWeight: "800" },
  muted: { color: C.muted, fontSize: 13, marginTop: 6, lineHeight: 19 },
  btnPrimary: { backgroundColor: C.flame2, borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 14 },
  btnPrimaryText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  codeRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  input: { flex: 1, backgroundColor: C.card2, borderColor: C.line, borderWidth: 1, borderRadius: 12, color: C.text, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  redeemBtn: { backgroundColor: C.card2, borderColor: C.line, borderWidth: 1, borderRadius: 12, paddingHorizontal: 18, justifyContent: "center" },
  redeemText: { color: C.flame2, fontWeight: "800" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 },
  rowLabel: { color: C.text, fontSize: 15, fontWeight: "600" },
  divider: { height: 1, backgroundColor: C.line, marginVertical: 8 },
  badge: { fontSize: 12, fontWeight: "800", paddingHorizontal: 11, paddingVertical: 5, borderRadius: 99, overflow: "hidden" },
  badgePrem: { color: "#ffd56b", backgroundColor: "rgba(255,213,107,0.14)" },
  badgeFree: { color: C.muted, backgroundColor: C.card2 },
  connectBtn: { backgroundColor: C.card2, borderColor: C.line, borderWidth: 1, borderRadius: 99, paddingHorizontal: 16, paddingVertical: 7 },
  connectText: { color: C.flame2, fontWeight: "800", fontSize: 13 },
  status: { fontWeight: "800", marginTop: 10 },
});
