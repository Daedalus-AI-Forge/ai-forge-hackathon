import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { PanResponder, Platform, Pressable, StyleSheet, Text, View, type PointerEvent, type ViewStyle } from "react-native";
import Svg, { Circle, G, Path, Text as SvgText } from "react-native-svg";

import type { CommunityNetwork } from "@/lib/graphApi.types";
import { lv, type } from "@/theme/tokens";
import { connectionAppearance, GRAPH_CENTER, GRAPH_HEIGHT, GRAPH_WIDTH, layoutCommunity, pathToViewer } from "./communityLayout";

const TONES = [lv.gold, lv.silver, lv.bronze, lv.accent, lv.secondary];
const webGestureStyle: ViewStyle & { touchAction: "none" } = { touchAction: "none" };

/** Deterministic soft background per name, so a person keeps their color everywhere. */
export function toneFor(name: string) {
  return TONES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % TONES.length]!;
}

export function LvAvatar({ name, size = 34, ring = false }: { name: string; size?: number; ring?: boolean }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: toneFor(name),
        alignItems: "center",
        justifyContent: "center",
        borderWidth: ring ? 2 : 0,
        borderColor: lv.bg,
      }}
    >
      <Text style={{ fontSize: size * 0.4, fontWeight: "600", color: lv.fg }}>{name.slice(0, 1).toUpperCase() || "?"}</Text>
    </View>
  );
}

/** The community as a whole, with distance measured outward from the viewer. */
export function EgoGraph({ graph, selectedKey, onSelect }: {
  graph: CommunityNetwork;
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
}) {
  const layout = useMemo(() => layoutCommunity(graph), [graph]);
  const path = pathToViewer(selectedKey, layout.parents);
  const [width, setWidth] = useState(0);
  const [camera, setCamera] = useState({ ...GRAPH_CENTER, zoom: 1 });
  const live = useRef({ camera, width });
  useLayoutEffect(() => { live.current = { camera, width }; }, [camera, width]);
  const start = useRef(camera);
  const pointer = useRef<{ x: number; y: number; camera: typeof camera } | null>(null);
  // PanResponder.create stores these callbacks; refs are read only after a gesture starts.
  // eslint-disable-next-line react-hooks/refs
  const [responder] = useState(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 6 || Math.abs(gesture.dy) > 6,
    onMoveShouldSetPanResponderCapture: (_, gesture) => Math.abs(gesture.dx) > 6 || Math.abs(gesture.dy) > 6,
    onPanResponderGrant: () => { start.current = live.current.camera; },
    onPanResponderMove: (_, gesture) => {
      const scale = GRAPH_WIDTH / Math.max(1, live.current.width) / start.current.zoom;
      setCamera({ ...start.current,
        x: Math.max(0, Math.min(GRAPH_WIDTH, start.current.x - gesture.dx * scale)),
        y: Math.max(0, Math.min(GRAPH_HEIGHT, start.current.y - gesture.dy * scale)),
      });
    },
    onPanResponderTerminationRequest: () => true,
  }));
  const zoom = (delta: number) => setCamera(value => ({ ...value, zoom: Math.max(0.75, Math.min(3, value.zoom + delta)) }));
  const movePointer = (event: PointerEvent) => {
    const origin = pointer.current;
    if (!origin) return;
    const scale = GRAPH_WIDTH / Math.max(1, width) / origin.camera.zoom;
    setCamera({ ...origin.camera,
      x: Math.max(0, Math.min(GRAPH_WIDTH, origin.camera.x - (event.nativeEvent.pageX - origin.x) * scale)),
      y: Math.max(0, Math.min(GRAPH_HEIGHT, origin.camera.y - (event.nativeEvent.pageY - origin.y) * scale)),
    });
  };
  const closeNodes = layout.nodes.filter(node => node.distance === 1);
  const named = new Set(closeNodes.filter((_, i) => i % Math.max(1, Math.ceil(closeNodes.length / 8)) === 0).map(node => node.key));
  const paintedNodes = [...layout.nodes].sort((a, b) => (b.distance ?? 999) - (a.distance ?? 999));
  const step = selectedKey ? layout.distances.get(selectedKey) : undefined;

  return (
    <View style={{ gap: 12 }}>
      <View style={styles.topline}>
        <View style={styles.liveLabel}><View style={styles.liveDot} /><Text style={styles.caption}>One network. Your perspective.</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Recenter network" testID="network-recenter"
          style={styles.recenter} onPress={() => { setCamera({ ...GRAPH_CENTER, zoom: 1 }); onSelect(null); }}>
          <Text style={styles.recenterText}>◎ You</Text>
        </Pressable>
      </View>
      <View testID="ego-graph" style={[styles.canvas, Platform.OS === "web" && webGestureStyle]} onLayout={e => setWidth(e.nativeEvent.layout.width)}
        {...(Platform.OS === "web" ? {
          onPointerDown: (event: PointerEvent) => { pointer.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY, camera }; },
          onPointerMove: movePointer,
          onPointerUp: () => { pointer.current = null; },
          onPointerCancel: () => { pointer.current = null; },
          onPointerLeave: () => { pointer.current = null; },
        } : responder.panHandlers)}>
        <Svg width="100%" height="100%" pointerEvents="none"
          viewBox={`${camera.x - GRAPH_WIDTH / (2 * camera.zoom)} ${camera.y - GRAPH_HEIGHT / (2 * camera.zoom)} ${GRAPH_WIDTH / camera.zoom} ${GRAPH_HEIGHT / camera.zoom}`}>
          <Circle cx={GRAPH_CENTER.x} cy={GRAPH_CENTER.y} r={82} fill={lv.accent} opacity={0.3} />
          <Circle cx={GRAPH_CENTER.x} cy={GRAPH_CENTER.y} r={57} fill="none" stroke={lv.thread} strokeOpacity={0.12} />
          {graph.links.map(edge => {
            const a = layout.byKey.get(edge.source); const b = layout.byKey.get(edge.target);
            if (!a || !b) return null;
            const distance = a.distance === null || b.distance === null ? null : Math.max(a.distance, b.distance);
            const look = connectionAppearance(distance);
            const highlighted = selectedKey && path.has(a.key) && path.has(b.key);
            const faded = selectedKey && step !== undefined && !highlighted;
            const dx = b.x - a.x; const dy = b.y - a.y;
            const length = Math.hypot(dx, dy) || 1;
            const cx = (a.x + b.x) / 2 - dy / length * 16;
            const cy = (a.y + b.y) / 2 + dx / length * 16;
            return <Path key={edge.key} testID={`network-edge-${edge.key}`}
              d={`M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`} fill="none"
              stroke={look.dashed ? lv.mutedFg : lv.thread} strokeWidth={highlighted ? look.width + 0.6 : look.width}
              strokeOpacity={faded ? look.opacity * 0.35 : look.opacity} strokeDasharray={look.dashed ? "3 5" : undefined}
              vectorEffect="non-scaling-stroke" strokeLinecap="round" />;
          })}
          {paintedNodes.map(node => {
            const me = node.key === graph.meKey;
            const selected = node.key === selectedKey;
            const close = node.distance === 1;
            const radius = me ? 34 : selected ? 23 : close ? (closeNodes.length > 30 ? 9 : closeNodes.length > 12 ? 15 : 23) : node.distance === 2 ? 11 : 7;
            const showName = me || selected || named.has(node.key);
            const faded = selectedKey && step !== undefined && !path.has(node.key) && !me;
            return <G key={node.key} opacity={faded ? 0.35 : 1}>
              <Circle cx={node.x} cy={node.y} r={Math.max(radius + 8, 18)} fill={lv.card} fillOpacity={0.01} />
              {me || selected ? <Circle cx={node.x} cy={node.y} r={radius + 8} fill={lv.accent} stroke={lv.thread} strokeWidth={1.5} /> : null}
              <Circle cx={node.x} cy={node.y} r={radius} fill={me || close ? toneFor(node.name) : node.distance === null ? lv.silver : lv.accent}
                stroke={me || selected ? lv.card : node.distance === null ? lv.border : lv.thread}
                strokeOpacity={me || selected ? 1 : close ? 0.3 : 0.5} strokeWidth={me || close ? 3 : 1.5} />
              {me || close && radius >= 18 ? <SvgText x={node.x} y={node.y + (me ? 10 : 7)} textAnchor="middle" fill={lv.fg} fontSize={me ? 29 : 21} fontWeight="600">
                {node.name.slice(0, 1).toUpperCase() || "?"}
              </SvgText> : null}
              {showName ? <SvgText x={node.x} y={node.y + radius + 24} textAnchor="middle" fill={selected ? lv.thread : lv.fg}
                fontSize={me ? 23 : 20} fontWeight={me || selected ? "700" : "500"}>
                {me ? "You" : node.name.length > 13 ? `${node.name.slice(0, 12)}…` : node.name}
              </SvgText> : null}
              {me ? <SvgText x={node.x} y={node.y + radius + 44} textAnchor="middle" fill={lv.mutedFg} fontSize={15}>your starting point</SvgText> : null}
            </G>;
          })}
        </Svg>
        {paintedNodes.map(node => {
          const me = node.key === graph.meKey;
          const selected = node.key === selectedKey;
          const scale = width / GRAPH_WIDTH * camera.zoom;
          const hitSize = me || node.distance === 1 ? 44 : 24;
          return <Pressable key={node.key} testID={`ego-node-${node.key}`} accessibilityRole="button"
            accessibilityLabel={me ? "You, center of your network" : `${node.name}, ${node.distance === null ? "wider network" : `${node.distance} ${node.distance === 1 ? "step" : "steps"} from you`}`}
            accessibilityState={{ selected }} onPress={() => onSelect(me || selected ? null : node.key)}
            style={{ position: "absolute", width: hitSize, height: hitSize, borderRadius: hitSize / 2,
              left: width / 2 + (node.x - camera.x) * scale - hitSize / 2,
              top: width * GRAPH_HEIGHT / GRAPH_WIDTH / 2 + (node.y - camera.y) * scale - hitSize / 2,
            }} />;
        })}
        <View style={styles.zoomControls}>
          <Pressable testID="network-zoom-in" accessibilityRole="button" accessibilityLabel="Zoom in" disabled={camera.zoom >= 3}
            onPress={() => zoom(0.35)} style={[styles.zoomButton, camera.zoom >= 3 && styles.disabled]}><Text style={styles.zoomText}>+</Text></Pressable>
          <View style={styles.controlDivider} />
          <Pressable testID="network-zoom-out" accessibilityRole="button" accessibilityLabel="Zoom out" disabled={camera.zoom <= 0.75}
            onPress={() => zoom(-0.35)} style={[styles.zoomButton, camera.zoom <= 0.75 && styles.disabled]}><Text style={styles.zoomText}>−</Text></Pressable>
        </View>
        <View pointerEvents="none" style={styles.mapHint}><Text style={styles.caption}>Drag to explore · tap a person</Text></View>
      </View>
      <View style={styles.legend}>
        {[{ label: "1 step", distance: 1 }, { label: "2 steps", distance: 2 }, { label: "3+ steps", distance: 3 }, { label: "Wider network", distance: null }].map(item => {
          const look = connectionAppearance(item.distance);
          return <View key={item.label} style={styles.legendItem}>
            <View style={{ width: 20, borderTopWidth: look.width, borderColor: look.dashed ? lv.mutedFg : lv.thread,
              borderStyle: look.dashed ? "dashed" : "solid", opacity: look.opacity }} />
            <Text style={styles.caption}>{item.label}</Text>
          </View>;
        })}
      </View>
      <Text style={styles.explainer}>Solid threads connect back to you. Darker means closer.</Text>
      {graph.truncated ? <Text style={styles.caption}>Showing part of the network. Distances reflect the connections shown.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  topline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  liveLabel: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: lv.thread },
  caption: { ...type.caption2, color: lv.mutedFg, flexShrink: 1 },
  recenter: { minHeight: 44, paddingHorizontal: 10, justifyContent: "center", borderRadius: 22, backgroundColor: lv.bg },
  recenterText: { ...type.caption1, fontWeight: "600", color: lv.fg },
  canvas: { width: "100%", aspectRatio: GRAPH_WIDTH / GRAPH_HEIGHT, overflow: "hidden", borderRadius: lv.radiusSm, backgroundColor: lv.bg },
  zoomControls: { position: "absolute", right: 8, bottom: 34, borderRadius: 22, backgroundColor: lv.card, borderWidth: StyleSheet.hairlineWidth, borderColor: lv.border },
  zoomButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  zoomText: { ...type.title2, fontWeight: "400", color: lv.fg },
  controlDivider: { height: StyleSheet.hairlineWidth, backgroundColor: lv.border, marginHorizontal: 10 },
  mapHint: { position: "absolute", left: 10, bottom: 10 },
  legend: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  explainer: { ...type.caption1, color: lv.mutedFg },
  disabled: { opacity: 0.3 },
});
