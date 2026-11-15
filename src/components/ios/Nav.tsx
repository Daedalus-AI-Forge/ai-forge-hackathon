import { useEffect, useState, type ReactNode } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { layout, lv, type } from "@/theme/tokens";

import { Glass } from "./Glass";
import { Icon } from "./Icon";

const useNativeDriver = Platform.OS !== "web";

/** iOS 26 back button: a round glass control with a chevron. */
export function BackButton({ onPress, testID, label = "Back" }: { onPress: () => void; testID?: string; label?: string }) {
  return (
    <Glass
      variant="chrome"
      radius={22}
      curve="circular"
      onPress={onPress}
      testID={testID}
      accessibilityLabel={label}
      hitSlop={8}
      style={styles.round}
    >
      <Icon name="back" size={19} color={lv.fg} weight="semibold" />
    </Glass>
  );
}

/** Top row of a pushed screen: back button on the left, an optional accessory on the right. */
export function NavBar({ left, center, right }: { left?: ReactNode; center?: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.navbar}>
      <View style={styles.side}>{left}</View>
      <View style={styles.center}>{center}</View>
      <View style={[styles.side, styles.sideRight]}>{right}</View>
    </View>
  );
}

/**
 * Screen title. `large` is the 34-pt tab-root title; `title` the 28-pt title of a pushed screen.
 * Sits on the page margin, like iOS large titles.
 */
export function LargeTitle({
  eyebrow,
  title,
  subtitle,
  right,
  size = "large",
  eyebrowColor = lv.mutedFg,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  size?: "large" | "title";
  eyebrowColor?: string;
}) {
  return (
    <View style={styles.titleRow}>
      <View style={styles.titleCol}>
        {eyebrow ? <Text style={[type.eyebrow, { color: eyebrowColor }]}>{eyebrow}</Text> : null}
        <Text style={[size === "large" ? type.largeTitle : type.title1, styles.title]}>{title}</Text>
        {subtitle ? <Text style={[type.subheadline, styles.subtitle]}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.titleRight}>{right}</View> : null}
    </View>
  );
}

/**
 * Header above a group of content.
 * - `caps` (default): small uppercase label inset to line up with the card content below it.
 * - `title`: a bold 20-pt heading on the page margin, lined up with the card edges.
 */
export function SectionHeader({
  title,
  right,
  variant = "caps",
  color,
  style,
}: {
  title: ReactNode;
  right?: ReactNode;
  variant?: "caps" | "title";
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const caps = variant === "caps";
  return (
    <View style={[styles.section, caps && styles.sectionCaps, style]}>
      <Text style={[caps ? type.eyebrow : styles.sectionTitle, { color: color ?? (caps ? lv.mutedFg : lv.fg) }, styles.sectionText]}>
        {title}
      </Text>
      {right}
    </View>
  );
}

export type SegmentOption<K extends string> = { key: K; label: string; testID?: string };

/** iOS segmented control on glass, with a sliding thumb. */
export function Segmented<K extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly SegmentOption<K>[];
  value: K;
  onChange: (k: K) => void;
}) {
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.key === value));
  const thumb = width > 0 ? width / options.length : 0;
  const [x] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.spring(x, { toValue: index * thumb, useNativeDriver, damping: 22, stiffness: 260, mass: 0.9 }).start();
  }, [x, index, thumb]);
  return (
    <Glass variant="thin" radius={999} style={styles.segment}>
      <View style={styles.segmentInner} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {thumb > 0 ? <Animated.View style={[styles.thumb, { width: thumb, transform: [{ translateX: x }] }]} /> : null}
        {options.map((o) => {
          const on = o.key === value;
          return (
            <Pressable
              key={o.key}
              testID={o.testID}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => onChange(o.key)}
              style={styles.segmentBtn}
            >
              <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </Glass>
  );
}

const SEG_PAD = 3;

const styles = StyleSheet.create({
  round: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  navbar: { flexDirection: "row", alignItems: "center", minHeight: 44 },
  side: { minWidth: 44, flexDirection: "row", alignItems: "center" },
  sideRight: { justifyContent: "flex-end" },
  center: { flex: 1, alignItems: "center", paddingHorizontal: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 4 },
  titleCol: { flex: 1, minWidth: 0, gap: 2 },
  title: { color: lv.fg },
  subtitle: { color: lv.mutedFg, marginTop: 4 },
  titleRight: { alignItems: "flex-end", justifyContent: "center" },
  section: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 28, marginBottom: -6 },
  sectionCaps: { paddingHorizontal: layout.cardPadding },
  sectionTitle: { ...type.title3, fontWeight: "700" },
  sectionText: { flexShrink: 1 },
  segment: { padding: SEG_PAD, boxShadow: "none" },
  segmentInner: { flexDirection: "row" },
  thumb: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    boxShadow: "0px 3px 8px rgba(0,0,0,0.12), 0px 1px 1px rgba(0,0,0,0.04)",
  },
  segmentBtn: { flex: 1, height: 34, alignItems: "center", justifyContent: "center" },
  segmentText: { ...type.subheadline, fontWeight: "500", color: lv.mutedFg },
  segmentTextOn: { color: lv.fg, fontWeight: "600" },
});
