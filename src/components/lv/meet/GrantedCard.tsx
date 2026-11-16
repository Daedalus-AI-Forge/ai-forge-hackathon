// The GRANTED reveal: meet-up photo, one thank-you line, the winning route of names and cities,
// and "+1 star" on every helper between the wisher and the match. UI idea from PR #16, wired to
// `link.ending` (PR #43) instead of #16's own endings backend.
import { Image, StyleSheet, Text, View } from "react-native";

import { DAvatar, DTag, Eyebrow, Sub } from "@/components/lv/passon/kit";
import { lv, shadows, type } from "@/theme/tokens";

import { grantedStops, type EndingHolder } from "./meetLogic";

export type GrantedEnding = {
  status: "traveling" | "found" | "granted" | "faded";
  wishText: string;
  photoUrl: string | null;
  locked: boolean;
  story: string;
  ripples: number;
  thankYou: string;
  tier: "gold" | "silver" | "bronze" | "red" | null;
  metInPerson: boolean | null;
  holders?: EndingHolder[];
};

const TIER = {
  gold: { label: "Gold wish", tone: "gold" },
  silver: { label: "Silver wish", tone: "neutral" },
  bronze: { label: "Bronze wish", tone: "neutral" },
  red: { label: "Red wish", tone: "thread" },
} as const;

export function GrantedCard({
  ending,
  testID = "granted-card",
  photoTestID = "granted-photo",
}: {
  ending: GrantedEnding;
  testID?: string;
  photoTestID?: string;
}) {
  if (ending.locked || ending.status !== "granted") {
    return (
      <View testID={`${testID}-locked`} style={styles.locked} accessibilityRole="summary">
        <Eyebrow>Found its person</Eyebrow>
        <Text style={styles.lockedTitle}>Waiting for them to meet…</Text>
        <Sub>The ending unlocks once both of them confirm a photo together.</Sub>
      </View>
    );
  }
  const stops = grantedStops(ending.holders);
  const tier = ending.tier ? TIER[ending.tier] : null;
  return (
    <View testID={testID} style={styles.polaroid}>
      {ending.photoUrl ? (
        <Image
          testID={photoTestID}
          source={{ uri: ending.photoUrl }}
          style={styles.photo}
          resizeMode="cover"
          accessibilityLabel="Their meet-up photo"
        />
      ) : null}
      <View style={styles.row}>
        <Text style={styles.granted}>Wish granted</Text>
        {tier ? <DTag label={tier.label} tone={tier.tone} /> : null}
      </View>
      <Text style={styles.wish} numberOfLines={3}>
        “{ending.wishText}”
      </Text>
      {ending.thankYou ? (
        <Text testID="granted-thank-you" style={styles.thanks} numberOfLines={3}>
          {ending.thankYou}
        </Text>
      ) : (
        <Text testID="granted-story" style={styles.thanks}>
          {ending.story}
        </Text>
      )}
      {stops.length ? (
        <View testID="granted-route" style={styles.route} accessibilityLabel={`Route: ${stops.map((s) => s.name).join(", ")}`}>
          {stops.map((s, i) => (
            <View key={s.key} style={styles.stopRow}>
              {i > 0 ? <View style={styles.line} /> : null}
              <View style={styles.stop}>
                <DAvatar name={s.name} color={s.avatar} size={28} />
                <Text style={styles.stopName} numberOfLines={1}>
                  {s.name}
                </Text>
                {s.city ? (
                  <Text style={styles.stopCity} numberOfLines={1}>
                    {s.city}
                  </Text>
                ) : null}
                {s.star ? <Text style={styles.star}>+1 ★</Text> : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}
      <Text style={styles.meta}>
        {ending.ripples} {ending.ripples === 1 ? "ripple" : "ripples"}
        {ending.metInPerson === true ? " · met in person" : ending.metInPerson === false ? " · met on a call" : ""}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  locked: { gap: 6, paddingVertical: 8 },
  lockedTitle: { ...type.title3, fontWeight: "700", color: lv.fg },
  polaroid: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderCurve: "continuous",
    padding: 12,
    paddingBottom: 18,
    gap: 10,
    transform: [{ rotate: "-1deg" }],
    boxShadow: shadows.float,
  },
  photo: { width: "100%", aspectRatio: 1, borderRadius: 6, backgroundColor: lv.muted },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  granted: { ...type.title3, fontWeight: "800", color: lv.thread },
  wish: { ...type.headline, color: lv.fg },
  thanks: { ...type.callout, color: lv.fg, fontStyle: "italic" },
  route: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", rowGap: 8 },
  stopRow: { flexDirection: "row", alignItems: "flex-start" },
  line: { width: 14, height: 2, backgroundColor: lv.thread, opacity: 0.6, marginTop: 13, borderRadius: 1 },
  stop: { alignItems: "center", width: 64, gap: 2 },
  stopName: { ...type.caption1, fontWeight: "700", color: lv.fg },
  stopCity: { ...type.caption2, color: lv.mutedFg },
  star: { ...type.caption2, fontWeight: "700", color: "#9A7A1F" },
  meta: { ...type.footnote, color: lv.mutedFg },
});
