import { useEffect, useRef, useState } from "react";
import { AppState, StyleSheet, Text } from "react-native";

import { DButton, DCard } from "@/components/lv/passon/kit";
import { hopUrl, smsLink } from "@/lib/links";
import { textAllLabel } from "@/lib/tossPeople";
import { lv } from "@/theme/tokens";

export type TextAllTarget = { hopId: string; name: string; message: string | null; to?: string };

// If the OS never reports leaving/returning (desktop web, no Messages app), unlock "Next" anyway.
const RETURN_FALLBACK_MS = 4000;

/**
 * "Text all N": opens Messages for one person at a time, each with their own message + link
 * (+ number when picked). The next person unlocks when the app comes back to the foreground.
 * Never sends — every Send is the user's own tap in Messages.
 */
export function TextAll({ targets }: { targets: TextAllTarget[] }) {
  const [opened, setOpened] = useState(0);
  const [away, setAway] = useState(false);
  const left = useRef(false);

  useEffect(() => {
    if (!away) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") left.current = true;
      else if (left.current) setAway(false);
    });
    const t = setTimeout(() => setAway(false), RETURN_FALLBACK_MS);
    return () => {
      sub.remove();
      clearTimeout(t);
    };
  }, [away]);

  const label = textAllLabel(
    targets.map((t) => t.name),
    opened,
  );
  const current = targets[opened];
  const drafting = current?.message === null;

  function openNext() {
    if (!current) return;
    left.current = false;
    smsLink(current.message ?? "", hopUrl(current.hopId), current.to);
    setOpened((n) => n + 1);
    setAway(true);
  }

  return (
    <DCard testID="share-text-all-card">
      {opened > 0 ? (
        <Text style={styles.progress} testID="share-text-all-progress">
          {opened} of {targets.length} opened
        </Text>
      ) : (
        <Text style={styles.hint}>Each person gets their own message and link. You tap Send in Messages.</Text>
      )}
      {label ? (
        away ? (
          <Text style={styles.hint}>Send it in Messages, then come back here for {current?.name}.</Text>
        ) : (
          <DButton
            testID="share-text-all"
            variant="thread"
            title={drafting ? `Drafting ${current.name}'s message…` : label}
            busy={drafting}
            disabled={drafting}
            onPress={openNext}
          />
        )
      ) : (
        <Text style={styles.progress}>All {targets.length} opened. Nice.</Text>
      )}
    </DCard>
  );
}

const styles = StyleSheet.create({
  progress: { fontSize: 15, fontWeight: "700", color: lv.fg },
  hint: { fontSize: 14, lineHeight: 20, color: lv.mutedFg },
});
