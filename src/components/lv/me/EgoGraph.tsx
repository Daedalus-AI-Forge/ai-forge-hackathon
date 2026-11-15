import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { NetworkNode } from "@/lib/graphApi.types";
import { lv } from "@/theme/tokens";

const TONES = [lv.gold, lv.silver, lv.bronze, lv.accent, lv.secondary];

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

type Placed = { node: NetworkNode; x: number; y: number };

/** Places direct connections evenly on one ring around "me" (fractions of the square, 0..1). */
export function placeRing(nodes: NetworkNode[], radius = 0.36): Placed[] {
  return nodes.map((node, i) => {
    const a = -Math.PI / 2 + (i / Math.max(1, nodes.length)) * Math.PI * 2;
    return { node, x: 0.5 + Math.cos(a) * radius, y: 0.5 + Math.sin(a) * radius };
  });
}

/**
 * Ego network: "me" in the center, each person I passed a wish to around it,
 * spoke thickness by how many tags I gave them. Drawn with plain Views (rotated
 * hairlines for the spokes) so it needs no SVG dependency.
 */
export function EgoGraph({
  meName,
  nodes,
  selectedKey,
  onSelect,
}: {
  meName: string;
  nodes: NetworkNode[];
  selectedKey: string | null;
  onSelect: (personKey: string | null) => void;
}) {
  const [size, setSize] = useState(0);
  const placed = placeRing(nodes.slice(0, 12));
  const c = size / 2;
  return (
    <View
      testID="ego-graph"
      style={styles.square}
      onLayout={(e) => setSize(Math.min(e.nativeEvent.layout.width, 340))}
    >
      {size > 0 ? (
        <>
          <View
            pointerEvents="none"
            style={[styles.orbit, { width: size * 0.72, height: size * 0.72, borderRadius: size, left: c - size * 0.36, top: c - size * 0.36 }]}
          />
          {placed.map(({ node, x, y }) => {
            const dx = x * size - c;
            const dy = y * size - c;
            const len = Math.sqrt(dx * dx + dy * dy);
            const on = node.personKey === selectedKey;
            const thick = on ? 2.5 : Math.min(1 + node.edgeCount * 0.5, 2.5);
            return (
              <View
                key={`l-${node.personKey}`}
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: c + dx / 2 - len / 2,
                  top: c + dy / 2 - thick / 2,
                  width: len,
                  height: thick,
                  backgroundColor: on ? lv.thread : "rgba(224,69,63,0.45)",
                  transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }],
                }}
              />
            );
          })}
          {placed.map(({ node, x, y }) => {
            const on = node.personKey === selectedKey;
            return (
              <Pressable
                key={node.personKey}
                testID={`ego-node-${node.name}`}
                accessibilityRole="button"
                accessibilityLabel={`${node.name}, ${node.tags.join(", ")}`}
                onPress={() => onSelect(on ? null : node.personKey)}
                hitSlop={8}
                style={[styles.node, { left: x * size - 40, top: y * size - 22 }]}
              >
                <View style={on ? styles.selRing : undefined}>
                  <LvAvatar name={node.name} size={32} ring />
                </View>
                <Text numberOfLines={1} style={[styles.label, on && styles.labelOn]}>
                  {node.name}
                </Text>
                {node.tags[0] ? (
                  <Text numberOfLines={1} style={styles.tag}>
                    {node.tags[0]}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
          <View pointerEvents="none" style={[styles.node, { left: c - 40, top: c - 30 }]}>
            <View style={styles.meRing}>
              <LvAvatar name={meName} size={46} />
            </View>
            <Text style={[styles.label, styles.labelOn]}>You</Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  square: { width: "100%", maxWidth: 340, aspectRatio: 1, alignSelf: "center" },
  orbit: { position: "absolute", borderWidth: 1, borderStyle: "dashed", borderColor: "rgba(28,25,21,0.12)" },
  node: { position: "absolute", width: 80, alignItems: "center" },
  label: { marginTop: 2, fontSize: 11, color: lv.mutedFg },
  labelOn: { color: lv.fg, fontWeight: "700" },
  tag: { fontSize: 10, color: lv.thread, fontWeight: "600" },
  meRing: { borderRadius: 30, borderWidth: 3, borderColor: lv.thread, padding: 1, backgroundColor: lv.bg },
  selRing: { borderRadius: 20, borderWidth: 2, borderColor: lv.thread },
});
