import { Text, type ColorValue } from "react-native";

/** Text glyph tab icon (no icon library in the bundle). Thicker when focused, like the new design's stroke swap. */
export function TabGlyph({ char, color, focused }: { char: string; color: ColorValue; focused: boolean }) {
  return <Text style={{ fontSize: 21, lineHeight: 24, color, fontWeight: focused ? "800" : "500" }}>{char}</Text>;
}
