import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import { CenterScreen, LargeTitle, Screen } from "@/components/ios";
import { DButton } from "@/components/lv/passon/kit";
import { BoatCard } from "@/components/lv/pool/BoatCard";
import { CoinsFloor, type PoolCoin } from "@/components/lv/pool/CoinsFloor";
import { ProgressDots } from "@/components/lv/pool/ProgressDots";
import { TodayBoatCard } from "@/components/lv/pool/TodayBoatCard";
import { VoyageLogCard, type VoyageLog } from "@/components/lv/pool/VoyageLogCard";
import { Water } from "@/components/lv/pool/Water";
import { Avatar, errorMessage } from "@/components/ui";
import { useMe } from "@/lib/device";
import { lv, type } from "@/theme/tokens";

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

  if (!home || !deviceId) return <CenterScreen />;

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
  const primary = friends.length > 0 || todayUnpushed ? "push" : wishesLeft > 0 ? "toss" : "none";

  return (
    <Screen tab testID="well-screen">
      <LargeTitle
        eyebrow={`${wishesLeft} coin${wishesLeft === 1 ? "" : "s"} · ${progress}/5 boats`}
        title="Wishwell"
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Profile"
            onPress={() => router.push("/me")}
            hitSlop={8}
            style={({ pressed }) => [styles.avatar, pressed && { transform: [{ scale: 0.94 }] }]}
          >
            <Avatar name={user.name} color={user.avatar} size={40} />
          </Pressable>
        }
      />

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

      <ProgressDots progress={progress} wishesLeft={wishesLeft} />

      {primary === "push" ? (
        <DButton testID="primary-action" title="Push today's boat" size="lg" busy={busy} onPress={pushBoat} />
      ) : primary === "toss" ? (
        <View testID="toss-button">
          <DButton testID="primary-action" title="Toss a coin" size="lg" onPress={() => router.push("/toss")} />
        </View>
      ) : (
        <Text testID="pool-done" style={styles.done}>
          Come back tomorrow morning for your voyage log
        </Text>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {demoEnabled && friends.length === 0 && deviceId ? (
        <DButton
          testID="use-demo-profile"
          title="Try it with demo wishes"
          variant="plain"
          size="sm"
          style={styles.demo}
          onPress={() => void claimDemo({ deviceId })}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatar: { borderRadius: 999, boxShadow: "0px 4px 12px rgba(28,24,20,0.14)" },
  done: { ...type.footnote, color: lv.mutedFg, textAlign: "center", paddingVertical: 14 },
  error: { ...type.footnote, color: lv.destructive, textAlign: "center" },
  demo: { alignSelf: "center" },
});
