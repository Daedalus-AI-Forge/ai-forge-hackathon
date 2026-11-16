import { useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Share, StyleSheet, Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import { BackButton, GlassCard, Icon, LargeTitle, NavBar, Screen, SectionHeader } from "@/components/ios";
import { WishProgressButton } from "@/components/lv/meet/WishProgressButton";
import { DAvatar, DButton } from "@/components/lv/passon/kit";
import { useMe } from "@/lib/device";
import { lv, shadows, type } from "@/theme/tokens";

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

  const nav = (
    <NavBar
      left={
        <BackButton
          testID="boat-back"
          label="Back to Voyages"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/voyages"))}
        />
      }
    />
  );

  if (!card || !page) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        {nav}
        <Text style={styles.muted}>{voyages === undefined || page === undefined ? "Loading…" : "Boat not found."}</Text>
      </Screen>
    );
  }

  const real = card.source === "friend";
  const endingOpen = card.status === "granted" || (!real && card.status === "landed");
  const found = !real && endingOpen ? card.found : null;
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

  const chain = [
    ...page.chain.map((h, i) => ({ name: h.name, color: h.avatar, prev: i > 0 ? page.chain[i - 1]!.name : null, vouch: h.vouch })),
    { name: page.hop.holderName, color: lv.primary, prev: null, vouch: null, me: true },
  ];

  return (
    <Screen testID="boat-screen">
      <Stack.Screen options={{ headerShown: false }} />
      {nav}

      <LargeTitle size="title" title={card.text} subtitle={source} />
      {card.source === "daily" && page.wish.daily ? (
        <Text style={styles.clue}>
          Daily clue {page.wish.daily.step} of {page.wish.daily.of}: “{page.wish.daily.hint}”
        </Text>
      ) : null}

      <SectionHeader title="Route" />
      <GlassCard style={styles.timeline}>
        {card.cities.map((c, i) => (
          <View key={i} style={styles.row}>
            <View style={styles.rail}>
              <View style={styles.dot} />
              {i < card.cities.length - 1 ? <View style={styles.stem} /> : null}
            </View>
            <Text style={[styles.city, i < card.cities.length - 1 && styles.rowGap]}>{c ?? "Somewhere"}</Text>
          </View>
        ))}
      </GlassCard>

      <SectionHeader title="The chain" />
      <GlassCard style={styles.timeline}>
        {chain.map((h, i) => (
          <View key={i} style={styles.row}>
            <View style={styles.rail}>
              <DAvatar name={h.name} color={h.color} size={28} />
              {i < chain.length - 1 ? <View style={styles.stem} /> : null}
            </View>
            <Text style={[styles.chainText, i < chain.length - 1 && styles.rowGap]}>
              {"me" in h ? (
                <Text style={styles.strong}>You</Text>
              ) : i === 0 ? (
                <>
                  <Text style={styles.strong}>{h.name}</Text> started the boat
                </>
              ) : (
                <>
                  <Text style={styles.strong}>{h.prev}</Text> → <Text style={styles.strong}>{h.name}</Text>
                  {h.vouch ? `: “${h.vouch}”` : ""}
                </>
              )}
            </Text>
          </View>
        ))}
      </GlassCard>

      {found ? (
        <View testID="boat-ending" style={styles.polaroid}>
          <Text style={styles.polaroidName}>
            {found.name}
            {found.city ? ` · ${found.city}` : ""}
          </Text>
          <Text style={styles.polaroidStory}>“{found.story}”</Text>
          <Text style={styles.polaroidApart}>{peopleApart(card.hops)}</Text>
          <DButton title="Share" icon="share" testID="boat-share" onPress={() => void share(found)} />
        </View>
      ) : !endingOpen ? (
        <GlassCard style={styles.locked} testID="boat-ending-locked">
          {card.status === "faded" ? null : <Icon name="lock" size={18} color={lv.mutedFg} />}
          <Text style={styles.lockedText}>
            {card.status === "faded" ? "This boat faded before it found anyone."
              : real ? "The ending unlocks once the wish-maker and their match confirm a photo together."
              : "The ending unlocks when someone says “That's me”."}
          </Text>
        </GlassCard>
      ) : null}
      <WishProgressButton
        wishId={card.wishId}
        title={endingOpen ? "Open the full ending" : "Check wish progress"}
        testID={endingOpen ? "boat-full-ending" : "boat-progress-link"}
      />
    </Screen>
  );
}

function dateLabel(ms: number) {
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

const styles = StyleSheet.create({
  muted: { ...type.subheadline, color: lv.mutedFg },
  clue: { ...type.footnote, color: lv.mutedFg, fontStyle: "italic", marginTop: -8 },
  timeline: { gap: 0 },
  row: { flexDirection: "row", gap: 12 },
  rail: { width: 28, alignItems: "center" },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 5, backgroundColor: lv.thread, borderWidth: 2, borderColor: "#fff" },
  stem: { width: 2, flex: 1, minHeight: 12, marginVertical: 3, borderRadius: 1, backgroundColor: lv.thread },
  rowGap: { paddingBottom: 16 },
  city: { flex: 1, ...type.body, fontWeight: "500", color: lv.fg },
  chainText: { flex: 1, ...type.subheadline, color: lv.fg, paddingTop: 4 },
  strong: { fontWeight: "600", color: lv.fg },
  polaroid: {
    width: "90%",
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderCurve: "continuous",
    padding: 16,
    paddingBottom: 22,
    gap: 10,
    marginTop: 8,
    transform: [{ rotate: "-1.5deg" }],
    boxShadow: shadows.float,
  },
  polaroidName: { ...type.title2, color: lv.fg },
  polaroidStory: { ...type.subheadline, color: lv.fg },
  polaroidApart: { ...type.footnote, color: lv.mutedFg },
  locked: { alignItems: "center", gap: 8, paddingVertical: 22 },
  lockedText: { ...type.subheadline, color: lv.mutedFg, textAlign: "center" },
});
