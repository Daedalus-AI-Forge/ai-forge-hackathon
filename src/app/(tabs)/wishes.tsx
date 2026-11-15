import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/convex/_generated/api";
import { BranchRace } from "@/components/BranchRace";
import { TierBadge } from "@/components/TierBadge";
import { ThreadMap } from "@/components/lv/threads/ThreadMap";
import { STATUS_LABEL, TIER_LABEL, pathHolders } from "@/components/lv/threads/threadData";
import { useMe } from "@/lib/device";
import { rippleLine, useNow } from "@/lib/time";
import { lv } from "@/theme/tokens";

export default function MyWishes() {
  const { deviceId } = useMe();
  const wishes = useQuery(api.wishes.mine, deviceId ? { deviceId } : "skip");
  const now = useNow(30000);
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: lv.bg }} edges={["top"]}>
      <ScrollView testID="wishes-screen" contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Started & joined</Text>
          <Text style={styles.title}>My wishes</Text>
        </View>
        {wishes === undefined ? <Text style={styles.muted}>Loading…</Text> : null}
        {(wishes ?? []).map((w) => {
          const path = pathHolders(w.holders);
          return (
            <View key={w._id} style={{ gap: 8 }}>
            <Pressable
              testID={`wish-card-${w._id}`}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: "/threads/[id]", params: { id: w._id } })}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
            >
              <ThreadMap holders={w.holders} compact highlightName={w.creatorName} />
              <View style={styles.body}>
                <View style={styles.row}>
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>Your wish</Text>
                  </View>
                  <Text style={styles.status}>
                    {STATUS_LABEL[w.status]}
                    {w.status === "granted" && w.tier ? ` · ${TIER_LABEL[w.tier]}` : ""}
                  </Text>
                  {w.tier ? <TierBadge tier={w.tier} testID={`my-wish-tier-${w._id}`} /> : null}
                </View>
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
        {wishes && wishes.length === 0 ? <Text style={styles.muted}>No wishes yet. Toss one into the well!</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16, maxWidth: 430, width: "100%", alignSelf: "center", paddingBottom: 40 },
  header: { paddingHorizontal: 8, paddingTop: 8, gap: 2 },
  eyebrow: { fontSize: 11, fontWeight: "600", letterSpacing: 1.2, textTransform: "uppercase", color: lv.mutedFg },
  title: { fontSize: 34, fontWeight: "700", color: lv.fg, letterSpacing: -0.5 },
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
  pill: { backgroundColor: lv.thread, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { color: lv.threadFg, fontSize: 11, fontWeight: "600" },
  status: { fontSize: 12, color: lv.mutedFg },
  text: { fontSize: 18, fontWeight: "600", color: lv.fg, lineHeight: 24 },
  muted: { fontSize: 13, color: lv.mutedFg },
  chain: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", rowGap: 6, marginTop: 4 },
  chainItem: { flexDirection: "row", alignItems: "center" },
  dash: { width: 12, height: 1, backgroundColor: lv.thread, marginHorizontal: 4 },
  chip: { backgroundColor: lv.muted, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  chipMe: { backgroundColor: lv.primary },
  chipText: { fontSize: 11, color: lv.mutedFg },
  chipTextMe: { color: lv.primaryFg, fontWeight: "600" },
});
