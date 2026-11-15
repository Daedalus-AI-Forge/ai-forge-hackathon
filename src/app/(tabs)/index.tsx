import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/convex/_generated/api";
import { Pool } from "@/components/Pool";
import { Button, Muted } from "@/components/ui";
import { HelpCard } from "@/components/WishCard";
import { useMe } from "@/lib/device";
import { colors, mono } from "@/lib/theme";
import { countdown, rippleLine, useNow } from "@/lib/time";

export default function TheWell() {
  const router = useRouter();
  const { deviceId } = useMe();
  const home = useQuery(api.wishes.home, deviceId ? { deviceId } : "skip");
  const claimDemo = useMutation(api.users.claimDemo);
  const demoEnabled = useQuery(api.users.demoEnabled);
  const now = useNow();

  if (!home) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.red} />
      </View>
    );
  }
  const wish = home.activeWish;

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <ScrollView testID="well-screen" contentContainerStyle={styles.container}>
        <Text style={styles.brand}>Wishwell</Text>
        <Pool testID="well-pool" holders={wish?.holders ?? []} />
        {wish ? (
          <View style={styles.wishBlock}>
            <Text testID="well-wish-text" style={styles.wishText}>
              {wish.text}
            </Text>
            <Text testID="well-stats" style={styles.stats}>
              {rippleLine(wish.ripples, wish.holding, wish.expiresAt, now)}
            </Text>
            <Text testID="well-countdown" style={styles.countdown}>
              {countdown(wish.expiresAt, now)}
            </Text>
          </View>
        ) : (
          <View style={styles.wishBlock}>
            <Text style={styles.wishText}>The well is calm.</Text>
            <Muted style={{ textAlign: "center" }}>Toss a wish and watch it ripple through your friends.</Muted>
          </View>
        )}
        <Button testID="toss-button" title="Toss a wish" onPress={() => router.push("/toss")} />
        {demoEnabled && !wish && home.helpCards.length === 0 && deviceId ? (
          <Button
            testID="use-demo-profile"
            title="Try it with demo wishes"
            variant="ghost"
            onPress={() => void claimDemo({ deviceId })}
          />
        ) : null}
        {home.helpCards.length > 0 ? (
          <View style={{ gap: 12 }}>
            <Text style={styles.section}>Friends' wishes you can help</Text>
            {home.helpCards.map((c) => (
              <HelpCard key={c.hopId} hopId={c.hopId} creatorName={c.creatorName} text={c.text} depth={c.depth} expiresAt={c.expiresAt} />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.cream },
  container: { padding: 20, gap: 18, maxWidth: 430, width: "100%", alignSelf: "center", paddingBottom: 40 },
  brand: { fontSize: 22, fontWeight: "800", color: colors.red, textAlign: "center" },
  wishBlock: { alignItems: "center", gap: 6 },
  wishText: { fontSize: 20, fontWeight: "700", color: colors.ink, textAlign: "center", lineHeight: 26 },
  stats: { fontSize: 15, color: colors.muted, fontWeight: "600" },
  countdown: { fontFamily: mono, fontSize: 30, fontWeight: "800", color: colors.ink, letterSpacing: 1 },
  section: { fontSize: 18, fontWeight: "800", color: colors.ink },
});
