// Shared controls in the iOS style: capsule buttons, glass cards, filled text fields, chips.
// Every screen builds on these, so sizes and colors stay identical across the app.
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

import { Glass as GlassSurface, GlassCard, Icon, type IconName } from "@/components/ios";
import { keyboardInputProps } from "@/components/keyboard";
import { lv, night, shadows, type } from "@/theme/tokens";

/**
 * thread: brand red, filled (primary action) · ink: dark filled · ghost: iOS gray fill ·
 * tinted: red label on a red tint · plain: text only · glass: frosted capsule for floating over the backdrop ·
 * gold: the night pool's gold capsule.
 */
type Variant = "thread" | "ink" | "ghost" | "tinted" | "plain" | "glass" | "gold";
type Size = "sm" | "md" | "lg";

// sm stays compact but gets a hit slop, so every button has at least a 44-pt target.
const HEIGHT: Record<Size, number> = { sm: 40, md: 48, lg: 54 };
const FONT: Record<Size, number> = { sm: 15, md: 16, lg: 17 };
const FG: Record<Variant, string> = {
  thread: lv.threadFg,
  ink: lv.primaryFg,
  ghost: lv.fg,
  tinted: lv.thread,
  plain: lv.thread,
  glass: lv.fg,
  gold: night.goldFg,
};
const BG: Record<Exclude<Variant, "glass">, ViewStyle> = {
  thread: { backgroundColor: lv.thread },
  ink: { backgroundColor: lv.primary },
  ghost: { backgroundColor: lv.fill },
  tinted: { backgroundColor: lv.threadTint },
  plain: { backgroundColor: "transparent" },
  gold: { backgroundColor: night.gold, boxShadow: "0px 4px 18px rgba(233,199,102,0.55)" },
};

export function DButton({
  title,
  onPress,
  variant = "thread",
  disabled,
  busy,
  testID,
  size = "md",
  icon,
  tone = "light",
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  busy?: boolean;
  testID?: string;
  size?: Size;
  icon?: IconName;
  /** "night" on the night pool: ghost becomes a light-on-dark fill and plain turns gold. */
  tone?: "light" | "night";
  style?: StyleProp<ViewStyle>;
}) {
  const inactive = !!disabled || !!busy;
  const nightTone = tone === "night" && (variant === "ghost" || variant === "plain");
  const fg = nightTone
    ? variant === "ghost"
      ? night.fg
      : night.gold
    : variant === "glass" && inactive && !busy
      ? lv.tertiaryFg
      : FG[variant];
  const content = busy ? (
    <ActivityIndicator color={fg} />
  ) : (
    <View style={s.labelRow}>
      {icon ? <Icon name={icon} size={FONT[size]} color={fg} /> : null}
      <Text style={[s.btnText, { color: fg, fontSize: FONT[size] }]} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );

  if (variant === "glass") {
    // A glass surface never dims (opacity would break the blur on web); its label greys out instead.
    return (
      <GlassSurface
        variant="regular"
        radius={999}
        testID={testID}
        onPress={onPress}
        disabled={inactive}
        accessibilityState={{ disabled: inactive, busy: !!busy }}
        style={[s.btn, { height: HEIGHT[size] }, style]}
      >
        {content}
      </GlassSurface>
    );
  }

  const lift = size === "lg" && !inactive ? (variant === "thread" ? s.liftThread : variant === "ink" ? s.liftInk : null) : null;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: !!busy }}
      onPress={inactive ? undefined : onPress}
      hitSlop={size === "sm" ? 4 : undefined}
      style={({ pressed }) => [
        s.btn,
        { height: HEIGHT[size] },
        BG[variant],
        nightTone && variant === "ghost" && s.ghostNight,
        lift,
        variant === "plain" && s.plain,
        inactive && s.inactive,
        pressed && !inactive && s.pressed,
        style,
      ]}
    >
      {content}
    </Pressable>
  );
}

/** Frosted content card. */
export function Glass({ children, style, testID }: { children: ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  return (
    <GlassCard testID={testID} style={style}>
      {children}
    </GlassCard>
  );
}

/** Content card for forms and dense text: the same glass, a little more opaque, with roomier rows. */
export function DCard({ children, style, testID }: { children: ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  return (
    <GlassCard variant="thick" testID={testID} style={[s.formCard, style]}>
      {children}
    </GlassCard>
  );
}

export function Eyebrow({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.eyebrow, style]}>{children}</Text>;
}

export function Sub({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.sub, style]}>{children}</Text>;
}

/**
 * iOS text field: gray fill with a faint outline; a red ring while focused.
 * The wrapper never flexes by default: in a column it takes its content's height (a `flexBasis: 0`
 * wrapper collapses to 0px on react-native-web). Side by side in a row, pass `grow`
 * (or `containerStyle={{ flex: 1 }}`) so the fields share the row.
 */
export function DField({
  label,
  onFocus,
  onBlur,
  grow = false,
  containerStyle,
  ...props
}: TextInputProps & { label?: string; grow?: boolean; containerStyle?: StyleProp<ViewStyle> }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[s.fieldWrap, grow && s.fieldGrow, containerStyle]}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={lv.tertiaryFg}
        selectionColor={lv.thread}
        accessibilityLabel={label}
        {...keyboardInputProps(props)}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[s.field, props.multiline && s.fieldMulti, focused && s.fieldFocused, props.editable === false && s.fieldOff, props.style]}
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
    <View style={{ gap: 8 }}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <View style={s.chipRow}>
        {options.map((o) => (
          <Pressable
            key={o}
            testID={testIDPrefix ? `${testIDPrefix}-${o.replace(/\W+/g, "-")}` : undefined}
            accessibilityRole="button"
            accessibilityState={{ selected: on(o) }}
            onPress={() => onChange(o)}
            style={({ pressed }) => [s.chip, on(o) && s.chipOn, pressed && s.chipPressed]}
          >
            <Text style={[s.chipText, on(o) && s.chipTextOn]}>{o}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

type TagTone = "thread" | "threadSolid" | "gold" | "neutral" | "ink";
const TAG: Record<TagTone, { bg: string; fg: string }> = {
  thread: { bg: lv.threadTint, fg: lv.thread },
  threadSolid: { bg: lv.thread, fg: lv.threadFg },
  gold: { bg: lv.goldTint, fg: "#7A5A12" },
  neutral: { bg: lv.fill, fg: lv.mutedFg },
  ink: { bg: lv.fg, fg: lv.primaryFg },
};

/** Small capsule label ("Today's boat", "Mia's real wish", "Your coin"). */
export function DTag({ label, tone = "thread", testID }: { label: string; tone?: TagTone; testID?: string }) {
  return (
    <View testID={testID} style={[s.tag, { backgroundColor: TAG[tone].bg }]}>
      <Text style={[s.tagText, { color: TAG[tone].fg }]} numberOfLines={1}>
        {label}
      </Text>
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
    <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
      <Text style={{ color: "#fff", fontWeight: "700", fontSize: size * 0.42 }}>{(name.trim()[0] ?? "?").toUpperCase()}</Text>
    </View>
  );
}

export const s = StyleSheet.create({
  btn: { borderRadius: 999, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  btnText: { fontWeight: "600", textAlign: "center" },
  plain: { paddingHorizontal: 8 },
  ghostNight: { backgroundColor: "rgba(255,255,255,0.12)" },
  liftThread: { boxShadow: shadows.button },
  liftInk: { boxShadow: shadows.ink },
  inactive: { opacity: 0.4 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  eyebrow: { ...type.eyebrow, color: lv.mutedFg },
  sub: { ...type.subheadline, color: lv.mutedFg },
  label: { ...type.subheadline, fontWeight: "600", color: lv.fg, paddingHorizontal: 4 },
  formCard: { gap: 16 },
  fieldWrap: { gap: 8, alignSelf: "stretch" },
  fieldGrow: { flexGrow: 1, flexBasis: 0 },
  field: {
    minHeight: 50,
    borderRadius: lv.radiusSm,
    borderCurve: "continuous",
    backgroundColor: lv.fill,
    borderWidth: 1,
    borderColor: lv.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 17,
    lineHeight: 22,
    color: lv.fg,
    outlineWidth: 0,
  },
  fieldMulti: { minHeight: 96, textAlignVertical: "top", paddingTop: 12 },
  fieldFocused: { backgroundColor: "rgba(255,255,255,0.85)", borderColor: lv.thread },
  fieldOff: { color: lv.mutedFg, backgroundColor: lv.fillStrong },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 38,
    justifyContent: "center",
    borderRadius: 999,
    paddingHorizontal: 15,
    backgroundColor: lv.fill,
  },
  chipOn: { backgroundColor: lv.fg },
  chipPressed: { opacity: 0.7 },
  chipText: { ...type.subheadline, fontWeight: "500", color: lv.fg },
  chipTextOn: { color: lv.primaryFg, fontWeight: "600" },
  tag: { alignSelf: "flex-start", flexShrink: 1, height: 24, justifyContent: "center", borderRadius: 999, paddingHorizontal: 10 },
  tagText: { ...type.caption1, fontWeight: "600" },
  error: { ...type.subheadline, color: lv.destructive },
  hint: { ...type.footnote, color: lv.mutedFg, textAlign: "center" },
  avatar: { alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.9)" },
});
