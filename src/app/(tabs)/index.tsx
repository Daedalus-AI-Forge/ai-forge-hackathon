import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery } from "convex/react";
import { useFocusEffect, useRouter } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ImageBackground, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/convex/_generated/api";
import { BoatCard } from "@/components/lv/pool/BoatCard";
import { CoinsFloor, type PoolCoin } from "@/components/lv/pool/CoinsFloor";
import { ProgressDots } from "@/components/lv/pool/ProgressDots";
import { TodayBoatCard } from "@/components/lv/pool/TodayBoatCard";
import { VoyageLogCard, type VoyageLog } from "@/components/lv/pool/VoyageLogCard";
import { NightPool } from "@/components/lv/pool/NightPool";
import { SHELL_TAB_CLEARANCE } from "@/components/lv/shell/tabBarStyle";
import { Avatar, errorMessage } from "@/components/ui";
import { useMe } from "@/lib/device";
import { night, poolImages } from "@/theme/tokens";

const ONBOARDED_KEY = "wishwell.onboarded";
const LOG_DISMISS_KEY = "wishwell.logDismissed";

export default function ThePool() {
  const router = useRouter();
  const { deviceId } = useMe();
  const home = useQuery(api.wishes.home, deviceId ? { deviceId } : "skip");
  const mine = useQuery(api.wishes.mine, deviceId ? { deviceId } : "skip");
  const claimDemo = useMutation(api.users.claimDemo);
  const demoEnabled = useQuery(api.users.demoEnabled);
  const join = useMutation(api.daily.join);
  const [date] = useState(() => new Date().toISOString().slice(0, 10));
  const today = useQuery(api.daily.today, deviceId ? { deviceId, date } : "skip");
  const voyageLog = useQuery(api.pool.voyageLog, deviceId ? { deviceId, date } : "skip");
  const [logDismissed, setLogDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const poolSize = Math.min(width, 430) - 40 - 16 - 24;

  // The pool is a night scene: light status bar while it is on screen, the app default elsewhere.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle("light");
      return () => setStatusBarStyle("dark");
    }, []),
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const onboarded = await AsyncStorage.getItem(ONBOARDED_KEY);
        if (!cancelled && onboarded !== "1") router.replace("/welcome");
      } catch {
        // First-open redirect is best-effort: the pool still works without it.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(LOG_DISMISS_KEY);
        if (!cancelled) setLogDismissed(stored === date);
      } catch {
        // Dismissal is a nicety; a fresh read failure just shows the card.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [date]);

  if (!home || !deviceId) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={night.gold} />
      </View>
    );
  }

  const user = home.user;
  const wishesLeft = user.wishesLeft;
  const progress = user.boatProgress ?? 0;
  const friends = home.helpCards;
  const todayUnpushed = !!today && today.open && today.passedTo === 0;

  const openToday = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const hopId = today?.hopId ?? (await join({ deviceId }));
      router.push({ pathname: "/w/[hopId]", params: { hopId } });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const pushBoat = () => {
    if (busy) return;
    if (friends.length > 0) {
      router.push({
        pathname: "/w/[hopId]",
        params: { hopId: friends[0].hopId, start: "pass" },
      });
    } else {
      void openToday();
    }
  };

  const coins: PoolCoin[] = (mine ?? [])
    .filter((w) => w.status === "traveling" || w.status === "found" || w.status === "granted")
    .slice(0, 3);
  const primary = friends.length > 0 || todayUnpushed ? "push" : wishesLeft > 0 ? "toss" : "none";

  return (
    <View style={styles.root}>
      <ImageBackground source={poolImages.fountain} style={StyleSheet.absoluteFill} resizeMode="cover" imageStyle={styles.fountain}>
        <View style={[StyleSheet.absoluteFill, styles.dim]} />
        <View style={styles.scrimTop} />
      </ImageBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView testID="well-screen" contentContainerStyle={styles.container}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>
                {wishesLeft} coin{wishesLeft === 1 ? "" : "s"} · {progress}/5 boats
              </Text>
              <Text style={styles.brand}>Wishwell</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Profile" onPress={() => router.push("/me")}>
              <Avatar name={user.name} color={user.avatar} size={36} />
            </Pressable>
          </View>

          {voyageLog && !logDismissed ? (
            <VoyageLogCard
              log={voyageLog as VoyageLog}
              onDismiss={() => void AsyncStorage.setItem(LOG_DISMISS_KEY, date).then(() => setLogDismissed(true))}
            />
          ) : null}

          <NightPool size={poolSize} coins={coins.length} />

          <View style={styles.boats}>
            {friends.map((c) => (
              <BoatCard key={c.hopId} hopId={c.hopId} creatorName={c.creatorName} text={c.text} depth={c.depth} expiresAt={c.expiresAt} />
            ))}
            {today ? (
              <TodayBoatCard
                deviceId={deviceId}
                date={date}
                onOpen={(hopId) => router.push({ pathname: "/w/[hopId]", params: { hopId } })}
              />
            ) : null}
          </View>

          {coins.length > 0 ? <CoinsFloor coins={coins} /> : null}

          <ProgressDots progress={progress} wishesLeft={wishesLeft} />

          {primary === "push" ? (
            <Pressable
              testID="primary-action"
              accessibilityRole="button"
              disabled={busy}
              onPress={pushBoat}
              style={({ pressed }) => [styles.primary, (pressed || busy) && styles.primaryPressed]}
            >
              <Text style={styles.primaryText}>{busy ? "Opening…" : "Push today's boat"}</Text>
            </Pressable>
          ) : primary === "toss" ? (
            <View testID="toss-button">
              <Pressable
                testID="primary-action"
                accessibilityRole="button"
                onPress={() => router.push("/toss")}
                style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}
              >
                <Text style={styles.primaryText}>Toss a coin</Text>
              </Pressable>
            </View>
          ) : (
            <Text testID="pool-done" style={styles.done}>
              Come back tomorrow morning for your voyage log
            </Text>
          )}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {demoEnabled && friends.length === 0 && deviceId ? (
            <Pressable
              testID="use-demo-profile"
              accessibilityRole="button"
              onPress={() => void claimDemo({ deviceId })}
              style={styles.demo}
            >
              <Text style={styles.demoText}>Try it with demo wishes</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: night.deep },
  fountain: { opacity: 0.55, width: "100%", height: "100%" },
  dim: { backgroundColor: "rgba(7,20,26,0.5)" },
  scrimTop: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 180,
    backgroundColor: "rgba(7,20,26,0.35)",
  },
  safe: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: night.deep,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 20,
    maxWidth: 430,
    width: "100%",
    alignSelf: "center",
    paddingBottom: SHELL_TAB_CLEARANCE,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  eyebrow: { fontSize: 13, color: night.mutedFg, letterSpacing: 0.2 },
  brand: {
    fontSize: 46,
    lineHeight: 52,
    color: night.fg,
    fontFamily: night.serif,
    textShadowColor: "rgba(233,199,102,0.55)",
    textShadowRadius: 18,
    textShadowOffset: { width: 0, height: 0 },
  },
  boats: { gap: 14 },
  primary: {
    height: 56,
    borderRadius: 999,
    backgroundColor: night.gold,
    borderWidth: 1,
    borderColor: night.goldBright,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: night.gold,
    shadowOpacity: 0.55,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  primaryPressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  primaryText: { color: night.goldFg, fontSize: 18, fontWeight: "600" },
  done: {
    fontSize: 15,
    color: night.mutedFg,
    textAlign: "center",
    paddingVertical: 14,
    fontFamily: night.serif,
  },
  error: { color: "#FF8A80", fontSize: 13, textAlign: "center" },
  demo: { alignItems: "center", paddingVertical: 8 },
  demoText: { color: night.mutedFg, fontSize: 15, fontWeight: "600" },
});
