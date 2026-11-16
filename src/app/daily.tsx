import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import { BackButton, Glass, GlassCard, NavBar, Screen } from "@/components/ios";
import { DButton } from "@/components/lv/passon/kit";
import { errorMessage } from "@/components/ui";
import { Countdown, nextUtcMidnight } from "@/components/lv/daily/Countdown";
import { DailyHero } from "@/components/lv/daily/DailyHero";
import { useMe } from "@/lib/device";
import { lv, type } from "@/theme/tokens";

export default function DailyScreen() {
  const router = useRouter();
  const { deviceId } = useMe();
  const [date] = useState(() => new Date().toISOString().slice(0, 10));
  const [endsAt] = useState(() => nextUtcMidnight(Date.now()));
  const today = useQuery(api.daily.today, deviceId ? { deviceId, date } : "skip");
  const join = useMutation(api.daily.join);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const play = async () => {
    if (!deviceId || !today) return;
    setBusy(true);
    setError(null);
    try {
      const hopId = today.hopId ?? (await join({ deviceId }));
      router.push({ pathname: "/w/[hopId]", params: { hopId } });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen testID="daily-screen">
      <NavBar
        left={<BackButton testID="daily-back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />}
        right={
          <Glass variant="chrome" radius={999} style={styles.pill}>
            <Text style={styles.pillText}>Ends in </Text>
            <Countdown testID="daily-countdown" to={endsAt} style={[styles.pillText, styles.pillTime]} />
          </Glass>
        }
      />

      {today === undefined ? (
        <ActivityIndicator style={styles.loading} color={lv.thread} />
      ) : (
        <>
          <DailyHero
            title={today.title}
            hint={today.hint}
            stats={[
              [String(today.players), "playing"],
              [String(today.passedTo), "you passed"],
              [today.open ? "open" : "closed", "status"],
            ]}
          />

          {today.passedTo > 0 ? (
            <GlassCard testID="daily-done" style={styles.done}>
              <Text style={styles.doneEmoji}>🌊</Text>
              <Text style={styles.doneTitle}>You're in today's ripple</Text>
              <Text style={styles.doneBody}>
                You passed it to {today.passedTo} {today.passedTo === 1 ? "friend" : "friends"}. The well added them to your wish network.
              </Text>
            </GlassCard>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {today.open ? (
            <DButton
              testID="daily-wish-play"
              size="lg"
              busy={busy}
              disabled={!deviceId}
              onPress={() => void play()}
              title={today.hopId ? (today.passedTo > 0 ? "Pass it to someone else" : "Keep going") : "I know who this is"}
            />
          ) : (
            <GlassCard style={styles.done}>
              <Text style={styles.doneBody}>Today's wish has been granted. A new one rises at midnight UTC.</Text>
            </GlassCard>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", height: 36, paddingHorizontal: 14 },
  pillText: { ...type.footnote, fontWeight: "500", color: lv.fg },
  pillTime: { fontVariant: ["tabular-nums"] },
  loading: { marginTop: 48 },
  done: { alignItems: "center", paddingVertical: 24, gap: 6 },
  doneEmoji: { fontSize: 34 },
  doneTitle: { ...type.title3, color: lv.fg },
  doneBody: { ...type.subheadline, color: lv.mutedFg, textAlign: "center" },
  error: { ...type.footnote, color: lv.destructive },
});
