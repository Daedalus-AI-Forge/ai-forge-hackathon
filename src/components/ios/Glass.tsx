// Frosted glass surfaces: real iOS materials on device, CSS backdrop-filter on the web,
// translucent white where neither exists (Android, or a dev client built without expo-blur).
import { BlurView, type BlurTint } from "expo-blur";
import { GlassView } from "expo-glass-effect";
import type { ReactNode } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type AccessibilityRole,
  type AccessibilityState,
  type Insets,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { layout, lv, shadows } from "@/theme/tokens";

import { canBlur, canLiquidGlass } from "./native";

export type GlassVariant = "regular" | "thin" | "thick" | "chrome" | "dark";

type Material = {
  tint: BlurTint;
  intensity: number;
  /** Wash over the native blur, for legibility. */
  overlay: string | null;
  web: string;
  webFilter: string;
  fallback: string;
};

const MATERIALS: Record<GlassVariant, Material> = {
  regular: {
    tint: "systemThinMaterialLight",
    intensity: 80,
    overlay: "rgba(255,255,255,0.34)",
    web: "rgba(255,255,255,0.58)",
    webFilter: "blur(28px) saturate(180%)",
    fallback: "rgba(255,255,255,0.86)",
  },
  thin: {
    tint: "systemUltraThinMaterialLight",
    intensity: 70,
    overlay: "rgba(255,255,255,0.14)",
    web: "rgba(255,255,255,0.40)",
    webFilter: "blur(22px) saturate(170%)",
    fallback: "rgba(255,255,255,0.72)",
  },
  thick: {
    tint: "systemMaterialLight",
    intensity: 90,
    overlay: "rgba(255,255,255,0.5)",
    web: "rgba(255,255,255,0.76)",
    webFilter: "blur(30px) saturate(180%)",
    fallback: "rgba(255,255,255,0.93)",
  },
  chrome: {
    tint: "systemChromeMaterialLight",
    intensity: 90,
    overlay: "rgba(255,255,255,0.2)",
    web: "rgba(250,250,252,0.62)",
    webFilter: "blur(24px) saturate(190%)",
    fallback: "rgba(250,250,252,0.94)",
  },
  dark: {
    tint: "systemThickMaterialDark",
    intensity: 85,
    overlay: "rgba(28,28,30,0.38)",
    web: "rgba(28,28,30,0.74)",
    webFilter: "blur(28px) saturate(160%)",
    fallback: "rgba(28,28,30,0.94)",
  },
};

const FRAME: Record<GlassVariant, ViewStyle> = {
  regular: { borderColor: "rgba(255,255,255,0.75)", boxShadow: shadows.card },
  thin: { borderColor: "rgba(255,255,255,0.6)", boxShadow: shadows.card },
  thick: { borderColor: "rgba(255,255,255,0.8)", boxShadow: shadows.card },
  chrome: { borderColor: "rgba(255,255,255,0.65)", boxShadow: shadows.float },
  dark: { borderColor: "rgba(255,255,255,0.12)", boxShadow: shadows.dark },
};

/**
 * Just the material layer, absolutely filling its parent. Put it first among the children.
 * `liquid: false` keeps a chrome surface on the classic blur even where Liquid Glass exists
 * (Liquid Glass is for floating controls, not bars that span the screen).
 */
export function GlassFill({ variant = "regular", radius = 0, liquid = true }: { variant?: GlassVariant; radius?: number; liquid?: boolean }) {
  const m = MATERIALS[variant];
  const fill = [StyleSheet.absoluteFill, { borderRadius: radius, pointerEvents: "none" } as const];
  if (Platform.OS === "web") {
    // backdrop-filter is not in RN's style types; react-native-web passes it straight to CSS.
    const web = { backgroundColor: m.web, backdropFilter: m.webFilter, WebkitBackdropFilter: m.webFilter } as ViewStyle;
    return <View style={[fill, web]} />;
  }
  if (variant === "chrome" && liquid && canLiquidGlass) {
    return <GlassView glassEffectStyle="regular" colorScheme="light" style={fill} />;
  }
  if (canBlur) {
    return (
      <>
        <BlurView tint={m.tint} intensity={m.intensity} style={fill} />
        {m.overlay ? <View style={[fill, { backgroundColor: m.overlay }]} /> : null}
      </>
    );
  }
  return <View style={[fill, { backgroundColor: m.fallback }]} />;
}

export type GlassProps = {
  children?: ReactNode;
  variant?: GlassVariant;
  /** Corner radius; continuous ("squircle") corners on iOS. */
  radius?: number;
  /** Circles and capsules need circular curves; defaults to circular only for radius >= 999. */
  curve?: "continuous" | "circular";
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** Makes the surface a button. Pressing scales it slightly; it never dims, so the blur stays intact on web. */
  onPress?: () => void;
  disabled?: boolean;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityState?: AccessibilityState;
  hitSlop?: Insets | number;
};

/** A frosted surface. No padding by default; use `GlassCard` for content cards. */
export function Glass({
  children,
  variant = "regular",
  radius = lv.radiusXl,
  curve = radius >= 999 ? "circular" : "continuous",
  style,
  testID,
  onPress,
  disabled,
  accessibilityRole,
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
  hitSlop,
}: GlassProps) {
  const frame = [styles.frame, FRAME[variant], { borderRadius: radius, borderCurve: curve }, style];
  const a11y = { testID, accessibilityLabel, accessibilityHint, accessibilityState };
  if (onPress) {
    return (
      <Pressable
        {...a11y}
        accessibilityRole={accessibilityRole ?? "button"}
        onPress={onPress}
        disabled={disabled}
        hitSlop={hitSlop}
        style={({ pressed }) => [frame, pressed && styles.pressed]}
      >
        {({ pressed }) => (
          <>
            <GlassFill variant={variant} radius={radius} />
            {pressed ? <View style={[StyleSheet.absoluteFill, styles.pressWash, variant === "dark" && styles.pressWashDark]} /> : null}
            {children}
          </>
        )}
      </Pressable>
    );
  }
  return (
    <View {...a11y} accessibilityRole={accessibilityRole} style={frame}>
      <GlassFill variant={variant} radius={radius} />
      {children}
    </View>
  );
}

/** A content card: glass with the standard card padding and spacing. */
export function GlassCard({ style, ...props }: GlassProps) {
  return <Glass {...props} style={[styles.card, style]} />;
}

const styles = StyleSheet.create({
  frame: { overflow: "hidden", borderWidth: StyleSheet.hairlineWidth },
  card: { padding: layout.cardPadding, gap: layout.stackGap },
  pressed: { transform: [{ scale: 0.98 }] },
  pressWash: { backgroundColor: "rgba(0,0,0,0.04)", pointerEvents: "none" },
  pressWashDark: { backgroundColor: "rgba(255,255,255,0.06)" },
});
