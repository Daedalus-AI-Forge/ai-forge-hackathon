import { StyleSheet, View, type ViewStyle } from "react-native";

import { lv } from "@/theme/tokens";

// Fades end in the same hue at alpha 0 (not `transparent`) so no platform interpolates through grey.
const GLOWS = [
  "radial-gradient(circle at 90% 4%, rgba(229,72,63,0.22) 0%, rgba(229,72,63,0) 42%)",
  "radial-gradient(circle at 4% 16%, rgba(235,207,138,0.50) 0%, rgba(235,207,138,0) 46%)",
  "radial-gradient(circle at 14% 94%, rgba(63,107,120,0.28) 0%, rgba(63,107,120,0) 52%)",
  "radial-gradient(circle at 98% 68%, rgba(122,170,196,0.26) 0%, rgba(122,170,196,0) 44%)",
  "linear-gradient(180deg, #FBF6EF 0%, #F4EFE8 46%, #E6EDEF 100%)",
].join(", ");

/**
 * The ambient wallpaper behind every screen: warm paper at the top, well-water at the bottom and a few
 * soft glows. It stays put while content scrolls, and gives the frosted glass something to pick up.
 */
export function Backdrop({ style }: { style?: ViewStyle }) {
  return <View style={[StyleSheet.absoluteFill, styles.base, style]} />;
}

const styles = StyleSheet.create({
  base: { backgroundColor: lv.bg, backgroundImage: GLOWS, pointerEvents: "none" },
});
