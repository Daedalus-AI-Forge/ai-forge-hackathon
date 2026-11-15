import { useEffect, useRef } from "react";
import { Animated, Easing, Image, Platform, StyleSheet, Text, View } from "react-native";

import { Glass } from "@/components/ios";
import { Avatar } from "@/components/ui";
import { lv, lvImages } from "@/theme/tokens";

const useNativeDriver = Platform.OS !== "web";

export type WellHolder = { key: string; name: string; depth: number; avatar: string; acted: string | null };

function Ripple({ size, delay, color }: { size: number; delay: number; color: string }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.sequence([
      Animated.delay(delay),
      Animated.loop(Animated.timing(t, { toValue: 1, duration: 4400, easing: Easing.out(Easing.quad), useNativeDriver })),
    ]);
    anim.start();
    return () => anim.stop();
  }, [t, delay]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1.5,
        borderColor: color,
        opacity: t.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.8, 0] }),
        transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.12, 1] }) }],
      }}
    />
  );
}

function Bob({ children }: { children: React.ReactNode }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver }),
        Animated.timing(t, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [t]);
  return (
    <Animated.View style={{ transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }] }}>
      {children}
    </Animated.View>
  );
}

function PlacedHolder({ holder, x, y, delay }: { holder: WellHolder; x: number; y: number; delay: number }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([Animated.delay(delay), Animated.spring(t, { toValue: 1, friction: 6, tension: 40, useNativeDriver })]).start();
  }, [t, delay]);
  return (
    <Animated.View
      testID={`pool-holder-${holder.key}`}
      style={{
        position: "absolute",
        opacity: holder.acted ? 0.6 : 1,
        transform: [
          { translateX: x },
          { translateY: y },
          { scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
        ],
      }}
    >
      <View style={styles.holderRing}>
        <Avatar name={holder.name} color={holder.avatar} size={30} />
      </View>
    </Animated.View>
  );
}

/** The new-design well: a photographic pool inside a stone rim, ripples, red wish coin, holders on rings. */
export function Well({ holders = [], size = 320, testID }: { holders?: WellHolder[]; size?: number; testID?: string }) {
  const pool = size * (156 / 170);
  const ringR = [62, 98, 134].map((r) => (r / 340) * size);
  // holders[0] is the creator's own hop; everyone after it sits on a ring.
  const placed = holders.filter((h) => h.depth > 0);
  return (
    <View testID={testID} style={[styles.wrap, { width: size, height: size }]}>
      <Glass variant="thin" radius={size / 2} curve="circular" style={[styles.rim, { width: size, height: size }]} />
      <View style={[styles.pool, { width: pool, height: pool, borderRadius: pool / 2 }]}>
        <Image source={lvImages.wellPool} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <View style={[StyleSheet.absoluteFill, styles.depth, { borderRadius: pool / 2 }]} />
        {ringR.map((r) => (
          <View key={r} pointerEvents="none" style={[styles.ring, { width: r * 2, height: r * 2, borderRadius: r }]} />
        ))}
        {[0, 1, 2, 3].map((i) => (
          <Ripple key={i} size={pool} delay={i * 1100} color="rgba(255,255,255,0.6)" />
        ))}
        <Ripple size={pool} delay={400} color={lv.thread} />
        <View pointerEvents="none" style={[styles.sheen, { width: pool * 0.9, height: pool * 0.42, top: pool * 0.04, left: -pool * 0.05 }]} />
      </View>
      {/* Centered on the pool, where the ripples start. */}
      <View style={styles.center}>
        <Bob>
          <View testID="pool-coin" style={styles.coin}>
            <View style={styles.coinInner}>
              <Text style={styles.coinStar}>✦</Text>
            </View>
          </View>
        </Bob>
      </View>
      {placed.map((h, i) => {
        const depth = Math.min(i, 2);
        const a = -Math.PI / 2 + i * 2.1 + depth * 0.6;
        const r = ringR[depth]!;
        return <PlacedHolder key={h.key} holder={h} x={Math.cos(a) * r} y={Math.sin(a) * r} delay={300 + i * 250} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: "center", alignItems: "center", justifyContent: "center" },
  rim: { position: "absolute" },
  center: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", pointerEvents: "none" },
  pool: { overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: lv.water },
  depth: { borderWidth: 14, borderColor: "rgba(12,30,40,0.28)" },
  ring: { position: "absolute", borderWidth: 1, borderStyle: "dashed", borderColor: "rgba(255,255,255,0.22)" },
  sheen: { position: "absolute", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.12)", transform: [{ rotate: "-25deg" }] },
  coin: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: lv.thread,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "2px 4px 6px rgba(10,30,40,0.4)",
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
  holderRing: { borderRadius: 999, borderWidth: 2, borderColor: "rgba(255,255,255,0.9)" },
});
