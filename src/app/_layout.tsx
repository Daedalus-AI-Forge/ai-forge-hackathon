import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexProvider } from "convex/react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AUTH_ENABLED, AuthBridge, SessionAuth, authStorage } from "@/lib/auth";
import { convex } from "@/lib/convex";
import { colors } from "@/lib/theme";
import { lv } from "@/theme/tokens";
import { KeyboardDoneBar } from "@/components/keyboard";

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

export default function RootLayout() {
  if (!convex) {
    return (
      <View testID="convex-status" style={styles.notLinked}>
        <Text style={styles.title}>Wishwell</Text>
        <Text style={styles.body}>Convex is not linked. Run npx convex dev to write EXPO_PUBLIC_CONVEX_URL.</Text>
      </View>
    );
  }
  return (
    <Backend client={convex}>
      <Stack screenOptions={{ contentStyle: { backgroundColor: lv.bg }, headerShadowVisible: false, headerStyle: { backgroundColor: lv.bg }, headerTintColor: lv.fg }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: "Wishwell" }} />
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="boat/[hopId]" options={{ headerShown: false }} />
        <Stack.Screen name="toss" options={{ presentation: "modal", title: "Toss a coin" }} />
        <Stack.Screen name="sign-in" options={{ presentation: "modal", title: "Sign in" }} />
        <Stack.Screen name="revyl-auth" options={{ headerShown: false }} />
        <Stack.Screen name="w/[hopId]" options={{ headerShown: false, title: "A wish for you" }} />
        <Stack.Screen name="daily" options={{ headerShown: false, title: "Today's wish" }} />
      </Stack>
      <StatusBar style="dark" />
      <KeyboardDoneBar />
    </Backend>
  );
}

const styles = StyleSheet.create({
  notLinked: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 24, backgroundColor: lv.bg },
  title: { fontSize: 32, fontWeight: "800", color: colors.red },
  body: { fontSize: 16, color: colors.muted, textAlign: "center" },
});
