import { StyleSheet, Text, View } from "react-native";

import { colors, radius } from "@/lib/theme";

export type Tier = "gold" | "silver" | "bronze" | "red";

const TIERS: Record<Tier, { label: string; bg: string; fg: string }> = {
  gold: { label: "Gold wish", bg: "#FBEFC7", fg: "#8A6A00" },
  silver: { label: "Silver wish", bg: "#ECEDEF", fg: "#5B5F66" },
  bronze: { label: "Bronze wish", bg: "#F6E0CC", fg: "#8A4B14" },
  red: { label: "Red wish", bg: colors.redSoft, fg: colors.red },
};

export function TierBadge({ tier, label, testID }: { tier: Tier; label?: string; testID?: string }) {
  const t = TIERS[tier];
  return (
    <View testID={testID ?? "tier-badge-" + tier} style={[styles.chip, { backgroundColor: t.bg }]}>
      <Text style={[styles.text, { color: t.fg }]}>{label ?? t.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  text: { fontSize: 12, fontWeight: "800" },
});
