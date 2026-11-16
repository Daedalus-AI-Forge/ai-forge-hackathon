import { useMutation } from "convex/react";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import { GlassCard } from "@/components/ios";
import { errorMessage } from "@/components/ui";
import { useMe } from "@/lib/device";
import { lv } from "@/theme/tokens";

/** Stars: "Trade 2 stars for 1 wish". Self-contained so the Me tab can drop it in. */
export function StarsCard() {
  const { deviceId, user } = useMe();
  const trade = useMutation(api.stars.tradeForWish);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stars = user?.stars ?? 0;
  const disabled = busy || stars < 2 || !deviceId;
  return (
    <GlassCard testID="stars-card" style={{ gap: 8 }}>
      <Text style={styles.eyebrow}>Stars</Text>
      <Text testID="stars-count" style={styles.num}>
        {stars} ⭐
      </Text>
      <Text style={styles.hint}>Earn stars by helping a wish come true. Spend 1 to ask the well, or trade 2 for a wish.</Text>
      {error ? <Text style={styles.err}>{error}</Text> : null}
      <Pressable
        testID="stars-trade"
        accessibilityRole="button"
        disabled={disabled}
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
        style={[styles.btn, disabled && { opacity: 0.5 }]}
      >
        <Text style={styles.btnText}>Trade 2 stars for 1 wish</Text>
      </Pressable>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  eyebrow: { fontSize: 11, fontWeight: "600", letterSpacing: 1, textTransform: "uppercase", color: lv.mutedFg },
  num: { fontSize: 24, fontWeight: "700", color: lv.fg },
  hint: { fontSize: 13, lineHeight: 18, color: lv.mutedFg },
  err: { fontSize: 13, color: lv.destructive },
  btn: { height: 44, borderRadius: 999, backgroundColor: lv.primary, alignItems: "center", justifyContent: "center" },
  btnText: { color: lv.primaryFg, fontSize: 15, fontWeight: "600" },
});
