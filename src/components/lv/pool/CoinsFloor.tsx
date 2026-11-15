import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { CopperCoin } from "@/components/lv/pool/NightPool";
import { timeLeft, useNow } from "@/lib/time";
import { lv, night } from "@/theme/tokens";

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
    <View testID="coins-floor" style={styles.floor}>
      <Text style={styles.heading}>Your coins in the pool</Text>
      <View style={styles.row}>
        {coins.map((c, idx) => {
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
              onPress={() =>
                router.push({
                  pathname: "/threads/[id]",
                  params: { id: c._id },
                })
              }
              style={({ pressed }) => [styles.item, pressed && { opacity: 0.75 }]}
            >
              <View style={styles.coinWrap}>
                {Array.from({ length: rings }, (_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.ring,
                      {
                        width: 46 + i * 16,
                        height: 46 + i * 16,
                        borderRadius: 23 + i * 8,
                      },
                    ]}
                  />
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
    </View>
  );
}

const styles = StyleSheet.create({
  floor: {
    borderRadius: lv.radiusXl,
    padding: 16,
    gap: 12,
    backgroundColor: night.glass,
    borderWidth: 1,
    borderColor: night.border,
  },
  heading: { fontSize: 17, color: night.fg, fontFamily: night.serif },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
    rowGap: 12,
  },
  item: { alignItems: "center", width: 104 },
  coinWrap: {
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    borderWidth: 1,
    borderColor: "rgba(127,211,209,0.4)",
  },
  coin: {
    width: 40,
    height: 40,
    borderRadius: 20,
    shadowColor: "#04121A",
    shadowOpacity: 0.5,
    shadowRadius: 4,
    shadowOffset: { width: 2, height: 4 },
    elevation: 3,
  },
  coinGranted: {
    shadowColor: night.gold,
    shadowOpacity: 0.9,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  label: {
    fontSize: 12,
    color: night.mutedFg,
    textAlign: "center",
    marginTop: 6,
  },
});
