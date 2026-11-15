// New-design primitives for the pass-on page (buttons, glass panel, fields, chips).
import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { lv } from "@/theme/tokens";
import { keyboardInputProps } from "@/components/keyboard";

type Variant = "thread" | "ink" | "ghost";

export function DButton({
  title,
  onPress,
  variant = "thread",
  disabled,
  busy,
  testID,
  size = "md",
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  busy?: boolean;
  testID?: string;
  size?: "sm" | "md" | "lg";
  style?: StyleProp<ViewStyle>;
}) {
  const inactive = disabled || busy;
  const fg = variant === "ghost" ? lv.fg : variant === "ink" ? lv.primaryFg : lv.threadFg;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!busy }}
      onPress={inactive ? undefined : onPress}
      style={({ pressed }) => [
        s.btn,
        { height: size === "lg" ? 56 : size === "sm" ? 44 : 52 },
        variant === "thread" && { backgroundColor: lv.thread },
        variant === "ink" && { backgroundColor: lv.primary },
        variant === "ghost" && s.ghost,
        inactive && { opacity: 0.45 },
        pressed && { transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[s.btnText, { color: fg, fontSize: size === "lg" ? 17 : size === "sm" ? 15 : 16 }]}>{title}</Text>
      )}
    </Pressable>
  );
}

/** Frosted "glass" panel. */
export function Glass({ children, style, testID }: { children: ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  return (
    <View testID={testID} style={[s.glass, style]}>
      {children}
    </View>
  );
}

export function DCard({ children, style, testID }: { children: ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  return (
    <View testID={testID} style={[s.card, style]}>
      {children}
    </View>
  );
}

export function Eyebrow({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.eyebrow, style]}>{children}</Text>;
}

export function Sub({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.sub, style]}>{children}</Text>;
}

/**
 * Labelled text field. The wrapper never flexes on its own: in a column it takes its content's
 * height (a `flexBasis: 0` wrapper collapses to 0px on react-native-web, letting the next element
 * draw over the input). Inside a row, pass `containerStyle={{ flex: 1 }}`.
 */
export function DField({
  label,
  containerStyle,
  ...props
}: TextInputProps & { label?: string; containerStyle?: StyleProp<ViewStyle> }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[s.fieldWrap, containerStyle]}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={lv.mutedFg}
        accessibilityLabel={label}
        {...keyboardInputProps(props)}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        style={[
          s.field,
          props.multiline && s.fieldMulti,
          focused && { borderColor: lv.fg },
          props.editable === false && { backgroundColor: lv.muted, color: lv.mutedFg },
          props.style,
        ]}
      />
    </View>
  );
}

/** Chip row; testIDs match the legacy `${prefix}-${option}` scheme. */
export function DChips({
  label,
  options,
  value,
  onChange,
  testIDPrefix,
}: {
  label?: string;
  options: readonly string[];
  value: string | readonly string[] | null;
  onChange: (v: string) => void;
  testIDPrefix?: string;
}) {
  const on = (o: string) => (Array.isArray(value) ? value.includes(o) : value === o);
  return (
    <View style={s.fieldWrap}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <View style={s.chipRow}>
        {options.map((o) => (
          <Pressable
            key={o}
            testID={testIDPrefix ? `${testIDPrefix}-${o.replace(/\W+/g, "-")}` : undefined}
            accessibilityRole="button"
            accessibilityState={{ selected: on(o) }}
            onPress={() => onChange(o)}
            style={[s.chip, on(o) && { backgroundColor: lv.fg, borderColor: lv.fg }]}
          >
            <Text style={[s.chipText, on(o) && { color: lv.bg }]}>{o}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function DError({ error }: { error: string | null }) {
  return error ? (
    <Text style={s.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
      {error}
    </Text>
  ) : null;
}

/** Quiet line under a disabled primary button saying what is still missing. */
export function DHint({ children, testID }: { children: ReactNode; testID?: string }) {
  return children ? (
    <Text style={s.hint} testID={testID} accessibilityLiveRegion="polite">
      {children}
    </Text>
  ) : null;
}

export function DAvatar({ name, color, size = 28 }: { name: string; color: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: "#fff", fontWeight: "700", fontSize: size * 0.42 }}>{(name.trim()[0] ?? "?").toUpperCase()}</Text>
    </View>
  );
}

export const s = StyleSheet.create({
  btn: { borderRadius: 999, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  ghost: { backgroundColor: "rgba(254,253,251,0.7)", borderWidth: 1, borderColor: lv.border },
  btnText: { fontWeight: "600" },
  glass: {
    backgroundColor: "rgba(254,253,251,0.72)",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
    padding: 16,
    gap: 10,
    ...lv.shadow,
  },
  card: { backgroundColor: lv.card, borderRadius: lv.radius, borderWidth: 1, borderColor: lv.border, padding: 20, gap: 18, ...lv.shadow },
  eyebrow: { fontSize: 11, fontWeight: "600", letterSpacing: 1.5, textTransform: "uppercase", color: lv.mutedFg },
  sub: { fontSize: 15, color: lv.mutedFg, lineHeight: 21 },
  fieldWrap: { gap: 8, alignSelf: "stretch" },
  label: { fontSize: 15, lineHeight: 20, color: lv.fg, fontWeight: "600" },
  field: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: lv.bg,
    borderWidth: 1.5,
    borderColor: lv.fieldBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 17,
    lineHeight: 22,
    color: lv.fg,
  },
  fieldMulti: { minHeight: 96, textAlignVertical: "top" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 40,
    justifyContent: "center",
    borderRadius: 999,
    paddingHorizontal: 16,
    backgroundColor: lv.bg,
    borderWidth: 1.5,
    borderColor: lv.fieldBorder,
  },
  chipText: { fontSize: 15, color: lv.fg },
  error: { color: lv.destructive, fontSize: 15, lineHeight: 20 },
  hint: { color: lv.mutedFg, fontSize: 14, lineHeight: 19, textAlign: "center" },
});
