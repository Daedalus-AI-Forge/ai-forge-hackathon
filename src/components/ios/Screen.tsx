import { useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { formScrollProps } from "@/components/keyboard";
import { layout, lv } from "@/theme/tokens";

import { Backdrop } from "./Backdrop";
import { GlassFill } from "./Glass";
import { tabClearance } from "./metrics";

const useNativeDriver = Platform.OS !== "web";

/** Frosted strip under the status bar that fades in once content scrolls beneath it (iOS scroll edge). */
function ScrollEdge({ height, visible }: { height: number; visible: boolean }) {
  const [t] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(t, { toValue: visible ? 1 : 0, duration: 180, useNativeDriver }).start();
  }, [t, visible]);
  return (
    <Animated.View style={[styles.edge, { height, opacity: t }]}>
      <GlassFill variant="chrome" liquid={false} />
      <View style={styles.edgeLine} />
    </Animated.View>
  );
}

export type ScreenProps = {
  children: ReactNode;
  testID?: string;
  /** Tab root: leave room for the floating tab bar. */
  tab?: boolean;
  /** A native stack header sits above (modals): iOS insets the content under it automatically. */
  nativeHeader?: boolean;
  maxWidth?: number;
  contentStyle?: StyleProp<ViewStyle>;
  /** Replaces the ambient backdrop (e.g. the Pool tab's night scene). */
  backdrop?: ReactNode;
};

/**
 * Page scaffold shared by every screen: ambient backdrop, safe areas, page margins, a centered
 * readable column and the frosted scroll edge. Children stack with the standard gap.
 */
export function Screen({ children, testID, tab, nativeHeader, maxWidth = layout.maxWidth, contentStyle, backdrop }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const [scrolled, setScrolled] = useState(false);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setScrolled(e.nativeEvent.contentOffset.y > 6);
  const top = nativeHeader ? 16 : insets.top + 8;
  const bottom = tab ? tabClearance(insets.bottom) : insets.bottom + 40;
  return (
    <View style={styles.root}>
      {backdrop ?? <Backdrop />}
      <ScrollView
        testID={testID}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { maxWidth, paddingTop: top, paddingBottom: bottom }, contentStyle]}
        {...formScrollProps}
        contentInsetAdjustmentBehavior={nativeHeader ? "automatic" : "never"}
        scrollEventThrottle={32}
        onScroll={nativeHeader ? undefined : onScroll}
      >
        {children}
      </ScrollView>
      {!nativeHeader && insets.top > 0 ? <ScrollEdge height={insets.top} visible={scrolled} /> : null}
    </View>
  );
}

/** Full-screen centered state (loading, missing) on the same backdrop. */
export function CenterScreen({ children, testID }: { children?: ReactNode; testID?: string }) {
  return (
    <View testID={testID} style={[styles.root, styles.center]}>
      <Backdrop />
      {children ?? <ActivityIndicator color={lv.thread} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: lv.bg },
  scroll: { flex: 1 },
  content: { width: "100%", alignSelf: "center", paddingHorizontal: layout.margin, gap: 16 },
  center: { alignItems: "center", justifyContent: "center", gap: 10, padding: layout.margin * 1.5 },
  edge: { position: "absolute", top: 0, left: 0, right: 0, pointerEvents: "none" },
  edgeLine: { position: "absolute", left: 0, right: 0, bottom: 0, height: StyleSheet.hairlineWidth, backgroundColor: lv.separator },
});
