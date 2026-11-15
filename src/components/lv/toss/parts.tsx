import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from "react-native";

import { lv } from "@/theme/tokens";

const TONES = ["#F1E2D3", "#DCE8DC", "#DCE3EE", "#F3DCD8", "#E6E0D2"];

export function LvAvatar({ name, size = 36 }: { name: string; size?: number }) {
  const bg = TONES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % TONES.length];
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: size * 0.4, fontWeight: "600", color: lv.fg }}>{(name.trim()[0] ?? "?").toUpperCase()}</Text>
    </View>
  );
}

export function LvCard({ children, style, testID }: { children: ReactNode; style?: ViewStyle; testID?: string }) {
  return (
    <View testID={testID} style={[s.card, style]}>
      {children}
    </View>
  );
}

export function Eyebrow({ children, color = lv.mutedFg }: { children: ReactNode; color?: string }) {
  return <Text style={[s.eyebrow, { color }]}>{children}</Text>;
}

export function LvField(props: TextInputProps) {
  return <TextInput placeholderTextColor={lv.mutedFg} {...props} style={[s.field, props.multiline && s.area, props.style]} />;
}

type Variant = "thread" | "ink" | "ghost";
export function LvButton({
  title,
  onPress,
  variant = "ink",
  disabled,
  busy,
  testID,
  compact,
}: {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  busy?: boolean;
  testID?: string;
  compact?: boolean;
}) {
  const bg = variant === "thread" ? lv.thread : variant === "ink" ? lv.primary : "transparent";
  const fg = variant === "ghost" ? lv.fg : lv.primaryFg;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        s.btn,
        compact && s.btnCompact,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
        variant === "ghost" && s.btnGhost,
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[s.btnText, compact && { fontSize: 14 }, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: lv.card, borderRadius: lv.radiusXl, borderWidth: 1, borderColor: lv.border, padding: 18, gap: 12, ...lv.shadow },
  eyebrow: { fontSize: 11, fontWeight: "600", letterSpacing: 1.4, textTransform: "uppercase" },
  field: {
    backgroundColor: lv.bg,
    borderWidth: 1,
    borderColor: lv.border,
    borderRadius: lv.radiusSm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: lv.fg,
  },
  area: { minHeight: 96, textAlignVertical: "top" },
  btn: { height: 52, borderRadius: 999, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  btnCompact: { height: 38, paddingHorizontal: 16 },
  btnGhost: { borderWidth: 1, borderColor: lv.border, backgroundColor: lv.card },
  btnText: { fontSize: 16, fontWeight: "600" },
});
