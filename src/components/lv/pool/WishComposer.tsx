import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Glass, Icon } from "@/components/ios";
import { keyboardInputProps } from "@/components/keyboard";
import { night } from "@/theme/tokens";

const COMPOSER_MAX = 430;
// Brighter than mutedFg so "Whisper a wish…" reads on the dark glass.
const PLACEHOLDER = "rgba(222,236,234,0.72)";

/** Katie-Lan's pool composer: "Whisper a wish…" and a gold Toss. An empty wish just sinks. */
export function WishComposer({
  value,
  onChange,
  onToss,
  bottom,
}: {
  value: string;
  onChange: (v: string) => void;
  onToss: () => void;
  /** Distance from the screen bottom, so the composer floats above the tab bar. */
  bottom: number;
}) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.wrap, { bottom }]}
      pointerEvents="box-none"
      testID="wish-composer"
    >
      <View style={styles.column}>
        <Glass variant="dark" radius={26} style={styles.bar}>
        <TextInput
          {...keyboardInputProps({
            testID: "toss-text",
            value,
            onChangeText: onChange,
            placeholder: "Whisper a wish…",
            placeholderTextColor: PLACEHOLDER,
            maxLength: 120,
            accessibilityLabel: "Your wish",
            onSubmitEditing: onToss,
            style: styles.input,
          })}
        />
        <Pressable
          testID="toss-coin"
          accessibilityRole="button"
          accessibilityLabel="Toss"
          onPress={onToss}
          style={({ pressed }) => [styles.gold, pressed && styles.pressed]}
        >
          <Icon name="sparkles" size={14} color={night.goldFg} weight="bold" />
          <Text style={styles.goldText}>Toss</Text>
        </Pressable>
      </Glass>
        <Text style={styles.hint}>or tap anywhere on the water</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // Full-width track, centered column: on wide screens the composer stays phone-sized.
  wrap: { position: "absolute", left: 0, right: 0, zIndex: 10, alignItems: "center", paddingHorizontal: 16 },
  column: { width: "100%", maxWidth: COMPOSER_MAX },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 8,
    paddingLeft: 20,
    backgroundColor: night.glassStrong,
  },
  input: { flex: 1, minWidth: 0, height: 48, zIndex: 1, fontFamily: night.serif, fontSize: 20, color: night.fg, outlineStyle: "none" } as object,
  gold: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 48,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: night.gold,
    backgroundImage: `linear-gradient(180deg, ${night.goldBright}, ${night.gold} 55%, ${night.goldDeep})`,
    boxShadow: "0px 0px 24px rgba(233,199,102,0.55), 0px 10px 30px -10px rgba(169,119,43,0.8)",
  } as object,
  pressed: { transform: [{ translateY: 1 }, { scale: 0.99 }] },
  goldText: { fontFamily: night.serif, fontSize: 18, color: night.goldFg },
  hint: { marginTop: 8, textAlign: "center", fontFamily: night.serif, fontSize: 16, color: night.mutedFg },
});
