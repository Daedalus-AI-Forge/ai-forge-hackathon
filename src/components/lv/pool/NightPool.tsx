import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Image, Platform, StyleSheet, View, type GestureResponderEvent } from "react-native";

import { night, poolImages } from "@/theme/tokens";

const useNativeDriver = Platform.OS !== "web";

/** Deterministic layout hash (from the prototype): same positions on every render and platform. */
function rand(i: number, n: number) {
  let h = Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(n + 7, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h ^= h >>> 13;
  return ((h >>> 0) % 1000) / 1000;
}

/** A point inside the unit disc (radius <= maxR), as fractions of the pool size. */
function discPoint(i: number, salt: number, maxR: number) {
  const a = rand(i, salt) * Math.PI * 2;
  const r = Math.sqrt(rand(i, salt + 1)) * maxR;
  return { x: 0.5 + Math.cos(a) * r * 0.5, y: 0.5 + Math.sin(a) * r * 0.5 };
}

const STARS = Array.from({ length: 7 }, (_, i) => ({
  ...discPoint(i, 1, 0.82),
  size: 3 + Math.round(rand(i, 3) * 3),
  dur: 1800 + Math.round(rand(i, 4) * 2400),
  delay: Math.round(rand(i, 5) * 2000),
}));
const COIN_SPOTS = Array.from({ length: 3 }, (_, i) => ({
  ...discPoint(i, 21, 0.55),
  variant: i % 2,
  tilt: Math.round((rand(i, 23) - 0.5) * 60),
}));

export function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduce(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

/** One expanding ring on the water. `loop` keeps it breathing; otherwise it plays once and calls onDone. */
function Ripple({
  x,
  y,
  size,
  delay = 0,
  loop,
  duration,
  onDone,
}: {
  x: number;
  y: number;
  size: number;
  delay?: number;
  loop?: boolean;
  duration: number;
  onDone?: () => void;
}) {
  const [t] = useState(() => new Animated.Value(0));
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  });
  useEffect(() => {
    const once = Animated.timing(t, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.quad),
      useNativeDriver,
    });
    const anim = Animated.sequence([Animated.delay(delay), loop ? Animated.loop(once) : once]);
    anim.start(({ finished }) => {
      if (finished) doneRef.current?.();
    });
    return () => anim.stop();
  }, [t, delay, loop, duration]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ripple,
        {
          left: x - size / 2,
          top: y - size / 2,
          width: size,
          height: size,
          borderRadius: size / 2,
          opacity: t.interpolate({
            inputRange: [0, 0.12, 1],
            outputRange: [0, 0.85, 0],
          }),
          transform: [
            {
              scale: t.interpolate({
                inputRange: [0, 1],
                outputRange: [0.08, 1],
              }),
            },
          ],
        },
      ]}
    />
  );
}

function Star({ x, y, size, dur, delay, still }: { x: number; y: number; size: number; dur: number; delay: number; still: boolean }) {
  const [t] = useState(() => new Animated.Value(still ? 1 : 0));
  useEffect(() => {
    if (still) {
      t.setValue(1);
      return;
    }
    const half = (to: number) =>
      Animated.timing(t, {
        toValue: to,
        duration: dur / 2,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver,
      });
    const anim = Animated.sequence([Animated.delay(delay), Animated.loop(Animated.sequence([half(1), half(0)]))]);
    anim.start();
    return () => anim.stop();
  }, [t, dur, delay, still]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.star,
        {
          left: x - size / 2,
          top: y - size / 2,
          width: size,
          height: size,
          borderRadius: size / 2,
          opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }),
          transform: [
            {
              scale: t.interpolate({
                inputRange: [0, 1],
                outputRange: [0.6, 1],
              }),
            },
          ],
        },
      ]}
    />
  );
}

/** A copper coin cropped from the two-coin sprite sheet. */
export function CopperCoin({ size, variant = 0, style }: { size: number; variant?: number; style?: object }) {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: "hidden",
        },
        styles.coinShadow,
        style,
      ]}
    >
      <Image
        source={poolImages.coins}
        style={{
          width: size * 2,
          height: size,
          marginLeft: variant ? -size : 0,
        }}
        resizeMode="cover"
      />
    </View>
  );
}

type TapRipple = { id: number; x: number; y: number };

/**
 * The wishing pool seen from above: the tiled floor under night water, stars twinkling on the surface,
 * your coins resting on the bottom. Touching the water sends out a ripple (decorative only).
 * A native port of the prototype's WebGL pool: same floor and coins, ripples drawn as rings.
 */
export function NightPool({ size, coins }: { size: number; coins: number }) {
  const still = useReduceMotion();
  const [taps, setTaps] = useState<TapRipple[]>([]);
  const nextId = useRef(0);
  const c = size / 2;

  const onTap = (e: GestureResponderEvent) => {
    const { locationX: x, locationY: y } = e.nativeEvent;
    if (Math.hypot(x - c, y - c) > c * 0.95) return;
    const id = nextId.current++;
    setTaps((list) => [...list.slice(-4), { id, x, y }]);
  };
  const drop = (id: number) => setTaps((list) => list.filter((r) => r.id !== id));

  return (
    <View
      testID="night-pool"
      accessible
      accessibilityRole="image"
      accessibilityLabel={coins > 0 ? `The wishing pool, with ${coins} of your coins on the floor` : "The wishing pool"}
      style={[styles.rim, { width: size + 16, height: size + 16, borderRadius: (size + 16) / 2 }]}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: c,
          overflow: "hidden",
        }}
        onStartShouldSetResponder={() => true}
        onResponderRelease={onTap}
      >
        <Image source={poolImages.floor} style={{ position: "absolute", left: 0, top: 0, width: size, height: size }} resizeMode="cover" />
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.water]} />
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.depth, { borderRadius: c, borderWidth: size * 0.09 }]} />

        {COIN_SPOTS.slice(0, Math.min(coins, COIN_SPOTS.length)).map((s, i) => (
          <CopperCoin
            key={i}
            size={size * 0.1}
            variant={s.variant}
            style={{
              position: "absolute",
              left: s.x * size - size * 0.05,
              top: s.y * size - size * 0.05,
              transform: [{ rotate: `${s.tilt}deg` }],
            }}
          />
        ))}

        {still ? null : (
          <>
            <Ripple x={c} y={c} size={size * 1.1} duration={1600} />
            <Ripple x={c} y={c} size={size * 0.9} duration={5200} delay={1400} loop />
            <Ripple x={c} y={c} size={size * 0.9} duration={5200} delay={4000} loop />
          </>
        )}
        {STARS.map((s, i) => (
          <Star key={i} x={s.x * size} y={s.y * size} size={s.size} dur={s.dur} delay={s.delay} still={still} />
        ))}
        {taps.map((r) => (
          <TapRing key={r.id} r={r} size={size} onDone={drop} still={still} />
        ))}
      </View>
    </View>
  );
}

function TapRing({ r, size, onDone, still }: { r: TapRipple; size: number; onDone: (id: number) => void; still: boolean }) {
  return <Ripple x={r.x} y={r.y} size={size * 0.45} duration={still ? 300 : 1100} onDone={() => onDone(r.id)} />;
}

const styles = StyleSheet.create({
  rim: {
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(248,242,226,0.14)",
    borderWidth: 1,
    borderColor: "rgba(248,242,226,0.35)",
    shadowColor: night.aqua,
    shadowOpacity: 0.35,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  water: { backgroundColor: "rgba(10,52,64,0.38)" },
  depth: { borderColor: "rgba(7,20,26,0.22)" },
  ripple: {
    position: "absolute",
    borderWidth: 1.5,
    borderColor: "rgba(232,250,248,0.9)",
  },
  star: {
    position: "absolute",
    backgroundColor: night.goldBright,
    shadowColor: night.gold,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  coinShadow: {
    shadowColor: "#04121A",
    shadowOpacity: 0.45,
    shadowRadius: 3,
    shadowOffset: { width: 1, height: 2 },
  },
});
