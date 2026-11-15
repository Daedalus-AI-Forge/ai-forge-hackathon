import type { TextStyle, ViewStyle } from "react-native";

import { lv } from "@/theme/tokens";

/** Floating frosted pill tab bar from the new design (bottom-5, inset 20, rounded-full, glass). */
export const shellTabBarStyle: ViewStyle = {
  position: "absolute",
  left: 20,
  right: 20,
  bottom: 20,
  height: 60,
  paddingTop: 6,
  paddingBottom: 6,
  paddingHorizontal: 6,
  borderRadius: 999,
  borderTopWidth: 0,
  borderWidth: 1,
  borderColor: lv.border,
  backgroundColor: "rgba(254,253,251,0.94)",
  ...lv.shadow,
};

export const shellTabLabelStyle: TextStyle = { fontSize: 10, fontWeight: "500", marginTop: 0 };

/** Bottom padding a scrolling screen needs so content clears the floating bar. */
export const SHELL_TAB_CLEARANCE = 112;
