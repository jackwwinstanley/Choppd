import React from "react";
import { Pressable, Text, StyleSheet, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C, F } from "../theme";

export default function GradientButton({
  label, onPress, disabled, style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.wrap, disabled && { opacity: 0.4 }, style]}>
      <LinearGradient colors={[C.flame1, C.flame2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.grad}>
        <Text style={styles.label}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 14, overflow: "hidden", shadowColor: C.flame2, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  grad: { paddingVertical: 16, alignItems: "center" },
  label: { color: "#fff", fontSize: 16, fontFamily: F.display },
});
