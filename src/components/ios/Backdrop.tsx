import { Image, StyleSheet, View, type ViewStyle } from "react-native";

import { lv, poolImages } from "@/theme/tokens";

// Fades end in the same hue at alpha 0 (not `transparent`) so no platform interpolates through grey.
// Darker at the top (titles sit there) and at the very bottom (the tab bar), with the fountain's
// lantern-gold and pool-aqua glowing through in between.
const WASH = [
  "radial-gradient(circle at 88% 6%, rgba(233,199,102,0.14) 0%, rgba(233,199,102,0) 40%)",
  "radial-gradient(circle at 10% 92%, rgba(127,211,209,0.14) 0%, rgba(127,211,209,0) 48%)",
  "linear-gradient(180deg, rgba(14,34,41,0.82) 0%, rgba(14,34,41,0.55) 38%, rgba(10,26,32,0.6) 72%, rgba(7,20,26,0.88) 100%)",
].join(", ");

/**
 * The ambient wallpaper behind every screen: the Well tab's night fountain, blurred and dimmed, so
 * the whole app sits in the same night garden. It stays put while content scrolls, and gives the
 * frosted glass something to pick up.
 */
export function Backdrop({ style }: { style?: ViewStyle }) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.base, style]}>
      <Image source={poolImages.ambient} style={styles.image} resizeMode="cover" />
      <View style={[StyleSheet.absoluteFill, styles.wash]} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: lv.bg, pointerEvents: "none", overflow: "hidden" },
  image: { width: "100%", height: "100%", opacity: 0.9 },
  wash: { backgroundImage: WASH },
});
