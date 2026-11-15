import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Glass } from "@/components/lv/passon/kit";
import { lv } from "@/theme/tokens";

/** Shown on Today's boat: this ripple's clue, and in plain words what the well learns from the pass. */
export function WellHint({
  daily,
}: {
  daily: { tag: string; hint: string; reasoning: string; step: number; of: number };
}) {
  const [open, setOpen] = useState(false);
  const last = daily.step > daily.of;
  return (
    <Glass testID="well-hint">
      <Text testID="well-hint-step" style={styles.label}>
        {last ? "End of the trail" : `Clue ${daily.step} of ${daily.of}`}
      </Text>
      <Text style={styles.hint}>{last ? `${daily.of} clues led to you. Is this you?` : daily.hint}</Text>
      <Pressable testID="well-hint-why" accessibilityRole="button" onPress={() => setOpen((v) => !v)} hitSlop={8}>
        <Text style={styles.why}>{open ? "Hide" : "Why is the well asking?"}</Text>
      </Pressable>
      {open ? (
        <>
          <Text style={styles.body}>{daily.reasoning}</Text>
          {last ? null : (
            <Text style={styles.body}>
              When you pass this on, the well remembers the person you picked as your "{daily.tag}" link, so it can route
              real wishes through the right friend later. You can see and delete this in the app under Me.
            </Text>
          )}
        </>
      ) : null}
    </Glass>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 11, fontWeight: "600", letterSpacing: 1.2, textTransform: "uppercase", color: lv.thread },
  hint: { fontSize: 17, fontWeight: "700", color: lv.fg, lineHeight: 23 },
  why: { fontSize: 14, fontWeight: "600", color: lv.thread },
  body: { fontSize: 13.5, color: lv.mutedFg, lineHeight: 19 },
});