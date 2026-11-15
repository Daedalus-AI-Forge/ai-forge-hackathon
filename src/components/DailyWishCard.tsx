import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text } from "react-native";

import { api } from "@/convex/_generated/api";
import { Button, Card, ErrorText, Muted, errorMessage } from "@/components/ui";
import { colors } from "@/lib/theme";

export function DailyWishCard({ deviceId }: { deviceId: string }) {
  const router = useRouter();
  const [date] = useState(() => new Date().toISOString().slice(0, 10));
  const today = useQuery(api.daily.today, { deviceId, date });
  const join = useMutation(api.daily.join);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!today) return null;

  return (
    <Card testID="daily-wish-card" style={styles.card}>
      <Text style={styles.label}>Today's wish from the well</Text>
      <Text testID="daily-wish-title" style={styles.title}>
        {today.title}
      </Text>
      <Muted>Six people, five clues. Clue 1: {today.hint}</Muted>
      {today.passedTo > 0 ? (
        <Text style={styles.done}>
          You passed it to {today.passedTo} {today.passedTo === 1 ? "friend" : "friends"}. The well added them to your wish network.
        </Text>
      ) : null}
      <ErrorText error={error} />
      {today.open ? (
        <Button
          testID="daily-wish-play"
          title={today.hopId ? (today.passedTo > 0 ? "Pass it to someone else" : "Keep going") : "I know who this is"}
          busy={busy}
          onPress={async () => {
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
          }}
        />
      ) : null}
      {today.players > 0 ? (
        <Muted>
          {today.players} {today.players === 1 ? "person is" : "people are"} playing today.
        </Muted>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1.5, borderColor: colors.redSoft },
  label: { fontSize: 13, fontWeight: "800", color: colors.red, textTransform: "uppercase", letterSpacing: 0.6 },
  title: { fontSize: 19, fontWeight: "800", color: colors.ink, lineHeight: 25 },
  done: { fontSize: 15, color: colors.ink, fontWeight: "600", lineHeight: 21 },
});
