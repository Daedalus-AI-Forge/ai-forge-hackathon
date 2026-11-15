// Legacy primitives (sign-in, account, a few older screens), now drawn with the shared kit so
// they match the rest of the app.
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from "react-native";

import { GlassCard } from "@/components/ios";
import { DButton, DField } from "@/components/lv/passon/kit";
import { lv, type } from "@/theme/tokens";

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled,
  busy,
  testID,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  busy?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <DButton
      title={title}
      onPress={onPress}
      variant={variant === "primary" ? "thread" : variant === "secondary" ? "glass" : "plain"}
      size="lg"
      disabled={disabled}
      busy={busy}
      testID={testID}
      style={style}
    />
  );
}

export function Card({ children, style, testID }: { children: ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  return (
    <GlassCard testID={testID} style={style}>
      {children}
    </GlassCard>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipOn]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({
  options,
  value,
  onChange,
  testIDPrefix,
}: {
  options: readonly string[];
  value: string | null;
  onChange: (v: string) => void;
  testIDPrefix?: string;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((o) => (
        <Chip
          key={o}
          label={o}
          selected={value === o}
          onPress={() => onChange(o)}
          testID={testIDPrefix ? `${testIDPrefix}-${o.replace(/\W+/g, "-")}` : undefined}
        />
      ))}
    </View>
  );
}

export function Field(props: TextInputProps & { label?: string }) {
  return <DField {...props} />;
}

export function Avatar({ name, color, size = 36 }: { name: string; color: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: "rgba(255,255,255,0.92)",
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "700", fontSize: size * 0.42 }}>{(name.trim()[0] ?? "?").toUpperCase()}</Text>
    </View>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Muted({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

export function ErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  return <Text style={styles.error}>{error}</Text>;
}

export function errorMessage(e: unknown) {
  const raw = e instanceof Error ? e.message : String(e);
  const match = raw.match(/Uncaught Error: (.*?)(\n|$)/);
  return match ? match[1] : raw;
}

const styles = StyleSheet.create({
  chip: { minHeight: 34, justifyContent: "center", paddingHorizontal: 14, borderRadius: 999, backgroundColor: lv.fill },
  chipOn: { backgroundColor: lv.fg },
  chipText: { ...type.subheadline, fontWeight: "500", color: lv.fg },
  chipTextOn: { color: lv.primaryFg, fontWeight: "600" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  title: { ...type.title1, color: lv.fg },
  muted: { ...type.subheadline, color: lv.mutedFg },
  error: { ...type.footnote, color: lv.destructive },
});
