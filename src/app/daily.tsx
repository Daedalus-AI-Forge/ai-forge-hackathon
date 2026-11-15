import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/convex/_generated/api";
import { errorMessage } from "@/components/ui";
import { Countdown, nextUtcMidnight } from "@/components/lv/daily/Countdown";
import { DailyHero } from "@/components/lv/daily/DailyHero";
import { useMe } from "@/lib/device";
import { lv } from "@/theme/tokens";
import { formScrollProps } from "@/components/keyboard";

export default function DailyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
    <ScrollView
      testID="daily-screen"
      {...formScrollProps}
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 48 }]}
    >
      <View style={styles.topRow}>
        <Pressable
          testID="daily-back"
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          style={styles.glassCircle}
        >
          <Text style={styles.backGlyph}>←</Text>
        </Pressable>
        <View style={styles.pill}>
          <Text style={styles.pillText}>Ends in </Text>
          <Countdown testID="daily-countdown" to={endsAt} style={styles.pillText} />
        </View>
      </View>

      {today === undefined ? (
        <ActivityIndicator style={{ marginTop: 48 }} color={lv.thread} />
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
            <View testID="daily-done" style={styles.glassCard}>
              <Text style={styles.doneEmoji}>🌊</Text>
              <Text style={styles.doneTitle}>You're in today's ripple</Text>
              <Text style={styles.doneBody}>
                You passed it to {today.passedTo} {today.passedTo === 1 ? "friend" : "friends"}. The well added them to your wish network.
              </Text>
            </View>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {today.open ? (
            <View style={styles.actions}>
              <Pressable
                testID="daily-wish-play"
                accessibilityRole="button"
                disabled={busy || !deviceId}
                onPress={() => void play()}
                style={({ pressed }) => [styles.btn, styles.btnThread, (pressed || busy) && styles.pressed]}
              >
                {busy ? (
                  <ActivityIndicator color={lv.threadFg} />
                ) : (
                  <Text style={styles.btnThreadText}>
                    {today.hopId ? (today.passedTo > 0 ? "Pass it to someone else" : "Keep going") : "I know who this is"}
                  </Text>
                )}
              </Pressable>
            </View>
          ) : (
            <View style={styles.glassCard}>
              <Text style={styles.doneBody}>Today's wish has been granted. A new one rises at midnight UTC.</Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const glass = { backgroundColor: "rgba(254,253,251,0.85)", borderWidth: 1, borderColor: lv.border } as const;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: lv.bg },
  content: { paddingHorizontal: 16 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4 },
  glassCircle: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", ...glass },
  backGlyph: { fontSize: 20, color: lv.fg },
  pill: { flexDirection: "row", alignItems: "center", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, ...glass },
  pillText: { fontSize: 12, fontWeight: "500", color: lv.fg },
  glassCard: { marginTop: 20, borderRadius: 28, padding: 24, alignItems: "center", ...glass },
  doneEmoji: { fontSize: 36 },
  doneTitle: { marginTop: 8, fontSize: 20, fontWeight: "600", color: lv.fg },
  doneBody: { marginTop: 4, fontSize: 14, lineHeight: 20, color: lv.mutedFg, textAlign: "center" },
  error: { marginTop: 12, color: lv.destructive, fontSize: 14 },
  actions: { marginTop: 20, gap: 12 },
  btn: { height: 64, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  btnThread: { backgroundColor: lv.thread },
  btnThreadText: { fontSize: 18, fontWeight: "600", color: lv.threadFg },
  pressed: { opacity: 0.85 },
});
