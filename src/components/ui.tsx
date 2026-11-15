import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";

import { colors, radius } from "@/lib/theme";
import { keyboardInputProps } from "@/components/keyboard";

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
  const inactive = disabled || busy;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={inactive ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        variant === "primary" && styles.primary,
        variant === "secondary" && styles.secondary,
        variant === "ghost" && styles.ghost,
        inactive && { opacity: 0.5 },
        pressed && { transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={variant === "primary" ? "#fff" : colors.red} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            variant === "primary" ? { color: "#fff" } : { color: variant === "ghost" ? colors.muted : colors.red },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function Card({ children, style, testID }: { children: ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  return (
    <View testID={testID} style={[styles.card, style]}>
      {children}
    </View>
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
      onPress={onPress}
      style={[styles.chip, selected && { backgroundColor: colors.red, borderColor: colors.red }]}
    >
      <Text style={[styles.chipText, selected && { color: "#fff" }]}>{label}</Text>
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

export function Field({ label, ...props }: TextInputProps & { label?: string }) {
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput placeholderTextColor="#B0A796" {...keyboardInputProps(props)} style={[styles.input, props.multiline && { minHeight: 84, textAlignVertical: "top" }, props.style]} />
    </View>
  );
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
        borderColor: "#fff",
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "800", fontSize: size * 0.42 }}>
        {(name.trim()[0] ?? "?").toUpperCase()}
      </Text>
    </View>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Muted({ children, style }: { children: ReactNode; style?: StyleProp<import("react-native").TextStyle> }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

export function ErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  return <Text style={{ color: colors.red, fontSize: 14 }}>{error}</Text>;
}

export function errorMessage(e: unknown) {
  const raw = e instanceof Error ? e.message : String(e);
  const match = raw.match(/Uncaught Error: (.*?)(\n|$)/);
  return match ? match[1] : raw;
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: radius.pill,
    paddingHorizontal: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: { backgroundColor: colors.red },
  secondary: { backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.red },
  ghost: { backgroundColor: "transparent" },
  buttonText: { fontSize: 17, fontWeight: "700" },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: 18,
    gap: 10,
    shadowColor: "#7A5C2E",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  chipText: { fontSize: 15, color: colors.ink, fontWeight: "600" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  label: { fontSize: 14, color: colors.muted, fontWeight: "600" },
  input: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.line,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 17,
    color: colors.ink,
  },
  title: { fontSize: 26, fontWeight: "800", color: colors.ink },
  muted: { fontSize: 15, color: colors.muted, lineHeight: 21 },
});
