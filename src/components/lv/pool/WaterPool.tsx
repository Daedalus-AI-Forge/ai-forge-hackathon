import { useIsFocused } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AppState, StyleSheet, View, type GestureResponderEvent } from "react-native";

import { boatBounds, toPoolSpace, type PoolFrame } from "@/lib/well/geometry";
import {
  floorCoins, makeBoats, pushBoats, spawnTossedCoin, stepBoats, stepCoins,
  type Coin, type FloatBoat,
} from "@/lib/well/pool-sim";
import { WaterRenderer, type RenderCoin } from "@/lib/well/water-renderer";
import { night, poolImages } from "@/theme/tokens";

import { WaterSurface, loadTexture, waterSurfaceSupported, type WaterContext } from "./WaterSurface";

export { waterSurfaceSupported };

/**
 * Imperative handle for other UI (e.g. the toss composer) to disturb the water.
 * Coordinates are in pool space: (0,0) is the centre, radius 1 is the water's edge, +y points down.
 */
export interface WaterPoolApi {
  /** A ripple. power 1 is a finger tap; 0.2 a drip; 2 a big splash. */
  drop(x: number, y: number, power?: number): void;
  /** A copper coin lands at (x, y): splash, push the boats, then it sinks and rests on the floor. */
  tossCoin(x: number, y: number): void;
}

export interface WaterPoolProps {
  /** The small round pool in a thin rim (circleFrame), or the Pool tab's full-bleed hero (heroFrame). */
  frame: PoolFrame;
  /** Hero: the shader draws the marble rim and the garden; the round pool gets the thin glass rim. */
  hero?: boolean;
  /** Layout y (px) where open water starts, e.g. below a header drawn over the pool; boats stay under it. */
  openTop?: number;
  coins: number;
  /** Coins tossed this session (fractions of the pool, 0..1); each new id lands once via tossCoin. */
  tosses?: { id: number; x: number; y: number; variant: number }[];
  /** Tapping the water (fractions of the pool, 0..1), as in NightPool. */
  onWaterTap?: (x: number, y: number) => void;
  onReady?: (api: WaterPoolApi) => void;
  /** GL init/frame failed: the caller should fall back to the non-GL pool. */
  onError?: (err: unknown) => void;
}

const FRAME_MS = 1000 / 60;
const BOATS = 6;

/**
 * Katie-Lan's real-time water (WebGL2 height-field ripples refracting the pool floor), running on an
 * expo-gl GLView natively and a <canvas> on web. Paused while the screen is unfocused or the app is
 * in the background; NightPool falls back to the Animated version on any GL error.
 */
export function WaterPool({ frame, hero, openTop, coins, tosses, onWaterTap, onReady, onError }: WaterPoolProps) {
  const focused = useIsFocused();
  const [appActive, setAppActive] = useState(AppState.currentState !== "background");
  const [renderer, setRenderer] = useState<WaterRenderer | null>(null);
  const tossed = useRef<Coin[]>([]);
  const bounds = useRef(boatBounds(frame, openTop));
  const boats = useRef<FloatBoat[]>(makeBoats(BOATS, boatBounds(frame, openTop)));
  const resting = useRef<RenderCoin[]>(floorCoins(coins));
  const time = useRef(0);
  const lastMove = useRef<{ x: number; y: number } | null>(null);
  const cbs = useRef({ onReady, onError });
  useEffect(() => {
    cbs.current = { onReady, onError };
  });

  useEffect(() => {
    resting.current = floorCoins(coins);
  }, [coins]);

  // The header's height is measured after the first layout: before the water has run, re-launch the
  // boats inside the new bounds instead of letting them slide down from under the header.
  useEffect(() => {
    bounds.current = boatBounds(frame, openTop);
    if (time.current < 0.5) boats.current = makeBoats(BOATS, bounds.current);
  }, [frame, openTop]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => setAppActive(s === "active"));
    return () => sub.remove();
  }, []);

  const onContext = ({ gl, pixelWidth, pixelHeight, present }: WaterContext) => {
    let r: WaterRenderer;
    try {
      r = new WaterRenderer(gl, { present });
      r.resize(frame.width, pixelWidth, pixelHeight, { cx: frame.cx, cy: frame.cy, R: frame.R });
    } catch (err) {
      cbs.current.onError?.(err);
      return;
    }
    // Dive-in ripple, as in the prototype, centred on the open water.
    const y0 = hero ? Math.max(0, bounds.current.minY + 0.3) : 0;
    r.addDrop(0, y0, 0.35, 0.06);
    r.addDrop(0, y0, 0.12, -0.05);
    setRenderer(r);
    Promise.all([loadTexture(poolImages.floor), loadTexture(poolImages.coins)])
      .then(([floor, coinSheet]) => {
        r.setFloorImage(floor);
        r.setCoinImage(coinSheet);
      })
      .catch((err) => cbs.current.onError?.(err));
  };

  useEffect(() => () => renderer?.dispose(), [renderer]);

  // Imperative API for the toss flow.
  useEffect(() => {
    if (!renderer) return;
    cbs.current.onReady?.({
      drop(x, y, power = 1) {
        renderer.addDrop(x, y, 0.035 + 0.01 * power, 0.03 * power);
        pushBoats(boats.current, x, y, 0.12 * power);
      },
      tossCoin(x, y) {
        renderer.addDrop(x, y, 0.045, 0.14);
        renderer.addDrop(x, y, 0.11, -0.04);
        pushBoats(boats.current, x, y, 0.35);
        tossed.current.push(spawnTossedCoin(x, y));
      },
    });
  }, [renderer]);

  // Tosses from the composer (NightPool's `tosses`): each new one splashes in and sinks to the floor.
  const landed = useRef(new Set<number>());
  useEffect(() => {
    if (!renderer || !tosses) return;
    for (const t of tosses) {
      if (landed.current.has(t.id)) continue;
      landed.current.add(t.id);
      const x = t.x * 2 - 1;
      const y = t.y * 2 - 1;
      renderer.addDrop(x, y, 0.045, 0.14);
      renderer.addDrop(x, y, 0.11, -0.04);
      pushBoats(boats.current, x, y, 0.35);
      const coin = spawnTossedCoin(x, y);
      coin.variant = t.variant;
      tossed.current.push(coin);
    }
  }, [renderer, tosses]);

  const running = !!renderer && focused && appActive;

  // Frame loop: rAF capped at 60fps; stopped entirely (not just skipped) while paused.
  useEffect(() => {
    if (!running || !renderer) return;
    let raf = 0;
    let last = 0;
    let dripAt = time.current + 0.4;
    let warmup = 3;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (last && now - last < FRAME_MS - 2) return;
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 1 / 60;
      last = now;
      time.current += dt;
      const t = time.current;
      if (t > dripAt) {
        const a = Math.random() * Math.PI * 2;
        const rr = Math.sqrt(Math.random()) * 0.85;
        renderer.addDrop(Math.cos(a) * rr, Math.sin(a) * rr, 0.025, 0.012 + Math.random() * 0.01);
        dripAt = t + 0.6 + Math.random() * 1.2;
      }
      tossed.current = stepCoins(tossed.current, dt);
      stepBoats(boats.current, dt, t, bounds.current);
      try {
        renderer.frame(t, [...resting.current, ...tossed.current], boats.current, null);
        if (warmup > 0) {
          warmup--;
          renderer.sync(); // see WaterRenderer.sync: iOS expo-gl stays blank without it
        }
      } catch (err) {
        cancelAnimationFrame(raf);
        cbs.current.onError?.(err);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, renderer]);

  const toPool = (e: GestureResponderEvent) => toPoolSpace(frame, e.nativeEvent.locationX, e.nativeEvent.locationY);
  const onGrant = (e: GestureResponderEvent) => {
    const p = toPool(e);
    if (!renderer || Math.hypot(p.x, p.y) > 0.95) return;
    renderer.addDrop(p.x, p.y, 0.045, 0.08);
    renderer.addDrop(p.x, p.y, 0.11, -0.02);
    pushBoats(boats.current, p.x, p.y, 0.25);
    lastMove.current = p;
    onWaterTap?.((p.x + 1) / 2, (p.y + 1) / 2);
  };
  const onMove = (e: GestureResponderEvent) => {
    const p = toPool(e);
    if (!renderer || Math.hypot(p.x, p.y) > 0.95) return;
    const prev = lastMove.current;
    if (!prev || Math.hypot(p.x - prev.x, p.y - prev.y) > 0.035) {
      renderer.addDrop(p.x, p.y, 0.03, 0.012);
      lastMove.current = p;
    }
  };

  const label = coins > 0 ? `The wishing pool: paper boats drifting, ${coins} of your coins on the floor` : "The wishing pool, with paper boats drifting";
  const water = (
    <View
      testID="water-pool-gl"
      style={
        hero
          ? { width: frame.width, height: frame.height, overflow: "hidden", backgroundColor: night.deep }
          : { width: frame.width, height: frame.height, borderRadius: frame.R, overflow: "hidden", backgroundColor: night.bg }
      }
      onStartShouldSetResponder={() => true}
      onResponderGrant={onGrant}
      onResponderMove={onMove}
    >
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <WaterSurface width={frame.width} height={frame.height} onContext={onContext} onError={(err) => cbs.current.onError?.(err)} />
      </View>
    </View>
  );

  if (hero) {
    return (
      <View testID="night-pool" accessible accessibilityRole="image" accessibilityLabel={label} accessibilityHint={onWaterTap ? "Tap the water to toss a coin" : undefined}>
        {water}
      </View>
    );
  }
  const size = frame.width;
  return (
    <View
      testID="night-pool"
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      accessibilityHint={onWaterTap ? "Tap the water to toss a coin" : undefined}
      style={[styles.rim, { width: size + 16, height: size + 16, borderRadius: (size + 16) / 2 }]}
    >
      {water}
    </View>
  );
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
});
