import { useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/convex/_generated/api";
import { ThreadMap } from "@/components/lv/threads/ThreadMap";
import { STATUS_LABEL, TIER_LABEL, actionLabel, badgesFor, totalKm } from "@/components/lv/threads/threadData";
import { useMe } from "@/lib/device";
import { countdown, useNow } from "@/lib/time";
import { lv } from "@/theme/tokens";

const TIER_BG = { gold: lv.gold, silver: lv.silver, bronze: lv.bronze, red: lv.accent } as const;

/** One wish of mine (id = wishId). Data comes from `wishes.mine`; there is no per-wish query yet. */
export default function ThreadDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { deviceId } = useMe();
  const wishes = useQuery(api.wishes.mine, deviceId ? { deviceId } : "skip");
  const now = useNow(1000);
  const w = wishes?.find((x) => x._id === id);

  const back = (
    <Pressable testID="thread-back" accessibilityRole="button" onPress={() => (router.canGoBack() ? router.back() : router.replace("/voyages"))} hitSlop={12}>
      <Text style={styles.back}>‹ Voyages</Text>
    </Pressable>
  );

  if (!w) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View testID="thread-screen" style={styles.container}>
          {back}
          <Text style={styles.muted}>{wishes === undefined ? "Loading…" : "Thread not found."}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const chain = [...w.holders].sort((a, b) => a.depth - b.depth);
  const left = w.expiresAt - now;
  const badges = badgesFor(w);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView testID="thread-screen" contentContainerStyle={styles.container}>
        {back}
        <Text style={styles.headline}>
          Your coin: <Text style={{ color: lv.thread }}>{w.text}</Text>
        </Text>

        <View style={[styles.card, { padding: 12 }]}>
          <ThreadMap testID="thread-map" holders={w.holders} highlightName={w.creatorName} />
          <View style={styles.stats}>
            <Stat value={String(w.ripples)} label="Hops" />
            <Stat value={Math.round(totalKm(w.holders)).toLocaleString()} label="Km" />
            <Stat value={w.status === "traveling" && left > 0 ? countdown(w.expiresAt, now) : "—"} label="Left" />
          </View>
        </View>

        {w.status === "found" ? (
          <View style={[styles.card, styles.center, { borderColor: lv.thread }]}>
            <Text style={styles.cardTitle}>Someone says they're who you're looking for</Text>
            <Text style={[styles.muted, { textAlign: "center" }]}>
              Confirming them comes next — you'll see their intro and the vouch chain here.
            </Text>
          </View>
        ) : null}

        {w.status === "faded" ? (
          <View style={[styles.card, { borderColor: lv.thread }]}>
            <Text style={styles.cardTitle}>This thread faded.</Text>
            <Text style={styles.muted}>It ran out of time before reaching the right person.</Text>
          </View>
        ) : null}

        {w.status === "granted" ? (
          <View testID="thread-ending" style={styles.polaroid}>
            <View style={styles.row}>
              <View style={[styles.tierPill, { backgroundColor: w.tier ? TIER_BG[w.tier] : lv.muted }]}>
                <Text style={styles.tierText}>
                  {w.tier ? TIER_LABEL[w.tier] : "Wish granted"} · {w.ripples} ripples
                </Text>
              </View>
            </View>
            <ThreadMap holders={w.holders} compact />
            {badges.length ? (
              <View style={styles.badges}>
                {badges.map((b) => (
                  <View key={b} style={styles.badge}>
                    <Text style={styles.badgeText}>{b}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {w.status !== "faded" ? (
          <Pressable
            testID="thread-open-ending"
            accessibilityRole="button"
            onPress={() => router.push({ pathname: "/wish/[wishId]", params: { wishId: w._id } })}
            style={({ pressed }) => [styles.card, styles.center, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.cardTitle}>
              {w.status === "traveling" ? "Who says it's them? ›" : w.status === "found" ? "Photo and contacts ›" : "Open the Wish Granted card ›"}
            </Text>
          </Pressable>
        ) : null}

        <Text style={[styles.eyebrow, { paddingHorizontal: 8, paddingTop: 8 }]}>
          The chain · {STATUS_LABEL[w.status]} · {w.holding} holding it
        </Text>
        <View style={styles.chain}>
          {chain.map((h) => {
            const isMe = h.depth === 0;
            return (
              <View key={h.key} style={styles.chainItem}>
                <View style={[styles.avatar, { backgroundColor: h.avatar }]}>
                  <Text style={styles.avatarText}>{h.name.slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.chainMeta}>
                    {isMe ? <Text style={styles.youPill}> You </Text> : null}
                    {isMe ? " " : ""}
                    <Text style={{ color: lv.fg, fontWeight: "600" }}>{h.name}</Text>
                    {h.city ? ` · ${h.city}` : ""} · {actionLabel(h)}
                  </Text>
                  {!h.acted && h.depth > 0 ? <Text style={styles.chainMsg}>Holding it now</Text> : null}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.eyebrow}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: lv.bg },
  container: { padding: 16, paddingTop: 20, gap: 20, maxWidth: 430, width: "100%", alignSelf: "center", paddingBottom: 48 },
  back: { fontSize: 15, color: lv.mutedFg, paddingHorizontal: 8 },
  headline: { fontSize: 34, lineHeight: 37, fontWeight: "700", color: lv.fg, paddingHorizontal: 8, letterSpacing: -0.5 },
  card: {
    backgroundColor: lv.card,
    borderRadius: lv.radiusXl,
    padding: 20,
    borderWidth: 1,
    borderColor: lv.border,
    gap: 6,
    ...lv.shadow,
  },
  center: { alignItems: "center" },
  cardTitle: { fontSize: 22, fontWeight: "700", color: lv.fg },
  stats: { flexDirection: "row", gap: 8, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 4 },
  statValue: { fontSize: 24, fontWeight: "700", color: lv.fg, fontVariant: ["tabular-nums"] },
  eyebrow: { fontSize: 11, fontWeight: "600", letterSpacing: 1.2, textTransform: "uppercase", color: lv.mutedFg },
  muted: { fontSize: 14, color: lv.mutedFg, lineHeight: 20 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  polaroid: {
    width: "90%",
    alignSelf: "center",
    backgroundColor: lv.card,
    padding: 12,
    paddingBottom: 20,
    gap: 12,
    transform: [{ rotate: "-1.5deg" }],
    ...lv.shadow,
  },
  tierPill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  tierText: { fontSize: 12, fontWeight: "500", color: lv.fg },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  badge: { borderWidth: 1, borderColor: lv.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
  badgeText: { fontSize: 12, color: lv.fg },
  chain: { marginLeft: 16, borderLeftWidth: 1, borderLeftColor: lv.thread, paddingLeft: 0, gap: 20 },
  chainItem: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginLeft: -13 },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: lv.card,
  },
  avatarText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  chainMeta: { fontSize: 12, color: lv.mutedFg, lineHeight: 18 },
  youPill: { backgroundColor: lv.thread, color: lv.threadFg, fontSize: 10, fontWeight: "600", borderRadius: 999, overflow: "hidden" },
  chainMsg: { fontSize: 15, color: lv.fg, marginTop: 2 },
});
