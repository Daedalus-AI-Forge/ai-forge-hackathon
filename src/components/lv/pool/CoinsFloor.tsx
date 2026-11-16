import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { GlassCard } from "@/components/ios";
import { CopperCoin } from "@/components/lv/pool/NightPool";
import { hopCount, timeLeft, useNow } from "@/lib/time";
import { night, type } from "@/theme/tokens";

export type PoolCoin = {
  _id: string;
  status: "traveling" | "found" | "granted" | "faded";
  ripples: number;
  expiresAt: number;
};

/** The pool floor: my coins (the prototype's copper coins), each ringed by the hops it has taken so far. */
export function CoinsFloor({ coins }: { coins: PoolCoin[] }) {
  const router = useRouter();
  const now = useNow(30000);
  return (
    <GlassCard testID="coins-floor" variant="dark">
      <Text style={styles.heading}>Your coins in the pool</Text>
      <View style={styles.row}>
        {coins.map((c, idx) => {
          const rings = Math.max(1, Math.min(c.ripples, 3));
          const label =
            c.status === "granted"
              ? "Granted"
              : c.status === "found"
                ? "Someone said that's me"
                : `${hopCount(c.ripples)} · ${timeLeft(c.expiresAt, now)}`;
          return (
            <Pressable
              key={c._id}
              testID={`coin-${c._id}`}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: "/threads/[id]", params: { id: c._id } })}
              style={({ pressed }) => [styles.item, pressed && { opacity: 0.7, transform: [{ scale: 0.96 }] }]}
            >
              <View style={styles.coinWrap}>
                {Array.from({ length: rings }, (_, i) => (
                  <View key={i} style={[styles.ring, { width: 46 + i * 16, height: 46 + i * 16, borderRadius: 23 + i * 8 }]} />
                ))}
                <View style={[styles.coin, c.status === "granted" && styles.coinGranted]}>
                  <CopperCoin size={40} variant={idx % 2} />
                </View>
              </View>
              <Text style={styles.label} numberOfLines={2}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  heading: { ...type.headline, fontWeight: "400", color: night.fg, fontFamily: night.serif },
  row: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-around", rowGap: 12 },
  item: { alignItems: "center", width: 104 },
  coinWrap: { width: 80, height: 80, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", borderWidth: 1, borderColor: "rgba(127,211,209,0.4)" },
  coin: { width: 40, height: 40, borderRadius: 20, boxShadow: "1px 3px 6px rgba(4,18,26,0.5)" },
  coinGranted: { boxShadow: `0px 0px 14px ${night.gold}` },
  label: { ...type.caption1, color: night.mutedFg, textAlign: "center", marginTop: 6 },
});
