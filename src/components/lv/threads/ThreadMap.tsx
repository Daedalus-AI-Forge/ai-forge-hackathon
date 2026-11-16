// World map with the wish's red thread drawn hop by hop.
// Built from plain Views (no react-native-svg in this app yet): each arc is a
// quadratic curve approximated by short rotated line segments.
import { useState } from "react";
import { Image, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";

import { lv, lvImages } from "@/theme/tokens";
import { pathHolders, project, type Holder } from "./threadData";

const VIEW = { x: 0, y: 40, w: 1000, h: 360 }; // visible window of the 1000×500 map
const SEGMENTS = 14;

export function ThreadMap({
  holders,
  compact = false,
  highlightName,
  testID,
  radius = lv.radiusMd,
}: {
  holders: Holder[];
  compact?: boolean;
  highlightName?: string;
  testID?: string;
  /** Corner radius; pass the container's inner radius so corners stay concentric. */
  radius?: number;
}) {
  const [width, setWidth] = useState(0);
  const height = compact ? 112 : Math.max(160, width * 0.5);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  // "slice" fit: cover the box, centered.
  const scale = width ? Math.max(width / VIEW.w, height / VIEW.h) : 0;
  const ox = (width - VIEW.w * scale) / 2 - VIEW.x * scale;
  const oy = (height - VIEW.h * scale) / 2 - VIEW.y * scale;
  const toScreen = (p: { x: number; y: number }) => ({ x: ox + p.x * scale, y: oy + p.y * scale });

  const path = pathHolders(holders);
  const pts = path.map((h, i) => {
    const p = project(h.city);
    const dup = path.filter((x) => x.city === h.city).length > 1;
    return { h, ...toScreen({ x: p.x + (dup ? (i % 2 ? 14 : 0) : 0), y: p.y + (dup ? i * 3 : 0) }) };
  });

  const lines: { x: number; y: number; len: number; angle: number }[] = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const cx = (a.x + b.x) / 2;
    const cy = Math.min(a.y, b.y) - Math.max(30 * scale, Math.abs(b.x - a.x) * 0.18);
    let prev = { x: a.x, y: a.y };
    for (let s = 1; s <= SEGMENTS; s++) {
      const t = s / SEGMENTS;
      const x = (1 - t) ** 2 * a.x + 2 * (1 - t) * t * cx + t * t * b.x;
      const y = (1 - t) ** 2 * a.y + 2 * (1 - t) * t * cy + t * t * b.y;
      const dx = x - prev.x;
      const dy = y - prev.y;
      lines.push({ x: (x + prev.x) / 2, y: (y + prev.y) / 2, len: Math.hypot(dx, dy) + 1, angle: Math.atan2(dy, dx) });
      prev = { x, y };
    }
  }
  const stroke = compact ? 3 : 2.5;

  return (
    <View testID={testID} onLayout={onLayout} style={[styles.box, { height, borderRadius: radius }]}>
      {width > 0 ? (
        <>
          <Image
            source={lvImages.worldMapNight}
            style={{ position: "absolute", left: ox, top: oy, width: 1000 * scale, height: 500 * scale }}
            resizeMode="stretch"
          />
          {lines.map((l, i) => (
            <View
              key={i}
              style={{
                position: "absolute",
                left: l.x - l.len / 2,
                top: l.y - stroke / 2,
                width: l.len,
                height: stroke,
                borderRadius: stroke,
                backgroundColor: lv.thread,
                transform: [{ rotate: `${l.angle}rad` }],
              }}
            />
          ))}
          {pts.map((p, i) => {
            const hi = highlightName != null && p.h.name === highlightName;
            const r = hi ? 9 : compact ? 6 : 5;
            return (
              <View key={p.h.key} style={{ position: "absolute", left: p.x - r, top: p.y - r }}>
                {!compact ? (
                  <Text style={[styles.label, { top: -18, left: r - 10 }]}>{i === 0 ? "●" : p.h.depth}</Text>
                ) : null}
                <View
                  style={{
                    width: r * 2,
                    height: r * 2,
                    borderRadius: r,
                    borderWidth: 2.5,
                    borderColor: hi ? lv.card : lv.thread,
                    backgroundColor: hi ? lv.thread : lv.card,
                  }}
                />
              </View>
            );
          })}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: "hidden", borderCurve: "continuous", backgroundColor: lv.muted, width: "100%" },
  label: {
    position: "absolute",
    width: 20,
    textAlign: "center",
    fontSize: 10,
    fontWeight: "600",
    fontFamily: lv.font.mono,
    color: lv.fg,
  },
});
