import { useMutation, useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { api } from "@/convex/_generated/api";
import { GlassCard, Icon, SectionHeader } from "@/components/ios";
import { keyboardInputProps } from "@/components/keyboard";
import { DTag } from "@/components/lv/passon/kit";
import { EgoGraph, LvAvatar } from "@/components/lv/me/EgoGraph";
import { networkDistances } from "@/components/lv/me/communityLayout";
import { layout, lv, type } from "@/theme/tokens";

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
    <View testID="network-map" style={styles.group}>
      <SectionHeader variant="title" title="The wish network" right={<DTag label="Your perspective" tone="neutral" />} />
      <GlassCard>
        <View style={styles.intro}>
          <Text style={styles.eyebrow}>A world of little connections</Text>
          <Text style={styles.note}>Everyone’s part of the picture. Follow the threads that lead back to you.</Text>
        </View>
        {community === undefined ? <Text style={styles.note}>Loading the network…</Text> : null}
        {community === null ? <Text style={styles.note}>Your network will appear once your profile is ready.</Text> : null}
        {community ? (
          <>
            <View testID="network-summary" style={styles.summary}>
              {[[community.nodes.filter(node => node.kind === "user").length, "Users"], [[...(topology?.distances.values() ?? [])].filter(d => d === 1).length, "1 step away"], [community.links.length, "Threads"]].map(([value, label], i) => (
                <View key={label} style={[styles.stat, i > 0 && styles.statDivider]}>
                  <Text style={styles.statNumber}>{value}</Text>
                  <Text style={styles.statLabel}>{label}</Text>
                </View>
              ))}
            </View>
            <View style={styles.search}>
              <Icon name="search" size={16} color={lv.mutedFg} />
              <TextInput testID="network-search" accessibilityLabel="Find someone in the network"
                placeholder="Find someone in the network" placeholderTextColor={lv.tertiaryFg} selectionColor={lv.thread}
                {...keyboardInputProps({})} returnKeyType="search"
                value={search} onChangeText={value => { setSearch(value); setSearchLimit(8); }} style={styles.searchInput} />
              {search ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={10} onPress={() => setSearch("")} style={styles.clear}>
                  <Icon name="close" size={9} color="#FFFFFF" weight="bold" />
                </Pressable>
              ) : null}
            </View>
            {search.trim() ? (
              <View style={styles.results}>
                {matches.slice(0, searchLimit).map((node, i) => (
                  <Pressable key={node.key} accessibilityRole="button" accessibilityLabel={`Show ${node.name} in the network`}
                    style={({ pressed }) => [styles.searchResult, i > 0 && styles.resultDivider, pressed && styles.rowPressed]}
                    onPress={() => { setSelected(node.key); setSelectedAlias(null); setSearch(""); }}>
                    <LvAvatar name={node.name} size={28} />
                    <Text style={[styles.name, styles.flex]} numberOfLines={1}>{node.name}</Text>
                    <Text style={styles.muted}>{topology?.distances.has(node.key) ? `${topology.distances.get(node.key)} steps away` : "Wider network"}</Text>
                    <Icon name="forward" size={12} color={lv.tertiaryFg} />
                  </Pressable>
                ))}
                {!matches.length ? <Text style={[styles.note, styles.resultEmpty]}>No matching people in the network shown.</Text> : null}
                {matches.length > searchLimit ? (
                  <Pressable accessibilityRole="button" onPress={() => setSearchLimit(limit => limit + 8)} style={[styles.searchResult, styles.resultDivider]}>
                    <Text style={styles.more}>Show more · {matches.length} matches</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            <EgoGraph graph={community} selectedKey={selectedNode?.key ?? null} onSelect={key => { setSelected(key); setSelectedAlias(null); }} />
            {community.links.length === 0 ? <Text style={styles.note}>Your first shared wish starts a thread. The wider network will grow around it.</Text> : null}
          </>
        ) : null}
        {coach ? <CoachProgress {...coach} /> : null}
      </GlassCard>

      {sel ? (
        <GlassCard testID={`network-detail-${sel.name}`} style={styles.detail}>
          <View style={styles.headRow}>
            <Text style={[styles.eyebrow, { color: lv.thread }]}>Your connection</Text>
            <DTag label="Private to you" tone="neutral" />
          </View>
          <View style={styles.row}>
            <LvAvatar name={detailName ?? sel.name} size={44} ring />
            <View style={styles.personText}>
              <Text style={styles.detailName}>{detailName ?? sel.name}</Text>
              <Text style={styles.muted}>{selLinks.length} {selLinks.length === 1 ? "connection" : "connections"} · {detailTags} {detailTags === 1 ? "tag" : "tags"}</Text>
            </View>
            <CloseButton onPress={clearSelection} />
          </View>
          {selLinks.map((l) => (
            <View key={l.edgeId} testID={`network-tag-${sel.name}-${l.tag}`} style={styles.tagRow}>
              <View style={styles.tagBody}>
                <DTag label={l.tag} tone={l.source === "daily" ? "thread" : "neutral"} />
                {l.reason ? <Text style={styles.reason}>“{l.reason}”</Text> : null}
                <Text style={styles.muted}>
                  {l.source === "daily" ? "From a daily wish" : "Picked by you"} · {new Date(l.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </Text>
              </View>
              <Pressable
                testID={`network-forget-tag-${sel.name}-${l.tag}`}
                accessibilityRole="button"
                accessibilityLabel={`Forget ${l.tag} for ${sel.name}`}
                onPress={() => void forgetEdge({ deviceId, edgeId: l.edgeId })}
                style={({ pressed }) => [styles.forgetButton, pressed && { opacity: 0.5 }]}
              >
                <Text style={styles.forgetText}>Forget</Text>
              </Pressable>
            </View>
          ))}
          <Text style={styles.footnote}>Remembered from your passes. Yours to keep or forget.</Text>
        </GlassCard>
      ) : null}

      {selectedNode && !sel ? (
        <GlassCard testID="network-community-detail" style={styles.detail}>
          <View style={styles.row}>
            <LvAvatar name={selectedNode.name} size={44} ring />
            <View style={styles.personText}>
              <Text style={styles.detailName}>{selectedNode.name}</Text>
              <Text style={styles.muted}>{distance === undefined ? "In the wider network" : `${distance} ${distance === 1 ? "step" : "steps"} away from you`}</Text>
            </View>
            <CloseButton onPress={clearSelection} />
          </View>
          {route.length > 0 ? (
            <View style={styles.route}>
              {route.map((name, i) => (
                <View key={`${name}-${i}`} style={styles.routeStep}>
                  {i > 0 ? <View style={styles.routeDash} /> : null}
                  <Text style={[styles.routeName, (i === 0 || i === route.length - 1) && styles.routeEnd]}>{name}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.note}>No shared path to you in the connections shown yet.</Text>
          )}
        </GlassCard>
      ) : null}

      {nodes.length > 0 ? (
        <>
          <SectionHeader title="Your saved connections" right={<Text style={styles.count}>{nodes.length}</Text>} />
          <GlassCard style={styles.list}>
            {nodes.map((p, i) => (
              <View key={p.personKey} style={[styles.listRow, p.personKey === sel?.personKey && styles.selectedRow]}>
                {i > 0 ? <View style={styles.listDivider} /> : null}
                <Pressable
                  testID={`network-person-${p.name}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Explore ${p.name}, ${p.edgeCount} ${p.edgeCount === 1 ? "connection" : "connections"}`}
                  accessibilityState={{ selected: p.personKey === sel?.personKey }}
                  onPress={() => selectPerson(p.personKey)}
                  style={({ pressed }) => [styles.personButton, pressed && { opacity: 0.6 }]}
                >
                  <LvAvatar name={p.name} size={36} />
                  <View style={styles.personText}>
                    <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
                    <Text numberOfLines={1} style={styles.muted}>
                      {p.tags.join(" · ")}
                    </Text>
                  </View>
                  <View style={styles.connectionCount}><Text style={styles.connectionCountText}>{p.edgeCount}</Text></View>
                </Pressable>
                <Pressable
                  testID={`network-forget-${p.name}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Forget ${p.name}`}
                  onPress={() => {
                    if (sel?.personKey === p.personKey) clearSelection();
                    void forget({ deviceId, personName: p.name });
                  }}
                  style={({ pressed }) => [styles.forgetButton, pressed && { opacity: 0.5 }]}
                >
                  <Text style={styles.forgetText}>Forget</Text>
                </Pressable>
              </View>
            ))}
          </GlassCard>
        </>
      ) : null}
    </View>
  );
}

function CloseButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Close connection details" onPress={onPress} hitSlop={8}
      style={({ pressed }) => [styles.close, pressed && { opacity: 0.6 }]}>
      <Icon name="close" size={11} color={lv.mutedFg} weight="bold" />
    </Pressable>
  );
}

function CoachProgress({ ready, edgeCount, threshold }: { ready: boolean; edgeCount: number; threshold: number }) {
  const pct = Math.min(1, threshold > 0 ? edgeCount / threshold : 1);
  return (
    <View testID="coach-progress" style={styles.coach}>
      <View style={styles.headRow}>
        <View style={styles.coachTitle}>
          <Icon name="sparkles" size={13} color={lv.thread} />
          <Text style={styles.eyebrow}>AI coach</Text>
        </View>
        <Text style={[styles.muted, ready && styles.ready]}>{ready ? "Ready to help" : `${edgeCount} / ${threshold}`}</Text>
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
  group: { gap: 16 },
  flex: { flex: 1 },
  intro: { gap: 4 },
  eyebrow: { ...type.eyebrow, color: lv.mutedFg },
  note: { ...type.footnote, color: lv.mutedFg },
  body: { ...type.footnote, color: lv.fg },
  footnote: { ...type.caption1, color: lv.mutedFg },
  muted: { ...type.footnote, color: lv.mutedFg },
  name: { ...type.body, fontWeight: "500", color: lv.fg },
  summary: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: lv.separator, paddingVertical: 12 },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderColor: lv.separator },
  statNumber: { ...type.title2, fontWeight: "600", color: lv.fg, fontVariant: ["tabular-nums"] },
  statLabel: { ...type.caption1, color: lv.mutedFg },
  search: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 40, borderRadius: lv.radiusSm, borderCurve: "continuous", backgroundColor: lv.fill, paddingHorizontal: 10 },
  searchInput: { flex: 1, ...type.body, color: lv.fg, paddingVertical: 8, outlineWidth: 0 },
  clear: { width: 18, height: 18, borderRadius: 9, backgroundColor: lv.tertiaryFg, alignItems: "center", justifyContent: "center" },
  results: { borderRadius: lv.radiusSm, borderCurve: "continuous", backgroundColor: "rgba(255,255,255,0.55)", overflow: "hidden" },
  searchResult: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12 },
  resultDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: lv.separator },
  resultEmpty: { padding: 12 },
  rowPressed: { backgroundColor: lv.fill },
  more: { ...type.subheadline, fontWeight: "500", color: lv.thread },
  detail: { borderColor: lv.thread, borderWidth: 1 },
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  personText: { flex: 1, minWidth: 0, gap: 2 },
  detailName: { ...type.headline, color: lv.fg },
  close: { width: 30, height: 30, borderRadius: 15, backgroundColor: lv.fill, alignItems: "center", justifyContent: "center" },
  tagRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderColor: lv.separator },
  tagBody: { flex: 1, gap: 6 },
  reason: { ...type.subheadline, color: lv.fg },
  route: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", rowGap: 6 },
  routeStep: { flexDirection: "row", alignItems: "center" },
  routeDash: { width: 14, height: 2, borderRadius: 1, backgroundColor: lv.thread, marginHorizontal: 6 },
  routeName: { ...type.footnote, color: lv.mutedFg },
  routeEnd: { color: lv.fg, fontWeight: "600" },
  count: { ...type.footnote, fontWeight: "600", color: lv.mutedFg },
  list: { padding: 0, gap: 0 },
  listRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: layout.cardPadding, paddingRight: 8 },
  // Inset separator, lined up with the names (after the avatar), like an iOS list.
  listDivider: { position: "absolute", top: 0, right: 0, left: layout.cardPadding + 36 + 12, height: StyleSheet.hairlineWidth, backgroundColor: lv.separator },
  selectedRow: { backgroundColor: lv.threadTint },
  personButton: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60 },
  connectionCount: { minWidth: 26, height: 22, paddingHorizontal: 7, borderRadius: 11, backgroundColor: lv.threadTint, alignItems: "center", justifyContent: "center" },
  connectionCountText: { ...type.caption1, fontWeight: "600", color: lv.thread, fontVariant: ["tabular-nums"] },
  forgetButton: { minHeight: 44, paddingHorizontal: 8, alignItems: "center", justifyContent: "center" },
  forgetText: { ...type.subheadline, color: lv.mutedFg },
  coach: { gap: 8, backgroundColor: lv.fill, padding: 12, borderRadius: lv.radiusSm, borderCurve: "continuous" },
  coachTitle: { flexDirection: "row", alignItems: "center", gap: 6 },
  ready: { color: lv.thread, fontWeight: "600" },
  track: { height: 6, borderRadius: 3, backgroundColor: lv.fillStrong, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3, backgroundColor: lv.thread },
});
