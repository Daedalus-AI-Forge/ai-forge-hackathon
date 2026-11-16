import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { Text, View, type ColorValue } from "react-native";

import { canSymbols } from "./native";

type SFName = Extract<SymbolViewProps["name"], string>;

/** App icons: an SF Symbol on iOS, a text glyph (or a drawn chevron) everywhere else. */
const ICONS = {
  pool: { sf: "water.waves", glyph: "≋", scale: 1.35 },
  poolFill: { sf: "water.waves", glyph: "≋", scale: 1.35 },
  voyages: { sf: "sailboat", glyph: "⛵︎" },
  voyagesFill: { sf: "sailboat.fill", glyph: "⛵︎" },
  me: { sf: "person.crop.circle", glyph: "◯" },
  meFill: { sf: "person.crop.circle.fill", glyph: "◉" },
  back: { sf: "chevron.left", glyph: "chevron-left" },
  forward: { sf: "chevron.right", glyph: "chevron-right" },
  close: { sf: "xmark", glyph: "✕" },
  sparkles: { sf: "sparkles", glyph: "✦" },
  share: { sf: "square.and.arrow.up", glyph: "↑" },
  lock: { sf: "lock.fill", glyph: "🔒" },
  check: { sf: "checkmark", glyph: "✓" },
  plus: { sf: "plus", glyph: "+" },
  group: { sf: "person.2.fill", glyph: "👥" },
  contact: { sf: "person.crop.circle.badge.plus", glyph: "＋" },
  search: { sf: "magnifyingglass", glyph: "⌕", scale: 1.2 },
  recenter: { sf: "scope", glyph: "◎" },
  minus: { sf: "minus", glyph: "−" },
  boat: { sf: "sailboat.fill", glyph: "⛵︎" },
} as const satisfies Record<string, { sf: SFName; glyph: string; scale?: number }>;

export type IconName = keyof typeof ICONS;

function Chevron({ size, color, dir }: { size: number; color: ColorValue; dir: "left" | "right" }) {
  const arm = size * 0.46;
  const stroke = Math.max(2, size * 0.11);
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View
        style={{
          width: arm,
          height: arm,
          borderLeftWidth: stroke,
          borderBottomWidth: stroke,
          borderColor: color,
          borderBottomLeftRadius: stroke / 2,
          marginLeft: dir === "left" ? arm * 0.35 : -arm * 0.35,
          transform: [{ rotate: dir === "left" ? "45deg" : "-135deg" }],
        }}
      />
    </View>
  );
}

export function Icon({
  name,
  size = 20,
  color,
  weight = "semibold",
}: {
  name: IconName;
  size?: number;
  color: ColorValue;
  weight?: SymbolViewProps["weight"];
}) {
  const icon = ICONS[name];
  const scale = "scale" in icon ? icon.scale : 1;
  const fallback =
    icon.glyph === "chevron-left" || icon.glyph === "chevron-right" ? (
      <Chevron size={size} color={color} dir={icon.glyph === "chevron-left" ? "left" : "right"} />
    ) : (
      <Text style={{ fontSize: size * 0.95 * scale, lineHeight: size * 1.15, color, textAlign: "center", minWidth: size }}>{icon.glyph}</Text>
    );
  if (!canSymbols) return fallback;
  return (
    <SymbolView
      name={icon.sf}
      size={size}
      tintColor={color}
      weight={weight}
      type="monochrome"
      resizeMode="scaleAspectFit"
      fallback={fallback}
    />
  );
}
