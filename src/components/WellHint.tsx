import { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { Card, Muted } from "@/components/ui";
import { colors } from "@/lib/theme";

/** Shown on a daily wish: this ripple's clue, and in plain words what the well learns from the pass. */
export function WellHint({
  daily,
}: {
  daily: { tag: string; hint: string; reasoning: string; step: number; of: number };
}) {
  const [open, setOpen] = useState(false);
  const last = daily.step > daily.of;
  return (
    <Card testID="well-hint" style={styles.card}>
      <Text testID="well-hint-step" style={styles.label}>
        {last ? "End of the trail" : `Clue ${daily.step} of ${daily.of}`}
      </Text>
      <Text style={styles.hint}>
        {last ? `${daily.of} clues led to you. Is this you?` : daily.hint}
      </Text>
      <Pressable testID="well-hint-why" accessibilityRole="button" onPress={() => setOpen((v) => !v)}>
        <Text style={styles.why}>{open ? "Hide" : "Why is the well asking?"}</Text>
      </Pressable>
      {open ? (
        <>
          <Muted>{daily.reasoning}</Muted>
          {last ? null : (
            <Muted>
              When you pass this on, the well remembers the person you picked as your "{daily.tag}" link, so it can
              route real wishes through the right friend later. You can see and delete this in the app under Me.
            </Muted>
          )}
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.redSoft, shadowOpacity: 0, elevation: 0 },
  label: { fontSize: 13, fontWeight: "800", color: colors.red, textTransform: "uppercase", letterSpacing: 0.6 },
  hint: { fontSize: 17, fontWeight: "700", color: colors.ink, lineHeight: 23 },
  why: { fontSize: 14, fontWeight: "700", color: colors.red },
});
