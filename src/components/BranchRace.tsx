import { useQuery } from "convex/react";
import { StyleSheet, Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { TierBadge } from "@/components/TierBadge";
import { Card } from "@/components/ui";
import { colors, mono, radius } from "@/lib/theme";
import { countdown, useNow } from "@/lib/time";

/** The branches of one wish racing to the right person. Fewer ripples wins. */
export function BranchRace({
  deviceId,
  wishId,
  title,
  showCountdown = true,
}: {
  deviceId: string;
  wishId: Id<"wishes">;
  title?: string;
  showCountdown?: boolean;
}) {
  const race = useQuery(api.rewards.race, { deviceId, wishId });
  const now = useNow();
  if (!race || race.branches.length === 0) return null;
  const traveling = race.status === "traveling";
  return (
    <Card testID={"branch-race-" + wishId}>
      <View style={styles.head}>
        <Text style={styles.title}>{title ?? (race.branches.length > 1 ? "Branches racing" : "One branch traveling")}</Text>
        {traveling && showCountdown ? (
          <Text testID="branch-race-countdown" style={styles.countdown}>
            {countdown(race.expiresAt, now)}
          </Text>
        ) : null}
      </View>
      <Text style={styles.hint}>Fewest ripples to an “It's me!” wins.</Text>
      {race.branches.map((b, i) => (
        <View key={b.label} testID={"branch-row-" + i} style={[styles.row, b.leading && styles.leadingRow]}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.label}>
              {b.label}
              {b.leading ? <Text style={styles.leading}>{b.won ? "  · won" : "  · leading"}</Text> : null}
            </Text>
            <Text style={styles.meta}>
              {b.depth} {b.depth === 1 ? "ripple" : "ripples"} · {b.holding} holding · {b.people} {b.people === 1 ? "person" : "people"}
              {b.found ? " · found someone!" : ""}
            </Text>
          </View>
          <TierBadge tier={b.tier} label={b.tier.charAt(0).toUpperCase() + b.tier.slice(1)} testID={"branch-tier-" + i} />
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 17, fontWeight: "800", color: colors.ink },
  countdown: { fontFamily: mono, fontSize: 18, fontWeight: "800", color: colors.ink },
  hint: { fontSize: 13, color: colors.muted },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: radius.card / 2,
    backgroundColor: colors.cream,
  },
  leadingRow: { borderWidth: 2, borderColor: colors.red, backgroundColor: colors.redSoft },
  label: { fontSize: 15, fontWeight: "800", color: colors.ink },
  leading: { color: colors.red },
  meta: { fontSize: 13, color: colors.muted, fontWeight: "600" },
});
