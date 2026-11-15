// Which native visual effects this build actually contains.
// A dev client built before expo-blur / expo-symbols were added has no native views for them;
// rendering one there would fail, so every effect checks here first and falls back to plain views.
import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

function hasModule(name: string) {
  try {
    return requireOptionalNativeModule(name) != null;
  } catch {
    return false;
  }
}

/** Real UIVisualEffectView materials (iOS). Web uses CSS backdrop-filter instead. */
export const canBlur = Platform.OS === "ios" && hasModule("ExpoBlur");

/** SF Symbols (iOS). */
export const canSymbols = Platform.OS === "ios" && hasModule("SymbolModule");

/** iOS 26+ Liquid Glass for floating chrome (tab bar, round nav buttons). */
export const canLiquidGlass = (() => {
  if (Platform.OS !== "ios") return false;
  try {
    const m = requireOptionalNativeModule<{ isLiquidGlassAvailable?: boolean; isGlassEffectAPIAvailable?: boolean }>(
      "ExpoGlassEffect",
    );
    return !!m?.isLiquidGlassAvailable && !!m?.isGlassEffectAPIAvailable;
  } catch {
    return false;
  }
})();
