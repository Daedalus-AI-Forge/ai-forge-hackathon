import { useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { api } from "@/convex/_generated/api";
import { BackButton, GlassCard, LargeTitle, NavBar, Screen, SectionHeader } from "@/components/ios";
import { DAvatar, DTag } from "@/components/lv/passon/kit";
import { ThreadMap } from "@/components/lv/threads/ThreadMap";
import { STATUS_LABEL, TIER_LABEL, actionLabel, badgesFor, totalKm } from "@/components/lv/threads/threadData";
import { photoNames } from "@/components/lv/world/chainText";
import { Polaroid, tiltFor } from "@/components/lv/world/Polaroid";
import { useMe } from "@/lib/device";
import { countdown, hopCount, useNow } from "@/lib/time";
import { layout, lv, type } from "@/theme/tokens";

const TIER_BG = { gold: lv.gold, silver: lv.silver, bronze: lv.bronze, red: lv.accent } as const;
const INSET = 8; // map inset inside the card; its radius stays concentric

/** One wish of mine (id = wishId). Data comes from `wishes.mine`; there is no per-wish query yet. */
export default function ThreadDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { deviceId } = useMe();
  const wishes = useQuery(api.wishes.mine, deviceId ? { deviceId } : "skip");
  const now = useNow(1000);
  const w = wishes?.find((x) => x._id === id);
  const chains = useQuery(api.chains.mine, deviceId ? { deviceId } : "skip");
  const endChain = chains?.find((c) => c.wishId === id);
  const { width } = useWindowDimensions();

  const nav = (
    <NavBar
      left={
        <BackButton
          testID="thread-back"
          label="Back to Voyages"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/voyages"))}
        />
      }
    />
  );

  if (!w) {
    return (
      <Screen testID="thread-screen">
        <Stack.Screen options={{ headerShown: false }} />
        {nav}
        <Text style={styles.muted}>{wishes === undefined ? "Loading…" : "Thread not found."}</Text>
      </Screen>
    );
  }

  const chain = [...w.holders].sort((a, b) => a.depth - b.depth);
  const left = w.expiresAt - now;
  const badges = badgesFor(w);

  return (
    <Screen testID="thread-screen">
      <Stack.Screen options={{ headerShown: false }} />
      {nav}
      <LargeTitle
        size="title"
        title={
          <>
            Your coin: <Text style={{ color: lv.thread }}>{w.text}</Text>
          </>
        }
      />

      <GlassCard style={styles.mapCard}>
        <ThreadMap testID="thread-map" holders={w.holders} highlightName={w.creatorName} radius={lv.radiusXl - INSET} />
        <View style={styles.stats}>
          <Stat value={String(w.ripples)} label="Hops" />
          <Stat value={Math.round(totalKm(w.holders)).toLocaleString()} label="Km" divider />
          <Stat value={w.status === "traveling" && left > 0 ? countdown(w.expiresAt, now) : "—"} label="Left" divider />
        </View>
      </GlassCard>

      {w.status === "found" ? (
        <GlassCard style={styles.center}>
          <Text style={[styles.cardTitle, styles.centerText]}>Someone says they're who you're looking for</Text>
          <Text style={[styles.muted, styles.centerText]}>
            Confirming them comes next — you'll see their intro and the vouch chain here.
          </Text>
        </GlassCard>
      ) : null}

      {w.status === "faded" ? (
        <GlassCard>
          <Text style={styles.cardTitle}>This thread faded.</Text>
          <Text style={styles.muted}>It ran out of time before reaching the right person.</Text>
        </GlassCard>
      ) : null}

      {endChain ? (
        <View testID="thread-ending" style={styles.ending}>
          {/* The final photo on the chain, as a polaroid; tap it for the whole chain. */}
          <Polaroid
            testID="thread-polaroid"
            photoUrl={endChain.photoUrl}
            caption={w.text}
            sub={photoNames(endChain).join(" & ")}
            names={endChain.people.map((p) => p.name)}
            date={endChain.endedAt}
            width={Math.min(Math.min(width, layout.maxWidth) - layout.margin * 2 - 40, 320)}
            tilt={tiltFor(endChain.wishId, 2)}
            onPress={() => router.push({ pathname: "/chain/[wishId]", params: { wishId: endChain.wishId } })}
            accessibilityLabel={endChain.photoUrl ? `Photo from the end of your wish's chain: ${w.text}` : "The photo from this chain is still developing"}
          />
          <View style={styles.badges}>
            <View style={[styles.tierPill, { backgroundColor: w.tier ? TIER_BG[w.tier] : lv.muted }]}>
              <Text style={[styles.tierText, w.tier && w.tier !== "red" ? styles.tierTextOnLight : null]}>
                {w.tier ? TIER_LABEL[w.tier] : w.status === "granted" ? "Wish granted" : "Found"} · {hopCount(w.ripples)}
              </Text>
            </View>
            {badges.map((b) => (
              <DTag key={b} label={b} tone="neutral" />
            ))}
          </View>
        </View>
      ) : null}

      <SectionHeader title={`The chain · ${STATUS_LABEL[w.status]} · ${w.holding} holding it`} />
      <GlassCard style={styles.timeline}>
        {chain.map((h, i) => {
          const isMe = h.depth === 0;
          return (
            <View key={h.key} style={styles.row}>
              <View style={styles.rail}>
                <DAvatar name={h.name} color={h.avatar} size={28} />
                {i < chain.length - 1 ? <View style={styles.stem} /> : null}
              </View>
              <View style={[styles.chainBody, i < chain.length - 1 && styles.rowGap]}>
                <View style={styles.chainHead}>
                  {isMe ? <DTag label="You" tone="threadSolid" /> : null}
                  <Text style={styles.chainMeta}>
                    <Text style={styles.chainName}>{h.name}</Text>
                    {h.city ? ` · ${h.city}` : ""} · {actionLabel(h)}
                  </Text>
                </View>
                {!h.acted && h.depth > 0 ? <Text style={styles.chainMsg}>Holding it now</Text> : null}
              </View>
            </View>
          );
        })}
      </GlassCard>
    </Screen>
  );
}

function Stat({ value, label, divider }: { value: string; label: string; divider?: boolean }) {
  return (
    <View style={[styles.stat, divider && styles.statDivider]}>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  muted: { ...type.subheadline, color: lv.mutedFg },
  mapCard: { padding: INSET, gap: 0 },
  stats: { flexDirection: "row", paddingTop: 14, paddingBottom: 8 },
  stat: { flex: 1, alignItems: "center", gap: 2, paddingHorizontal: 4 },
  statDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderColor: lv.separator },
  statValue: { ...type.title2, color: lv.fg, fontVariant: ["tabular-nums"] },
  statLabel: { ...type.eyebrow, color: lv.mutedFg },
  center: { alignItems: "center" },
  centerText: { textAlign: "center" },
  cardTitle: { ...type.title3, color: lv.fg },
  ending: { alignItems: "center", gap: 18, marginTop: 8 },
  tierPill: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 12, height: 26, justifyContent: "center" },
  tierText: { ...type.caption1, fontWeight: "600", color: lv.fg },
  tierTextOnLight: { color: lv.onLight },
  badges: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6 },
  timeline: { gap: 0 },
  row: { flexDirection: "row", gap: 12 },
  rail: { width: 28, alignItems: "center" },
  stem: { width: 2, flex: 1, minHeight: 12, marginVertical: 3, borderRadius: 1, backgroundColor: lv.thread },
  rowGap: { paddingBottom: 16 },
  chainBody: { flex: 1, paddingTop: 4, gap: 2 },
  chainHead: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  chainMeta: { ...type.footnote, color: lv.mutedFg, flexShrink: 1 },
  chainName: { color: lv.fg, fontWeight: "600" },
  chainMsg: { ...type.subheadline, color: lv.fg },
});
