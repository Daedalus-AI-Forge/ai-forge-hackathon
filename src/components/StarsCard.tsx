import { useMutation } from "convex/react";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import { Button, Card, ErrorText, Muted, errorMessage } from "@/components/ui";
import { useMe } from "@/lib/device";
import { colors } from "@/lib/theme";

/** Stars and wishes, plus "Trade 2 stars for 1 wish". Self-contained so the Me tab can drop it in. */
export function StarsCard() {
  const { deviceId, user } = useMe();
  const trade = useMutation(api.stars.tradeForWish);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stars = user?.stars ?? 0;
  return (
    <Card testID="stars-card">
      <View style={styles.row}>
        <View style={styles.stat}>
          <Text testID="stars-count" style={styles.num}>
            ★ {stars}
          </Text>
          <Muted>stars</Muted>
        </View>
        <View style={styles.stat}>
          <Text testID="wishes-count" style={styles.num}>
            {user?.wishesLeft ?? 0}
          </Text>
          <Muted>wishes left</Muted>
        </View>
      </View>
      <Muted>Earn stars by helping a wish come true. Spend 1 to ask the well, or trade 2 for a wish.</Muted>
      <ErrorText error={error} />
      <Button
        testID="stars-trade"
        title="Trade 2 stars for 1 wish"
        variant="secondary"
        busy={busy}
        disabled={stars < 2 || !deviceId}
        onPress={async () => {
          if (!deviceId) return;
          setBusy(true);
          setError(null);
          try {
            await trade({ deviceId });
          } catch (e) {
            setError(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12 },
  stat: { flex: 1, alignItems: "center" },
  num: { fontSize: 28, fontWeight: "800", color: colors.red },
});
