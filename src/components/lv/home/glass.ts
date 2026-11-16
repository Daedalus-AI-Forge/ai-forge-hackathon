import { StyleSheet } from "react-native";

import { lv, type } from "@/theme/tokens";

/**
 * Plain style fallbacks for places that can't host the `Glass` component.
 * Prefer `Glass` / `GlassCard` from "@/components/ios": they render real frosted materials.
 */
export const glass = StyleSheet.create({
  light: {
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.9)",
    boxShadow: "0px 10px 30px rgba(28,24,20,0.08)",
  },
  dark: { backgroundColor: "rgba(28,28,30,0.6)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.14)" },
  eyebrow: { ...type.eyebrow, color: lv.mutedFg },
});
