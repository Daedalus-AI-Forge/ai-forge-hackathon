import type { Tabs } from "expo-router";
import { useEffect, useState, type ComponentProps } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { lv } from "@/theme/tokens";

import { Glass } from "./Glass";
import { TAB_BAR_HEIGHT, tabBarBottom } from "./metrics";

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

const useNativeDriver = Platform.OS !== "web";
const PAD = 5;

/** Floating glass tab bar (iOS 26): a capsule above the home indicator with a sliding selection lens. */
export function GlassTabBar({ state, descriptors, emitter, navigateToTab }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  // `href: null` tabs arrive as hidden routes; they get no button.
  const visible = state.routes.filter((r) => !(descriptors[r.key]?.options as { hidden?: boolean } | undefined)?.hidden);
  const focusedKey = state.routes[state.index]?.key;
  const at = Math.max(0, visible.findIndex((r) => r.key === focusedKey));
  const slot = width > 0 && visible.length > 0 ? width / visible.length : 0;
  const [x] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.spring(x, { toValue: at * slot, useNativeDriver, damping: 20, stiffness: 240, mass: 0.9 }).start();
  }, [x, at, slot]);

  return (
    <View style={[styles.wrap, { bottom: tabBarBottom(insets.bottom) }]}>
      <Glass variant="chrome" radius={TAB_BAR_HEIGHT / 2} curve="circular" style={styles.bar}>
        <View style={styles.row} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          {slot > 0 ? <Animated.View style={[styles.lens, { width: slot, transform: [{ translateX: x }] }]} /> : null}
          {visible.map((route) => {
            const { options } = descriptors[route.key]!;
            const focused = route.key === focusedKey;
            const color = focused ? lv.thread : lv.fg;
            const title = typeof options.title === "string" ? options.title : route.name;
            const onPress = () => {
              const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigateToTab(route.key);
            };
            return (
              <Pressable
                key={route.key}
                testID={options.tabBarButtonTestID}
                accessibilityRole="tab"
                accessibilityLabel={options.tabBarAccessibilityLabel ?? title}
                accessibilityState={{ selected: focused }}
                onPress={onPress}
                onLongPress={() => emitter.emit({ type: "tabLongPress", target: route.key })}
                style={({ pressed }) => [styles.item, pressed && styles.pressed]}
              >
                {options.tabBarIcon?.({ focused, color, size: 24 })}
                <Text style={[styles.label, { color }, focused && styles.labelOn]} numberOfLines={1}>
                  {title}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Glass>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, alignItems: "center", paddingHorizontal: 24, pointerEvents: "box-none" },
  bar: { width: "100%", maxWidth: 400, height: TAB_BAR_HEIGHT, padding: PAD },
  row: { flex: 1, flexDirection: "row" },
  lens: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: TAB_BAR_HEIGHT / 2 - PAD,
    backgroundColor: "rgba(118,118,128,0.14)",
  },
  item: { flex: 1, alignItems: "center", justifyContent: "center", gap: 1 },
  pressed: { transform: [{ scale: 0.94 }] },
  label: { fontSize: 10, lineHeight: 12, fontWeight: "500" },
  labelOn: { fontWeight: "600" },
});
