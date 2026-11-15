import { StyleSheet, Text, View } from "react-native";

import { lv } from "@/theme/tokens";

/** Dark hero card: eyebrow, title, three stat tiles. */
export function DailyHero({ title, hint, stats }: { title: string; hint?: string; stats: [string, string][] }) {
  return (
    <View testID="daily-hero" style={styles.hero}>
      <View pointerEvents="none" style={styles.orb} />
      <Text style={styles.eyebrow}>Today's wish from the well</Text>
      <Text style={styles.emoji}>🌊</Text>
      <Text testID="daily-wish-title" style={styles.title}>
        {title}
      </Text>
      {hint ? <Text style={styles.hint}>Clue 1: {hint}</Text> : null}
      <View style={styles.grid}>
        {stats.map(([value, label]) => (
          <View key={label} style={styles.tile}>
            <Text style={styles.value}>{value}</Text>
            <Text style={styles.label}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: 20, overflow: "hidden", borderRadius: 32, backgroundColor: lv.fg, padding: 24, ...lv.shadow },
  orb: { position: "absolute", right: -64, top: -64, width: 224, height: 224, borderRadius: 112, backgroundColor: lv.thread, opacity: 0.35 },
  eyebrow: { fontSize: 11, fontWeight: "600", letterSpacing: 2, textTransform: "uppercase", color: lv.bg, opacity: 0.6 },
  emoji: { marginTop: 20, fontSize: 44 },
  title: { marginTop: 12, fontSize: 30, fontWeight: "700", lineHeight: 33, letterSpacing: -0.5, color: lv.bg },
  hint: { marginTop: 10, fontSize: 15, lineHeight: 21, color: lv.bg, opacity: 0.75 },
  grid: { marginTop: 24, flexDirection: "row", gap: 8 },
  tile: { flex: 1, alignItems: "center", borderRadius: 16, backgroundColor: "rgba(249,246,241,0.1)", paddingVertical: 12 },
  value: { fontSize: 18, fontWeight: "600", color: lv.bg },
  label: { fontSize: 11, color: lv.bg, opacity: 0.6 },
});
