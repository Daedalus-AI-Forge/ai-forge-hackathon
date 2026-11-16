// The wish network as a glowing planet: you face the camera, your threads arc around the globe,
// wishes that came true run across it as red threads, and the wider world waits round the back.
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { PanResponder, Platform, StyleSheet, Text, View, type GestureResponderEvent, type PointerEvent, type ViewStyle } from "react-native";
import Svg, { Circle, Defs, G, Path, RadialGradient, Stop, Text as SvgText } from "react-native-svg";

import { Glass, Icon } from "@/components/ios";
import { pathToViewer } from "@/components/lv/me/communityLayout";
import { useReduceMotion } from "@/components/lv/pool/NightPool";
import type { CommunityNetwork } from "@/lib/graphApi.types";
import { night, type } from "@/theme/tokens";

import {
  arcPoints,
  cameraFacing,
  graticule,
  layoutGlobe,
  lerpCamera,
  nearestAt,
  PITCH_LIMIT,
  project,
  splitPath,
  THREAD_LOOK,
  threadKind,
  type Camera,
  type GlobeNode,
  type Projected,
  type ThreadKind,
} from "./globeLayout";

const REST: Camera = { yaw: 0, pitch: 0.1 };
const INTRO_FROM: Camera = { yaw: -1.5, pitch: 0.42 };
const SWAY = 0.2; // radians either side of rest
const SWAY_PERIOD_MS = 18000;
const FONT = Platform.OS === "web" ? "-apple-system, BlinkMacSystemFont, system-ui, sans-serif" : undefined;
const webGestureStyle: ViewStyle & { touchAction: "none"; cursor: "grab" } = { touchAction: "none", cursor: "grab" };

type ArcStyle = ThreadKind;
const TONE = { gold: night.gold, fg: night.fg, aqua: night.aqua } as const;
const look = (kind: ThreadKind) => ({ ...THREAD_LOOK[kind], color: TONE[THREAD_LOOK[kind].tone] as string });
const ARC: Record<ThreadKind, { color: string; width: number; opacity: number }> = {
  near: look("near"),
  mid: look("mid"),
  far: look("far"),
  wide: look("wide"),
};
const BACK = 0.22; // how much of a thread shows through the far side of the glass

function arcStyle(a: GlobeNode, b: GlobeNode): ArcStyle {
  return threadKind(a.distance, b.distance);
}

function dot(p: Projected, r: number) {
  return `M${(p.x - r).toFixed(1)} ${p.y.toFixed(1)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
}

type Motion = { kind: "tween"; from: Camera; to: Camera; start: number; duration: number } | { kind: "sway"; base: Camera; start: number };

export function Globe({
  graph,
  chains,
  selectedKey,
  onSelect,
  onInteract,
}: {
  graph: CommunityNetwork;
  /** Wishes that came true through you, as `user:` keys from wisher to finder. */
  chains: string[][];
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  /** True while a finger is on the globe, so the page can stop scrolling. */
  onInteract?: (active: boolean) => void;
}) {
  const layout = useMemo(() => layoutGlobe(graph), [graph]);
  const reduce = useReduceMotion();
  const [size, setSize] = useState(0);
  const radius = size * 0.4;
  const center = size / 2;

  // ---- camera + motion ----
  const [camera, setCameraState] = useState<Camera>(INTRO_FROM);
  const cameraRef = useRef<Camera>(INTRO_FROM);
  const motion = useRef<Motion | null>(null);
  const frame = useRef<number | null>(null);
  const lastPaint = useRef(0);
  const touched = useRef(false); // once you drag the globe, it stops swaying on its own
  const introduced = useRef(false);
  const live = useRef({ reduce, radius });
  useLayoutEffect(() => {
    live.current = { reduce, radius };
  }, [reduce, radius]);

  const setCamera = useCallback((next: Camera) => {
    cameraRef.current = next;
    setCameraState(next);
  }, []);

  // One frame of motion. Reduce Motion (which can resolve after mount) snaps to where it was heading.
  const tick = useRef<(now: number) => void>(() => {});
  const schedule = useCallback(() => {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame((now) => {
      frame.current = null;
      tick.current(now);
    });
  }, []);
  useLayoutEffect(() => {
    tick.current = (now: number) => {
      const m = motion.current;
      if (!m) return;
      if (live.current.reduce) {
        motion.current = null;
        setCamera(m.kind === "tween" ? m.to : m.base);
        return;
      }
      if (m.kind === "tween") {
        const t = Math.min(1, (now - m.start) / m.duration);
        setCamera(lerpCamera(m.from, m.to, 1 - (1 - t) ** 3));
        if (t >= 1) motion.current = touched.current ? null : { kind: "sway", base: m.to, start: now };
      } else if (now - lastPaint.current > 33) {
        // ~30fps is plenty for a slow sway.
        lastPaint.current = now;
        setCamera({ yaw: m.base.yaw + SWAY * Math.sin(((now - m.start) / SWAY_PERIOD_MS) * Math.PI * 2), pitch: m.base.pitch });
      }
      if (motion.current) schedule();
    };
  });

  const run = useCallback((next: Motion | null) => {
    motion.current = next;
    if (next) schedule();
  }, [schedule]);

  const stop = useCallback(() => {
    motion.current = null;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);

  const flyTo = useCallback((to: Camera, duration = 700) => {
    run({ kind: "tween", from: cameraRef.current, to, start: performance.now(), duration });
  }, [run]);

  // Intro spin the first time the tab is shown; a slow sway while it stays idle; nothing while away.
  useFocusEffect(useCallback(() => {
    if (!introduced.current) {
      introduced.current = true;
      flyTo(REST, 1800);
    } else if (!touched.current && !live.current.reduce) {
      run({ kind: "sway", base: cameraRef.current, start: performance.now() });
    }
    return stop;
  }, [flyTo, run, stop]));

  // Bring whoever is selected (from a tap, search or the list) round to the front.
  const selectedNode = selectedKey ? layout.byKey.get(selectedKey) : undefined;
  useEffect(() => {
    if (selectedNode) flyTo(cameraFacing(selectedNode.v));
  }, [selectedNode, flyTo]);

  const recenter = () => {
    touched.current = false;
    onSelect(null);
    flyTo(REST);
  };

  // ---- geometry for this frame ----
  const projected = useMemo(
    () => layout.nodes.map((node) => ({ key: node.key, node, p: project(node.v, camera, center, center, radius) })),
    [layout, camera, center, radius],
  );
  const arcs = useMemo(() => graph.links.flatMap((link) => {
    const a = layout.byKey.get(link.source);
    const b = layout.byKey.get(link.target);
    return a && b ? [{ key: link.key, a, b, style: arcStyle(a, b), points: arcPoints(a.v, b.v) }] : [];
  }), [graph.links, layout]);
  const chainArcs = useMemo(() => {
    const out: { key: string; points: ReturnType<typeof arcPoints> }[] = [];
    const seen = new Set<string>();
    for (const chain of chains) {
      for (let i = 1; i < chain.length; i++) {
        const a = layout.byKey.get(chain[i - 1]!);
        const b = layout.byKey.get(chain[i]!);
        const key = [a?.key, b?.key].sort().join("|");
        if (!a || !b || a.key === b.key || seen.has(key)) continue;
        seen.add(key);
        out.push({ key, points: arcPoints(a.v, b.v, 1.5) });
      }
    }
    return out;
  }, [chains, layout]);
  const chainMembers = useMemo(() => new Set(chains.flat()), [chains]);
  const path = useMemo(() => pathToViewer(selectedKey, layout.parents), [selectedKey, layout.parents]);
  const pathArcs = useMemo(() => {
    const keys = [...path];
    return keys.slice(1).flatMap((key, i) => {
      const a = layout.byKey.get(keys[i]!);
      const b = layout.byKey.get(key);
      return a && b ? [arcPoints(a.v, b.v)] : [];
    });
  }, [path, layout]);
  const focused = selectedKey !== null && path.size > 1;

  const grid = useMemo(() => (size ? graticule(camera, center, center, radius) : ""), [camera, center, radius, size]);
  const proj = (points: ReturnType<typeof arcPoints>) => points.map((pt) => project(pt, camera, center, center, radius));

  const arcPaths: Record<ArcStyle, { front: string; back: string }> = {
    near: { front: "", back: "" }, mid: { front: "", back: "" }, far: { front: "", back: "" }, wide: { front: "", back: "" },
  };
  for (const arc of arcs) {
    const { front, back } = splitPath(proj(arc.points));
    arcPaths[arc.style].front += front;
    arcPaths[arc.style].back += back;
  }
  const chainPath = chainArcs.map((arc) => splitPath(proj(arc.points)));
  const selectedPath = pathArcs.map((points) => splitPath(proj(points)));

  const backDots = projected.filter(({ p, key }) => !p.front && key !== graph.meKey).map(({ p }) => dot(p, 1.5)).join("");
  const front = projected.filter(({ p }) => p.front).sort((a, b) => a.p.z - b.p.z);

  // Names: you, the selected person, then the people on your chains and nearest ring, without overlaps.
  const me = projected.find((n) => n.key === graph.meKey);
  const labels: { key: string; x: number; y: number; text: string; strong: boolean }[] = [];
  const boxes: { x: number; y: number; w: number }[] = me?.p.front ? [{ x: me.p.x, y: me.p.y + 22, w: 40 }, { x: me.p.x, y: me.p.y, w: 24 }] : [];
  const priority = (key: string, node: GlobeNode) =>
    key === selectedKey ? 0 : chainMembers.has(key) ? 1 : node.distance === 1 ? 2 : 9;
  for (const { key, node, p } of [...front].filter(({ key, node, p }) => key !== graph.meKey && p.z > 0.3 && priority(key, node) < 9)
    .sort((a, b) => priority(a.key, a.node) - priority(b.key, b.node) || b.p.z - a.p.z)) {
    if (labels.length >= 9 && key !== selectedKey) break;
    const text = node.name.length > 12 ? `${node.name.slice(0, 11)}…` : node.name;
    const w = text.length * 6.4 + 6;
    const y = p.y - 10;
    if (boxes.some((b) => Math.abs(b.x - p.x) < (b.w + w) / 2 && Math.abs(b.y - y) < 14)) continue;
    boxes.push({ x: p.x, y, w });
    labels.push({ key, x: p.x, y, text, strong: key === selectedKey });
  }

  // ---- gestures ----
  const start = useRef<{ x: number; y: number; camera: Camera; moved: boolean } | null>(null);
  const canvas = useRef<ComponentRef<typeof View>>(null);
  const handlers = useRef({ tap: (_x: number, _y: number) => {}, onInteract });
  const tap = (x: number, y: number) => {
    const hit = nearestAt(projected, x, y);
    if (!hit || hit.key === graph.meKey) onSelect(null);
    else onSelect(hit.key === selectedKey ? null : hit.key);
  };
  useLayoutEffect(() => {
    handlers.current = { tap, onInteract };
  });
  const begin = (x: number, y: number) => {
    start.current = { x, y, camera: cameraRef.current, moved: false };
    handlers.current.onInteract?.(true);
  };
  const drag = (dx: number, dy: number) => {
    const s = start.current;
    if (!s) return;
    if (!s.moved && Math.hypot(dx, dy) < 6) return;
    if (!s.moved) {
      s.moved = true;
      touched.current = true;
      stop();
    }
    const r = Math.max(1, live.current.radius);
    setCamera({ yaw: s.camera.yaw + dx / r, pitch: Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, s.camera.pitch + dy / r)) });
  };
  const end = (cancelled = false) => {
    const s = start.current;
    start.current = null;
    handlers.current.onInteract?.(false);
    if (s && !s.moved && !cancelled) handlers.current.tap(s.x, s.y);
  };
  const gestures = useRef({ begin, drag, end });
  useLayoutEffect(() => {
    gestures.current = { begin, drag, end };
  });
  // PanResponder keeps these callbacks; they read the latest handlers from refs once a touch starts.
  // eslint-disable-next-line react-hooks/refs
  const [responder] = useState(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e: GestureResponderEvent) => gestures.current.begin(e.nativeEvent.locationX, e.nativeEvent.locationY),
    onPanResponderMove: (_, g) => gestures.current.drag(g.dx, g.dy),
    onPanResponderRelease: () => gestures.current.end(),
    onPanResponderTerminate: () => gestures.current.end(true),
    onPanResponderTerminationRequest: () => !start.current?.moved,
  }));
  const webPoint = (e: PointerEvent) => {
    const rect = (canvas.current as unknown as HTMLElement | null)?.getBoundingClientRect();
    return { x: e.nativeEvent.clientX - (rect?.left ?? 0), y: e.nativeEvent.clientY - (rect?.top ?? 0) };
  };
  const webHandlers = Platform.OS === "web" ? {
    onPointerDown: (e: PointerEvent) => {
      const p = webPoint(e);
      begin(p.x, p.y);
      const origin = { cx: e.nativeEvent.clientX, cy: e.nativeEvent.clientY };
      (start.current as unknown as { origin: typeof origin }).origin = origin;
    },
    onPointerMove: (e: PointerEvent) => {
      const s = start.current as (typeof start.current & { origin?: { cx: number; cy: number } }) | null;
      if (s?.origin) drag(e.nativeEvent.clientX - s.origin.cx, e.nativeEvent.clientY - s.origin.cy);
    },
    onPointerUp: () => end(),
    onPointerCancel: () => end(true),
    onPointerLeave: () => { if (start.current) end(true); },
  } : responder.panHandlers;

  const direct = layout.nodes.filter((n) => n.distance === 1).length;

  return (
    <View style={styles.wrap} onLayout={(e) => setSize(e.nativeEvent.layout.width)}>
      <View
        ref={canvas}
        testID="world-globe"
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Your wish network as a globe: ${layout.nodes.length} people, ${direct} connected to you directly.`}
        accessibilityHint="Drag to turn the globe and tap a person. The list below lets you find anyone."
        style={[styles.canvas, { height: size }, Platform.OS === "web" && webGestureStyle]}
        {...webHandlers}
      >
        {size > 0 ? (
          <Svg width={size} height={size} pointerEvents="none">
            <Defs>
              <RadialGradient id="atmo" cx="50%" cy="50%" r="50%">
                <Stop offset="0.8" stopColor={night.aqua} stopOpacity="0" />
                <Stop offset="0.84" stopColor={night.aqua} stopOpacity="0.28" />
                <Stop offset="0.9" stopColor={night.aqua} stopOpacity="0.08" />
                <Stop offset="1" stopColor={night.aqua} stopOpacity="0" />
              </RadialGradient>
              <RadialGradient id="ocean" cx="38%" cy="30%" r="75%">
                <Stop offset="0" stopColor="#2A6B78" />
                <Stop offset="0.45" stopColor="#123B45" />
                <Stop offset="1" stopColor="#061519" />
              </RadialGradient>
              <RadialGradient id="sheen" cx="34%" cy="26%" r="42%">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.16" />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
              </RadialGradient>
              <RadialGradient id="you" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={night.goldBright} stopOpacity="0.75" />
                <Stop offset="0.45" stopColor={night.gold} stopOpacity="0.22" />
                <Stop offset="1" stopColor={night.gold} stopOpacity="0" />
              </RadialGradient>
            </Defs>

            <Circle cx={center} cy={center} r={radius / 0.8} fill="url(#atmo)" />
            <Circle cx={center} cy={center} r={radius} fill="url(#ocean)" />
            <Path d={grid} stroke={night.aqua} strokeOpacity={0.1} strokeWidth={0.7} fill="none" />

            {/* The far side, faintly through the glass. */}
            {(Object.keys(ARC) as ArcStyle[]).map((style) => (
              <Path key={`back-${style}`} d={arcPaths[style].back} stroke={ARC[style].color} strokeWidth={ARC[style].width * 0.8}
                strokeOpacity={ARC[style].opacity * BACK * (focused ? 0.5 : 1)} fill="none" strokeLinecap="round" />
            ))}
            {chainPath.map((arc, i) => (
              <Path key={`chain-back-${i}`} d={arc.back} stroke={night.thread} strokeWidth={1.4} strokeOpacity={0.3} fill="none" strokeLinecap="round" />
            ))}
            <Path d={backDots} fill={night.fg} fillOpacity={0.18} />

            <Circle cx={center} cy={center} r={radius} fill="url(#sheen)" />
            <Circle cx={center} cy={center} r={radius} fill="none" stroke={night.aqua} strokeOpacity={0.28} strokeWidth={1} />

            {/* Your side of the world. */}
            {(Object.keys(ARC) as ArcStyle[]).map((style) => (
              <Path key={`front-${style}`} d={arcPaths[style].front} stroke={ARC[style].color} strokeWidth={ARC[style].width}
                strokeOpacity={ARC[style].opacity * (focused ? 0.4 : 1)} fill="none" strokeLinecap="round" />
            ))}
            {chainPath.map((arc, i) => (
              <G key={`chain-${i}`}>
                <Path d={arc.front} stroke={night.thread} strokeWidth={5} strokeOpacity={0.18} fill="none" strokeLinecap="round" />
                <Path d={arc.front} stroke={night.thread} strokeWidth={1.8} strokeOpacity={0.95} fill="none" strokeLinecap="round" />
              </G>
            ))}
            {selectedPath.map((arc, i) => (
              <G key={`path-${i}`}>
                <Path d={arc.back} stroke={night.goldBright} strokeWidth={1.2} strokeOpacity={0.35} fill="none" strokeDasharray="2 4" />
                <Path d={arc.front} stroke={night.goldBright} strokeWidth={6} strokeOpacity={0.16} fill="none" strokeLinecap="round" />
                <Path d={arc.front} stroke={night.goldBright} strokeWidth={2.2} strokeOpacity={1} fill="none" strokeLinecap="round" />
              </G>
            ))}

            {front.map(({ key, node, p }) => {
              if (key === graph.meKey) return null;
              const depth = Math.max(0, p.z);
              const base = node.distance === 1 ? 5.2 : node.distance === 2 ? 3.8 : node.distance === null ? 2.4 : 3;
              const r = base * (0.72 + 0.38 * depth);
              const fill = node.distance === 1 ? night.goldBright : node.distance === 2 ? night.gold : node.distance === null ? night.aqua : night.fg;
              const selected = key === selectedKey;
              const dim = focused && !path.has(key) ? 0.35 : 1;
              return (
                <G key={key} opacity={(0.4 + 0.6 * depth) * dim}>
                  {node.distance === 1 || selected ? <Circle cx={p.x} cy={p.y} r={r * 2.4} fill={fill} fillOpacity={0.14} /> : null}
                  {chainMembers.has(key) ? <Circle cx={p.x} cy={p.y} r={r + 3} fill="none" stroke={night.thread} strokeWidth={1.4} /> : null}
                  {selected ? <Circle cx={p.x} cy={p.y} r={r + 6} fill="none" stroke={night.fg} strokeWidth={1.5} /> : null}
                  <Circle cx={p.x} cy={p.y} r={selected ? r + 1.5 : r} fill={fill} />
                </G>
              );
            })}

            {me ? (
              <G opacity={me.p.front ? 1 : 0.3}>
                <Circle cx={me.p.x} cy={me.p.y} r={30} fill="url(#you)" />
                <Circle cx={me.p.x} cy={me.p.y} r={8} fill={night.gold} stroke={night.goldBright} strokeWidth={2.5} />
                <SvgText fontFamily={FONT} x={me.p.x} y={me.p.y + 26} textAnchor="middle" fontSize={13} fontWeight="700"
                  stroke={night.deep} strokeWidth={3} strokeOpacity={0.7} fill={night.deep}>You</SvgText>
                <SvgText fontFamily={FONT} x={me.p.x} y={me.p.y + 26} textAnchor="middle" fontSize={13} fontWeight="700" fill={night.goldBright}>You</SvgText>
              </G>
            ) : null}

            {labels.map((l) => (
              <G key={`label-${l.key}`}>
                <SvgText fontFamily={FONT} x={l.x} y={l.y} textAnchor="middle" fontSize={11.5} fontWeight={l.strong ? "700" : "500"}
                  stroke={night.deep} strokeWidth={3} strokeOpacity={0.75} fill={night.deep}>{l.text}</SvgText>
                <SvgText fontFamily={FONT} x={l.x} y={l.y} textAnchor="middle" fontSize={11.5} fontWeight={l.strong ? "700" : "500"}
                  fill={l.strong ? night.goldBright : night.fg}>{l.text}</SvgText>
              </G>
            ))}
          </Svg>
        ) : null}
      </View>
      <Glass variant="dark" radius={999} testID="network-recenter" accessibilityLabel="Turn the globe back to you" hitSlop={6}
        onPress={recenter} style={styles.recenter}>
        <Icon name="recenter" size={13} color={night.gold} />
        <Text style={styles.recenterText}>You</Text>
      </Glass>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%" },
  canvas: { width: "100%" },
  recenter: { position: "absolute", top: 4, right: 0, flexDirection: "row", alignItems: "center", gap: 5, height: 32, paddingHorizontal: 12 },
  recenterText: { ...type.footnote, fontWeight: "600", color: night.fg },
});
