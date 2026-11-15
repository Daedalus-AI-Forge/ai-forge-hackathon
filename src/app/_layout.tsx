import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexProvider } from "convex/react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import type { ReactNode } from "react";
import { Platform, StyleSheet, Text } from "react-native";

import { CenterScreen } from "@/components/ios";
import { AUTH_ENABLED, AuthBridge, SessionAuth, authStorage } from "@/lib/auth";
import { convex } from "@/lib/convex";
import { lv, type } from "@/theme/tokens";

function Backend({ client, children }: { client: NonNullable<typeof convex>; children: ReactNode }) {
  if (!AUTH_ENABLED) return <ConvexProvider client={client}>{children}</ConvexProvider>;
  return (
    <ConvexAuthProvider client={client} storage={authStorage}>
      <SessionAuth client={client}>
        <AuthBridge />
        {children}
      </SessionAuth>
    </ConvexAuthProvider>
  );
}

const ios = Platform.OS === "ios";

/** Modal sheets get the native iOS frosted header; content scrolls under it. */
const modalHeader = {
  presentation: "modal",
  headerTransparent: ios,
  headerBlurEffect: ios ? "systemChromeMaterialLight" : undefined,
  headerStyle: ios ? undefined : { backgroundColor: lv.bg },
  headerTitleStyle: { fontWeight: "600", color: lv.fg },
} as const;

export default function RootLayout() {
  if (!convex) {
    return (
      <CenterScreen testID="convex-status">
        <Text style={styles.title}>Wishwell</Text>
        <Text style={styles.body}>Convex is not linked. Run npx convex dev to write EXPO_PUBLIC_CONVEX_URL.</Text>
      </CenterScreen>
    );
  }
  return (
    <Backend client={convex}>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: lv.bg },
          headerShadowVisible: false,
          headerStyle: { backgroundColor: lv.bg },
          headerTintColor: lv.thread,
          headerTitleStyle: { color: lv.fg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: "Wishwell" }} />
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="boat/[hopId]" options={{ headerShown: false }} />
        <Stack.Screen name="threads/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="toss" options={{ ...modalHeader, title: "Toss a coin" }} />
        <Stack.Screen name="sign-in" options={{ ...modalHeader, title: "Sign in" }} />
        <Stack.Screen name="revyl-auth" options={{ headerShown: false }} />
        <Stack.Screen name="w/[hopId]" options={{ headerShown: false, title: "A wish for you" }} />
        <Stack.Screen name="daily" options={{ headerShown: false, title: "Today's wish" }} />
      </Stack>
      <StatusBar style="dark" />
    </Backend>
  );
}

const styles = StyleSheet.create({
  title: { ...type.largeTitle, color: lv.thread },
  body: { ...type.callout, color: lv.mutedFg, textAlign: "center" },
});
