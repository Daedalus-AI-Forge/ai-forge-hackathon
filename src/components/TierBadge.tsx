import { StyleSheet, Text, View } from "react-native";

import { lv } from "@/theme/tokens";

export type Tier = "gold" | "silver" | "bronze" | "red";

const TIERS: Record<Tier, { label: string; bg: string; fg: string }> = {
  gold: { label: "Gold wish", bg: lv.gold, fg: lv.fg },
  silver: { label: "Silver wish", bg: lv.silver, fg: lv.fg },
  bronze: { label: "Bronze wish", bg: lv.bronze, fg: lv.fg },
  red: { label: "Red wish", bg: lv.thread, fg: lv.threadFg },
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
  chip: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  text: { fontSize: 11, fontWeight: "600" },
});
