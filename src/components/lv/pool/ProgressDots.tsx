import { StyleSheet, Text, View } from "react-native";

import { night } from "@/theme/tokens";

/** Five dots (gold on the night pool): how many boats until the next coin, and whether a coin is waiting. */
export function ProgressDots({ progress, wishesLeft }: { progress: number; wishesLeft: number }) {
  return (
    <View testID="boat-progress" style={styles.wrap}>
      <View style={styles.dots}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={[styles.dot, i < progress && styles.dotOn]} />
        ))}
      </View>
      <Text style={styles.line}>
        Push {5 - progress} more to earn a coin
        {wishesLeft > 0 ? <Text style={styles.have}> · You have a coin to toss</Text> : null}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 10 },
  dots: { flexDirection: "row", gap: 8 },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: night.border,
  },
  dotOn: { backgroundColor: night.gold, borderColor: night.goldBright },
  line: { fontSize: 13, color: night.mutedFg },
  have: { color: night.gold, fontWeight: "600" },
});
