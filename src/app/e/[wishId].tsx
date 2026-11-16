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
import { DButton, DCard, Eyebrow, Sub } from "@/components/lv/passon/kit";
import { photoSource } from "@/components/lv/world/Polaroid";
import { copyLink } from "@/lib/links";
import { useDeviceId } from "@/lib/device";
import type { EndingView } from "@/lib/linkApi.types";
import { lv, polaroid, shadows, type } from "@/theme/tokens";

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
        <ActivityIndicator color={lv.tint} style={styles.loading} />
      ) : view === null ? (
        <View style={styles.missing} testID="ending-missing">
          <Text style={styles.h1}>We couldn't find this ending</Text>
          <Sub>The link may be incomplete, or the story isn't ready yet.</Sub>
        </View>
      ) : (
        <>
          <Eyebrow>{STATUS[view.status] ?? "A paper boat"}</Eyebrow>
          {/* Polaroid-style card: photo, wish, story */}
          <View testID="ending-card" style={styles.polaroid}>
            {view.photoUrl ? (
              <Image testID="ending-photo" source={photoSource(view.photoUrl)} style={styles.photo} resizeMode="cover" />
            ) : null}
            <Text style={styles.wish}>"{view.wishText}"</Text>
            <Text testID="ending-story" style={styles.story}>{view.story}</Text>
          </View>
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
  // A paper print on the night page: warm paper and dark ink, like the World tab's polaroids.
  polaroid: {
    backgroundColor: polaroid.paper,
    borderRadius: 10,
    borderCurve: "continuous",
    padding: 12,
    paddingBottom: 20,
    gap: 12,
    transform: [{ rotate: "-1deg" }],
    boxShadow: shadows.float,
  },
  photo: { width: "100%", aspectRatio: 1, borderRadius: 6, backgroundColor: polaroid.photoBg },
  wish: { ...type.title3, fontWeight: "700", color: polaroid.ink },
  story: { ...type.callout, color: polaroid.ink },
  route: { ...type.subheadline, color: lv.fg },
});
