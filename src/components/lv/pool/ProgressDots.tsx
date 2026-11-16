import { StyleSheet, Text, View } from "react-native";

import { night, type } from "@/theme/tokens";

/** Five dots (gold on the night pool): how many boats until the next coin, and whether a coin is waiting. */
export function ProgressDots({ progress, wishesLeft }: { progress: number; wishesLeft: number }) {
  return (
    <View testID="boat-progress" style={styles.wrap} accessibilityLabel={`${progress} of 5 boats toward your next coin`}>
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
  wrap: { alignItems: "center", gap: 10, paddingTop: 4 },
  dots: { flexDirection: "row", gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "rgba(255,255,255,0.14)" },
  dotOn: { backgroundColor: night.gold },
  line: { ...type.footnote, color: night.mutedFg, textAlign: "center" },
  have: { color: night.gold, fontWeight: "600" },
});
