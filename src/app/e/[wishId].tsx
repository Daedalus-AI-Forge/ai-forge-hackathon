// Ending page (from the SMS link): photo, the two-sentence story, the route, share, get the app. No login.
import { useQuery } from "convex/react";
import { Stack, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import { Screen } from "@/components/ios";
import { GetTheApp } from "@/components/link/end/GetTheApp";
import { routeChain } from "@/components/link/end/logic";
import { EndingShareButton, GrantedCard } from "@/components/lv/meet/GrantedCard";
import { MeetForWish } from "@/components/lv/meet/MeetCard";
import { DCard, Eyebrow, Sub } from "@/components/lv/passon/kit";
import { photoSource } from "@/components/lv/world/Polaroid";
import { useDeviceId } from "@/lib/device";
import type { EndingView } from "@/lib/linkApi.types";
import { lv, polaroid, shadows, type } from "@/theme/tokens";

const STATUS: Record<EndingView["status"], string> = {
  traveling: "Still drifting",
  found: "Found its person",
  granted: "Wish granted",
  faded: "Faded at sea",
};

export default function EndingPage() {
  const { wishId } = useLocalSearchParams<{ wishId: string }>();
  const view = useQuery(api.link.ending, wishId ? { wishId } : "skip");
  const deviceId = useDeviceId();
  // Real wishes end through the meet-up: locked while found, the GrantedCard reveal once granted.
  // Daily boats and other states keep the plain polaroid.
  const meetEnding = !!view && (view.status === "granted" || (view.status === "found" && view.locked));

  return (
    <Screen maxWidth={560}>
      <Stack.Screen options={{ headerShown: false, title: "How the wish ended" }} />
      {view === undefined ? (
        <ActivityIndicator color={lv.tint} style={styles.loading} />
      ) : view === null ? (
        <View style={styles.missing} testID="ending-missing">
          <Text style={styles.h1}>We couldn’t find this ending</Text>
          <Sub>The link may be incomplete, or the story isn’t ready yet.</Sub>
        </View>
      ) : (
        <>
          <Eyebrow>{STATUS[view.status] ?? "A paper boat"}</Eyebrow>
          {/* The meet-up step for the two participants while the ending is still locked. */}
          {view.status === "found" && view.locked ? <MeetForWish wishId={wishId} deviceId={deviceId} showEndingLink={false} /> : null}
          {meetEnding ? (
            <View testID="ending-card">
              <GrantedCard ending={view} wishId={wishId} photoTestID="ending-photo" storyTestID="ending-story" shareTestID="ending-share" />
            </View>
          ) : (
            <View testID="ending-card" style={styles.polaroid}>
              {view.photoUrl ? (
                <Image testID="ending-photo" source={photoSource(view.photoUrl)} style={styles.photo} resizeMode="cover" />
              ) : null}
              <Text style={styles.wish}>“{view.wishText}”</Text>
              <Text testID="ending-story" style={styles.story}>{view.story}</Text>
            </View>
          )}
          {view.route.length ? (
            <DCard testID="ending-route">
              <Eyebrow>Route · {view.ripples} hop{view.ripples === 1 ? "" : "s"}</Eyebrow>
              <Text style={styles.route}>{routeChain(view.route)}</Text>
            </DCard>
          ) : null}
          {!meetEnding ? <EndingShareButton ending={view} wishId={wishId} testID="ending-share" /> : null}
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
