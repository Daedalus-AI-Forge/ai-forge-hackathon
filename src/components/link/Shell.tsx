// Wizard frame for the link page: background, back arrow, step dots, centered column.
// Also holds the pure step transitions so the route stays a thin composer.
import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { LinkStep } from "@/lib/linkDraft";
import { lv } from "@/theme/tokens";
import { formScrollProps } from "@/components/keyboard";

export type HandleChoice = "claim" | "push" | null;

/** Step after `from`. `freeWishAvailable === false` skips the wish; `freeWishOnly` (special states) skips the boat. */
export function nextStep(from: LinkStep, o: { freeWishAvailable: boolean; freeWishOnly: boolean }): LinkStep {
  switch (from) {
    case "first":
      return o.freeWishAvailable ? "wish" : o.freeWishOnly ? "contact" : "handle";
    case "wish":
      return o.freeWishOnly ? "contact" : "handle";
    case "handle":
      return "contact";
    default:
      return "done";
  }
}

/** Step the back arrow returns to, or null when there is nothing behind (first) or nothing to undo (done). */
export function prevStep(from: LinkStep, o: { freeWishAvailable: boolean; freeWishOnly: boolean }): LinkStep | null {
  switch (from) {
    case "wish":
      return "first";
    case "handle":
      return o.freeWishAvailable ? "wish" : "first";
    case "contact":
      return o.freeWishOnly ? (o.freeWishAvailable ? "wish" : "first") : "handle";
    default:
      return null;
  }
}

const DOTS: LinkStep[] = ["first", "wish", "handle", "contact", "done"];

export function Shell({
  step,
  onBack,
  children,
  testID,
}: {
  step: LinkStep;
  onBack?: (() => void) | null;
  children: ReactNode;
  testID?: string;
}) {
  const at = DOTS.indexOf(step);
  return (
    <ScrollView
      testID={testID}
      style={styles.page}
      contentContainerStyle={styles.content}
      {...formScrollProps}
    >
      <View style={styles.column}>
        {step !== "first" ? (
          <View style={styles.topBar}>
            {onBack ? (
              <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} testID="link-back">
                <Text style={styles.back}>←</Text>
              </Pressable>
            ) : (
              <View style={{ width: 22 }} />
            )}
            <View style={styles.dots} accessibilityLabel={`Step ${at + 1} of ${DOTS.length}`}>
              {DOTS.map((d, i) => (
                <View key={d} style={[styles.dot, i <= at && { backgroundColor: lv.thread }]} />
              ))}
            </View>
            <View style={{ width: 22 }} />
          </View>
        ) : null}
        {children}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: lv.bg },
  content: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40, alignItems: "center" },
  column: { width: "100%", maxWidth: 480, gap: 14 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 },
  back: { fontSize: 22, color: lv.fg },
  dots: { flexDirection: "row", gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: lv.border },
});
