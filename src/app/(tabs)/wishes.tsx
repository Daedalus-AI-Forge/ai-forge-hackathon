import { useQuery } from "convex/react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/convex/_generated/api";
import { Card, Muted, Title } from "@/components/ui";
import { useMe } from "@/lib/device";
import { colors } from "@/lib/theme";
import { rippleLine, useNow } from "@/lib/time";

export default function MyWishes() {
  const { deviceId } = useMe();
  const wishes = useQuery(api.wishes.mine, deviceId ? { deviceId } : "skip");
  const now = useNow(30000);
  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <ScrollView testID="wishes-screen" contentContainerStyle={styles.container}>
        <Title>My wishes</Title>
        <Muted>The full wish tree, vouches and endings arrive in the next build.</Muted>
        {(wishes ?? []).map((w) => (
          <Card key={w._id}>
            <Text style={styles.status}>{w.status === "granted" ? "Wish granted" : w.status}</Text>
            <Text style={styles.text}>{w.text}</Text>
            <Muted>{rippleLine(w.ripples, w.holding, w.expiresAt, now)}</Muted>
          </Card>
        ))}
        {wishes && wishes.length === 0 ? <Muted>No wishes yet. Toss one into the well!</Muted> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 14, maxWidth: 430, width: "100%", alignSelf: "center" },
  status: { fontSize: 13, fontWeight: "800", color: colors.red, textTransform: "capitalize" },
  text: { fontSize: 17, fontWeight: "700", color: colors.ink },
});
