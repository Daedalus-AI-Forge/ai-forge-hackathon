// The GRANTED reveal, in the World tab's print style: the meet-up photo develops as a polaroid with
// the wish in hand-lettering, then the thank-you line and story, the winning route of names and cities
// with "+1 star" on every helper between the wisher and the match, and Share. Wired to `link.ending`.
// While the ending is locked, the same print sits "developing…" until both people confirm a photo.
import * as Linking from "expo-linking";
import { useState } from "react";
import { Platform, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { Glass } from "@/components/ios";
import { endingShareText } from "@/components/link/end/logic";
import { DAvatar, DButton, DError, Sub } from "@/components/lv/passon/kit";
import { TIER_LABEL } from "@/components/lv/threads/threadData";
import { Polaroid, tiltFor } from "@/components/lv/world/Polaroid";
import type { EndingView } from "@/lib/linkApi.types";
import { shareLink } from "@/lib/links";
import { hopCount } from "@/lib/time";
import { layout, night, type } from "@/theme/tokens";

import { grantedStops, type GrantedStop } from "./meetLogic";

/** The print's width on a page: the chain page's size, so both endings look like the same photo. */
export function usePrintWidth() {
  const { width } = useWindowDimensions();
  return Math.min(Math.min(width, layout.maxWidth) - layout.margin * 2 - 28, 340);
}

/** Who stands in the photo: the wisher and the match, the first and last stop of the route. */
export function photoPair(ending: Pick<EndingView, "holders">) {
  const holders = ending.holders ?? [];
  return holders.length > 1 ? [holders[0]!, holders.at(-1)!] : [];
}

export function GrantedCard({
  ending,
  wishId,
  testID = "granted-card",
  photoTestID = "granted-photo",
  storyTestID = "granted-story",
  shareTestID = "granted-share",
}: {
  ending: EndingView;
  wishId: string;
  testID?: string;
  photoTestID?: string;
  storyTestID?: string;
  shareTestID?: string;
}) {
  const printWidth = usePrintWidth();
  const tilt = tiltFor(wishId, 2.2);

  if (ending.locked || ending.status !== "granted") {
    return (
      <View testID={`${testID}-locked`} style={styles.wrap} accessibilityRole="summary">
        <View style={styles.head}>
          <Text style={styles.eyebrow}>Found its person</Text>
          <Text style={styles.title}>Waiting to meet…</Text>
        </View>
        <View style={styles.print}>
          <Polaroid
            photoUrl={null}
            caption={ending.wishText}
            names={["?", "?"]}
            date={null}
            width={printWidth}
            tilt={tilt}
            accessibilityLabel="The photo from this wish is still developing"
          />
          <Text style={[styles.muted, styles.center]}>The ending develops once both of them confirm a photo together.</Text>
        </View>
      </View>
    );
  }

  const stops = grantedStops(ending.holders);
  const pair = photoPair(ending);
  const names = pair.map((p) => p.name).join(" & ");
  const city = pair.at(-1)?.city;
  const met = ending.metInPerson === true ? " · met in person" : ending.metInPerson === false ? " · met on a call" : "";
  return (
    <View testID={testID} style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.eyebrow}>Wish granted{ending.tier ? ` · ${TIER_LABEL[ending.tier]}` : ""}</Text>
        {names ? <Text style={styles.title}>{names}</Text> : null}
      </View>

      <View style={styles.print}>
        <Polaroid
          testID={ending.photoUrl ? photoTestID : undefined}
          photoUrl={ending.photoUrl}
          caption={ending.wishText}
          sub={names ? (city ? `${names} · ${city}` : names) : undefined}
          names={pair.length ? pair.map((p) => p.name) : ["?", "?"]}
          date={null}
          width={printWidth}
          tilt={tilt}
          accessibilityLabel={ending.photoUrl ? `Their meet-up photo: ${ending.wishText}` : "The photo from this wish"}
        />
      </View>

      <Glass variant="dark" style={styles.card}>
        {ending.thankYou ? (
          <Text testID="granted-thank-you" style={styles.quote}>
            “{ending.thankYou}”
          </Text>
        ) : null}
        <Text testID={storyTestID} style={ending.thankYou ? styles.muted : styles.story}>
          {ending.story}
        </Text>
      </Glass>

      <Glass variant="dark" style={styles.card}>
        <Text style={styles.label}>
          {hopCount(ending.ripples)}
          {met}
        </Text>
        {stops.length ? (
          <View testID="granted-route" style={styles.route} accessibilityLabel={`Route: ${stops.map((s) => s.name).join(", ")}`}>
            <RouteRows stops={stops} />
          </View>
        ) : null}
      </Glass>

      <EndingShareButton ending={ending} wishId={wishId} testID={shareTestID} />
    </View>
  );
}

/**
 * The people who carried the wish, evenly spaced on the red thread. Up to five share one row; a longer
 * route (at most seven) splits into two rows, so nobody lands alone on a line with a dangling dash.
 */
function RouteRows({ stops }: { stops: GrantedStop[] }) {
  const cols = stops.length <= 5 ? stops.length : Math.ceil(stops.length / 2);
  const col = 100 / cols;
  const rows: GrantedStop[][] = [];
  for (let i = 0; i < stops.length; i += cols) rows.push(stops.slice(i, i + cols));
  return rows.map((row, r) => (
    <View key={r} style={styles.routeRow}>
      {row.length > 1 ? <View style={[styles.thread, { left: `${col / 2}%`, right: `${100 - (row.length - 0.5) * col}%` }]} /> : null}
      {row.map((s) => (
        <View key={s.key} style={[styles.stop, { width: `${col}%` }]}>
          <DAvatar name={s.name} color={s.avatar} size={30} />
          <Text style={styles.stopName} numberOfLines={1}>
            {s.name}
          </Text>
          {s.city ? (
            <Text style={styles.stopCity} numberOfLines={1}>
              {s.city}
            </Text>
          ) : null}
          {s.star ? <Text style={styles.star}>+1 ★</Text> : null}
        </View>
      ))}
    </View>
  ));
}

function endingUrl(wishId: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") return `${window.location.origin}/e/${wishId}`;
  const base = process.env.EXPO_PUBLIC_WEB_URL;
  return base ? `${base.replace(/\/$/, "")}/e/${wishId}` : Linking.createURL(`/e/${wishId}`);
}

/** The ending's one primary action: the pool's gold capsule, on the night page like the chain page's. */
export function EndingShareButton({ ending, wishId, testID }: { ending: EndingView; wishId: string; testID: string }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (ending.locked) return null;

  async function share() {
    setNote("");
    setError(null);
    try {
      const result = await shareLink(endingShareText(ending, ""), endingUrl(wishId));
      if (result === "copied") setNote("Ending link copied.");
    } catch {
      setError("Couldn't share the ending. Try again.");
    }
  }

  return (
    <View style={styles.share}>
      <DButton testID={testID} variant="gold" size="lg" title="Share the story" icon="share" onPress={share} />
      {note ? <Sub style={styles.center}>{note}</Sub> : null}
      <DError error={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: layout.stackGap },
  head: { gap: 4 },
  eyebrow: { ...type.eyebrow, color: night.gold },
  title: { fontFamily: night.serif, fontSize: 32, lineHeight: 38, color: night.fg },
  print: { alignItems: "center", gap: 14, paddingVertical: 12 },
  center: { textAlign: "center" },
  muted: { ...type.footnote, color: night.mutedFg },
  card: { padding: layout.cardPadding, gap: 10 },
  quote: { fontFamily: night.serif, fontSize: 19, lineHeight: 26, color: night.fg },
  story: { ...type.callout, color: night.fg },
  label: { ...type.eyebrow, color: night.mutedFg },
  route: { gap: 14 },
  routeRow: { flexDirection: "row", alignItems: "flex-start" },
  // The red thread joins the people who carried it, as on the World globe and the chain list; it runs
  // behind the avatars from the first one's center to the last one's.
  thread: { position: "absolute", top: 14, height: 2, borderRadius: 1, backgroundColor: night.thread },
  stop: { alignItems: "center", gap: 2, paddingHorizontal: 2 },
  stopName: { ...type.caption1, fontWeight: "700", color: night.fg },
  stopCity: { ...type.caption2, color: night.mutedFg },
  star: { ...type.caption2, fontWeight: "700", color: night.gold },
  share: { gap: 6, marginTop: 4 },
});
