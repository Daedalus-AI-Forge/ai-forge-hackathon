import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import { errorMessage } from "@/components/ui";
import { countdown, nextUtcMidnight, useNow } from "@/lib/time";
import { lv, night } from "@/theme/tokens";

const useNativeDriver = Platform.OS !== "web";

/**
 * Today's boat, styled as the prototype's daily-challenge card: dark glass, a gold star,
 * the time until the boat rolls over, and one gold action. Data stays on api.daily.*.
 */
export function TodayBoatCard({ deviceId, date, onOpen }: { deviceId: string; date: string; onOpen: (hopId: string) => void }) {
  const today = useQuery(api.daily.today, { deviceId, date });
  const join = useMutation(api.daily.join);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!today) return null;

  const play = async () => {
    if (busy || !today.open) return;
    setBusy(true);
    setError(null);
    try {
      const hopId = today.hopId ?? (await join({ deviceId }));
      onOpen(hopId);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <TodayBoatView
      title={today.title}
      hint={today.hint}
      players={today.players}
      open={today.open}
      pushed={today.passedTo > 0}
      busy={busy}
      error={error}
      onPress={() => void play()}
    />
  );
}

export type TodayBoatViewProps = {
  title: string;
  hint: string;
  players: number;
  open: boolean;
  pushed: boolean;
  busy: boolean;
  error: string | null;
  onPress: () => void;
};

/** The card itself, free of data loading (used by TodayBoatCard). */
export function TodayBoatView({ title, hint, players, open, pushed, busy, error, onPress }: TodayBoatViewProps) {
  const [glow] = useState(() => new Animated.Value(0));
  const now = useNow(1000);
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 1900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 1900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [glow]);
  return (
    <Animated.View
      style={
        pushed || !open
          ? null
          : {
              shadowColor: lv.gold,
              shadowOpacity: glow.interpolate({
                inputRange: [0, 1],
                outputRange: [0.35, 0.75],
              }),
              shadowRadius: 24,
              shadowOffset: { width: 0, height: 6 },
              elevation: 8,
            }
      }
    >
      <Pressable
        testID="today-boat"
        accessibilityRole="button"
        accessibilityLabel={pushed ? "Today's boat, pushed" : `Today's boat: ${title}. Open it`}
        disabled={pushed || busy || !open}
        onPress={onPress}
        style={({ pressed }) => [styles.card, pushed && styles.cardPushed, pressed && { opacity: 0.88 }]}
      >
        <Text style={styles.label}>
          <Text style={styles.star}>★ </Text>
          {pushed ? "Today's boat · pushed" : `Today's boat · new one in ${countdown(nextUtcMidnight(now), now)}`}
        </Text>
        {pushed ? (
          <Text style={styles.pushed}>It’s drifting. A new boat rises tomorrow.</Text>
        ) : (
          <>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.hint}>Clue: {hint}</Text>
            <View style={styles.footer}>
              <Text style={styles.players}>{players} pushing today</Text>
              <View style={styles.cta}>
                <Text style={styles.ctaText}>{busy ? "Opening…" : "Open the boat"}</Text>
              </View>
            </View>
          </>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: lv.radiusXl,
    padding: 20,
    gap: 8,
    backgroundColor: night.glassStrong,
    borderWidth: 1,
    borderColor: night.border,
  },
  cardPushed: { opacity: 0.8 },
  label: {
    fontSize: 13,
    color: night.gold,
    letterSpacing: 0.3,
    fontVariant: ["tabular-nums"],
  },
  star: { color: night.gold },
  title: {
    fontSize: 26,
    color: night.fg,
    lineHeight: 31,
    marginTop: 2,
    fontFamily: night.serif,
  },
  hint: { fontSize: 15, color: night.mutedFg, lineHeight: 21 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    gap: 12,
  },
  players: { fontSize: 13, color: night.mutedFg, flexShrink: 1 },
  cta: {
    height: 40,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: night.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { fontSize: 15, fontWeight: "600", color: night.goldFg },
  pushed: {
    fontSize: 17,
    color: night.fg,
    fontFamily: night.serif,
    paddingVertical: 4,
  },
  error: { color: "#FF8A80", fontSize: 13 },
});
