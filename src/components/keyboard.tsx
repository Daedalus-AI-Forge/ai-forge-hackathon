import { InputAccessoryView, Keyboard, Platform, Pressable, StyleSheet, Text, View, type ScrollViewProps, type TextInputProps } from "react-native";

import { lv } from "@/theme/tokens";

/** One shared iOS accessory bar; every input points at it via `inputAccessoryViewID`. */
export const KEYBOARD_DONE_ID = "keyboard-done";

/**
 * Keyboard defaults for every TextInput wrapper. Caller props always win.
 * - single-line: return key "done" that blurs and submits (callers' onSubmitEditing still fires)
 * - iOS: a "Done" bar above the keyboard, so multiline and phone/number pads can always close it
 */
export function keyboardInputProps(props: TextInputProps): TextInputProps {
  return {
    ...(props.multiline ? null : { returnKeyType: "done", submitBehavior: "blurAndSubmit" }),
    ...(Platform.OS === "ios" ? { inputAccessoryViewID: KEYBOARD_DONE_ID } : null),
    ...props,
  };
}

/** For every ScrollView that holds a form: tap-outside and drag dismiss, keyboard never covers the bottom button. */
export const formScrollProps: Pick<ScrollViewProps, "keyboardShouldPersistTaps" | "keyboardDismissMode" | "automaticallyAdjustKeyboardInsets"> = {
  keyboardShouldPersistTaps: "handled",
  keyboardDismissMode: Platform.OS === "ios" ? "interactive" : "on-drag",
  automaticallyAdjustKeyboardInsets: true,
};

/** Render once at the app root. iOS only; no-op elsewhere. */
export function KeyboardDoneBar() {
  if (Platform.OS !== "ios") return null;
  return (
    <InputAccessoryView nativeID={KEYBOARD_DONE_ID}>
      <View style={styles.bar}>
        <Pressable testID="keyboard-done" accessibilityRole="button" accessibilityLabel="Done" hitSlop={8} onPress={() => Keyboard.dismiss()}>
          <Text style={styles.done}>Done</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#F4F1EA",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#D9D3C7",
  },
  done: { fontSize: 16, fontWeight: "700", color: lv.fg },
});
