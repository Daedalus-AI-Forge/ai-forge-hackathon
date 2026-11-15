import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import { glass } from "@/components/lv/home/glass";
import { errorMessage } from "@/components/ui";
import { lv } from "@/theme/tokens";

const useNativeDriver = Platform.OS !== "web";

/** Today's boat from the well: an absurd portrait onboarded with a soft gold glow. */
export function TodayBoatCard({ deviceId, date, onOpen }: { deviceId: string; date: string; onOpen: (hopId: string) => void }) {
  const today = useQuery(api.daily.today, { deviceId, date });
  const join = useMutation(api.daily.join);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1900, easing: Easing.inOut(Easing.sin), useNativeDriver }),
        Animated.timing(glow, { toValue: 0, duration: 1900, easing: Easing.inOut(Easing.sin), useNativeDriver }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [glow]);
  if (!today) return null;

  const pushed = today.passedTo > 0;
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
    <Animated.View
      style={
        pushed || !today.open
          ? null
          : {
              shadowColor: lv.gold,
              shadowOpacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] }),
              shadowRadius: 22,
              shadowOffset: { width: 0, height: 6 },
              elevation: 8,
            }
      }
    >
      <Pressable
        testID="today-boat"
        accessibilityRole="button"
        disabled={pushed || busy || !today.open}
        onPress={() => void play()}
        style={({ pressed }) => [styles.card, glass.light, pushed && styles.cardPushed, pressed && { opacity: 0.85 }]}
      >
        {pushed ? (
          <Text style={styles.pushed}>Pushed ✓ — it's drifting</Text>
        ) : (
          <>
            <View style={styles.pill}>
              <Text style={styles.pillText}>Today's boat</Text>
            </View>
            <Text style={styles.title}>{today.title}</Text>
            <Text style={styles.hint}>Clue: {today.hint}</Text>
            <Text style={styles.players}>
              {busy ? "Opening…" : `${today.players} pushing today · Tap to open ›`}
            </Text>
          </>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: lv.radiusXl, padding: 18, gap: 6 },
  cardPushed: { opacity: 0.75 },
  pill: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: lv.gold },
  pillText: { fontSize: 11, fontWeight: "600", letterSpacing: 1.2, textTransform: "uppercase", color: lv.fg },
  title: { fontSize: 22, fontWeight: "700", color: lv.fg, lineHeight: 28, marginTop: 4 },
  hint: { fontSize: 15, color: lv.mutedFg, marginTop: 2 },
  players: { fontSize: 12, color: lv.mutedFg, marginTop: 4 },
  pushed: { fontSize: 15, fontWeight: "600", color: lv.mutedFg, paddingVertical: 6 },
  error: { color: lv.destructive, fontSize: 13 },
});