// The GRANTED reveal: meet-up photo, one thank-you line, the winning route of names and cities,
// and "+1 star" on every helper between the wisher and the match. UI idea from PR #16, wired to
// `link.ending` (PR #43) instead of #16's own endings backend.
import * as Linking from "expo-linking";
import { useState } from "react";
import { Image, Platform, StyleSheet, Text, View } from "react-native";

import { endingShareText } from "@/components/link/end/logic";
import { DAvatar, DButton, DError, DTag, Eyebrow, Sub } from "@/components/lv/passon/kit";
import { photoSource } from "@/components/lv/world/Polaroid";
import type { EndingView } from "@/lib/linkApi.types";
import { shareLink } from "@/lib/links";
import { hopCount } from "@/lib/time";
import { lv, polaroid, shadows, type } from "@/theme/tokens";

import { grantedStops } from "./meetLogic";

const TIER = {
  gold: { label: "Gold wish", tone: "gold" },
  silver: { label: "Silver wish", tone: "neutral" },
  bronze: { label: "Bronze wish", tone: "neutral" },
  red: { label: "Red wish", tone: "thread" },
} as const;

export function GrantedCard({
  ending,
  wishId,
  testID = "granted-card",
  photoTestID = "granted-photo",
  storyTestID = "granted-story",
  shareTestID = "granted-share",
}: {
  ending: EndingView;
  wishId: string;
  testID?: string;
  photoTestID?: string;
  storyTestID?: string;
  shareTestID?: string;
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
          source={photoSource(ending.photoUrl)}
          style={styles.photo}
          resizeMode="contain"
          accessibilityLabel="Their meet-up photo"
        />
      ) : null}
      <View style={styles.row}>
        <Text style={styles.granted}>Wish granted</Text>
        {tier ? <DTag label={tier.label} tone={tier.tone} /> : null}
      </View>
      <Text style={styles.wish}>
        “{ending.wishText}”
      </Text>
      {ending.thankYou ? (
        <Text testID="granted-thank-you" style={styles.thanks}>
          {ending.thankYou}
        </Text>
      ) : null}
      <Text testID={storyTestID} style={styles.story}>{ending.story}</Text>
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
        {hopCount(ending.ripples)}
        {ending.metInPerson === true ? " · met in person" : ending.metInPerson === false ? " · met on a call" : ""}
      </Text>
      <EndingShareButton ending={ending} wishId={wishId} testID={shareTestID} />
    </View>
  );
}

function endingUrl(wishId: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") return `${window.location.origin}/e/${wishId}`;
  const base = process.env.EXPO_PUBLIC_WEB_URL;
  return base ? `${base.replace(/\/$/, "")}/e/${wishId}` : Linking.createURL(`/e/${wishId}`);
}

export function EndingShareButton({ ending, wishId, testID }: { ending: EndingView; wishId: string; testID: string }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (ending.locked) return null;

  async function share() {
    setNote("");
    setError(null);
    try {
      const result = await shareLink(endingShareText(ending, ""), endingUrl(wishId));
      if (result === "copied") setNote("Ending link copied.");
    } catch {
      setError("Couldn't share the ending. Try again.");
    }
  }

  return (
    <View style={styles.share}>
      <DButton testID={testID} size="lg" title="Share" icon="share" onPress={share} />
      {note ? <Sub>{note}</Sub> : null}
      <DError error={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  locked: { gap: 6, paddingVertical: 8 },
  lockedTitle: { ...type.title3, fontWeight: "700", color: lv.fg },
  polaroid: {
    backgroundColor: polaroid.paper,
    borderRadius: 10,
    borderCurve: "continuous",
    padding: 12,
    paddingBottom: 18,
    gap: 10,
    transform: [{ rotate: "-1deg" }],
    boxShadow: shadows.float,
  },
  photo: { width: "100%", aspectRatio: 1, borderRadius: 6, backgroundColor: polaroid.photoBg },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  granted: { ...type.title3, fontWeight: "800", color: lv.thread },
  wish: { ...type.headline, color: polaroid.ink },
  thanks: { ...type.callout, color: polaroid.ink, fontStyle: "italic" },
  story: { ...type.callout, color: polaroid.ink },
  route: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", rowGap: 8 },
  stopRow: { flexDirection: "row", alignItems: "flex-start" },
  line: { width: 14, height: 2, backgroundColor: lv.thread, opacity: 0.6, marginTop: 13, borderRadius: 1 },
  stop: { alignItems: "center", width: 64, gap: 2 },
  stopName: { ...type.caption1, fontWeight: "700", color: polaroid.ink },
  stopCity: { ...type.caption2, color: polaroid.inkMuted },
  star: { ...type.caption2, fontWeight: "700", color: "#9A7A1F" },
  meta: { ...type.footnote, color: polaroid.inkMuted },
  share: { gap: 6 },
});
