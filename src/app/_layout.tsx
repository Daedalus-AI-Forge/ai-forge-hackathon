import { ConvexProvider } from "convex/react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import type { ReactNode } from "react";

import { convex } from "@/lib/convex";

function Providers({ children }: { children: ReactNode }) {
  if (!convex) return children;
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}

export default function RootLayout() {
  return (
    <Providers>
      <Stack>
        <Stack.Screen name="index" options={{ title: "Raincheck" }} />
      </Stack>
      <StatusBar style="auto" />
    </Providers>
  );
}
