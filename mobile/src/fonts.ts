// Weight-aware global font: maps every <Text>'s fontWeight to the matching
// Inter family (custom fonts don't synthesize weight), so the whole app uses
// Inter without editing every StyleSheet. Headings opt into Instrument Sans by
// setting fontFamily explicitly (their style wins).
import React from "react";
import { Text, StyleSheet } from "react-native";
import { F } from "./theme";

function interFor(w?: string | number): string {
  const k = String(w ?? "400");
  if (k === "500") return F.bodyMed;
  if (k === "600") return F.bodySemi;
  if (k === "700" || k === "800" || k === "900" || k === "bold") return F.bodyBold;
  return F.body;
}

let applied = false;
export function applyGlobalFont() {
  if (applied) return;
  const T: any = Text;
  if (!T.render) return;
  applied = true;
  const orig = T.render;
  T.render = function (...args: any[]) {
    const el = orig.apply(this, args);
    const flat = (StyleSheet.flatten(el.props.style) || {}) as any;
    const fontFamily = flat.fontFamily || interFor(flat.fontWeight);
    return React.cloneElement(el, { style: [{ fontFamily }, el.props.style] });
  };
}
