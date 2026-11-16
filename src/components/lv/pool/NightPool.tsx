import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Image, Platform, StyleSheet, View, type GestureResponderEvent } from "react-native";

import { RIM, boatBounds, circleFrame, type PoolFrame } from "@/lib/well/geometry";
import { makeBoats } from "@/lib/well/pool-sim";
import { night, poolImages } from "@/theme/tokens";

import { PaperBoat, boatBox } from "./PaperBoat";
import { WaterPool, waterSurfaceSupported, type WaterPoolApi } from "./WaterPool";

export type { WaterPoolApi };

let warnedGl = false;

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

/** A lantern boat on the fallback water, bobbing and rocking (still under Reduce Motion). */
function FloatingBoat({ x, y, halfWidth, seed, still }: { x: number; y: number; halfWidth: number; seed: number; still: boolean }) {
  const [t] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (still) return;
    const half = (to: number) => Animated.timing(t, { toValue: to, duration: 2200 + seed * 120, easing: Easing.inOut(Easing.sin), useNativeDriver });
    const anim = Animated.loop(Animated.sequence([half(1), half(0)]));
    anim.start();
    return () => anim.stop();
  }, [t, still, seed]);
  const box = boatBox(halfWidth);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: x + box.left,
        top: y + box.top,
        transform: [
          { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [-halfWidth * 0.05, halfWidth * 0.05] }) },
          { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ["-5deg", "5deg"] }) },
        ],
      }}
    >
      <PaperBoat halfWidth={halfWidth} />
    </Animated.View>
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

/** A coin tossed tonight, landing at (x, y) as fractions of the pool (0..1). */
export type PoolToss = { id: number; x: number; y: number; variant: number };

/**
 * Katie-Lan's toss: the coin arcs up from below, spinning and shrinking as it falls toward the
 * floor, then lands with two rings and stays on the bottom. Reduce Motion: it is simply there.
 */
function SinkingCoin({ toss, size, still }: { toss: PoolToss; size: number; still: boolean }) {
  const [t] = useState(() => new Animated.Value(still ? 1 : 0));
  const [landed, setLanded] = useState(still);
  useEffect(() => {
    if (still) return;
    const anim = Animated.timing(t, { toValue: 1, duration: 820, easing: Easing.bezier(0.25, 0.1, 0.4, 1), useNativeDriver });
    anim.start(({ finished }) => finished && setLanded(true));
    return () => anim.stop();
  }, [t, still]);
  const coin = Math.min(size * 0.1, 34);
  const sx = toss.x * size;
  const sy = toss.y * size;
  const startX = size / 2 + (sx - size / 2) * 0.2;
  const startY = size + coin;
  const midY = Math.min(startY, sy) - size * 0.2;
  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: -coin / 2,
          top: -coin / 2,
          transform: [
            { translateX: t.interpolate({ inputRange: [0, 0.55, 1], outputRange: [startX, (startX + sx) / 2, sx] }) },
            { translateY: t.interpolate({ inputRange: [0, 0.55, 1], outputRange: [startY, midY, sy] }) },
            { scale: t.interpolate({ inputRange: [0, 0.55, 1], outputRange: [3, 1.7, 1] }) },
            { rotateX: t.interpolate({ inputRange: [0, 1], outputRange: ["0deg", still ? "0deg" : "1080deg"] }) },
          ],
        }}
      >
        <CopperCoin size={coin} variant={toss.variant} />
      </Animated.View>
      {landed ? (
        <>
          <Ripple x={sx} y={sy} size={size * 0.32} duration={still ? 300 : 1200} />
          {still ? null : <Ripple x={sx} y={sy} size={size * 0.6} duration={1800} delay={180} />}
        </>
      ) : null}
    </>
  );
}

/**
 * The wishing pool seen from above: the tiled floor under night water, lantern paper boats drifting on
 * the surface, your coins resting on the bottom. Touching the water sends out a ripple.
 * - `size`: the small round pool in a thin glass rim (the toss sheet).
 * - `frame` (heroFrame): the Pool tab's full-bleed pool, its top running off the screen and the marble
 *   rim showing only along the bottom; `openTop` is where open water starts below the header.
 * With GL and motion it renders WaterPool (Katie-Lan's WebGL2 water; `onReady` gets its API). This
 * Animated version is the fallback when GL is unavailable or Reduce Motion is on.
 */
export function NightPool({
  size = 200,
  frame,
  openTop,
  coins,
  tosses = [],
  onWaterTap,
  onReady,
}: {
  size?: number;
  frame?: PoolFrame;
  openTop?: number;
  coins: number;
  /** Coins tossed in this session; each one plays the sink animation once, then rests. */
  tosses?: PoolToss[];
  /** Tapping the water (fractions of the pool, 0..1); without it a tap is only a ripple. */
  onWaterTap?: (x: number, y: number) => void;
  /** With the GL water: its imperative API (drop / tossCoin in pool space). */
  onReady?: (api: WaterPoolApi) => void;
}) {
  const still = useReduceMotion();
  const [glFailed, setGlFailed] = useState(false);
  const hero = !!frame;
  const f = useMemo(() => frame ?? circleFrame(size), [frame, size]);

  // Katie's real-time water when GL is available and motion is welcome; this Animated pool otherwise.
  if (waterSurfaceSupported && !still && !glFailed) {
    return (
      <WaterPool
        frame={f}
        hero={hero}
        openTop={openTop}
        coins={coins}
        tosses={tosses}
        onWaterTap={onWaterTap}
        onReady={onReady}
        onError={(err) => {
          if (!warnedGl) {
            warnedGl = true;
            console.warn("[NightPool] water effect unavailable, using the static pool", err);
          }
          setGlFailed(true);
        }}
      />
    );
  }

  const label = coins > 0 ? `The wishing pool: paper boats drifting, ${coins} of your coins on the floor` : "The wishing pool, with paper boats drifting";
  const hint = onWaterTap ? "Tap the water to toss a coin" : undefined;
  const water = <FallbackWater frame={f} openTop={openTop} coins={coins} tosses={tosses} onWaterTap={onWaterTap} still={still} />;

  if (!hero) {
    const d = f.R * 2;
    return (
      <View
        testID="night-pool"
        accessible
        accessibilityRole="image"
        accessibilityLabel={label}
        accessibilityHint={hint}
        style={[styles.rim, { width: d + 16, height: d + 16, borderRadius: (d + 16) / 2 }]}
      >
        {water}
      </View>
    );
  }
  // Hero: the marble ring sits behind the water circle; the frame clips its top off.
  const outer = f.R * (1 + RIM);
  return (
    <View
      testID="night-pool"
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={{ width: f.width, height: f.height, overflow: "hidden", backgroundColor: night.deep }}
    >
      <View style={[styles.marble, { left: f.cx - outer, top: f.cy - outer, width: outer * 2, height: outer * 2, borderRadius: outer }]}>{water}</View>
    </View>
  );
}

/** The fallback's water circle (diameter 2R): floor, coins, ripples, boats, sinking coins, tap rings. */
function FallbackWater({
  frame: f,
  openTop,
  coins,
  tosses,
  onWaterTap,
  still,
}: {
  frame: PoolFrame;
  openTop?: number;
  coins: number;
  tosses: PoolToss[];
  onWaterTap?: (x: number, y: number) => void;
  still: boolean;
}) {
  const [taps, setTaps] = useState<TapRipple[]>([]);
  const nextId = useRef(0);
  const size = f.R * 2;
  const c = f.R;
  const coin = Math.min(size * 0.1, 34);
  const boats = useMemo(() => makeBoats(5, boatBounds(f, openTop)), [f, openTop]);

  const onTap = (e: GestureResponderEvent) => {
    const { locationX: x, locationY: y } = e.nativeEvent;
    if (Math.hypot(x - c, y - c) > c * 0.95) return;
    const id = nextId.current++;
    setTaps((list) => [...list.slice(-4), { id, x, y }]);
    onWaterTap?.(x / size, y / size);
  };
  const drop = (id: number) => setTaps((list) => list.filter((r) => r.id !== id));

  return (
    <View style={{ width: size, height: size, borderRadius: c, overflow: "hidden" }} onStartShouldSetResponder={() => true} onResponderRelease={onTap}>
      <Image source={poolImages.floor} style={{ position: "absolute", left: 0, top: 0, width: size, height: size }} resizeMode="cover" />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.water]} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.depth, { borderRadius: c, borderWidth: size * 0.09 }]} />

      {COIN_SPOTS.slice(0, Math.min(coins, COIN_SPOTS.length)).map((s, i) => (
        <CopperCoin
          key={i}
          size={coin}
          variant={s.variant}
          style={{
            position: "absolute",
            left: s.x * size - coin / 2,
            top: s.y * size - coin / 2,
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
      {boats.map((b, i) => (
        <FloatingBoat key={i} x={c + b.x * c} y={c + b.y * c} halfWidth={b.size * c} seed={i} still={still} />
      ))}
      {tosses.slice(-8).map((t) => (
        <SinkingCoin key={t.id} toss={t} size={size} still={still} />
      ))}
      {taps.map((r) => (
        <TapRing key={r.id} r={r} size={size} onDone={drop} still={still} />
      ))}
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
  // The fallback's marble lip (the GL water draws its own): only its bottom shows on the hero.
  marble: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8E1D3",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
  },
  coinShadow: {
    shadowColor: "#04121A",
    shadowOpacity: 0.45,
    shadowRadius: 3,
    shadowOffset: { width: 1, height: 2 },
  },
});
