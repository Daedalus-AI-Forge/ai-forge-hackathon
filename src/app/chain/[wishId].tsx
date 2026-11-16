// One wish chain that came true and passed through me: its final photo as a polaroid, what the
// person who said "it's me" wrote, the route round the world, and everyone who carried it.
import { useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Share, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { api } from "@/convex/_generated/api";
import { BackButton, Glass, NavBar, Screen, SectionHeader } from "@/components/ios";
import { LvAvatar } from "@/components/lv/me/LvAvatar";
import { DButton } from "@/components/lv/passon/kit";
import { TIER_LABEL, totalKm, type Holder } from "@/components/lv/threads/threadData";
import { photoNames, ROLE_LINE, routeLine, type Chain } from "@/components/lv/world/chainText";
import { Polaroid, tiltFor } from "@/components/lv/world/Polaroid";
import { RouteGlobe, routeStops } from "@/components/lv/world/RouteGlobe";
import { WorldBackdrop } from "@/components/lv/world/WorldBackdrop";
import { useMe } from "@/lib/device";
import { layout, night, type } from "@/theme/tokens";

const INSET = 8;

function holdersOf(chain: Chain): Holder[] {
  return chain.people.map((p, i) => ({
    key: String(i),
    name: p.name,
    city: p.city,
    depth: i,
    avatar: "",
    acted: i === chain.people.length - 1 ? ("its_me" as const) : ("pass" as const),
  }));
}

function roleOf(chain: Chain, i: number) {
  if (i === chain.people.length - 1) return "Said “That’s me”";
  if (i === 0 && !chain.daily) return "Made the wish";
  return "Passed it on";
}

export default function ChainScreen() {
  const { wishId } = useLocalSearchParams<{ wishId: string }>();
  const router = useRouter();
  const { deviceId } = useMe();
  const { width } = useWindowDimensions();
  const chains = useQuery(api.chains.mine, deviceId ? { deviceId } : "skip");
  const chain = chains?.find((c) => c.wishId === wishId);

  const nav = (
    <NavBar
      left={
        <BackButton
          testID="chain-back"
          label="Back to the world"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/world"))}
        />
      }
    />
  );

  if (!chain) {
    return (
      <Screen testID="chain-screen" backdrop={<WorldBackdrop />} tone="night">
        <Stack.Screen options={{ headerShown: false }} />
        {nav}
        <Text style={styles.muted}>{chains === undefined ? "Loading…" : "This chain isn’t one of yours."}</Text>
      </Screen>
    );
  }

  const printWidth = Math.min(Math.min(width, layout.maxWidth) - layout.margin * 2 - 28, 340);
  const holders = holdersOf(chain);
  const hops = Math.max(1, chain.people.length - 1);
  const km = Math.round(totalKm(holders));
  const finder = chain.people.at(-1)!;
  const me = chain.people.find((p) => p.me);
  const voyage =
    chain.role === "wisher"
      ? () => router.push({ pathname: "/threads/[id]", params: { id: chain.wishId } })
      : chain.role === "passer" && chain.myHopId
        ? () => router.push({ pathname: "/boat/[hopId]", params: { hopId: chain.myHopId! } })
        : null;
  const share = async () => {
    try {
      await Share.share({ message: `“${chain.text}”\n${routeLine(chain).replace("You", me?.name ?? "me")}\nIt came true.` });
    } catch {
      // share sheet dismissed
    }
  };

  return (
    <Screen testID="chain-screen" backdrop={<WorldBackdrop />} tone="night">
      <Stack.Screen options={{ headerShown: false }} />
      {nav}

      <View style={styles.head}>
        <Text style={styles.eyebrow}>
          {ROLE_LINE[chain.role]}
          {chain.tier ? ` · ${TIER_LABEL[chain.tier]}` : ""}
        </Text>
        <Text style={styles.title}>{photoNames(chain).join(" & ")}</Text>
      </View>

      <View style={styles.print}>
        <Polaroid
          testID="chain-polaroid"
          photoUrl={chain.photoUrl}
          caption={chain.text}
          sub={finder.city ? `${photoNames(chain).join(" & ")} · ${finder.city}` : photoNames(chain).join(" & ")}
          names={chain.people.map((p) => p.name)}
          date={chain.endedAt}
          width={printWidth}
          tilt={tiltFor(chain.wishId, 2.2)}
          accessibilityLabel={chain.photoUrl ? `Photo from the end of the chain: ${chain.text}` : "The photo from this chain is still developing"}
        />
        {!chain.photoUrl ? <Text style={[styles.muted, styles.center]}>The photo from when you met lands here once it’s added.</Text> : null}
      </View>

      {chain.story ? (
        <Glass variant="dark" style={styles.card}>
          <Text style={styles.quote}>“{chain.story}”</Text>
          <Text style={styles.muted}>— {finder.me ? "you" : finder.name}, on saying “That’s me”</Text>
        </Glass>
      ) : null}

      <Glass variant="dark" testID="chain-route" style={styles.mapCard}>
        {routeStops(chain.people.map((p) => p.city)).length > 1 ? <RouteGlobe cities={chain.people.map((p) => p.city)} /> : null}
        <View style={styles.stats}>
          <Stat value={String(hops)} label={hops === 1 ? "Hop" : "Hops"} />
          <Stat value={km > 0 ? km.toLocaleString() : "—"} label="Km" divider />
          <Stat value={String(chain.people.length)} label="People" divider />
        </View>
      </Glass>

      <SectionHeader title="Everyone on the chain" color={night.mutedFg} />
      <Glass variant="dark" style={styles.card}>
        {chain.people.map((p, i) => (
          <View key={`${p.name}-${i}`} style={styles.row}>
            <View style={styles.rail}>
              <LvAvatar name={p.name} size={30} ring={p.me} />
              {i < chain.people.length - 1 ? <View style={styles.stem} /> : null}
            </View>
            <View style={[styles.rowBody, i < chain.people.length - 1 && styles.rowGap]}>
              <Text style={styles.name}>
                {p.me ? "You" : p.name}
                {p.city ? <Text style={styles.muted}> · {p.city}</Text> : null}
              </Text>
              <Text style={styles.muted}>{roleOf(chain, i)}</Text>
            </View>
          </View>
        ))}
      </Glass>

      <View style={styles.actions}>
        <DButton testID="chain-share" title="Share the story" icon="share" variant="gold" onPress={() => void share()} />
        {voyage ? <DButton testID="chain-voyage" title="See the full voyage" variant="plain" tone="night" onPress={voyage} /> : null}
      </View>
    </Screen>
  );
}

function Stat({ value, label, divider }: { value: string; label: string; divider?: boolean }) {
  return (
    <View style={[styles.stat, divider && styles.statDivider]}>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { gap: 4 },
  eyebrow: { ...type.eyebrow, color: night.gold },
  title: { fontFamily: night.serif, fontSize: 32, lineHeight: 38, color: night.fg },
  print: { alignItems: "center", gap: 14, paddingVertical: 12 },
  center: { textAlign: "center" },
  muted: { ...type.footnote, color: night.mutedFg },
  card: { padding: layout.cardPadding, gap: 8 },
  quote: { fontFamily: night.serif, fontSize: 19, lineHeight: 26, color: night.fg },
  mapCard: { padding: INSET, gap: 0 },
  stats: { flexDirection: "row", paddingTop: 14, paddingBottom: 8 },
  stat: { flex: 1, alignItems: "center", gap: 2, paddingHorizontal: 4 },
  statDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderColor: night.border },
  statValue: { ...type.title2, color: night.fg, fontVariant: ["tabular-nums"] },
  statLabel: { ...type.eyebrow, color: night.mutedFg },
  row: { flexDirection: "row", gap: 12 },
  rail: { width: 30, alignItems: "center" },
  stem: { width: 2, flex: 1, minHeight: 12, marginVertical: 3, borderRadius: 1, backgroundColor: night.thread },
  rowBody: { flex: 1, paddingTop: 4, gap: 1 },
  rowGap: { paddingBottom: 14 },
  name: { ...type.subheadline, fontWeight: "600", color: night.fg },
  actions: { gap: 8 },
});
