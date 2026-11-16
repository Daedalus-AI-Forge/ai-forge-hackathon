import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, ImageBackground, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { api } from "@/convex/_generated/api";
import { CenterScreen, Glass, Icon, LargeTitle, Screen, TAB_BAR_HEIGHT, tabBarBottom } from "@/components/ios";
import { FountainScene } from "@/components/lv/fountain/FountainScene";
import { DIVE_MS, diveMemory } from "@/components/lv/fountain/logic";
import { DButton } from "@/components/lv/passon/kit";
import { BoatCard } from "@/components/lv/pool/BoatCard";
import { CoinsFloor, type PoolCoin } from "@/components/lv/pool/CoinsFloor";
import { ProgressDots } from "@/components/lv/pool/ProgressDots";
import { TodayBoatCard } from "@/components/lv/pool/TodayBoatCard";
import { VoyageLogCard, type VoyageLog } from "@/components/lv/pool/VoyageLogCard";
import { NightPool, useReduceMotion, type PoolToss } from "@/components/lv/pool/NightPool";
import { TossSheet } from "@/components/lv/pool/TossSheet";
import { WishComposer } from "@/components/lv/pool/WishComposer";
import { tossToast } from "@/lib/tossWish";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar, errorMessage } from "@/components/ui";
import { useMe } from "@/lib/device";
import { layout, night, poolImages, type } from "@/theme/tokens";

const ONBOARDED_KEY = "wishwell.onboarded";
const LOG_DISMISS_KEY = "wishwell.logDismissed";
const useNativeDriver = Platform.OS !== "web";
const DIVE_EASE = Easing.bezier(0.65, 0, 0.25, 1);

type Phase = "fountain" | "diving" | "pool";

function tween(v: Animated.Value, toValue: number, duration: number, easing = Easing.inOut(Easing.ease)) {
  return Animated.timing(v, { toValue, duration, easing, useNativeDriver });
}

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
  const poolSize = Math.min(width, layout.maxWidth) - layout.margin * 2 - 16 - 24;

  // Katie-Lan's prototype opens on the fountain, then dives into the pool. A dive is remembered for
  // the session (diveMemory), so coming back to the tab lands in the pool until the app restarts.
  const still = useReduceMotion();
  const [phase, setPhase] = useState<Phase>(() => (diveMemory.dived() ? "pool" : "fountain"));
  const [zoom] = useState(() => new Animated.Value(diveMemory.dived() ? 1 : 0));
  const [ui] = useState(() => new Animated.Value(diveMemory.dived() ? 0 : 1));
  const [flash] = useState(() => new Animated.Value(0));
  const [poolIn] = useState(() => new Animated.Value(diveMemory.dived() ? 1 : 0));
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  // Tossing happens in the pool (Katie-Lan's design): the composer shows after a "toss" dive or the
  // pool's own Toss button; a coin sinks, a toast confirms, then the sheet picks who it reaches first.
  const insets = useSafeAreaInsets();
  const [composing, setComposing] = useState(false);
  const [wish, setWish] = useState("");
  const [tosses, setTosses] = useState<PoolToss[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [sheetWish, setSheetWish] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sheetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(
    () => () => {
      clearTimeout(toastTimer.current);
      clearTimeout(sheetTimer.current);
    },
    [],
  );
  const tossCoin = (x?: number, y?: number) => {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 0.35;
    const id = Date.now();
    setTosses((list) => [...list, { id, x: x ?? 0.5 + Math.cos(a) * r * 0.5, y: y ?? 0.5 + Math.sin(a) * r * 0.5, variant: Math.random() < 0.5 ? 0 : 1 }]);
    const text = wish.trim();
    setToast(tossToast(text));
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
    setWish("");
    // A quiet wish only sinks. A spoken one sails on: once the coin lands, ask who it reaches first.
    clearTimeout(sheetTimer.current);
    if (text) sheetTimer.current = setTimeout(() => setSheetWish(text), still ? 400 : 1300);
  };

  const dive = (then?: () => void) => {
    if (phase !== "fountain") return;
    diveMemory.dive();
    setPhase("diving");
    clearTimeout(timer.current);
    if (still) {
      // Reduce Motion: no zoom, no flash; the fountain and pool crossfade.
      Animated.parallel([tween(ui, 0, 300), tween(poolIn, 1, 300)]).start();
    } else {
      Animated.parallel([tween(zoom, 1, 1300, DIVE_EASE), tween(ui, 0, 500), tween(flash, 1, 700)]).start();
    }
    timer.current = setTimeout(
      () => {
        setPhase("pool");
        if (!still) Animated.parallel([tween(flash, 0, 700), tween(poolIn, 1, 500)]).start();
        then?.();
      },
      still ? 300 : DIVE_MS,
    );
  };

  const surface = () => {
    clearTimeout(timer.current);
    diveMemory.surface();
    setPhase("fountain");
    flash.setValue(0);
    if (still) zoom.setValue(0);
    Animated.parallel([tween(zoom, 0, still ? 0 : 1100, DIVE_EASE), tween(ui, 1, 500), tween(poolIn, 0, 300)]).start();
  };

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

  if (!home || !deviceId) return <CenterScreen backdrop={<NightBackdrop />} spinnerColor={night.gold} />;

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

  const tossFromFountain = () => dive(() => setComposing(true));
  // Challenge: dive, then open today's boat through api.daily.join, as the pool's TodayBoatCard does.
  const challengeFromFountain = () =>
    dive(() => {
      if (today?.open && today.passedTo === 0) void openToday();
    });

  const coins: PoolCoin[] = (mine ?? []).filter((w) => w.status === "traveling" || w.status === "found" || w.status === "granted").slice(0, 3);
  const primary = friends.length > 0 || todayUnpushed ? "push" : wishesLeft > 0 ? "toss" : "none";

  const avatar = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Profile"
      onPress={() => router.push("/me")}
      hitSlop={8}
      style={({ pressed }) => [styles.avatar, pressed && { transform: [{ scale: 0.94 }] }]}
    >
      <Avatar name={user.name} color={user.avatar} size={40} />
    </Pressable>
  );
  // What the two counters mean: coins you can toss now, and pushed boats still needed for the next coin.
  const toNext = Math.max(1, 5 - progress);
  const eyebrow = `${wishesLeft} coin${wishesLeft === 1 ? "" : "s"} · ${toNext} boat${toNext === 1 ? "" : "s"} to next coin`;
  const inPool = phase === "pool";

  return (
    <View style={styles.root}>
      <Animated.View
        style={[styles.layer, { opacity: poolIn }, !inPool && styles.noTouch]}
        accessibilityElementsHidden={!inPool}
        importantForAccessibility={inPool ? "auto" : "no-hide-descendants"}
      >
        <Screen tab testID="well-screen" backdrop={<NightBackdrop />} tone="night">
          <Glass
            testID="pool-surface"
            variant="dark"
            radius={999}
            onPress={surface}
            accessibilityLabel="Fountain"
            accessibilityHint="Surfaces from the pool back to the fountain"
            style={styles.surface}
          >
            <Icon name="back" size={14} color={night.fg} />
            <Text style={styles.surfaceText}>Fountain</Text>
          </Glass>
          <LargeTitle eyebrowColor={night.mutedFg} eyebrow={eyebrow} title={<Text style={styles.brand}>Wishwell</Text>} right={avatar} />

          {voyageLog && !logDismissed ? (
            <VoyageLogCard log={voyageLog as VoyageLog} onDismiss={() => void AsyncStorage.setItem(LOG_DISMISS_KEY, date).then(() => setLogDismissed(true))} />
          ) : null}

          <NightPool size={poolSize} coins={coins.length} tosses={tosses} onWaterTap={composing ? (x, y) => tossCoin(x, y) : undefined} />

          <View style={styles.boats}>
            {friends.map((c) => (
              <BoatCard key={c.hopId} hopId={c.hopId} creatorName={c.creatorName} text={c.text} depth={c.depth} expiresAt={c.expiresAt} />
            ))}
            {today ? <TodayBoatCard deviceId={deviceId} date={date} onOpen={(hopId) => router.push({ pathname: "/w/[hopId]", params: { hopId } })} /> : null}
          </View>

          {coins.length > 0 ? <CoinsFloor coins={coins} /> : null}

          <ProgressDots progress={progress} wishesLeft={wishesLeft} />

          {primary === "push" ? (
            <DButton testID="primary-action" title="Push today's boat" variant="gold" size="lg" busy={busy} onPress={pushBoat} />
          ) : primary === "toss" ? (
            <View testID="toss-button">
              <DButton testID="primary-action" title="Toss a coin" variant="gold" size="lg" onPress={() => setComposing(true)} />
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
              tone="night"
              size="sm"
              style={styles.demo}
              onPress={() => void claimDemo({ deviceId })}
            />
          ) : null}
          {composing ? <View style={styles.composerSpace} /> : null}
        </Screen>
        {toast ? (
          <View style={[styles.toastWrap, { bottom: tabBarBottom(insets.bottom) + TAB_BAR_HEIGHT + 120 }]} pointerEvents="none">
            <Glass variant="dark" radius={999} style={styles.toast}>
              <Text testID="toss-toast" accessibilityLiveRegion="polite" style={styles.toastText}>
                {toast}
              </Text>
            </Glass>
          </View>
        ) : null}
        {composing && inPool ? (
          <WishComposer value={wish} onChange={setWish} onToss={() => tossCoin()} bottom={tabBarBottom(insets.bottom) + TAB_BAR_HEIGHT + 12} />
        ) : null}
      </Animated.View>
      {sheetWish ? (
        <TossSheet wish={sheetWish} deviceId={deviceId} needsProfile={!user.name} still={still} onClose={() => setSheetWish(null)} />
      ) : null}

      {inPool ? null : (
        <FountainScene
          zoom={zoom}
          ui={ui}
          still={still}
          leaving={phase === "diving"}
          eyebrow={eyebrow}
          avatar={avatar}
          wishes={mine}
          challenge={today ? { title: today.title, done: today.passedTo > 0 } : null}
          onToss={tossFromFountain}
          onChallenge={challengeFromFountain}
        />
      )}
      {/* The prototype's bg-dive: an aqua bloom over the water as the camera goes under. */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.noTouch, styles.dive, { opacity: flash }]}>
        <View
          style={[
            styles.bloom,
            {
              width: width * 1.6,
              height: width * 1.6,
              borderRadius: width * 0.8,
              left: -width * 0.3,
            },
          ]}
        />
      </Animated.View>
    </View>
  );
}

/** The teammates' night garden behind the pool: the fountain, dimmed so text and glass stay legible. */
function NightBackdrop() {
  return (
    <View style={[StyleSheet.absoluteFill, styles.night]}>
      <ImageBackground source={poolImages.fountain} style={StyleSheet.absoluteFill} resizeMode="cover" imageStyle={styles.fountain}>
        <View style={[StyleSheet.absoluteFill, styles.dim]} />
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: night.deep },
  layer: { flex: 1 },
  noTouch: { pointerEvents: "none" },
  dive: {
    backgroundColor: "rgba(127,211,209,0.18)",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  bloom: {
    position: "absolute",
    top: "70%",
    transform: [{ translateY: "-50%" }],
    backgroundColor: "rgba(198,240,238,0.9)",
    boxShadow: "0px 0px 120px 90px rgba(110,190,205,0.7)",
  },
  surface: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    height: 44,
    paddingHorizontal: 16,
  },
  surfaceText: {
    fontFamily: night.serif,
    fontSize: 18,
    lineHeight: 24,
    color: night.fg,
  },
  night: { backgroundColor: night.deep, pointerEvents: "none" },
  fountain: { opacity: 0.55, width: "100%", height: "100%" },
  dim: { backgroundColor: "rgba(7,20,26,0.5)" },
  brand: {
    fontSize: 46,
    lineHeight: 52,
    fontWeight: "400",
    color: night.fg,
    fontFamily: night.serif,
    textShadowColor: "rgba(233,199,102,0.55)",
    textShadowRadius: 18,
    textShadowOffset: { width: 0, height: 0 },
  },
  boats: { gap: 14 },
  avatar: { borderRadius: 999, boxShadow: "0px 4px 12px rgba(0,0,0,0.3)" },
  done: {
    ...type.footnote,
    color: night.mutedFg,
    textAlign: "center",
    paddingVertical: 14,
  },
  error: { ...type.footnote, color: "#FF8A80", textAlign: "center" },
  demo: { alignSelf: "center" },
  composerSpace: { height: 96 },
  toastWrap: { position: "absolute", left: 0, right: 0, alignItems: "center", zIndex: 20 },
  toast: { maxWidth: "86%", paddingHorizontal: 20, paddingVertical: 10 },
  toastText: { fontFamily: night.serif, fontSize: 16, lineHeight: 22, color: night.fg, textAlign: "center" },
});
