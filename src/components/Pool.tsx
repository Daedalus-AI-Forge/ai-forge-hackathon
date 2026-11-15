import { useEffect, useRef } from "react";
import { Animated, Easing, Platform, StyleSheet, View } from "react-native";

import { Avatar } from "@/components/ui";
import { colors } from "@/lib/theme";

const useNativeDriver = Platform.OS !== "web";

export type Holder = { key: string; name: string; depth: number; avatar: string; acted: string | null };

function Ripple({ size, delay }: { size: number; delay: number }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.sequence([
      Animated.delay(delay),
      Animated.loop(
        Animated.timing(t, { toValue: 1, duration: 3000, easing: Easing.out(Easing.quad), useNativeDriver }),
      ),
    ]);
    anim.start();
    return () => anim.stop();
  }, [t, delay]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ripple,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          opacity: t.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.6, 0] }),
          transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.15, 1] }) }],
        },
      ]}
    />
  );
}

function PlacedAvatar({ holder, x, y }: { holder: Holder; x: number; y: number }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(t, { toValue: 1, friction: 6, tension: 40, useNativeDriver }).start();
  }, [t]);
  return (
    <Animated.View
      testID={`pool-holder-${holder.key}`}
      style={[
        styles.placed,
        {
          opacity: holder.acted ? 0.55 : 1,
          transform: [
            { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, x] }) },
            { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, y] }) },
            { scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
          ],
        },
      ]}
    >
      <Avatar name={holder.name} color={holder.avatar} size={34} />
    </Animated.View>
  );
}

export function Pool({ holders = [], size = 300, testID }: { holders?: Holder[]; size?: number; testID?: string }) {
  const ringRadii = [size * 0.2, size * 0.33, size * 0.46];
  const byRing = [0, 1, 2].map((i) => holders.filter((h) => Math.min(h.depth, 3) === i + 1));
  return (
    <View testID={testID} style={[styles.pool, { width: size, height: size, borderRadius: size / 2 }]}>
      <Ripple size={size} delay={0} />
      <Ripple size={size} delay={1000} />
      <Ripple size={size} delay={2000} />
      {ringRadii.map((r) => (
        <View
          key={r}
          pointerEvents="none"
          style={[styles.ring, { width: r * 2, height: r * 2, borderRadius: r }]}
        />
      ))}
      <View testID="pool-coin" style={[styles.coin, { width: size * 0.13, height: size * 0.13, borderRadius: size }]} />
      {byRing.flatMap((ring, i) =>
        ring.map((h, j) => {
          const angle = (j / ring.length) * Math.PI * 2 - Math.PI / 2 + i * 0.7;
          return (
            <PlacedAvatar
              key={h.key}
              holder={h}
              x={Math.cos(angle) * ringRadii[i]}
              y={Math.sin(angle) * ringRadii[i]}
            />
          );
        }),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pool: {
    backgroundColor: colors.water,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    overflow: "hidden",
  },
  ripple: { position: "absolute", borderWidth: 2, borderColor: colors.red },
  ring: {
    position: "absolute",
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#C9BBA2",
  },
  coin: {
    position: "absolute",
    backgroundColor: colors.red,
    borderWidth: 3,
    borderColor: "#FFD9DC",
    shadowColor: colors.red,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  placed: { position: "absolute" },
});
