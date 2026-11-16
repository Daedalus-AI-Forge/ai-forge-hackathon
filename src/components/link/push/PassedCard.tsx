// Shown right after the visitor passes a boat on: which pass theirs was, and a live count of how far
// the boat has gone since. `screen` comes from the reactive link.firstScreen query, so the number
// moves on its own whenever someone further down the chain passes it again.
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { GlassCard } from "@/components/ios";
import { DButton, DTag, Sub } from "@/components/lv/passon/kit";
import type { FirstScreen } from "@/lib/linkApi.types";
import { lv, type } from "@/theme/tokens";

import { ResendCard } from "./ResendCard";

export type PassedCardProps = {
  screen: FirstScreen;
  /** What this device just passed; after a reload the server's `handled` fills the same fields. */
  passed: { childHopId: string; name: string; reason: string } | null;
};

/** The pass this visitor made: every hop above them, their own, and the one they just created. */
export function myPassNumber(chainLength: number) {
  return chainLength + 2;
}

export function PassedCard({ screen, passed }: PassedCardProps) {
  const [resend, setResend] = useState(false);
  const mine = myPassNumber(screen.chain.length);
  const now = Math.max(mine, screen.handled?.nowRipples ?? 0);
  const childHopId = passed?.childHopId ?? screen.handled?.childHopId ?? null;
  const name = passed?.name ?? screen.handled?.childName ?? "";
  const vouch = passed?.reason ?? screen.handled?.vouch ?? "";
  const source = screen.boat.kind === "daily" ? "Today's boat" : `${screen.boat.creatorName}'s wish`;

  return (
    <View style={{ gap: 12 }} testID="link-passed">
      <GlassCard>
        <View style={styles.row}>
          <DTag label={source} tone={screen.boat.kind === "daily" ? "gold" : "thread"} />
          <View style={styles.live} accessibilityLabel="Updates live">
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Live</Text>
          </View>
        </View>
        <View style={styles.count}>
          <Text style={styles.num} testID="link-pass-count" accessibilityLiveRegion="polite">
            {now}
          </Text>
          <View style={styles.countText}>
            <Text style={styles.title} testID="link-pass-mine">
              You made pass #{mine}
              {name ? `, to ${name}` : ""}
            </Text>
            <Sub>
              {now > mine
                ? `It has been passed ${now - mine} more time${now - mine === 1 ? "" : "s"} since.`
                : "Passes so far. This updates as the boat moves."}
            </Sub>
          </View>
        </View>
        {childHopId && !resend ? (
          <DButton title="Didn't send it?" variant="plain" size="sm" onPress={() => setResend(true)} testID="link-passed-resend" />
        ) : null}
      </GlassCard>
      {childHopId && resend ? (
        <ResendCard childHopId={childHopId} childName={name} vouch={vouch} wishText={screen.boat.text} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  live: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: lv.success },
  liveText: { ...type.footnote, fontWeight: "600", color: lv.fg },
  count: { flexDirection: "row", alignItems: "center", gap: 16 },
  num: { fontSize: 52, lineHeight: 56, fontWeight: "700", color: lv.fg, fontVariant: ["tabular-nums"] },
  countText: { flex: 1, gap: 2 },
  title: { ...type.headline, color: lv.fg },
});
