// Ending page (from the SMS link): photo, the two-sentence story, the route, share, get the app. No login.
import { useQuery } from "convex/react";
import { Stack, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import { useState } from "react";
import { ActivityIndicator, Image, Platform, ScrollView, Share, Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import { GetTheApp } from "@/components/link/end/GetTheApp";
import { endingShareText, routeChain } from "@/components/link/end/logic";
import { DButton, DCard, Eyebrow, Sub } from "@/components/lv/passon/kit";
import { copyLink } from "@/lib/links";
import { useDeviceId } from "@/lib/device";
import type { EndingView } from "@/lib/linkApi.types";
import { lv } from "@/theme/tokens";

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
    <ScrollView style={{ flex: 1, backgroundColor: lv.bg }} contentContainerStyle={{ padding: 20, gap: 16, maxWidth: 560, width: "100%", alignSelf: "center" }}>
      <Stack.Screen options={{ headerShown: false, title: "How the wish ended" }} />
      {view === undefined ? (
        <ActivityIndicator color={lv.fg} style={{ marginTop: 80 }} />
      ) : view === null ? (
        <View style={{ gap: 10, marginTop: 40 }} testID="ending-missing">
          <Text style={{ fontSize: 26, fontWeight: "700", color: lv.fg }}>We couldn't find this ending</Text>
          <Sub>The link may be incomplete, or the story isn't ready yet.</Sub>
        </View>
      ) : (
        <>
          <Eyebrow>{STATUS[view.status] ?? "A paper boat"}</Eyebrow>
          {/* Polaroid-style card: photo, wish, story */}
          <DCard testID="ending-card" style={{ padding: 12, paddingBottom: 20, transform: [{ rotate: "-1deg" }] }}>
            {view.photoUrl ? (
              <Image testID="ending-photo" source={{ uri: view.photoUrl }} style={{ width: "100%", aspectRatio: 1, borderRadius: 10, backgroundColor: lv.muted }} resizeMode="cover" />
            ) : null}
            <Text style={{ fontSize: 20, fontWeight: "700", color: lv.fg }}>"{view.wishText}"</Text>
            <Text testID="ending-story" style={{ fontSize: 16, color: lv.fg, lineHeight: 23 }}>{view.story}</Text>
          </DCard>
          {view.route.length ? (
            <DCard testID="ending-route">
              <Eyebrow>Route · {view.ripples} hop{view.ripples === 1 ? "" : "s"}</Eyebrow>
              <Text style={{ fontSize: 15, color: lv.fg, lineHeight: 22 }}>{routeChain(view.route)}</Text>
            </DCard>
          ) : null}
          <DButton testID="ending-share" size="lg" title="Share" onPress={share} />
          {note ? <Sub>{note}</Sub> : null}
          <GetTheApp deviceId={deviceId} title="Get the app — see where all your boats drifted" testID="ending-get-app" />
        </>
      )}
    </ScrollView>
  );
}
