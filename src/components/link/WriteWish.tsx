// Screen 2 of the link page: one line for the visitor's free wish, optional AI polish, or skip.
// Polish is capped at 3s; on timeout or error the visitor's own text stays.
import { useAction } from "convex/react";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { api } from "@/convex/_generated/api";
import { DButton, DHint, Eyebrow, Sub } from "@/components/lv/passon/kit";
import { withTimeout } from "@/lib/linkDraft";
import { lv } from "@/theme/tokens";
import { KEYBOARD_DONE_ID } from "@/components/keyboard";

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
    <View style={{ gap: 18 }} testID="link-wish-step">
      <View style={{ gap: 8 }}>
        <Eyebrow>Your free wish</Eyebrow>
        <Text style={styles.h1}>What kind of person do you wish you knew?</Text>
        <Sub>One line is enough. It sails to friends of friends, never to a stranger feed.</Sub>
      </View>

      <TextInput
        testID="link-wish-input"
        value={text}
        onChangeText={(t) => {
          setNote(null);
          onChangeText(t.replace(/\n/g, " ").slice(0, MAX_WISH));
        }}
        editable={!polishing}
        placeholder="Someone who switched from pre-med to design"
        placeholderTextColor={lv.mutedFg}
        maxLength={MAX_WISH}
        returnKeyType="done"
        submitBehavior="blurAndSubmit"
        inputAccessoryViewID={Platform.OS === "ios" ? KEYBOARD_DONE_ID : undefined}
        onSubmitEditing={() => trimmed && onContinue(trimmed)}
        style={styles.input}
        accessibilityLabel="Your wish"
      />

      <View style={styles.row}>
        <DButton
          title="Polish with AI"
          variant="ghost"
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
      {!trimmed && !polishing ? <DHint>Write one line to continue, or skip it below.</DHint> : null}
      <Pressable onPress={onSkip} accessibilityRole="button" hitSlop={8} testID="link-skip-wish" style={{ alignSelf: "center" }}>
        <Text style={styles.skip}>Not now, just help</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 26, lineHeight: 32, fontWeight: "700", color: lv.fg },
  input: {
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: lv.card,
    borderWidth: 1.5,
    borderColor: lv.fieldBorder,
    paddingHorizontal: 16,
    fontSize: 17,
    color: lv.fg,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  note: { fontSize: 13, color: lv.mutedFg, flexShrink: 1 },
  skip: { fontSize: 15, color: lv.mutedFg, textDecorationLine: "underline" },
});
