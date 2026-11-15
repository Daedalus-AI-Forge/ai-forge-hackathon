import { useConvexConnectionState } from "convex/react";
import { StyleSheet, Text, View } from "react-native";

import { convex } from "@/lib/convex";

function ConvexStatus() {
  const { isWebSocketConnected } = useConvexConnectionState();
  return (
    <Text testID="convex-status" style={styles.status}>
      Convex: {isWebSocketConnected ? "connected" : "connecting…"}
    </Text>
  );
}

export default function Home() {
  return (
    <View testID="home-screen" style={styles.container}>
      <Text style={styles.title}>Raincheck</Text>
      <Text style={styles.subtitle}>App skeleton is running.</Text>
      {convex ? (
        <ConvexStatus />
      ) : (
        <Text testID="convex-status" style={styles.status}>
          Convex: not linked (run npx convex dev)
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 24 },
  title: { fontSize: 32, fontWeight: "700" },
  subtitle: { fontSize: 16, opacity: 0.7 },
  status: { fontSize: 14, marginTop: 16 },
});
