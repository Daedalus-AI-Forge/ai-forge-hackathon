import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import { EgoGraph, LvAvatar } from "@/components/lv/me/EgoGraph";
import { lv } from "@/theme/tokens";

/**
 * "My wish network": ego graph + people list. Everything here was learned from
 * my own passes, is visible only to me, and can be forgotten per tag or per person.
 */
export function MeNetwork({ deviceId }: { deviceId: string }) {
  const net = useQuery(api.graph.myNetwork, { deviceId });
  const coach = useQuery(api.graph.coachReady, { deviceId });
  const forget = useMutation(api.edges.forget);
  const forgetEdge = useMutation(api.edges.forgetEdge);
  const [selected, setSelected] = useState<string | null>(null);

  const nodes = net?.nodes ?? [];
  const links = net?.links ?? [];
  const sel = nodes.find((n) => n.personKey === selected) ?? null;
  const selLinks = sel ? links.filter((l) => l.personKey === sel.personKey) : [];

  return (
    <View testID="network-map" style={{ gap: 12 }}>
      <Text style={styles.h2}>My wish network</Text>
      <View style={[styles.glass, { padding: 16, gap: 12 }]}>
        <Text style={styles.note}>
          Learned from the wishes you passed on. Only you can see it. Tap a friend to see why, and forget anything.
        </Text>
        {net === undefined ? <Text style={styles.note}>Loading…</Text> : null}
        {net && nodes.length === 0 ? (
          <Text style={styles.note}>Nothing yet. Pass today's wish to a friend and the map starts here.</Text>
        ) : null}
        {nodes.length > 0 ? (
          <EgoGraph meName={net?.me.name || "You"} nodes={nodes} selectedKey={selected} onSelect={setSelected} />
        ) : null}
        {coach ? <CoachProgress {...coach} /> : null}
      </View>

      {sel ? (
        <View testID={`network-detail-${sel.name}`} style={[styles.glass, { padding: 16, gap: 10 }]}>
          <View style={styles.row}>
            <LvAvatar name={sel.name} size={40} />
            <Text style={[styles.name, { flex: 1 }]}>{sel.name}</Text>
            <Pressable accessibilityRole="button" onPress={() => setSelected(null)} hitSlop={8}>
              <Text style={styles.muted}>Close</Text>
            </Pressable>
          </View>
          {selLinks.map((l) => (
            <View key={l.edgeId} testID={`network-tag-${sel.name}-${l.tag}`} style={styles.tagRow}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.chip, l.source === "daily" && styles.chipDaily]}>{l.tag}</Text>
                {l.reason ? <Text style={styles.note}>"{l.reason}"</Text> : null}
              </View>
              <Pressable
                testID={`network-forget-tag-${sel.name}-${l.tag}`}
                accessibilityRole="button"
                accessibilityLabel={`Forget ${l.tag} for ${sel.name}`}
                onPress={() => void forgetEdge({ deviceId, edgeId: l.edgeId })}
                style={styles.pill}
              >
                <Text style={styles.pillText}>Forget</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {nodes.length > 0 ? (
        <View style={[styles.glass, { overflow: "hidden" }]}>
          {nodes.map((p, i) => (
            <Pressable
              key={p.personKey}
              testID={`network-person-${p.name}`}
              onPress={() => setSelected(p.personKey === selected ? null : p.personKey)}
              style={[styles.listRow, i > 0 && styles.divider]}
            >
              <LvAvatar name={p.name} size={34} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.name}>{p.name}</Text>
                <Text numberOfLines={1} style={styles.muted}>
                  {p.tags.join(" · ")}
                </Text>
              </View>
              <Pressable
                testID={`network-forget-${p.name}`}
                accessibilityRole="button"
                accessibilityLabel={`Forget ${p.name}`}
                onPress={() => {
                  if (selected === p.personKey) setSelected(null);
                  void forget({ deviceId, personName: p.name });
                }}
                style={styles.pill}
              >
                <Text style={styles.pillText}>Forget</Text>
              </Pressable>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function CoachProgress({ ready, edgeCount, threshold }: { ready: boolean; edgeCount: number; threshold: number }) {
  const pct = Math.min(1, threshold > 0 ? edgeCount / threshold : 1);
  return (
    <View testID="coach-progress" style={{ gap: 6 }}>
      <Text style={styles.eyebrow}>AI coach</Text>
      <Text style={styles.body}>
        {ready
          ? "Unlocked: your coach can suggest who to ask."
          : `Unlocks at ${threshold} connections · ${edgeCount}/${threshold}`}
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  h2: { fontSize: 17, fontWeight: "600", color: lv.fg, paddingHorizontal: 4, marginTop: 8 },
  glass: { backgroundColor: lv.card, borderRadius: lv.radiusXl, borderWidth: StyleSheet.hairlineWidth, borderColor: lv.border, ...lv.shadow },
  note: { fontSize: 13, color: lv.mutedFg, lineHeight: 18 },
  body: { fontSize: 15, color: lv.fg },
  eyebrow: { fontSize: 11, fontWeight: "600", letterSpacing: 1, textTransform: "uppercase", color: lv.mutedFg },
  track: { height: 6, borderRadius: 3, backgroundColor: lv.muted, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3, backgroundColor: lv.thread },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  tagRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderColor: lv.border },
  listRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: lv.border },
  name: { fontSize: 15, fontWeight: "500", color: lv.fg },
  muted: { fontSize: 12, color: lv.mutedFg },
  chip: {
    alignSelf: "flex-start",
    fontSize: 13,
    fontWeight: "600",
    color: lv.fg,
    backgroundColor: lv.secondary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: "hidden",
  },
  chipDaily: { color: lv.thread, backgroundColor: lv.accent },
  pill: { height: 34, paddingHorizontal: 14, borderRadius: 999, backgroundColor: lv.primary, alignItems: "center", justifyContent: "center" },
  pillText: { color: lv.primaryFg, fontSize: 13, fontWeight: "600" },
});
