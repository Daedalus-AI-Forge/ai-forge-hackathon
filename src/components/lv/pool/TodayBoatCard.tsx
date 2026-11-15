import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform, StyleSheet, Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import { Glass, Icon } from "@/components/ios";
import { DButton, DTag } from "@/components/lv/passon/kit";
import { errorMessage } from "@/components/ui";
import { layout, lv, type } from "@/theme/tokens";

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
  const live = !pushed && today.open;
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
      style={[
        styles.halo,
        live
          ? {
              shadowColor: lv.gold,
              shadowOpacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.8] }),
              shadowRadius: 24,
              shadowOffset: { width: 0, height: 6 },
              elevation: 8,
            }
          : null,
      ]}
    >
      <Glass
        testID="today-boat"
        disabled={!live || busy}
        onPress={() => void play()}
        accessibilityLabel={pushed ? "Today's boat, pushed" : `Today's boat: ${today.title}`}
        style={styles.card}
      >
        {pushed ? (
          <View style={styles.pushedRow}>
            <View style={styles.check}>
              <Icon name="check" size={14} color={lv.threadFg} weight="bold" />
            </View>
            <Text style={styles.pushed}>Pushed — it's drifting</Text>
          </View>
        ) : (
          <View style={[styles.body, !today.open && styles.dim]}>
            <DTag label="Today's boat" tone="gold" />
            <Text style={styles.title}>{today.title}</Text>
            <Text style={styles.hint}>Clue: {today.hint}</Text>
            <Text style={styles.players}>{today.players} pushing today</Text>
            <DButton
              title="Open"
              variant="thread"
              size="lg"
              busy={busy}
              disabled={!today.open}
              testID="today-boat-open"
              onPress={() => void play()}
              style={styles.open}
            />
          </View>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Glass>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  halo: { borderRadius: lv.radiusXl },
  card: { padding: layout.cardPadding + 2, gap: 6 },
  body: { gap: 6 },
  dim: { opacity: 0.55 },
  title: { ...type.title2, color: lv.fg, marginTop: 6 },
  hint: { ...type.subheadline, color: lv.mutedFg },
  players: { ...type.footnote, color: lv.mutedFg },
  open: { marginTop: 10 },
  pushedRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 2 },
  check: { width: 24, height: 24, borderRadius: 12, backgroundColor: lv.thread, alignItems: "center", justifyContent: "center" },
  pushed: { ...type.headline, color: lv.mutedFg },
  error: { ...type.footnote, color: lv.destructive },
});
