import { Platform } from "react-native";

import { lv } from "@/theme/tokens";

// Legacy palette names, now mapped onto the shared tokens so older screens match the rest.
export const colors = {
  cream: lv.bg,
  card: lv.card,
  ink: lv.fg,
  muted: lv.mutedFg,
  line: lv.border,
  red: lv.thread,
  redSoft: lv.accent,
  water: lv.muted,
};

export const mono = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "ui-monospace, SFMono-Regular, Menlo, monospace",
});

export const radius = { card: lv.radiusXl, pill: 999 };
