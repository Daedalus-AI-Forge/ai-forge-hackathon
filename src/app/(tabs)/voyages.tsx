import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/convex/_generated/api";
import { BranchRace } from "@/components/BranchRace";
import { TierBadge } from "@/components/TierBadge";
import { SHELL_TAB_CLEARANCE } from "@/components/lv/shell/tabBarStyle";
import { ThreadMap } from "@/components/lv/threads/ThreadMap";
import { STATUS_LABEL, TIER_LABEL, pathHolders } from "@/components/lv/threads/threadData";
import { MiniRoute } from "@/components/lv/voyages/MiniRoute";
import { VOYAGE_STATUS } from "@/components/lv/voyages/voyageData";
import { useMe } from "@/lib/device";
import { rippleLine, useNow } from "@/lib/time";
import { lv } from "@/theme/tokens";

type Tab = "boats" | "coins";

/** Boats I pushed and coins I tossed: where they drifted and how they ended. */
export default function VoyagesScreen() {
  const { deviceId } = useMe();
  const [tab, setTab] = useState<Tab>("boats");
  const boats = useQuery(api.pool.voyages, deviceId ? { deviceId } : "skip");
  const coins = useQuery(api.wishes.mine, deviceId ? { deviceId } : "skip");
  const now = useNow(30000);
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView testID="voyages-screen" contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Where they drifted</Text>
          <Text style={styles.title}>Voyages</Text>
        </View>

        <View style={styles.segment}>
          {(["boats", "coins"] as const).map((t) => (
            <Pressable
              key={t}
              testID={t === "boats" ? "voyages-tab-boats" : "voyages-tab-coins"}
              accessibilityRole="button"
              accessibilityState={{ selected: tab === t }}
              onPress={() => setTab(t)}
              style={[styles.segmentBtn, tab === t && styles.segmentActive]}
            >
              <Text style={[styles.segmentText, tab === t && styles.segmentTextActive]}>
                {t === "boats" ? "Boats" : "Coins"}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === "boats" ? (
          <>
            {boats === undefined ? <Text style={styles.muted}>Loading…</Text> : null}
            {boats?.map((b) => (
              <Pressable
                key={b.hopId}
                testID={`boat-card-${b.hopId}`}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: "/boat/[hopId]", params: { hopId: b.hopId } })}
                style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
              >
                <View style={styles.body}>
                  <View style={styles.row}>
                    <View style={[styles.pill, b.source === "daily" ? styles.pillGold : styles.pillThread]}>
                      <Text style={[styles.pillText, b.source === "daily" ? styles.pillTextGold : styles.pillTextThread]}>
                        {b.source === "daily" ? "Today's boat" : `${b.creatorName}'s real wish`}
                      </Text>
                    </View>
                    <Text style={styles.status}>{VOYAGE_STATUS[b.status]}</Text>
                  </View>
                  <Text style={styles.text} numberOfLines={2}>
                    {b.text}
                  </Text>
                  <MiniRoute cities={b.cities} hops={b.hops} />
                  <Text style={styles.muted}>
                    {b.hops} {b.hops === 1 ? "hop" : "hops"} past you
                  </Text>
                  {b.found ? (
                    <Text style={styles.muted}>
                      Found {b.found.name}
                      {b.found.city ? ` · ${b.found.city}` : ""}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            ))}
            {boats && boats.length === 0 ? <Text style={styles.muted}>No boats yet. Push today's boat from the Pool.</Text> : null}
          </>
        ) : (
          <>
            {coins === undefined ? <Text style={styles.muted}>Loading…</Text> : null}
            {coins?.map((w) => {
              const path = pathHolders(w.holders);
              return (
                <View key={w._id} style={{ gap: 8 }}>
                <Pressable
                  testID={`coin-card-${w._id}`}
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: "/threads/[id]", params: { id: w._id } })}
                  style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
                >
                  <ThreadMap holders={w.holders} compact highlightName={w.creatorName} />
                  <View style={styles.body}>
                    <View style={styles.row}>
                      <View style={[styles.pill, styles.pillThread]}>
                        <Text style={[styles.pillText, styles.pillTextThread]}>Your coin</Text>
                      </View>
                      <Text style={styles.status}>
                        {STATUS_LABEL[w.status]}
                        {w.status === "granted" && w.tier ? ` · ${TIER_LABEL[w.tier]}` : ""}
                      </Text>
                    </View>
                    {w.tier ? <TierBadge tier={w.tier} testID={`my-wish-tier-${w._id}`} /> : null}
                    <Text style={styles.text}>{w.text}</Text>
                    <Text style={styles.muted}>{rippleLine(w.ripples, w.holding, w.expiresAt, now)}</Text>
                    <View style={styles.chain}>
                      {path.map((h, i) => (
                        <View key={h.key} style={styles.chainItem}>
                          {i > 0 ? <View style={styles.dash} /> : null}
                          <View style={[styles.chip, i === 0 && styles.chipMe]}>
                            <Text style={[styles.chipText, i === 0 && styles.chipTextMe]}>{i === 0 ? "You" : h.name}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                </Pressable>
                {deviceId && (w.status === "traveling" || w.status === "found") ? (
                  <BranchRace deviceId={deviceId} wishId={w._id} />
                ) : null}
                </View>
              );
            })}
            {coins && coins.length === 0 ? <Text style={styles.muted}>No coins tossed yet.</Text> : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: lv.bg },
  container: { padding: 16, gap: 16, maxWidth: 430, width: "100%", alignSelf: "center", paddingBottom: SHELL_TAB_CLEARANCE },
  header: { paddingHorizontal: 8, paddingTop: 8, gap: 2 },
  eyebrow: { fontSize: 11, fontWeight: "600", letterSpacing: 1.2, textTransform: "uppercase", color: lv.mutedFg },
  title: { fontSize: 34, fontWeight: "700", color: lv.fg, letterSpacing: -0.5 },
  segment: { flexDirection: "row", backgroundColor: lv.muted, borderRadius: 999, padding: 4, marginHorizontal: 8 },
  segmentBtn: { flex: 1, height: 44, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  segmentActive: { backgroundColor: lv.card, ...lv.shadow },
  segmentText: { fontSize: 14, fontWeight: "600", color: lv.mutedFg },
  segmentTextActive: { color: lv.fg },
  card: {
    backgroundColor: lv.card,
    borderRadius: 28,
    padding: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: lv.border,
    ...lv.shadow,
  },
  body: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8, gap: 6 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillThread: { backgroundColor: lv.thread },
  pillGold: { backgroundColor: lv.gold },
  pillText: { fontSize: 11, fontWeight: "600" },
  pillTextGold: { color: lv.fg },
  pillTextThread: { color: lv.threadFg },
  status: { fontSize: 12, color: lv.mutedFg },
  text: { fontSize: 18, fontWeight: "600", color: lv.fg, lineHeight: 24 },
  muted: { fontSize: 13, color: lv.mutedFg, lineHeight: 19 },
  chain: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", rowGap: 6, marginTop: 4 },
  chainItem: { flexDirection: "row", alignItems: "center" },
  dash: { width: 12, height: 1, backgroundColor: lv.thread, marginHorizontal: 4 },
  chip: { backgroundColor: lv.muted, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  chipMe: { backgroundColor: lv.primary },
  chipText: { fontSize: 11, color: lv.mutedFg },
  chipTextMe: { color: lv.primaryFg, fontWeight: "600" },
});