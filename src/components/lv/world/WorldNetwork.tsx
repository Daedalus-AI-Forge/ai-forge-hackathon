import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { api } from "@/convex/_generated/api";
import { Glass, Icon, SectionHeader } from "@/components/ios";
import { keyboardInputProps } from "@/components/keyboard";
import { networkDistances } from "@/components/lv/me/communityLayout";
import { LvAvatar } from "@/components/lv/me/LvAvatar";
import { layout, night, type } from "@/theme/tokens";

import { ROLE_LINE, routeLine, type Chain } from "./chainText";
import { Globe } from "./Globe";
import { reach } from "./globeLayout";
import { Polaroid, tiltFor } from "./Polaroid";

const STRIP_WIDTH = 150;

/** The World tab body: the globe, how you're connected to anyone you tap, and the wishes that came true. */
export function WorldNetwork({ deviceId, onGlobeTouch }: { deviceId: string; onGlobeTouch: (active: boolean) => void }) {
  const router = useRouter();
  const community = useQuery(api.graph.communityNetwork, { deviceId });
  const chains = useQuery(api.chains.mine, { deviceId });
  const net = useQuery(api.graph.myNetwork, { deviceId });
  const coach = useQuery(api.graph.coachReady, { deviceId });
  const forget = useMutation(api.edges.forget);
  const forgetEdge = useMutation(api.edges.forgetEdge);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedAlias, setSelectedAlias] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchLimit, setSearchLimit] = useState(8);

  const nodes = net?.nodes ?? [];
  const links = net?.links ?? [];
  const topology = useMemo(() => (community ? networkDistances(community) : null), [community]);
  const chainKeys = useMemo(() => (chains ?? []).map((c) => c.people.flatMap((p) => (p.userKey ? [p.userKey] : []))), [chains]);

  const selectedNode = community?.nodes.find((node) => node.key === selected) ?? null;
  const sel = selectedAlias !== null
    ? nodes.find((n) => n.personKey === selectedAlias) ?? null
    : nodes.find((n) => selectedNode?.personKeys.includes(n.personKey)) ?? null;
  const selLinks = sel ? links.filter((l) => (selectedAlias ? l.personKey === sel.personKey : selectedNode?.edgeIds.includes(l.edgeId))) : [];
  const detailName = (selectedAlias ? sel?.name : selectedNode?.name) ?? sel?.name ?? "";
  const distance = selected ? topology?.distances.get(selected) : undefined;
  const route: string[] = [];
  for (let key: string | undefined = distance === undefined ? undefined : selected ?? undefined; key; key = topology?.parents.get(key)) {
    route.push(key === community?.meKey ? "You" : community?.nodes.find((n) => n.key === key)?.name ?? "Someone");
  }
  route.reverse();
  const together = (chains ?? []).filter((c) => selected && c.people.some((p) => p.userKey === selected));
  const matches = search.trim()
    ? community?.nodes.filter((n) => n.key !== community.meKey && n.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())) ?? []
    : [];

  const select = (key: string | null) => {
    setSelected(key);
    setSelectedAlias(null);
  };
  const selectPerson = (personKey: string) => {
    const node = community?.nodes.find((item) => item.personKeys.includes(personKey));
    const again = selectedAlias === personKey;
    setSelected(again ? null : node?.key ?? null);
    setSelectedAlias(again ? null : personKey);
  };
  const clearSelection = () => select(null);
  const openChain = (c: Chain) => router.push({ pathname: "/chain/[wishId]", params: { wishId: c.wishId } });

  const people = community?.nodes.length ?? 0;
  const steps = topology ? reach(topology.distances) : 0;
  const direct = topology ? [...topology.distances.values()].filter((d) => d === 1).length : 0;

  return (
    <View testID="network-map" style={styles.group}>
      {community === undefined ? <Text style={styles.note}>Spinning up the globe…</Text> : null}
      {community === null ? <Text style={styles.note}>Your world appears once your profile is ready.</Text> : null}
      {community ? (
        <>
          <View testID="network-summary" style={styles.summary}>
            <Text style={styles.lede}>
              <Text style={styles.ledeStrong}>{people}</Text> {people === 1 ? "person" : "people"} ·{" "}
              <Text style={styles.ledeStrong}>{community.links.length}</Text> {community.links.length === 1 ? "thread" : "threads"} ·{" "}
              <Text style={styles.ledeStrong}>{direct}</Text> close to you
            </Text>
            <Text style={styles.note}>
              {steps > 0
                ? `Everyone your threads reach is within ${steps} ${steps === 1 ? "step" : "steps"} of you.`
                : "Pass a wish on and your first thread starts here."}
            </Text>
          </View>

          <Globe graph={community} chains={chainKeys} selectedKey={selected} onSelect={select} onInteract={onGlobeTouch} />

          <View style={styles.legend}>
            <Legend swatch={<View style={[styles.legendDot, { backgroundColor: night.gold }]} />} label="You & your circle" />
            <Legend swatch={<View style={[styles.legendLine, { backgroundColor: night.thread }]} />} label="Came true" />
            <Legend swatch={<View style={[styles.legendLine, { backgroundColor: night.aqua, opacity: 0.5 }]} />} label="Wider world" />
          </View>
          {community.truncated ? <Text style={styles.note}>Showing part of the world. Distances reflect the threads shown.</Text> : null}
        </>
      ) : null}

      {selectedNode || sel ? (
        <Glass variant="dark" testID={sel ? `network-detail-${sel.name}` : "network-community-detail"} style={styles.card}>
          <View style={styles.row}>
            <LvAvatar name={detailName} size={44} ring />
            <View style={styles.flex}>
              <Text style={styles.detailName} numberOfLines={1}>{detailName}</Text>
              <Text style={styles.muted}>
                {distance === undefined ? "Not connected to you yet" : `${distance} ${distance === 1 ? "step" : "steps"} from you`}
              </Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={clearSelection} hitSlop={8}
              style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
              <Icon name="close" size={11} color={night.mutedFg} weight="bold" />
            </Pressable>
          </View>
          {route.length > 1 ? (
            <View style={styles.route}>
              {route.map((name, i) => (
                <View key={`${name}-${i}`} style={styles.routeStep}>
                  {i > 0 ? <View style={styles.routeDash} /> : null}
                  <Text style={[styles.routeName, (i === 0 || i === route.length - 1) && styles.routeEnd]}>{name}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {together.map((c) => (
            <Pressable key={c.wishId} accessibilityRole="button" onPress={() => openChain(c)} style={({ pressed }) => [styles.togetherRow, pressed && styles.pressed]}>
              <View style={[styles.legendLine, { backgroundColor: night.thread }]} />
              <Text style={[styles.body, styles.flex]} numberOfLines={2}>
                Came true together: “{c.text}”
              </Text>
              <Icon name="forward" size={12} color={night.mutedFg} />
            </Pressable>
          ))}
          {sel ? (
            <View style={styles.private}>
              <View style={styles.headRow}>
                <Text style={styles.eyebrow}>Your notes</Text>
                <Text style={styles.privateTag}>Private to you</Text>
              </View>
              {selLinks.map((l) => (
                <View key={l.edgeId} testID={`network-tag-${sel.name}-${l.tag}`} style={styles.tagRow}>
                  <View style={styles.flex}>
                    <Text style={styles.tag}>{l.tag}</Text>
                    {l.reason ? <Text style={styles.body}>“{l.reason}”</Text> : null}
                    <Text style={styles.footnote}>
                      {l.source === "daily" ? "From a daily wish" : "Picked by you"} · {new Date(l.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </Text>
                  </View>
                  <Pressable testID={`network-forget-tag-${sel.name}-${l.tag}`} accessibilityRole="button"
                    accessibilityLabel={`Forget ${l.tag} for ${sel.name}`}
                    onPress={() => void forgetEdge({ deviceId, edgeId: l.edgeId })}
                    style={({ pressed }) => [styles.forget, pressed && styles.pressed]}>
                    <Text style={styles.forgetText}>Forget</Text>
                  </Pressable>
                </View>
              ))}
              <Text style={styles.footnote}>Remembered from boats you’ve pushed. Yours to keep or forget.</Text>
            </View>
          ) : null}
        </Glass>
      ) : null}

      <View testID="world-came-true" style={styles.section}>
        <SectionHeader title="Wishes that came true" color={night.gold}
          right={chains?.length ? <Text style={styles.count}>{chains.length}</Text> : undefined} />
        {chains && chains.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip} style={styles.stripScroll}>
            {chains.map((c) => (
              <Polaroid
                key={c.wishId}
                testID={`chain-polaroid-${c.wishId}`}
                photoUrl={c.photoUrl}
                caption={c.text}
                sub={ROLE_LINE[c.role]}
                names={c.people.map((p) => p.name)}
                date={c.endedAt}
                width={STRIP_WIDTH}
                tilt={tiltFor(c.wishId)}
                onPress={() => openChain(c)}
                accessibilityLabel={`${c.text}. ${ROLE_LINE[c.role]}. ${routeLine(c)}. Open the chain and its photo.`}
              />
            ))}
          </ScrollView>
        ) : chains ? (
          <View style={styles.emptyStrip}>
            <Polaroid photoUrl={null} caption="Your first one is still out there" names={["?", "?"]} date={null} width={STRIP_WIDTH} tilt={-2.5} tape={false} />
            <Text style={[styles.note, styles.flex]}>
              When a wish you made, passed on or answered comes true, its photo lands here — the whole chain, from first hand to last.
            </Text>
          </View>
        ) : null}
      </View>

      {community ? (
        <View style={styles.section}>
          <View style={styles.search}>
            <Icon name="search" size={16} color={night.mutedFg} />
            <TextInput testID="network-search" accessibilityLabel="Find someone in the network"
              placeholder="Find someone in the world" placeholderTextColor="rgba(181,203,201,0.6)" selectionColor={night.gold}
              {...keyboardInputProps({})} returnKeyType="search"
              value={search} onChangeText={(value) => { setSearch(value); setSearchLimit(8); }} style={styles.searchInput} />
            {search ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={10} onPress={() => setSearch("")} style={styles.clear}>
                <Icon name="close" size={9} color={night.deep} weight="bold" />
              </Pressable>
            ) : null}
          </View>
          {search.trim() ? (
            <Glass variant="dark" style={styles.list}>
              {matches.slice(0, searchLimit).map((node, i) => (
                <Pressable key={node.key} accessibilityRole="button" accessibilityLabel={`Show ${node.name} on the globe`}
                  style={({ pressed }) => [styles.listRow, i > 0 && styles.divider, pressed && styles.rowPressed]}
                  onPress={() => { select(node.key); setSearch(""); }}>
                  <LvAvatar name={node.name} size={28} />
                  <Text style={[styles.name, styles.flex]} numberOfLines={1}>{node.name}</Text>
                  <Text style={styles.muted}>
                    {topology?.distances.has(node.key) ? `${topology.distances.get(node.key)} steps away` : "Wider world"}
                  </Text>
                </Pressable>
              ))}
              {!matches.length ? <Text style={[styles.note, styles.pad]}>No one by that name in the world shown.</Text> : null}
              {matches.length > searchLimit ? (
                <Pressable accessibilityRole="button" onPress={() => setSearchLimit((n) => n + 8)} style={[styles.listRow, styles.divider]}>
                  <Text style={styles.more}>Show more · {matches.length} matches</Text>
                </Pressable>
              ) : null}
            </Glass>
          ) : null}
        </View>
      ) : null}

      {coach ? <CoachProgress {...coach} /> : null}

      {nodes.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader title="Your saved connections" color={night.mutedFg} right={<Text style={styles.count}>{nodes.length}</Text>} />
          <Glass variant="dark" style={styles.list}>
            {nodes.map((p, i) => (
              <View key={p.personKey} style={[styles.savedRow, i > 0 && styles.divider, p.personKey === sel?.personKey && styles.rowSelected]}>
                <Pressable testID={`network-person-${p.name}`} accessibilityRole="button"
                  accessibilityLabel={`Explore ${p.name}, ${p.edgeCount} ${p.edgeCount === 1 ? "connection" : "connections"}`}
                  accessibilityState={{ selected: p.personKey === sel?.personKey }}
                  onPress={() => selectPerson(p.personKey)}
                  style={({ pressed }) => [styles.personButton, pressed && styles.pressed]}>
                  <LvAvatar name={p.name} size={36} />
                  <View style={styles.flex}>
                    <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
                    <Text style={styles.muted} numberOfLines={1}>{p.tags.join(" · ")}</Text>
                  </View>
                  <View style={styles.countPill}><Text style={styles.countPillText}>{p.edgeCount}</Text></View>
                </Pressable>
                <Pressable testID={`network-forget-${p.name}`} accessibilityRole="button" accessibilityLabel={`Forget ${p.name}`}
                  onPress={() => {
                    if (sel?.personKey === p.personKey) clearSelection();
                    void forget({ deviceId, personName: p.name });
                  }}
                  style={({ pressed }) => [styles.forget, pressed && styles.pressed]}>
                  <Text style={styles.forgetText}>Forget</Text>
                </Pressable>
              </View>
            ))}
          </Glass>
        </View>
      ) : null}
    </View>
  );
}

function Legend({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <View style={styles.legendItem}>
      {swatch}
      <Text style={styles.caption}>{label}</Text>
    </View>
  );
}

function CoachProgress({ ready, edgeCount, threshold }: { ready: boolean; edgeCount: number; threshold: number }) {
  const pct = Math.min(1, threshold > 0 ? edgeCount / threshold : 1);
  return (
    <Glass variant="dark" testID="coach-progress" style={styles.card}>
      <View style={styles.headRow}>
        <View style={styles.row}>
          <Icon name="sparkles" size={13} color={night.gold} />
          <Text style={styles.eyebrow}>AI coach</Text>
        </View>
        <Text style={[styles.muted, ready && styles.ready]}>{ready ? "Ready to help" : `${edgeCount} / ${threshold}`}</Text>
      </View>
      <Text style={styles.body}>
        {ready ? "Unlocked: your coach can suggest who to ask." : `${Math.max(0, threshold - edgeCount)} more connections to unlock your coach.`}
      </Text>
      <View accessibilityRole="progressbar" accessibilityLabel="AI coach progress"
        accessibilityValue={{ min: 0, max: threshold, now: Math.min(edgeCount, threshold) }} style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%` }]} />
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  group: { gap: layout.sectionGap },
  section: { gap: 12 },
  flex: { flex: 1, minWidth: 0 },
  pad: { padding: 14 },
  summary: { gap: 4, marginTop: -6 },
  lede: { ...type.subheadline, color: night.mutedFg, fontVariant: ["tabular-nums"] },
  ledeStrong: { color: night.fg, fontWeight: "600" },
  note: { ...type.footnote, color: night.mutedFg },
  caption: { ...type.caption1, color: night.mutedFg },
  muted: { ...type.footnote, color: night.mutedFg },
  body: { ...type.subheadline, color: night.fg },
  footnote: { ...type.caption1, color: night.mutedFg },
  name: { ...type.body, fontWeight: "500", color: night.fg },
  eyebrow: { ...type.eyebrow, color: night.gold },
  count: { ...type.footnote, fontWeight: "600", color: night.mutedFg },
  legend: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", columnGap: 16, rowGap: 6, marginTop: -12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLine: { width: 16, height: 2, borderRadius: 1 },
  card: { padding: layout.cardPadding, gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  detailName: { ...type.headline, color: night.fg },
  close: { width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  route: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", rowGap: 6 },
  routeStep: { flexDirection: "row", alignItems: "center" },
  routeDash: { width: 14, height: 2, borderRadius: 1, backgroundColor: night.gold, marginHorizontal: 6 },
  routeName: { ...type.footnote, color: night.mutedFg },
  routeEnd: { color: night.goldBright, fontWeight: "600" },
  togetherRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  private: { gap: 10, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderColor: night.border },
  privateTag: { ...type.caption1, color: night.mutedFg },
  tagRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  tag: { ...type.caption1, fontWeight: "600", color: night.gold, marginBottom: 2 },
  forget: { minHeight: 44, paddingHorizontal: 8, alignItems: "center", justifyContent: "center" },
  forgetText: { ...type.subheadline, color: night.mutedFg },
  strip: { gap: 18, paddingVertical: 16, paddingHorizontal: 6 },
  stripScroll: { marginHorizontal: -layout.margin, paddingHorizontal: layout.margin - 6 },
  emptyStrip: { flexDirection: "row", alignItems: "center", gap: 18, paddingVertical: 10, paddingLeft: 6 },
  search: {
    flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, borderRadius: 12, borderCurve: "continuous",
    backgroundColor: "rgba(255,255,255,0.08)", borderWidth: StyleSheet.hairlineWidth, borderColor: night.border, paddingHorizontal: 12,
  },
  searchInput: { flex: 1, ...type.body, color: night.fg, paddingVertical: 10, outlineWidth: 0 },
  clear: { width: 18, height: 18, borderRadius: 9, backgroundColor: night.mutedFg, alignItems: "center", justifyContent: "center" },
  list: { padding: 0, gap: 0 },
  listRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: night.border },
  rowPressed: { backgroundColor: "rgba(255,255,255,0.06)" },
  rowSelected: { backgroundColor: "rgba(233,199,102,0.12)" },
  more: { ...type.subheadline, fontWeight: "500", color: night.gold },
  savedRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: layout.cardPadding, paddingRight: 8 },
  personButton: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60 },
  countPill: { minWidth: 26, height: 22, paddingHorizontal: 7, borderRadius: 11, backgroundColor: "rgba(233,199,102,0.16)", alignItems: "center", justifyContent: "center" },
  countPillText: { ...type.caption1, fontWeight: "600", color: night.gold, fontVariant: ["tabular-nums"] },
  ready: { color: night.gold, fontWeight: "600" },
  track: { height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.12)", overflow: "hidden" },
  fill: { height: 6, borderRadius: 3, backgroundColor: night.gold },
  pressed: { opacity: 0.6 },
});
