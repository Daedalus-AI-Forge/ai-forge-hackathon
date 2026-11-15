import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/convex/_generated/api";
import { DailyRow } from "@/components/lv/home/DailyRow";
import { FriendWishCard } from "@/components/lv/home/FriendWishCard";
import { glass } from "@/components/lv/home/glass";
import { Well } from "@/components/lv/home/Well";
import { Avatar } from "@/components/ui";
import { useMe } from "@/lib/device";
import { countdown, rippleLine, useNow } from "@/lib/time";
import { lv } from "@/theme/tokens";

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
        <ActivityIndicator color={lv.thread} />
      </View>
    );
  }
  const wish = home.activeWish;
  const user = home.user;
  const credits = user.wishesLeft;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView testID="well-screen" contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={glass.eyebrow}>
              {credits} wish{credits === 1 ? "" : "es"} · {user.stars} ⭐
            </Text>
            <Text style={styles.brand}>Wishwell</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Profile" onPress={() => router.push("/me")}>
            <Avatar name={user.name} color={user.avatar} size={36} />
          </Pressable>
        </View>

        <View style={styles.wellBox}>
          <Well testID="well-pool" holders={wish?.holders ?? []} size={320} />
          {wish ? (
            <View style={[styles.wellCaption, glass.light]}>
              <Text testID="well-wish-text" style={styles.wishText} numberOfLines={1}>
                {wish.text}
              </Text>
              <Text testID="well-stats" style={styles.stats} numberOfLines={1}>
                {rippleLine(wish.ripples, wish.holding, wish.expiresAt, now)}
              </Text>
              <Text testID="well-countdown" style={styles.countdown}>
                {countdown(wish.expiresAt, now)}
              </Text>
            </View>
          ) : (
            <View style={[styles.wellCaption, styles.wellCaptionEmpty, glass.light]}>
              <Text style={styles.still}>The water is still. Make a wish.</Text>
            </View>
          )}
        </View>

        <Pressable
          testID="toss-button"
          accessibilityRole="button"
          onPress={() => router.push("/toss")}
          style={({ pressed }) => [styles.toss, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
        >
          <View style={styles.tossInner}>
            <View style={styles.tossCoin}>
              <View style={styles.tossCoinFace} />
            </View>
            <Text style={styles.tossText}>Toss a wish</Text>
          </View>
        </Pressable>
        {demoEnabled && !wish && home.helpCards.length === 0 && deviceId ? (
          <Pressable
            testID="use-demo-profile"
            accessibilityRole="button"
            onPress={() => void claimDemo({ deviceId })}
            style={styles.demo}
          >
            <Text style={styles.demoText}>Try it with demo wishes</Text>
          </Pressable>
        ) : null}

        {deviceId ? (
          <View style={[styles.group, glass.light]}>
            <DailyRow deviceId={deviceId} />
          </View>
        ) : null}

        {home.helpCards.length > 0 ? (
          <View style={{ gap: 12 }}>
            <Text style={[glass.eyebrow, { paddingHorizontal: 4 }]}>
              Help one step · {home.helpCards.length} waiting
            </Text>
            {home.helpCards.map((c) => (
              <FriendWishCard
                key={c.hopId}
                hopId={c.hopId}
                creatorName={c.creatorName}
                text={c.text}
                depth={c.depth}
                expiresAt={c.expiresAt}
                type={c.type}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: lv.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: lv.bg },
  container: { paddingHorizontal: 20, paddingTop: 16, gap: 20, maxWidth: 430, width: "100%", alignSelf: "center", paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { fontSize: 34, fontWeight: "700", color: lv.fg, letterSpacing: -0.5, fontFamily: lv.font.display },
  wellBox: { paddingTop: 8, paddingBottom: 12, alignItems: "center" },
  wellCaption: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: -12,
    borderRadius: lv.radius,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
  },
  wellCaptionEmpty: { left: 24, right: 24 },
  wishText: { fontSize: 15, fontWeight: "600", color: lv.fg },
  stats: { fontSize: 12, color: lv.mutedFg, marginTop: 2 },
  countdown: { fontFamily: lv.font.mono, fontSize: 18, fontWeight: "700", color: lv.fg, marginTop: 2, letterSpacing: 0.5 },
  still: { fontSize: 14, color: lv.mutedFg },
  toss: {
    marginTop: 16,
    height: 56,
    borderRadius: 999,
    backgroundColor: lv.thread,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: lv.thread,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  tossText: { color: lv.threadFg, fontSize: 17, fontWeight: "600" },
  tossInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  tossCoin: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: lv.gold,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  tossCoinFace: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: "rgba(28,25,21,0.3)" },
  demo: { alignItems: "center", paddingVertical: 8 },
  demoText: { color: lv.mutedFg, fontSize: 15, fontWeight: "600" },
  group: { borderRadius: 24, overflow: "hidden" },
});
