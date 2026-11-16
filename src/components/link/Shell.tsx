// Wizard frame for the link page: background, back arrow, step dots, centered column.
// Also holds the pure step transitions so the route stays a thin composer.
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { BackButton, NavBar, Screen } from "@/components/ios";
import type { LinkStep } from "@/lib/linkDraft";
import { lv } from "@/theme/tokens";

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
    <Screen testID={testID} maxWidth={480} contentStyle={styles.column}>
      {step !== "first" ? (
        <NavBar
          left={onBack ? <BackButton onPress={onBack} testID="link-back" /> : null}
          center={
            <View style={styles.dots} accessibilityLabel={`Step ${at + 1} of ${DOTS.length}`}>
              {DOTS.map((d, i) => (
                <View key={d} style={[styles.dot, i <= at && styles.dotDone, i === at && styles.dotNow]} />
              ))}
            </View>
          }
        />
      ) : null}
      {children}
    </Screen>
  );
}

const styles = StyleSheet.create({
  column: { gap: 18 },
  dots: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: lv.fillStrong },
  dotDone: { backgroundColor: lv.thread },
  dotNow: { width: 18 },
});
