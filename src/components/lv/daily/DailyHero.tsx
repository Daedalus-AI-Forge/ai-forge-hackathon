import { StyleSheet, Text, View } from "react-native";

import { Glass } from "@/components/ios";
import { lv, type } from "@/theme/tokens";

/** Dark frosted hero card: eyebrow, title, three stat tiles, with a red glow behind the glass. */
export function DailyHero({ title, hint, stats }: { title: string; hint?: string; stats: [string, string][] }) {
  return (
    <View>
      <View style={styles.glow} />
      <Glass testID="daily-hero" variant="dark" radius={30} style={styles.hero}>
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
      </Glass>
    </View>
  );
}

const styles = StyleSheet.create({
  // Sits behind the glass so the blur turns it into a soft red light.
  glow: {
    position: "absolute",
    right: -20,
    top: -24,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundImage: "radial-gradient(circle, rgba(229,72,63,0.75) 0%, rgba(229,72,63,0) 70%)",
  },
  hero: { padding: 24 },
  eyebrow: { ...type.eyebrow, color: "rgba(255,255,255,0.6)" },
  emoji: { marginTop: 18, fontSize: 44 },
  title: { ...type.title1, color: "#FFFFFF", marginTop: 10 },
  hint: { ...type.subheadline, color: "rgba(255,255,255,0.75)", marginTop: 8 },
  grid: { marginTop: 22, flexDirection: "row", gap: 8 },
  tile: { flex: 1, alignItems: "center", borderRadius: 16, borderCurve: "continuous", backgroundColor: "rgba(255,255,255,0.1)", paddingVertical: 12 },
  value: { ...type.headline, color: "#FFFFFF" },
  label: { ...type.caption1, color: "rgba(255,255,255,0.6)" },
});
