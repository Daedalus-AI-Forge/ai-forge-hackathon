import { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import { Avatar, Button } from "@/components/ui";
import { cardUrl, shareLink } from "@/lib/links";
import { colors, mono } from "@/lib/theme";

type Stop = { name: string; city: string | null; avatar: string };

export type Ending = {
  wishText: string;
  tier: "gold" | "silver" | "bronze" | "red" | null;
  photoUrl: string | null;
  metInPerson: boolean;
  thankYou: string | null;
  story: string;
  chain: Stop[];
};

const TIER = {
  gold: { label: "Gold wish", color: "#D4A017" },
  silver: { label: "Silver wish", color: "#8E9AAF" },
  bronze: { label: "Bronze wish", color: "#B87333" },
  red: { label: "Red wish", color: colors.red },
} as const;

/** The Wish Granted polaroid: photo, tier, mini ripple chain and the 2-sentence story. */
export function GrantedCard({ wishId, ending, showThankYou = true }: { wishId: string; ending: Ending; showThankYou?: boolean }) {
  const [note, setNote] = useState<string | null>(null);
  const tier = ending.tier ? TIER[ending.tier] : null;
  const ripples = ending.chain.length - 1;
  return (
    <View testID="granted-card" style={styles.polaroid}>
      {ending.photoUrl ? (
        <Image testID="granted-photo" source={{ uri: ending.photoUrl }} style={styles.photo} resizeMode="cover" />
      ) : (
        <View style={[styles.photo, styles.noPhoto]}>
          <Text style={{ fontSize: 48 }}>✨</Text>
        </View>
      )}
      <View style={styles.badgeRow}>
        <Text style={styles.granted}>Wish granted</Text>
        {tier ? <Text style={[styles.tier, { backgroundColor: tier.color }]}>{tier.label}</Text> : null}
      </View>
      <Text style={styles.wish} numberOfLines={2}>
        {ending.wishText}
      </Text>
      <View testID="granted-ripple-map" style={styles.chain}>
        {ending.chain.map((s, i) => (
          <View key={i} style={styles.stopRow}>
            {i > 0 ? <View style={styles.line} /> : null}
            <View style={styles.stop}>
              <Avatar name={s.name} color={s.avatar} size={26} />
              <Text style={styles.stopName} numberOfLines={1}>
                {s.name}
              </Text>
              {s.city ? (
                <Text style={styles.stopCity} numberOfLines={1}>
                  {s.city}
                </Text>
              ) : null}
            </View>
          </View>
        ))}
      </View>
      <Text style={styles.meta}>
        {ripples === 1 ? "1 ripple" : `${ripples} ripples`}
        {ending.metInPerson ? " · met in person" : ""}
      </Text>
      <Text testID="granted-story" style={styles.story}>
        {ending.story}
      </Text>
      {showThankYou && ending.thankYou ? (
        <View testID="granted-thank-you" style={styles.thanks}>
          <Text style={styles.thanksLabel}>A note from {ending.chain[0]?.name ?? "the wisher"}</Text>
          <Text style={styles.thanksText}>“{ending.thankYou}”</Text>
        </View>
      ) : null}
      <Button
        testID="granted-share"
        title="Share the card"
        variant="secondary"
        onPress={async () => {
          const result = await shareLink(`Wish granted ✨ ${ending.story}`, cardUrl(wishId));
          if (result === "copied") setNote("Copied! Paste it anywhere.");
        }}
      />
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  polaroid: {
    backgroundColor: "#fff",
    padding: 14,
    paddingBottom: 18,
    borderRadius: 6,
    gap: 10,
    transform: [{ rotate: "-1deg" }],
    shadowColor: "#7A5C2E",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  photo: { width: "100%", aspectRatio: 1, borderRadius: 2, backgroundColor: colors.water },
  noPhoto: { alignItems: "center", justifyContent: "center" },
  badgeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  granted: { fontSize: 20, fontWeight: "800", color: colors.red },
  tier: { color: "#fff", fontWeight: "800", fontSize: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: "hidden" },
  wish: { fontSize: 15, fontWeight: "700", color: colors.ink },
  chain: { flexDirection: "row", alignItems: "flex-start", flexWrap: "wrap", rowGap: 8 },
  stopRow: { flexDirection: "row", alignItems: "center" },
  line: { width: 18, height: 2, backgroundColor: colors.red, marginTop: -26, opacity: 0.6 },
  stop: { alignItems: "center", width: 70, gap: 2 },
  stopName: { fontSize: 12, fontWeight: "700", color: colors.ink },
  stopCity: { fontSize: 11, color: colors.muted },
  meta: { fontFamily: mono, fontSize: 12, color: colors.red, fontWeight: "700" },
  story: { fontSize: 16, lineHeight: 23, color: colors.ink, fontStyle: "italic" },
  thanks: { backgroundColor: colors.cream, borderRadius: 12, padding: 12, gap: 4 },
  thanksLabel: { fontSize: 12, fontWeight: "700", color: colors.muted },
  thanksText: { fontSize: 15, color: colors.ink, lineHeight: 21 },
  note: { color: colors.muted, fontSize: 14, textAlign: "center" },
});
