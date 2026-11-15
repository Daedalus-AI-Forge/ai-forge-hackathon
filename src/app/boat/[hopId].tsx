import { useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/convex/_generated/api";
import { DAvatar, DButton } from "@/components/lv/passon/kit";
import { useMe } from "@/lib/device";
import { lv } from "@/theme/tokens";

import type { VoyageCard } from "@/components/lv/voyages/voyageData";

function peopleApart(hops: number) {
  return `You were ${hops} ${hops === 1 ? "person" : "people"} apart.`;
}

/** One boat I pushed: the route it drifted, the vouch chain above me, and how it ended. */
export default function BoatDetail() {
  const { hopId } = useLocalSearchParams<{ hopId: string }>();
  const router = useRouter();
  const { deviceId } = useMe();
  const voyages = useQuery(api.pool.voyages, deviceId ? { deviceId } : "skip");
  const card = voyages?.find((v) => v.hopId === hopId);
  const page = useQuery(api.hops.page, hopId ? { hopId } : "skip");

  const back = (
    <Pressable
      testID="boat-back"
      accessibilityRole="button"
      onPress={() => (router.canGoBack() ? router.back() : router.replace("/voyages"))}
      hitSlop={12}
    >
      <Text style={styles.back}>‹ Voyages</Text>
    </Pressable>
  );

  if (!card || !page) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          {back}
          <Text style={styles.muted}>{voyages === undefined || page === undefined ? "Loading…" : "Boat not found."}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const found = card.found && (card.status === "landed" || card.status === "granted") ? card.found : null;
  const source =
    card.source === "daily"
      ? `Today's boat · ${dateLabel(card.pushedAt)}`
      : `${card.creatorName}'s real wish`;

  const share = async (f: NonNullable<VoyageCard["found"]>) => {
    const message = `${card.text}\n\n${f.name}${f.city ? ` in ${f.city}` : ""} found it: “${f.story}”\n${peopleApart(card.hops)}`;
    try {
      await Share.share({ message });
    } catch {}
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView testID="boat-screen" contentContainerStyle={styles.container}>
        {back}

        <View style={styles.headline}>
          <Text style={styles.title}>{card.text}</Text>
          <Text style={styles.muted}>{source}</Text>
          {card.source === "daily" && page.wish.daily ? (
            <Text style={styles.clue}>
              Daily clue {page.wish.daily.step} of {page.wish.daily.of}: “{page.wish.daily.hint}”
            </Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.eyebrow}>Route</Text>
          <View style={styles.route}>
            {card.cities.map((c, i) => (
              <View key={i} style={styles.routeRow}>
                <View style={styles.rail}>
                  <View style={styles.dot} />
                  {i < card.cities.length - 1 ? <View style={styles.railLine} /> : null}
                </View>
                <Text style={styles.routeCity}>{c ?? "Somewhere"}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.eyebrow}>The chain</Text>
          <View style={styles.chain}>
            {page.chain.map((h, i) => {
              const prev = i > 0 ? page.chain[i - 1]!.name : null;
              return (
                <View key={i} style={styles.chainRow}>
                  <DAvatar name={h.name} color={h.avatar} size={26} />
                  <View style={styles.chainBody}>
                    {i === 0 ? (
                      <Text style={styles.chainText}>
                        <Text style={styles.strong}>{h.name}</Text> started the boat
                      </Text>
                    ) : (
                      <Text style={styles.chainText}>
                        <Text style={styles.strong}>{prev}</Text> → <Text style={styles.strong}>{h.name}</Text>
                        {h.vouch ? `: “${h.vouch}”` : ""}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
            <View style={styles.chainRow}>
              <DAvatar name={page.hop.holderName} color={lv.primary} size={26} />
              <Text style={styles.chainText}>
                <Text style={styles.strong}>You</Text>
              </Text>
            </View>
          </View>
        </View>

        {found ? (
          <View testID="boat-ending" style={styles.polaroid}>
            <Text style={styles.polaroidName}>
              {found.name}
              {found.city ? ` · ${found.city}` : ""}
            </Text>
            <Text style={styles.polaroidStory}>“{found.story}”</Text>
            <Text style={styles.polaroidApart}>{peopleApart(card.hops)}</Text>
            <DButton title="Share" testID="boat-share" onPress={() => void share(found)} size="md" />
          </View>
        ) : (
          <View style={styles.locked}>
            <Text style={styles.lockedText}>
              {card.status === "faded"
                ? "This boat faded before it found anyone."
                : "🔒 The ending unlocks when someone says “That's me”."}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function dateLabel(ms: number) {
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: lv.bg },
  container: { padding: 16, paddingTop: 20, gap: 20, maxWidth: 430, width: "100%", alignSelf: "center", paddingBottom: 48 },
  back: { fontSize: 15, color: lv.mutedFg, paddingHorizontal: 8 },
  headline: { paddingHorizontal: 8, gap: 6 },
  title: { fontSize: 30, lineHeight: 34, fontWeight: "700", color: lv.fg, letterSpacing: -0.5 },
  muted: { fontSize: 14, color: lv.mutedFg, lineHeight: 20 },
  clue: { fontSize: 13, color: lv.mutedFg, lineHeight: 19, fontStyle: "italic" },
  section: { gap: 10 },
  eyebrow: { fontSize: 11, fontWeight: "600", letterSpacing: 1.2, textTransform: "uppercase", color: lv.mutedFg, paddingHorizontal: 8 },
  route: { backgroundColor: lv.card, borderRadius: lv.radiusXl, borderWidth: 1, borderColor: lv.border, padding: 16, ...lv.shadow },
  routeRow: { flexDirection: "row", alignItems: "stretch" },
  rail: { width: 24, alignItems: "center" },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 5, backgroundColor: lv.thread, borderWidth: 2, borderColor: lv.card },
  railLine: { width: 2, flex: 1, marginVertical: 1, backgroundColor: lv.thread },
  routeCity: { flex: 1, paddingLeft: 10, paddingVertical: 8, fontSize: 16, fontWeight: "500", color: lv.fg },
  chain: { marginLeft: 16, borderLeftWidth: 1, borderLeftColor: lv.thread, gap: 20 },
  chainRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginLeft: -13 },
  chainBody: { flex: 1, paddingTop: 3 },
  chainText: { fontSize: 14, color: lv.fg, lineHeight: 20 },
  strong: { fontWeight: "700", color: lv.fg },
  polaroid: {
    width: "90%",
    alignSelf: "center",
    backgroundColor: lv.card,
    borderRadius: 4,
    padding: 16,
    paddingBottom: 20,
    gap: 10,
    transform: [{ rotate: "-1.5deg" }],
    ...lv.shadow,
  },
  polaroidName: { fontSize: 22, fontWeight: "700", color: lv.fg },
  polaroidStory: { fontSize: 15, color: lv.fg, lineHeight: 21 },
  polaroidApart: { fontSize: 13, color: lv.mutedFg },
  locked: {
    backgroundColor: lv.card,
    borderRadius: lv.radiusXl,
    borderWidth: 1,
    borderColor: lv.border,
    padding: 20,
    alignItems: "center",
    ...lv.shadow,
  },
  lockedText: { fontSize: 15, color: lv.mutedFg, textAlign: "center", lineHeight: 21 },
});