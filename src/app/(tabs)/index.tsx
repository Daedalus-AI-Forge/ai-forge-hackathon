import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/convex/_generated/api";
import { BranchRace } from "@/components/BranchRace";
import { glass } from "@/components/lv/home/glass";
import { BoatCard } from "@/components/lv/pool/BoatCard";
import { CoinsFloor, type PoolCoin } from "@/components/lv/pool/CoinsFloor";
import { ProgressDots } from "@/components/lv/pool/ProgressDots";
import { TodayBoatCard } from "@/components/lv/pool/TodayBoatCard";
import { VoyageLogCard, type VoyageLog } from "@/components/lv/pool/VoyageLogCard";
import { Water } from "@/components/lv/pool/Water";
import { SHELL_TAB_CLEARANCE } from "@/components/lv/shell/tabBarStyle";
import { Avatar, errorMessage } from "@/components/ui";
import { useMe } from "@/lib/device";
import { lv } from "@/theme/tokens";

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
        <ActivityIndicator color={lv.thread} />
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
      router.push({ pathname: "/w/[hopId]", params: { hopId: friends[0].hopId, start: "pass" } });
    } else {
      void openToday();
    }
  };

  const coins: PoolCoin[] = (mine ?? []).filter((w) => w.status === "traveling" || w.status === "found" || w.status === "granted").slice(0, 3);
  const raceCoin = (mine ?? []).find((w) => w.status === "traveling" || w.status === "found");
  const primary = friends.length > 0 || todayUnpushed ? "push" : wishesLeft > 0 ? "toss" : "none";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView testID="well-screen" contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={glass.eyebrow}>
              {wishesLeft} coin{wishesLeft === 1 ? "" : "s"} · {progress}/5 boats
            </Text>
            <Text style={styles.brand}>Wishwell</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Profile" onPress={() => router.push("/me")}>
            <Avatar name={user.name} color={user.avatar} size={36} />
          </Pressable>
        </View>

        {voyageLog && !logDismissed ? (
          <VoyageLogCard log={voyageLog as VoyageLog} onDismiss={() => void AsyncStorage.setItem(LOG_DISMISS_KEY, date).then(() => setLogDismissed(true))} />
        ) : null}

        <Water>
          {friends.map((c) => (
            <BoatCard
              key={c.hopId}
              hopId={c.hopId}
              creatorName={c.creatorName}
              text={c.text}
              depth={c.depth}
              expiresAt={c.expiresAt}
            />
          ))}
          {today ? <TodayBoatCard deviceId={deviceId} date={date} onOpen={(hopId) => router.push({ pathname: "/w/[hopId]", params: { hopId } })} /> : null}
        </Water>

        {coins.length > 0 ? <CoinsFloor coins={coins} /> : null}

        {raceCoin ? <BranchRace deviceId={deviceId} wishId={raceCoin._id} title="Your coin's branches racing" /> : null}
        {friends
          .filter((c) => c.branches > 1)
          .map((c) => (
            <BranchRace key={c.hopId} deviceId={deviceId} wishId={c._id} title={`${c.creatorName}'s branches racing`} />
          ))}

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
            <Pressable testID="primary-action" accessibilityRole="button" onPress={() => router.push("/toss")} style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}>
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
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: lv.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: lv.bg },
  container: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 20,
    maxWidth: 430,
    width: "100%",
    alignSelf: "center",
    paddingBottom: SHELL_TAB_CLEARANCE,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { fontSize: 34, fontWeight: "700", color: lv.fg, letterSpacing: -0.5, fontFamily: lv.font.display },
  primary: {
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
  primaryPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  primaryText: { color: lv.threadFg, fontSize: 17, fontWeight: "600" },
  done: { fontSize: 14, color: lv.mutedFg, textAlign: "center", paddingVertical: 14 },
  error: { color: lv.destructive, fontSize: 13, textAlign: "center" },
  demo: { alignItems: "center", paddingVertical: 8 },
  demoText: { color: lv.mutedFg, fontSize: 15, fontWeight: "600" },
});