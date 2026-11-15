import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { glass } from "@/components/lv/home/glass";
import { timeLeft, useNow } from "@/lib/time";
import { lv } from "@/theme/tokens";

export type PoolCoin = {
  _id: string;
  status: "traveling" | "found" | "granted" | "faded";
  ripples: number;
  expiresAt: number;
};

/** The pool floor: my coins, each ringed by the hops it has taken so far. */
export function CoinsFloor({ coins }: { coins: PoolCoin[] }) {
  const router = useRouter();
  const now = useNow(30000);
  return (
    <View testID="coins-floor" style={[styles.floor, glass.light]}>
      <Text style={glass.eyebrow}>Pool floor</Text>
      <View style={styles.row}>
        {coins.map((c) => {
          const rings = Math.max(1, Math.min(c.ripples, 3));
          const label =
            c.status === "granted"
              ? "Granted"
              : c.status === "found"
                ? "Someone said that's me"
                : `${c.ripples} hops · ${timeLeft(c.expiresAt, now)}`;
          return (
            <Pressable
              key={c._id}
              testID={`coin-${c._id}`}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: "/threads/[id]", params: { id: c._id } })}
              style={({ pressed }) => [styles.item, pressed && { opacity: 0.75 }]}
            >
              <View style={styles.coinWrap}>
                {Array.from({ length: rings }, (_, i) => (
                  <View key={i} style={[styles.ring, { width: 46 + i * 16, height: 46 + i * 16, borderRadius: 23 + i * 8 }]} />
                ))}
                <View style={[styles.coin, c.status === "granted" && styles.coinGranted]}>
                  <View style={styles.coinInner}>
                    <Text style={styles.coinStar}>✦</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.label} numberOfLines={2}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  floor: { borderRadius: lv.radiusXl, padding: 16, gap: 12 },
  row: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-around", rowGap: 12 },
  item: { alignItems: "center", width: 104 },
  coinWrap: { width: 80, height: 80, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", borderWidth: 1, borderColor: "rgba(224,69,63,0.3)" },
  coin: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: lv.thread,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0A1E28",
    shadowOpacity: 0.35,
    shadowRadius: 4,
    shadowOffset: { width: 2, height: 4 },
    elevation: 3,
  },
  coinGranted: {
    shadowColor: lv.gold,
    shadowOpacity: 0.7,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  coinInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  coinStar: { color: "#fff", fontSize: 14 },
  label: { fontSize: 12, color: lv.mutedFg, textAlign: "center", marginTop: 6 },
});