import { useQuery } from "convex/react";
import { StyleSheet, Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { GlassCard } from "@/components/ios";
import { TierBadge } from "@/components/TierBadge";
import { countdown, useNow } from "@/lib/time";
import { lv } from "@/theme/tokens";

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
    <GlassCard testID={"branch-race-" + wishId} style={{ gap: 8 }}>
      <View style={styles.head}>
        <Text style={styles.eyebrow}>{title ?? (race.branches.length > 1 ? "Branches racing" : "One branch traveling")}</Text>
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
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: { fontSize: 11, fontWeight: "600", letterSpacing: 1.2, textTransform: "uppercase", color: lv.mutedFg },
  countdown: { fontFamily: lv.font.mono, fontSize: 18, fontWeight: "700", color: lv.fg, letterSpacing: 0.5 },
  hint: { fontSize: 13, color: lv.mutedFg },
  row: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: lv.radiusSm, backgroundColor: lv.muted },
  leadingRow: { borderWidth: 1.5, borderColor: lv.thread, backgroundColor: lv.accent },
  label: { fontSize: 15, fontWeight: "600", color: lv.fg },
  leading: { color: lv.thread },
  meta: { fontSize: 12, color: lv.mutedFg },
});
