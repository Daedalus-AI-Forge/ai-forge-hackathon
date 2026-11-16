import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { Animated, Easing, Platform, StyleSheet, Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import { Glass, Icon } from "@/components/ios";
import { errorMessage } from "@/components/ui";
import { countdown, nextUtcMidnight, useNow } from "@/lib/time";
import { layout, lv, night, type } from "@/theme/tokens";

const useNativeDriver = Platform.OS !== "web";

/**
 * Today's boat on the night pool, styled as the prototype's daily-challenge card: dark glass, a gold
 * star, the time until the boat rolls over, and a gold "open" cue. Data stays on api.daily.*.
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
  const live = !pushed && open;
  const now = useNow(1000);
  const [glow] = useState(() => new Animated.Value(0));
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

  return (
    <Animated.View
      style={[
        styles.halo,
        live
          ? {
              shadowColor: night.gold,
              shadowOpacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.75] }),
              shadowRadius: 24,
              shadowOffset: { width: 0, height: 6 },
              elevation: 8,
            }
          : null,
      ]}
    >
      <Glass
        testID="today-boat"
        variant="dark"
        disabled={!live || busy}
        onPress={onPress}
        accessibilityLabel={pushed ? "Today’s boat, pushed" : `Today’s boat: ${title}`}
        accessibilityHint={pushed ? undefined : "Opens today’s boat"}
        style={styles.card}
      >
        <Text style={styles.label}>
          ★ {pushed ? "Today’s boat · pushed" : `Today’s boat · new one in ${countdown(nextUtcMidnight(now), now)}`}
        </Text>
        {pushed ? (
          <View style={styles.pushedRow}>
            <View style={styles.check}>
              <Icon name="check" size={14} color={night.goldFg} weight="bold" />
            </View>
            <Text style={styles.pushed}>It’s drifting. A new boat rises tomorrow.</Text>
          </View>
        ) : (
          <View style={[styles.body, !open && styles.dim]}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.hint}>Clue: {hint}</Text>
            {/* The whole card opens the boat; the Pool keeps a single primary button. */}
            <View style={styles.footer}>
              <Text style={styles.players}>{busy ? "Opening…" : `${players} pushing today`}</Text>
              {open && !busy ? (
                <View style={styles.open}>
                  <Text style={styles.openText}>Tap to open</Text>
                  <Icon name="forward" size={12} color={night.goldFg} weight="bold" />
                </View>
              ) : null}
            </View>
          </View>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Glass>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  halo: { borderRadius: lv.radiusXl },
  card: { padding: layout.cardPadding + 4, gap: 8 },
  label: { ...type.footnote, color: night.gold, fontVariant: ["tabular-nums"] },
  body: { gap: 6 },
  dim: { opacity: 0.55 },
  title: { fontSize: 26, lineHeight: 31, color: night.fg, fontFamily: night.serif },
  hint: { ...type.subheadline, color: night.mutedFg },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 8 },
  players: { ...type.footnote, color: night.mutedFg, flexShrink: 1 },
  open: { flexDirection: "row", alignItems: "center", gap: 4, height: 32, paddingHorizontal: 14, borderRadius: 999, backgroundColor: night.gold },
  openText: { ...type.footnote, fontWeight: "600", color: night.goldFg },
  pushedRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 2 },
  check: { width: 24, height: 24, borderRadius: 12, backgroundColor: night.gold, alignItems: "center", justifyContent: "center" },
  pushed: { fontSize: 17, lineHeight: 22, color: night.fg, fontFamily: night.serif, flexShrink: 1 },
  error: { ...type.footnote, color: "#FF8A80" },
});
