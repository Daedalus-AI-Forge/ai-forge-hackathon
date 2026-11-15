import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import { errorMessage } from "@/components/ui";
import { lv } from "@/theme/tokens";

import { glass } from "./glass";

/** New-design "Today's wish" row; same data + behavior as DailyWishCard (daily.today / daily.join). */
export function DailyRow({ deviceId }: { deviceId: string }) {
  const router = useRouter();
  const [date] = useState(() => new Date().toISOString().slice(0, 10));
  const today = useQuery(api.daily.today, { deviceId, date });
  const join = useMutation(api.daily.join);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!today) return null;

  const play = async () => {
    if (!today.open || busy) return;
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
  const meta =
    today.passedTo > 0
      ? `Passed to ${today.passedTo} ${today.passedTo === 1 ? "friend" : "friends"}`
      : today.players > 0
        ? `${today.players} playing`
        : "Six people, five clues";

  return (
    <View testID="daily-wish-card">
      <Pressable
        testID="daily-wish-play"
        accessibilityRole="button"
        accessibilityLabel={today.open ? "Play today's wish" : "Today's wish is closed"}
        disabled={!today.open || busy}
        onPress={() => void play()}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.emoji}>🔮</Text>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={glass.eyebrow} numberOfLines={1}>
            Today's wish · {meta}
          </Text>
          <Text testID="daily-wish-title" style={styles.title} numberOfLines={1}>
            {today.title}
          </Text>
          <Text style={styles.hint} numberOfLines={1}>
            Clue 1: {today.hint}
          </Text>
        </View>
        {busy ? <ActivityIndicator color={lv.mutedFg} /> : today.open ? <Text style={styles.chev}>›</Text> : null}
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  emoji: { fontSize: 24 },
  title: { fontSize: 15, fontWeight: "600", color: lv.fg, marginTop: 2 },
  hint: { fontSize: 12, color: lv.mutedFg, marginTop: 1 },
  chev: { fontSize: 22, color: lv.mutedFg },
  error: { color: lv.destructive, fontSize: 13, paddingHorizontal: 16, paddingBottom: 10 },
});
