import { Text, View } from "react-native";

import { lv } from "@/theme/tokens";

/** Deterministic jewel tone per name (cream initial on top), so a person keeps their color everywhere. */
export function toneFor(name: string) {
  return lv.tones[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % lv.tones.length]!;
}

export function LvAvatar({ name, size = 34, ring = false }: { name: string; size?: number; ring?: boolean }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: toneFor(name),
        alignItems: "center",
        justifyContent: "center",
        borderWidth: ring ? 2 : 0,
        borderColor: "rgba(248,242,226,0.85)",
      }}
    >
      <Text style={{ fontSize: size * 0.4, fontWeight: "600", color: lv.fg }}>{name.slice(0, 1).toUpperCase() || "?"}</Text>
    </View>
  );
}
