import { Platform } from "react-native";

export const colors = {
  cream: "#FBF6EC",
  card: "#FFFFFF",
  ink: "#1D1A16",
  muted: "#7A7166",
  line: "#E8DFCF",
  red: "#E63946",
  redSoft: "#FCE3E5",
  water: "#EFE7D6",
};

export const mono = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "ui-monospace, SFMono-Regular, Menlo, monospace",
});

export const radius = { card: 20, pill: 999 };
