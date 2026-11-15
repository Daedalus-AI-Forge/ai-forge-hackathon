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
