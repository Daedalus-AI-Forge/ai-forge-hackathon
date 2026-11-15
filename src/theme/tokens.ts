import { Platform } from "react-native";

// Design tokens for the Wishwell UI (hex values).
// Every ported screen imports from here; do not hardcode colors.
export const lv = {
  bg: "#F9F6F1",
  fg: "#1C1915",
  card: "#FEFDFB",
  primary: "#1C1915",
  primaryFg: "#FBF9F5",
  secondary: "#EFEBE6",
  muted: "#F0ECE7",
  mutedFg: "#6E6862",
  accent: "#F8E9E6",
  border: "#E3DED8",
  fieldBorder: "#CDC6BD", // input/chip outline: visible on both card and paper
  thread: "#E0453F", // the red "thread" accent
  threadFg: "#FDFBF8",
  gold: "#EBCF8A",
  silver: "#DCDFE3",
  bronze: "#CFA27E",
  destructive: "#E7000B",
  radius: 20, // --radius 1.25rem
  radiusSm: 16,
  radiusMd: 18,
  radiusXl: 24,
  shadow: {
    shadowColor: "#2A2016",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  font: { display: undefined as string | undefined, mono: "Menlo" }, // system SF on iOS
} as const;

/**
 * Night-garden pool palette (the Pool tab), ported from the teammates' web prototype:
 * deep green-navy night, luminous gold, aqua water, cream marble. Hex approximations of its oklch tokens.
 */
export const night = {
  bg: "#0E2229",
  deep: "#07141A",
  fg: "#F8F2E2",
  mutedFg: "#B5CBC9",
  gold: "#E9C766",
  goldBright: "#F7E6A6",
  goldDeep: "#A9772B",
  goldFg: "#3A2A0E",
  aqua: "#7FD3D1",
  glass: "rgba(16,38,46,0.62)",
  glassStrong: "rgba(11,30,37,0.84)",
  border: "rgba(255,255,255,0.16)",
  // Instrument Serif is not bundled; Georgia ships with iOS and is the prototype's own fallback.
  serif: Platform.select({
    ios: "Georgia",
    android: "serif",
    default: '"Instrument Serif", Georgia, serif',
  }),
} as const;

/** Pool scene images (assets/pool), from the teammates' web prototype. */
export const poolImages = {
  floor: require("../../assets/pool/pool-floor.jpg"),
  fountain: require("../../assets/pool/fountain-night.jpg"),
  coins: require("../../assets/pool/copper-coins.png"),
};

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
