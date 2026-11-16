// Ending page (from the SMS link, or "See the ending" in the app): the photo as a polaroid, the story,
// the route, share, get the app. No login.
import { useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import { BackButton, Glass, NavBar, Screen } from "@/components/ios";
import { GetTheApp } from "@/components/link/end/GetTheApp";
import { routeChain } from "@/components/link/end/logic";
import { EndingShareButton, GrantedCard, usePrintWidth } from "@/components/lv/meet/GrantedCard";
import { MeetForWish } from "@/components/lv/meet/MeetCard";
import { DCard, Eyebrow, Sub } from "@/components/lv/passon/kit";
import { Polaroid, tiltFor } from "@/components/lv/world/Polaroid";
import { useDeviceId } from "@/lib/device";
import type { EndingView } from "@/lib/linkApi.types";
import { layout, lv, night, type } from "@/theme/tokens";

const STATUS: Record<EndingView["status"], string> = {
  traveling: "Still drifting",
  found: "Found its person",
  granted: "Wish granted",
  faded: "Faded at sea",
};

export default function EndingPage() {
  const { wishId } = useLocalSearchParams<{ wishId: string }>();
  const router = useRouter();
  const view = useQuery(api.link.ending, wishId ? { wishId } : "skip");
  const deviceId = useDeviceId();
  const printWidth = usePrintWidth();
  // Real wishes end through the meet-up: locked while found, the GrantedCard reveal once granted.
  // Daily boats and other states keep the plain print.
  const meetEnding = !!view && (view.status === "granted" || (view.status === "found" && view.locked));
  // Opened from inside the app (Voyages, a boat, a claim): a way back. A cold SMS link has nowhere to go back to.
  const canGoBack = router.canGoBack();

  return (
    <Screen maxWidth={560}>
      <Stack.Screen options={{ headerShown: false, title: "How the wish ended" }} />
      {canGoBack ? <NavBar left={<BackButton testID="ending-back" onPress={() => router.back()} />} /> : null}
      {view === undefined ? (
        <ActivityIndicator color={lv.tint} style={styles.loading} />
      ) : view === null ? (
        <View style={styles.missing} testID="ending-missing">
          <Text style={styles.h1}>We couldn’t find this ending</Text>
          <Sub>The link may be incomplete, or the story isn’t ready yet.</Sub>
        </View>
      ) : (
        <>
          {/* The meet-up step for the two participants while the ending is still locked. */}
          {view.status === "found" && view.locked ? <MeetForWish wishId={wishId} deviceId={deviceId} showEndingLink={false} /> : null}
          {meetEnding ? (
            <View testID="ending-card">
              <GrantedCard ending={view} wishId={wishId} photoTestID="ending-photo" storyTestID="ending-story" shareTestID="ending-share" />
            </View>
          ) : (
            <>
              <Eyebrow style={styles.status}>{STATUS[view.status] ?? "A paper boat"}</Eyebrow>
              <View testID="ending-card" style={styles.ending}>
                {view.photoUrl ? (
                  <View style={styles.print}>
                    <Polaroid
                      testID="ending-photo"
                      photoUrl={view.photoUrl}
                      caption={view.wishText}
                      names={["?", "?"]}
                      date={null}
                      width={printWidth}
                      tilt={tiltFor(wishId, 2.2)}
                      accessibilityLabel={`Photo from the end of the voyage: ${view.wishText}`}
                    />
                  </View>
                ) : null}
                <Glass variant="dark" style={styles.card}>
                  {view.photoUrl ? null : <Text style={styles.wish}>“{view.wishText}”</Text>}
                  <Text testID="ending-story" style={styles.story}>
                    {view.story}
                  </Text>
                </Glass>
              </View>
            </>
          )}
          {view.route.length && !meetEnding ? (
            <DCard testID="ending-route">
              <Eyebrow>Route · {view.ripples} hop{view.ripples === 1 ? "" : "s"}</Eyebrow>
              <Text style={styles.route}>{routeChain(view.route)}</Text>
            </DCard>
          ) : null}
          {!meetEnding ? <EndingShareButton ending={view} wishId={wishId} testID="ending-share" /> : null}
          {/* Someone reading this in the app already has it. */}
          {Platform.OS === "web" ? (
            <View style={styles.getApp}>
              <Sub style={styles.center}>See where all your boats drifted.</Sub>
              <GetTheApp deviceId={deviceId} title="Get the app" testID="ending-get-app" />
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: 80 },
  missing: { gap: 10, marginTop: 40 },
  h1: { ...type.title1, color: lv.fg },
  status: { color: night.gold },
  ending: { gap: layout.stackGap },
  print: { alignItems: "center", paddingVertical: 12 },
  card: { padding: layout.cardPadding, gap: 10 },
  wish: { fontFamily: night.serif, fontSize: 22, lineHeight: 29, color: night.fg },
  story: { ...type.callout, color: night.fg },
  route: { ...type.subheadline, color: lv.fg },
  getApp: { gap: 8, marginTop: 8 },
  center: { textAlign: "center" },
});
