// Design tokens for the Wishwell UI.
// Every screen imports from here; do not hardcode colors, type sizes or page margins.
//
// The look follows iOS: semantic label/fill/separator colors, the iOS type ramp, continuous
// ("squircle") corners and translucent materials over a soft ambient backdrop. The brand keeps its
// red thread and gold.
import type { TextStyle } from "react-native";

export const lv = {
  // Base color under the ambient backdrop (also the native stack background).
  bg: "#F4EFE8",
  fg: "#1C1C1E", // iOS label
  card: "#FFFFFF",
  primary: "#1C1C1E",
  primaryFg: "#FFFFFF",
  secondary: "#EEECE9", // opaque soft surface (avatars, badges)
  muted: "#EFEDEA",
  mutedFg: "rgba(60,60,67,0.62)", // iOS secondaryLabel
  tertiaryFg: "rgba(60,60,67,0.32)", // iOS tertiaryLabel
  accent: "#FBE5E2", // opaque thread tint
  border: "rgba(60,60,67,0.14)", // hairline on glass
  separator: "rgba(60,60,67,0.18)",
  fill: "rgba(118,118,128,0.12)", // iOS tertiarySystemFill: fields, chips, tracks
  fillStrong: "rgba(120,120,128,0.2)", // iOS systemFill
  threadTint: "rgba(229,72,63,0.12)",
  thread: "#E5483F", // the red "thread" accent
  threadFg: "#FFFFFF",
  gold: "#EBCF8A",
  goldTint: "rgba(235,207,138,0.35)",
  silver: "#DCDFE3",
  bronze: "#CFA27E",
  water: "#3F6B78",
  destructive: "#FF3B30",
  success: "#34C759",
  radius: 22,
  radiusSm: 12,
  radiusMd: 16,
  radiusXl: 26,
  shadow: {
    shadowColor: "#1B1712",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  font: { display: undefined as string | undefined, mono: "Menlo" }, // system SF on iOS
} as const;

/**
 * iOS text styles (size / line height / weight). No letterSpacing: San Francisco already applies
 * optical tracking per size on iOS and in Safari, so adding Apple's tracking table again doubles it.
 */
export const type = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: "700" },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: "700" },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: "700" },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: "600" },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: "600" },
  body: { fontSize: 17, lineHeight: 22, fontWeight: "400" },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: "400" },
  subheadline: { fontSize: 15, lineHeight: 20, fontWeight: "400" },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: "400" },
  caption1: { fontSize: 12, lineHeight: 16, fontWeight: "400" },
  caption2: { fontSize: 11, lineHeight: 13, fontWeight: "400" },
  /** Small uppercase section label (iOS grouped-list header). */
  eyebrow: { fontSize: 12, lineHeight: 16, fontWeight: "600", letterSpacing: 0.6, textTransform: "uppercase" },
} as const satisfies Record<string, TextStyle>;

/** 4-pt grid. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

/**
 * Page geometry shared by every screen so edges line up:
 * - titles and cards sit on the page margin;
 * - section headers above a card are inset by `cardPadding`, so they line up with the card's content.
 */
export const layout = {
  margin: 20,
  maxWidth: 440,
  cardPadding: 16,
  sectionGap: 24,
  stackGap: 12,
  /** Bottom padding a tab screen needs so content clears the floating tab bar. */
  tabClearance: 120,
} as const;

/** CSS-style shadows (RN `boxShadow`): render outside a clipped glass surface on every platform. */
export const shadows = {
  card: "0px 1px 2px rgba(28,24,20,0.05), 0px 10px 30px rgba(28,24,20,0.08)",
  float: "0px 2px 6px rgba(28,24,20,0.06), 0px 16px 40px rgba(28,24,20,0.14)",
  dark: "0px 18px 44px rgba(20,16,12,0.30)",
  button: "0px 6px 16px rgba(229,72,63,0.28)",
  ink: "0px 6px 16px rgba(28,28,30,0.22)",
} as const;

/** Bundled cover images (assets/design). */
export const lvImages = {
  coverActivity: require("../../assets/design/cover-activity.jpg"),
  coverBeen: require("../../assets/design/cover-been.jpg"),
  coverGuide: require("../../assets/design/cover-guide.jpg"),
  coverSame: require("../../assets/design/cover-same.jpg"),
  drumMeet: require("../../assets/design/drum-meet.jpg"),
  wellPool: require("../../assets/design/well-pool.jpg"),
  worldMap: require("../../assets/design/world-map.jpg"),
};
