import { StyleSheet, Text, View } from "react-native";

import { lv } from "@/theme/tokens";

/**
 * One-line route summary for a voyage card: the cities a boat drifted through,
 * joined by short red dashes with the last city bold. Unknown cities show as
 * "·", and a route with no known city shows just the hop count.
 */
export function MiniRoute({ cities, hops }: { cities: (string | null)[]; hops: number }) {
  if (!cities.some(Boolean)) {
    return (
      <Text style={styles.text}>
        {hops} {hops === 1 ? "hop" : "hops"}
      </Text>
    );
  }
  return (
    <View style={styles.row}>
      {cities.map((c, i) => (
        <View key={i} style={styles.seg}>
          {i > 0 ? <View style={styles.dash} /> : null}
          <Text style={[styles.text, i === cities.length - 1 && styles.last]} numberOfLines={1}>
            {c ?? "·"}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", rowGap: 6 },
  seg: { flexDirection: "row", alignItems: "center" },
  dash: { width: 12, height: 2, borderRadius: 1, backgroundColor: lv.thread, marginHorizontal: 5 },
  text: { fontSize: 13, color: lv.mutedFg },
  last: { color: lv.fg, fontWeight: "700" },
});