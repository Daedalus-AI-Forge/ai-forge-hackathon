import { StyleSheet, Text, View } from "react-native";

import { lv } from "@/theme/tokens";

/** Five dots: how many boats until the next coin, and whether a coin is waiting. */
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
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: lv.border, borderWidth: 1, borderColor: lv.border },
  dotOn: { backgroundColor: lv.thread, borderColor: lv.thread },
  line: { fontSize: 13, color: lv.mutedFg },
  have: { color: lv.thread, fontWeight: "600" },
});