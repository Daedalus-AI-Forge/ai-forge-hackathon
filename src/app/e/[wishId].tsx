// Ending page (from the SMS link): photo, the two-sentence story, the route, share, get the app. No login.
import { useQuery } from "convex/react";
import { Stack, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import { useState } from "react";
import { ActivityIndicator, Image, Platform, Share, StyleSheet, Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import { Screen } from "@/components/ios";
import { GetTheApp } from "@/components/link/end/GetTheApp";
import { endingShareText, routeChain } from "@/components/link/end/logic";
import { GrantedCard } from "@/components/lv/meet/GrantedCard";
import { MeetForWish } from "@/components/lv/meet/MeetCard";
import { DButton, DCard, Eyebrow, Sub } from "@/components/lv/passon/kit";
import { copyLink } from "@/lib/links";
import { useDeviceId } from "@/lib/device";
import type { EndingView } from "@/lib/linkApi.types";
import { lv, shadows, type } from "@/theme/tokens";

const STATUS: Record<EndingView["status"], string> = {
  traveling: "Still drifting",
  found: "Found its person",
  granted: "Wish granted",
  faded: "Faded at sea",
};

function endingUrl(wishId: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") return `${window.location.origin}/e/${wishId}`;
  const base = process.env.EXPO_PUBLIC_WEB_URL;
  return base ? `${base.replace(/\/$/, "")}/e/${wishId}` : Linking.createURL(`/e/${wishId}`);
}

export default function EndingPage() {
  const { wishId } = useLocalSearchParams<{ wishId: string }>();
  const view = useQuery(api.link.ending, wishId ? { wishId } : "skip") as EndingView | null | undefined;
  const deviceId = useDeviceId();
  const [note, setNote] = useState<string | null>(null);
  // Real wishes end through the meet-up: locked while found, the GrantedCard reveal once granted.
  // Daily boats and other states keep the plain polaroid.
  const meetEnding = !!view && (view.status === "granted" || (view.status === "found" && view.locked));

  const share = async () => {
    if (!view || !wishId) return;
    const url = endingUrl(wishId);
    const message = endingShareText(view, url);
    try {
      if (Platform.OS === "web") {
        const nav = typeof navigator !== "undefined" ? (navigator as Navigator & { share?: (d: ShareData) => Promise<void> }) : null;
        if (nav?.share) await nav.share({ text: message, url });
        else {
          await copyLink(message);
          setNote("Copied — paste it anywhere.");
        }
      } else {
        await Share.share({ message });
      }
    } catch {
      // user cancelled the share sheet
    }
  };

  return (
    <Screen maxWidth={560}>
      <Stack.Screen options={{ headerShown: false, title: "How the wish ended" }} />
      {view === undefined ? (
        <ActivityIndicator color={lv.thread} style={styles.loading} />
      ) : view === null ? (
        <View style={styles.missing} testID="ending-missing">
          <Text style={styles.h1}>We couldn't find this ending</Text>
          <Sub>The link may be incomplete, or the story isn't ready yet.</Sub>
        </View>
      ) : (
        <>
          <Eyebrow>{STATUS[view.status] ?? "A paper boat"}</Eyebrow>
          {/* The meet-up step for the two participants while the ending is still locked. */}
          {view.locked ? <MeetForWish wishId={wishId} deviceId={deviceId} showEndingLink={false} /> : null}
          {meetEnding ? (
            <View testID="ending-card">
              <GrantedCard ending={view} photoTestID="ending-photo" />
              {view.status === "granted" && view.thankYou ? (
                <Text testID="ending-story" style={[styles.story, styles.storyAfter]}>{view.story}</Text>
              ) : null}
            </View>
          ) : (
          /* Polaroid-style card: photo, wish, story */
          <View testID="ending-card" style={styles.polaroid}>
            {view.photoUrl ? (
              <Image testID="ending-photo" source={{ uri: view.photoUrl }} style={styles.photo} resizeMode="cover" />
            ) : null}
            <Text style={styles.wish}>"{view.wishText}"</Text>
            <Text testID="ending-story" style={styles.story}>{view.story}</Text>
          </View>
          )}
          {view.route.length ? (
            <DCard testID="ending-route">
              <Eyebrow>Route · {view.ripples} hop{view.ripples === 1 ? "" : "s"}</Eyebrow>
              <Text style={styles.route}>{routeChain(view.route)}</Text>
            </DCard>
          ) : null}
          <DButton testID="ending-share" size="lg" title="Share" icon="share" onPress={share} />
          {note ? <Sub>{note}</Sub> : null}
          <GetTheApp deviceId={deviceId} title="Get the app — see where all your boats drifted" testID="ending-get-app" />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: 80 },
  missing: { gap: 10, marginTop: 40 },
  h1: { ...type.title1, color: lv.fg },
  polaroid: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderCurve: "continuous",
    padding: 12,
    paddingBottom: 20,
    gap: 12,
    transform: [{ rotate: "-1deg" }],
    boxShadow: shadows.float,
  },
  photo: { width: "100%", aspectRatio: 1, borderRadius: 6, backgroundColor: lv.muted },
  wish: { ...type.title3, fontWeight: "700", color: lv.fg },
  story: { ...type.callout, color: lv.fg },
  storyAfter: { marginTop: 14, paddingHorizontal: 4 },
  route: { ...type.subheadline, color: lv.fg },
});
