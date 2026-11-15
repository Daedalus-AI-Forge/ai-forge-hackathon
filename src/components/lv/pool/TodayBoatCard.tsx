import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { Animated, Easing, Platform, StyleSheet, Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import { Glass, Icon } from "@/components/ios";
import { DTag } from "@/components/lv/passon/kit";
import { errorMessage } from "@/components/ui";
import { layout, lv, type } from "@/theme/tokens";

const useNativeDriver = Platform.OS !== "web";

/** Today's boat from the well: an absurd portrait onboarded with a soft gold glow. */
export function TodayBoatCard({ deviceId, date, onOpen }: { deviceId: string; date: string; onOpen: (hopId: string) => void }) {
  const today = useQuery(api.daily.today, { deviceId, date });
  const join = useMutation(api.daily.join);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
        accessibilityLabel={pushed ? "Today’s boat, pushed" : `Today’s boat: ${today.title}`}
        accessibilityHint={pushed ? undefined : "Opens today’s boat"}
        style={styles.card}
      >
        {pushed ? (
          <View style={styles.pushedRow}>
            <View style={styles.check}>
              <Icon name="check" size={14} color={lv.threadFg} weight="bold" />
            </View>
            <Text style={styles.pushed}>Pushed — it’s drifting</Text>
          </View>
        ) : (
          <View style={[styles.body, !today.open && styles.dim]}>
            <DTag label="Today’s boat" tone="gold" />
            <Text style={styles.title}>{today.title}</Text>
            <Text style={styles.hint}>Clue: {today.hint}</Text>
            {/* The whole card opens the boat; the Pool keeps a single primary button. */}
            <View style={styles.footer}>
              <Text style={styles.players}>{busy ? "Opening…" : `${today.players} pushing today`}</Text>
              {today.open && !busy ? (
                <View style={styles.open}>
                  <Text style={styles.openText}>Tap to open</Text>
                  <Icon name="forward" size={12} color={lv.thread} weight="bold" />
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
  card: { padding: layout.cardPadding + 2, gap: 6 },
  body: { gap: 6 },
  dim: { opacity: 0.55 },
  title: { ...type.title2, color: lv.fg, marginTop: 6 },
  hint: { ...type.subheadline, color: lv.mutedFg },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 6 },
  players: { ...type.footnote, color: lv.mutedFg, flexShrink: 1 },
  open: { flexDirection: "row", alignItems: "center", gap: 4, height: 30, paddingHorizontal: 12, borderRadius: 999, backgroundColor: lv.threadTint },
  openText: { ...type.footnote, fontWeight: "600", color: lv.thread },
  pushedRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 2 },
  check: { width: 24, height: 24, borderRadius: 12, backgroundColor: lv.thread, alignItems: "center", justifyContent: "center" },
  pushed: { ...type.headline, color: lv.mutedFg },
  error: { ...type.footnote, color: lv.destructive },
});
