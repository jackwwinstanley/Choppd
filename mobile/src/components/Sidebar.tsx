import React from "react";
import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import { C } from "../theme";

type Item = { key: string; emoji: string; label: string };
const ITEMS: Item[] = [
  { key: "Profile", emoji: "👤", label: "Profile" },
  { key: "Explore", emoji: "🔍", label: "Search recipes" },
  { key: "Settings", emoji: "⚙️", label: "Settings" },
];

export default function Sidebar({
  visible, onClose, onNavigate,
}: {
  visible: boolean;
  onClose: () => void;
  onNavigate: (key: string) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.drawer}>
          <Text style={styles.brand}>SEARTUNE</Text>
          <View style={styles.nav}>
            {ITEMS.map((it) => (
              <Pressable key={it.key} style={styles.item} onPress={() => { onClose(); onNavigate(it.key); }}>
                <Text style={styles.itemEmoji}>{it.emoji}</Text>
                <Text style={styles.itemLabel}>{it.label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.foot}>
            <Text style={styles.footTitle}>🎸 New · Free Bird steak</Text>
            <Text style={styles.footSub}>Cook a medium-rare steak in rhythm.</Text>
          </View>
        </View>
        <Pressable style={styles.backdrop} onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: "row" },
  drawer: { width: 270, backgroundColor: C.bg2, borderRightColor: C.line, borderRightWidth: 1, paddingTop: 60, paddingHorizontal: 14 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  brand: { color: C.flame2, fontWeight: "800", letterSpacing: 3, fontSize: 15, paddingHorizontal: 6, paddingBottom: 12, borderBottomColor: C.line, borderBottomWidth: 1 },
  nav: { marginTop: 12, gap: 6 },
  item: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, paddingHorizontal: 12, borderRadius: 12 },
  itemEmoji: { fontSize: 18, width: 22, textAlign: "center" },
  itemLabel: { color: C.text, fontSize: 15, fontWeight: "600" },
  foot: { marginTop: "auto", marginBottom: 24, backgroundColor: C.card, borderColor: C.line, borderWidth: 1, borderRadius: 14, padding: 14 },
  footTitle: { color: C.text, fontWeight: "700", fontSize: 13 },
  footSub: { color: C.muted, fontSize: 11, marginTop: 3 },
});
