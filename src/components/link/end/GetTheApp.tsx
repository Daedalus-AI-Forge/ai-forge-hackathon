// Non-blocking "Get the app" prompt for the link page. Never gates a core step.
import { useMutation } from "convex/react";
import * as Linking from "expo-linking";
import { Platform } from "react-native";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { DButton } from "@/components/lv/passon/kit";

const APP_URL = process.env.EXPO_PUBLIC_APP_URL;

export function GetTheApp({ title = "Get the app", deviceId, hopId, testID = "get-the-app" }: { title?: string; deviceId: string | null; hopId?: string; testID?: string }) {
  const track = useMutation(api.linkMetrics.track);
  const onPress = () => {
    if (deviceId) {
      void track({ deviceId, event: "download_click", ...(hopId ? { hopId: hopId as Id<"hops"> } : {}) }).catch(() => {});
    }
    if (!APP_URL) return;
    if (Platform.OS === "web" && typeof window !== "undefined") window.open(APP_URL, "_blank", "noopener");
    else void Linking.openURL(APP_URL).catch(() => {});
  };
  return <DButton testID={testID} variant="ghost" title={title} onPress={onPress} />;
}
