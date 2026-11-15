// Screen 2 of the link page: one line for the visitor's free wish, optional AI polish, or skip.
// Polish is capped at 3s; on timeout or error the visitor's own text stays.
import { useAction } from "convex/react";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import { DButton, DField, Eyebrow, Sub } from "@/components/lv/passon/kit";
import { withTimeout } from "@/lib/linkDraft";
import { lv, type } from "@/theme/tokens";

export const POLISH_TIMEOUT_MS = 3000;
const MAX_WISH = 200;

export type WriteWishProps = {
  deviceId: string;
  text: string;
  onChangeText: (t: string) => void;
  onContinue: (text: string) => void;
  onSkip: () => void;
};

export function WriteWish({ deviceId, text, onChangeText, onContinue, onSkip }: WriteWishProps) {
  const polishWish = useAction(api.ai.polishWish);
  const [polishing, setPolishing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const trimmed = text.trim();

  async function polish() {
    if (!trimmed || polishing) return;
    setPolishing(true);
    setNote(null);
    const out = await withTimeout(
      polishWish({ deviceId, type: "same_boat", text: trimmed }),
      POLISH_TIMEOUT_MS,
      trimmed,
    );
    const polished = typeof out === "string" ? out.trim() : "";
    if (polished && polished !== trimmed) onChangeText(polished.slice(0, MAX_WISH));
    else setNote("Kept your words — they already work.");
    setPolishing(false);
  }

  return (
    <View style={{ gap: 14 }} testID="link-wish-step">
      <View style={{ gap: 8 }}>
        <Eyebrow>Your free wish</Eyebrow>
        <Text style={styles.h1}>What kind of person do you wish you knew?</Text>
        <Sub>One line is enough. It sails to friends of friends, never to a stranger feed.</Sub>
      </View>

      <DField
        testID="link-wish-input"
        value={text}
        onChangeText={(t) => {
          setNote(null);
          onChangeText(t.replace(/\n/g, " ").slice(0, MAX_WISH));
        }}
        editable={!polishing}
        placeholder="Someone who switched from pre-med to design"
        maxLength={MAX_WISH}
        returnKeyType="done"
        onSubmitEditing={() => trimmed && onContinue(trimmed)}
        style={styles.input}
        accessibilityLabel="Your wish"
      />

      <View style={styles.row}>
        <DButton
          title="Polish with AI"
          icon="sparkles"
          variant="tinted"
          size="sm"
          onPress={() => void polish()}
          busy={polishing}
          disabled={!trimmed}
          testID="link-polish"
        />
        {note ? <Text style={styles.note}>{note}</Text> : null}
      </View>

      <DButton
        title="Continue"
        size="lg"
        onPress={() => onContinue(trimmed)}
        disabled={!trimmed || polishing}
        testID="link-wish-continue"
      />
      <DButton title="Not now, just help" variant="plain" size="sm" onPress={onSkip} testID="link-skip-wish" style={styles.skip} />
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { ...type.title1, color: lv.fg },
  input: { minHeight: 52 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  note: { ...type.footnote, color: lv.mutedFg, flexShrink: 1 },
  skip: { alignSelf: "center" },
});
