import { StyleSheet } from "react-native";

import { lv } from "@/theme/tokens";

/** RN stand-ins for the new design's .glass / .glass-dark / .eyebrow utility classes. */
export const glass = StyleSheet.create({
  light: {
    backgroundColor: "rgba(254,253,251,0.86)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.9)",
    ...lv.shadow,
  },
  dark: { backgroundColor: "rgba(20,18,15,0.48)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.18)" },
  eyebrow: { fontSize: 11, fontWeight: "600", letterSpacing: 1.1, textTransform: "uppercase", color: lv.mutedFg },
});
