import { useMutation, useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { api } from "@/convex/_generated/api";
import { EgoGraph, LvAvatar } from "@/components/lv/me/EgoGraph";
import { networkDistances } from "@/components/lv/me/communityLayout";
import { lv } from "@/theme/tokens";

/**
 * Community topology with the viewer's own private evidence kept in its detail panel.
 */
export function MeNetwork({ deviceId }: { deviceId: string }) {
  const net = useQuery(api.graph.myNetwork, { deviceId });
  const community = useQuery(api.graph.communityNetwork, { deviceId });
  const coach = useQuery(api.graph.coachReady, { deviceId });
  const forget = useMutation(api.edges.forget);
  const forgetEdge = useMutation(api.edges.forgetEdge);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedAlias, setSelectedAlias] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchLimit, setSearchLimit] = useState(8);

  const nodes = net?.nodes ?? [];
  const links = net?.links ?? [];
  const topology = useMemo(() => community ? networkDistances(community) : null, [community]);
  const selectedNode = community?.nodes.find(node => node.key === selected) ?? null;
  const sel = selectedAlias !== null
    ? nodes.find(n => n.personKey === selectedAlias) ?? null
    : nodes.find(n => selectedNode?.personKeys.includes(n.personKey)) ?? null;
  const selLinks = sel ? links.filter(l => selectedAlias ? l.personKey === sel.personKey : selectedNode?.edgeIds.includes(l.edgeId)) : [];
  const detailName = selectedAlias ? sel?.name : selectedNode?.name;
  const detailTags = new Set(selLinks.map(link => link.tag)).size;
  const distance = selected ? topology?.distances.get(selected) : undefined;
  const matches = search.trim() ? community?.nodes.filter(node => node.key !== community.meKey && node.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())) ?? [] : [];
  const route: string[] = [];
  let routeKey: string | undefined = distance === undefined ? undefined : selected ?? undefined;
  while (routeKey) {
    const node = community?.nodes.find(item => item.key === routeKey);
    route.unshift(routeKey === community?.meKey ? "You" : node?.name ?? "Someone");
    routeKey = topology?.parents.get(routeKey);
  }
  const selectPerson = (personKey: string) => {
    const node = community?.nodes.find(item => item.personKeys.includes(personKey));
    const alreadySelected = selectedAlias === personKey;
    setSelected(alreadySelected ? null : node?.key ?? null);
    setSelectedAlias(alreadySelected ? null : personKey);
  };
  const clearSelection = () => { setSelected(null); setSelectedAlias(null); };

  return (
    <View testID="network-map" style={{ gap: 12 }}>
      <View style={styles.sectionHeading}>
        <Text style={styles.h2}>The wish network</Text>
        <View style={styles.privateBadge}><View style={styles.privateDot} /><Text style={styles.micro}>Your perspective</Text></View>
      </View>
      <View style={[styles.glass, { padding: 16, gap: 12 }]}>
        <View style={{ gap: 5 }}>
          <Text style={styles.eyebrow}>A world of little connections</Text>
          <Text style={styles.note}>
            Everyone’s part of the picture. Follow the threads that lead back to you.
          </Text>
        </View>
        {community === undefined ? <Text style={styles.note}>Loading the network…</Text> : null}
        {community === null ? <Text style={styles.note}>Your network will appear once your profile is ready.</Text> : null}
        {community ? (
          <>
            <View testID="network-summary" style={styles.summary}>
              {[[community.nodes.filter(node => node.kind === "user").length, "Users"], [[...(topology?.distances.values() ?? [])].filter(d => d === 1).length, "1 step away"], [community.links.length, "Threads"]].map(([value, label], i) => (
                <View key={label} style={[styles.stat, i > 0 && styles.statDivider]}>
                  <Text style={styles.statNumber}>{value}</Text>
                  <Text style={styles.micro}>{label}</Text>
                </View>
              ))}
            </View>
            <TextInput testID="network-search" accessibilityLabel="Find someone in the network"
              placeholder="Find someone in the network" placeholderTextColor={lv.mutedFg}
              value={search} onChangeText={value => { setSearch(value); setSearchLimit(8); }} style={styles.searchInput} />
            {search.trim() ? (
              <View style={{ gap: 2 }}>
                {matches.slice(0, searchLimit).map(node => (
                  <Pressable key={node.key} accessibilityRole="button" accessibilityLabel={`Show ${node.name} in the network`}
                    style={styles.searchResult} onPress={() => { setSelected(node.key); setSelectedAlias(null); setSearch(""); }}>
                    <Text style={[styles.name, { flex: 1 }]}>{node.name}</Text>
                    <Text style={styles.muted}>{topology?.distances.has(node.key) ? `${topology.distances.get(node.key)} steps away` : "Wider network"}</Text>
                  </Pressable>
                ))}
                {!matches.length ? <Text style={styles.note}>No matching people in the network shown.</Text> : null}
                {matches.length > searchLimit ? (
                  <Pressable accessibilityRole="button" onPress={() => setSearchLimit(limit => limit + 8)} style={styles.searchResult}>
                    <Text style={styles.muted}>Show more · {matches.length} matches</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            <EgoGraph graph={community} selectedKey={selectedNode?.key ?? null} onSelect={key => { setSelected(key); setSelectedAlias(null); }} />
            {community.links.length === 0 ? <Text style={styles.note}>Your first shared wish starts a thread. The wider network will grow around it.</Text> : null}
          </>
        ) : null}
        {coach ? <CoachProgress {...coach} /> : null}
      </View>

      {sel ? (
        <View testID={`network-detail-${sel.name}`} style={[styles.glass, styles.detail]}>
          <View style={styles.sectionHeading}>
            <Text style={[styles.eyebrow, { color: lv.thread }]}>Your connection</Text>
            <Text style={styles.micro}>Private to you</Text>
          </View>
          <View style={styles.row}>
            <LvAvatar name={detailName ?? sel.name} size={40} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.name}>{detailName ?? sel.name}</Text>
              <Text style={styles.muted}>{selLinks.length} {selLinks.length === 1 ? "connection" : "connections"} · {detailTags} {detailTags === 1 ? "tag" : "tags"}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close connection details" onPress={clearSelection} style={styles.close}>
              <Text style={styles.muted}>Close</Text>
            </Pressable>
          </View>
          {selLinks.map((l) => (
            <View key={l.edgeId} testID={`network-tag-${sel.name}-${l.tag}`} style={styles.tagRow}>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={[styles.chip, l.source === "daily" && styles.chipDaily]}>{l.tag}</Text>
                {l.reason ? <Text style={styles.reason}>“{l.reason}”</Text> : null}
                <Text style={styles.micro}>
                  {l.source === "daily" ? "From a daily wish" : "Picked by you"} · {new Date(l.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </Text>
              </View>
              <Pressable
                testID={`network-forget-tag-${sel.name}-${l.tag}`}
                accessibilityRole="button"
                accessibilityLabel={`Forget ${l.tag} for ${sel.name}`}
                onPress={() => void forgetEdge({ deviceId, edgeId: l.edgeId })}
                style={styles.forgetButton}
              >
                <Text style={styles.forgetText}>Forget</Text>
              </Pressable>
            </View>
          ))}
          <Text style={styles.micro}>Remembered from your passes. Yours to keep or forget.</Text>
        </View>
      ) : null}

      {selectedNode && !sel ? (
        <View testID="network-community-detail" style={[styles.glass, styles.detail]}>
          <View style={styles.row}>
            <LvAvatar name={selectedNode.name} size={40} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.name}>{selectedNode.name}</Text>
              <Text style={styles.muted}>{distance === undefined ? "In the wider network" : `${distance} ${distance === 1 ? "step" : "steps"} away from you`}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close connection details" onPress={clearSelection} style={styles.close}>
              <Text style={styles.muted}>Close</Text>
            </Pressable>
          </View>
          <Text style={styles.note}>{route.length > 0 ? route.join(" → ") : "No shared path to you in the connections shown yet."}</Text>
        </View>
      ) : null}

      {nodes.length > 0 ? (
        <View style={[styles.glass, { overflow: "hidden" }]}>
          <View style={styles.listHeader}>
            <Text style={styles.eyebrow}>Your saved connections</Text>
            <Text style={styles.micro}>{nodes.length}</Text>
          </View>
          {nodes.map((p, i) => (
            <View
              key={p.personKey}
              style={[styles.listRow, i > 0 && styles.divider, p.personKey === sel?.personKey && styles.selectedRow]}
            >
              <Pressable
                testID={`network-person-${p.name}`}
                accessibilityRole="button"
                accessibilityLabel={`Explore ${p.name}, ${p.edgeCount} ${p.edgeCount === 1 ? "connection" : "connections"}`}
                accessibilityState={{ selected: p.personKey === sel?.personKey }}
                onPress={() => selectPerson(p.personKey)}
                style={styles.personButton}
              >
                <LvAvatar name={p.name} size={34} />
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <Text style={styles.name}>{p.name}</Text>
                  <Text numberOfLines={1} style={styles.muted}>
                    {p.tags.join(" · ")}
                  </Text>
                </View>
                <Text style={styles.connectionCount}>{p.edgeCount}</Text>
              </Pressable>
              <Pressable
                testID={`network-forget-${p.name}`}
                accessibilityRole="button"
                accessibilityLabel={`Forget ${p.name}`}
                onPress={() => {
                  if (sel?.personKey === p.personKey) clearSelection();
                  void forget({ deviceId, personName: p.name });
                }}
                style={styles.forgetButton}
              >
                <Text style={styles.forgetText}>Forget</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function CoachProgress({ ready, edgeCount, threshold }: { ready: boolean; edgeCount: number; threshold: number }) {
  const pct = Math.min(1, threshold > 0 ? edgeCount / threshold : 1);
  return (
    <View testID="coach-progress" style={styles.coach}>
      <View style={styles.sectionHeading}>
        <Text style={styles.eyebrow}>AI coach</Text>
        <Text style={[styles.micro, ready && { color: lv.thread }]}>{ready ? "Ready to help" : `${edgeCount} / ${threshold}`}</Text>
      </View>
      <Text style={styles.body}>
        {ready
          ? "Unlocked: your coach can suggest who to ask."
          : `${Math.max(0, threshold - edgeCount)} more connections to unlock your coach.`}
      </Text>
      <View accessibilityRole="progressbar" accessibilityLabel="AI coach progress"
        accessibilityValue={{ min: 0, max: threshold, now: Math.min(edgeCount, threshold) }} style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  h2: { fontSize: 17, fontWeight: "600", color: lv.fg, paddingHorizontal: 4, marginTop: 8, flexShrink: 1 },
  privateBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: lv.secondary, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  privateDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: lv.mutedFg },
  glass: { backgroundColor: lv.card, borderRadius: lv.radiusXl, borderWidth: StyleSheet.hairlineWidth, borderColor: lv.border, ...lv.shadow },
  note: { fontSize: 13, color: lv.mutedFg, lineHeight: 18 },
  body: { fontSize: 13, lineHeight: 19, color: lv.fg },
  micro: { fontSize: 10, lineHeight: 15, color: lv.mutedFg },
  searchInput: { minHeight: 44, borderRadius: lv.radiusSm, backgroundColor: lv.bg, paddingHorizontal: 12, fontSize: 13, color: lv.fg },
  searchResult: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 8 },
  summary: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: lv.border, paddingVertical: 12, marginTop: 2 },
  stat: { flex: 1, alignItems: "center", gap: 3 },
  statDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderColor: lv.border },
  statNumber: { fontSize: 22, fontWeight: "500", color: lv.fg, fontVariant: ["tabular-nums"] },
  detail: { padding: 16, gap: 12, borderColor: lv.thread },
  reason: { fontSize: 13, lineHeight: 19, color: lv.fg },
  close: { minHeight: 44, minWidth: 44, justifyContent: "center", alignItems: "center" },
  coach: { gap: 8, backgroundColor: lv.bg, padding: 12, borderRadius: lv.radiusSm, marginTop: 4 },
  eyebrow: { fontSize: 11, fontWeight: "600", letterSpacing: 1, textTransform: "uppercase", color: lv.mutedFg },
  track: { height: 6, borderRadius: 3, backgroundColor: lv.muted, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3, backgroundColor: lv.thread },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  tagRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderColor: lv.border },
  listHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 },
  listRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 6 },
  personButton: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52 },
  selectedRow: { backgroundColor: lv.accent },
  connectionCount: { fontSize: 11, fontWeight: "600", color: lv.thread, backgroundColor: lv.bg, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8, overflow: "hidden" },
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
  forgetButton: { minHeight: 44, paddingHorizontal: 8, alignItems: "center", justifyContent: "center" },
  forgetText: { color: lv.mutedFg, fontSize: 12, textDecorationLine: "underline" },
});
