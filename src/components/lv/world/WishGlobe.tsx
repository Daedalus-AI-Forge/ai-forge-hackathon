// A completed wish's world path on the World tab's globe: drag to spin (with inertia), pinch or
// scroll to zoom, double-tap or "Fly the route" to follow the thread hop by hop along the
// great-circle arcs. Wisher in gold, finder in aqua. Reduce Motion: no auto-fly, the full path sits still.
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { PanResponder, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import Svg, { Circle, Defs, G, Path, RadialGradient, Stop, Text as SvgText } from "react-native-svg";

import { useReduceMotion } from "@/components/lv/pool/NightPool";
import { night, type } from "@/theme/tokens";

import { earthPaths } from "./earth";
import { lerpCamera, project, splitPath, type Camera } from "./globeLayout";
import { clampPitch, flyFrame, partialArc, routeCamera, vecOf, type PathStop } from "./wishPath";

const FONT = Platform.OS === "web" ? "-apple-system, BlinkMacSystemFont, system-ui, sans-serif" : undefined;
const LEG_MS = 1700;
const ZOOM_MIN = 0.8;
const ZOOM_MAX = 2.4;
const QUANT = 0.004; // radians: land is re-projected only when the camera moves this much
const NO_SCROLL = (Platform.OS === "web" ? { touchAction: "none", cursor: "grab" } : {}) as ViewStyle;

function stopLabel(s: PathStop) {
  return s.name ? `${s.name} · ${s.city}` : s.city;
}

export function WishGlobe({ path, height = 300, testID = "wish-globe" }: { path: PathStop[]; height?: number; testID?: string }) {
  const reduceMotion = useReduceMotion();
  const [width, setWidth] = useState(0);
  const [camera, setCamera] = useState<Camera>(() => routeCamera(path));
  const [zoom, setZoom] = useState(1);
  // null = idle, the whole path drawn; a number = mid-flight progress in legs (0..stops-1).
  const [progress, setProgress] = useState<number | null>(null);

  const cam = useRef(camera);
  cam.current = camera;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const spin = useRef({ vx: 0, vy: 0 });
  const raf = useRef<number | null>(null);
  const flying = useRef(false);

  const legs = Math.max(0, path.length - 1);
  const pathKey = path.map(stopLabel).join("|");

  const stopLoop = () => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
  };

  const fly = useCallback(() => {
    stopLoop();
    spin.current = { vx: 0, vy: 0 };
    if (legs === 0) return;
    if (reduceMotion) {
      // No motion: settle on the whole route at once.
      flying.current = false;
      setProgress(null);
      setCamera(routeCamera(path));
      return;
    }
    flying.current = true;
    const start = Date.now();
    const tick = () => {
      const p = Math.min(legs, (Date.now() - start) / LEG_MS);
      const frame = flyFrame(path, p);
      setCamera((c) => lerpCamera(c, frame.camera, 0.14));
      setProgress(p);
      if (p < legs) raf.current = requestAnimationFrame(tick);
      else {
        flying.current = false;
        raf.current = null;
        setProgress(null);
      }
    };
    raf.current = requestAnimationFrame(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathKey, legs, reduceMotion]);

  // A new path re-centres; with motion allowed, fly it once on arrival.
  useEffect(() => {
    setCamera(routeCamera(path));
    setProgress(null);
    if (reduceMotion || legs === 0) return;
    const t = setTimeout(fly, 700);
    return () => {
      clearTimeout(t);
      stopLoop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathKey, reduceMotion]);

  useEffect(() => stopLoop, []);

  const coast = () => {
    stopLoop();
    if (reduceMotion) return;
    const tick = () => {
      const v = spin.current;
      v.vx *= 0.94;
      v.vy *= 0.94;
      if (Math.abs(v.vx) + Math.abs(v.vy) < 0.0004) {
        raf.current = null;
        return;
      }
      setCamera((c) => ({ yaw: c.yaw + v.vx, pitch: clampPitch(c.pitch + v.vy) }));
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };

  const gesture = useRef({ last: { x: 0, y: 0 }, pinch: 0, zoom0: 1, lastTap: 0, moved: 0 });
  const radiusBase = height * 0.4;
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          stopLoop();
          flying.current = false;
          setProgress(null);
          gesture.current = { ...gesture.current, last: { x: 0, y: 0 }, pinch: 0, moved: 0 };
        },
        onPanResponderMove: (e, g) => {
          const touches = e.nativeEvent.touches ?? [];
          if (touches.length >= 2) {
            const d = Math.hypot(touches[0]!.pageX - touches[1]!.pageX, touches[0]!.pageY - touches[1]!.pageY);
            if (!gesture.current.pinch) {
              gesture.current.pinch = d;
              gesture.current.zoom0 = zoomRef.current;
            } else setZoom(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, (gesture.current.zoom0 * d) / gesture.current.pinch)));
            gesture.current.moved += 99;
            return;
          }
          const k = 1 / (radiusBase * zoomRef.current);
          const dx = g.dx - gesture.current.last.x;
          const dy = g.dy - gesture.current.last.y;
          gesture.current.last = { x: g.dx, y: g.dy };
          gesture.current.moved += Math.abs(dx) + Math.abs(dy);
          setCamera((c) => ({ yaw: c.yaw + dx * k, pitch: clampPitch(c.pitch + dy * k) }));
        },
        onPanResponderRelease: (_e, g) => {
          const k = 1 / (radiusBase * zoomRef.current);
          if (gesture.current.moved < 8) {
            const now = Date.now();
            if (now - gesture.current.lastTap < 320) {
              gesture.current.lastTap = 0;
              fly();
            } else gesture.current.lastTap = now;
            return;
          }
          // Velocity is px/ms; one frame is ~16ms.
          spin.current = { vx: g.vx * 16 * k, vy: g.vy * 16 * k };
          coast();
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fly, radiusBase],
  );

  // Web: scroll wheel / trackpad pinch zooms the globe.
  const boxRef = useRef<ComponentRef<typeof View>>(null);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const el = boxRef.current as unknown as HTMLElement | null;
    if (!el?.addEventListener) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z * Math.exp(-e.deltaY * 0.0015))));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [width]);

  const radius = radiusBase * zoom;
  const cx = width / 2;
  const cy = height / 2;
  const qYaw = Math.round(camera.yaw / QUANT);
  const qPitch = Math.round(camera.pitch / QUANT);
  const earth = useMemo(
    () => (width ? earthPaths({ yaw: qYaw * QUANT, pitch: qPitch * QUANT }, cx, cy, radius) : { land: "", grid: "" }),
    [width, qYaw, qPitch, cx, cy, radius],
  );
  const vs = path.map((s) => vecOf(s.lat, s.lng));
  const frame = progress === null ? null : flyFrame(path, progress);
  const reached = frame ? frame.reached : path.length;

  const legPaths = vs.slice(1).map((b, i) => {
    const upTo = !frame ? 1 : i < frame.leg ? 1 : i === frame.leg ? frame.frac : 0;
    if (upTo <= 0) return null;
    return splitPath(partialArc(vs[i]!, b, upTo).map((p) => project(p, camera, cx, cy, radius)));
  });
  const headPoint = frame ? partialArc(vs[frame.leg]!, vs[frame.leg + 1]!, frame.frac).at(-1)! : null;
  const head = headPoint ? project(headPoint, camera, cx, cy, radius) : null;
  const dots = path.map((s, i) => ({ s, i, p: project(vs[i]!, camera, cx, cy, radius) }));

  const summary = path.length ? `World path: ${path.map(stopLabel).join(", then ")}` : "World path";

  return (
    <View testID={testID} style={styles.wrap}>
      <View
        ref={boxRef}
        style={[styles.box, { height }, NO_SCROLL]}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessible
        accessibilityRole="image"
        accessibilityLabel={summary}
        accessibilityHint="Drag to turn the globe. Double-tap to fly the route."
        {...responder.panHandlers}
      >
        {width > 0 ? (
          <Svg width={width} height={height} pointerEvents="none">
            <Defs>
              <RadialGradient id="wishOcean" cx="38%" cy="30%" r="75%">
                <Stop offset="0" stopColor="#2A6B78" />
                <Stop offset="0.45" stopColor="#123B45" />
                <Stop offset="1" stopColor="#061519" />
              </RadialGradient>
              <RadialGradient id="wishAtmo" cx="50%" cy="50%" r="50%">
                <Stop offset="0.8" stopColor={night.aqua} stopOpacity="0" />
                <Stop offset="0.85" stopColor={night.aqua} stopOpacity="0.25" />
                <Stop offset="1" stopColor={night.aqua} stopOpacity="0" />
              </RadialGradient>
              <RadialGradient id="wishHead" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={night.goldBright} stopOpacity="1" />
                <Stop offset="0.4" stopColor={night.thread} stopOpacity="0.6" />
                <Stop offset="1" stopColor={night.thread} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Circle cx={cx} cy={cy} r={radius / 0.8} fill="url(#wishAtmo)" />
            <Circle cx={cx} cy={cy} r={radius} fill="url(#wishOcean)" />
            <Path testID="wish-globe-land" d={earth.land} fill={night.gold} fillOpacity={0.16} stroke={night.goldBright} strokeOpacity={0.4} strokeWidth={0.6} strokeLinejoin="round" />
            <Path d={earth.grid} stroke={night.aqua} strokeOpacity={0.1} strokeWidth={0.6} fill="none" />
            {legPaths.map((leg, i) =>
              leg ? (
                <G key={i}>
                  <Path d={leg.back} stroke={night.thread} strokeOpacity={0.3} strokeWidth={1.2} fill="none" strokeDasharray="2 4" />
                  <Path d={leg.front} stroke={night.thread} strokeOpacity={0.22} strokeWidth={7} fill="none" strokeLinecap="round" />
                  <Path d={leg.front} stroke={night.thread} strokeWidth={2.4} fill="none" strokeLinecap="round" />
                </G>
              ) : null,
            )}
            {head ? (
              <G opacity={head.front ? 1 : 0.4}>
                <Circle cx={head.x} cy={head.y} r={16} fill="url(#wishHead)" />
                <Circle cx={head.x} cy={head.y} r={3.5} fill={night.goldBright} />
              </G>
            ) : null}
            {dots.map(({ s, i, p }) => {
              if (i >= reached) return null;
              const first = i === 0;
              const last = i === path.length - 1 && path.length > 1;
              const color = first ? night.gold : last ? night.aqua : night.goldBright;
              const label = stopLabel(s);
              const above = i % 2 === 1;
              const ly = above ? p.y - 12 : p.y + 20;
              return (
                <G key={`${i}-${label}`} opacity={p.front ? 1 : 0.3}>
                  {first || last ? <Circle cx={p.x} cy={p.y} r={10} fill={color} fillOpacity={0.22} /> : null}
                  <Circle cx={p.x} cy={p.y} r={first || last ? 6 : 4} fill={color} stroke={night.deep} strokeWidth={1.5} />
                  {p.front ? (
                    <>
                      <SvgText fontFamily={FONT} x={p.x} y={ly} textAnchor="middle" fontSize={11.5} fontWeight="600"
                        stroke={night.deep} strokeWidth={3} strokeOpacity={0.75} fill={night.deep}>{label}</SvgText>
                      <SvgText fontFamily={FONT} x={p.x} y={ly} textAnchor="middle" fontSize={11.5} fontWeight="600"
                        fill={first ? night.goldBright : last ? night.aqua : night.fg}>{label}</SvgText>
                    </>
                  ) : null}
                </G>
              );
            })}
          </Svg>
        ) : null}
      </View>
      <View style={styles.bar}>
        <View style={styles.legend}>
          <View style={[styles.key, { backgroundColor: night.gold }]} />
          <Text style={styles.legendText}>Wisher</Text>
          <View style={[styles.key, { backgroundColor: night.aqua }]} />
          <Text style={styles.legendText}>Finder</Text>
        </View>
        {legs > 0 ? (
          <Pressable
            testID="wish-globe-fly"
            accessibilityRole="button"
            accessibilityLabel="Fly the route"
            onPress={fly}
            hitSlop={8}
            style={({ pressed }) => [styles.fly, pressed && styles.flyPressed]}
          >
            <Text style={styles.flyText}>Fly the route</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", gap: 8 },
  box: { width: "100%", overflow: "hidden" },
  bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  legend: { flexDirection: "row", alignItems: "center", gap: 6 },
  key: { width: 8, height: 8, borderRadius: 4 },
  legendText: { ...type.caption1, color: night.mutedFg, marginRight: 6 },
  fly: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    justifyContent: "center",
    backgroundColor: "rgba(255,107,94,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,107,94,0.5)",
  },
  flyPressed: { opacity: 0.7 },
  flyText: { ...type.subheadline, fontWeight: "600", color: night.fg },
});
