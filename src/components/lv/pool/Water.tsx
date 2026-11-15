import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { Well } from "@/components/lv/home/Well";

/** The water: the well's pool as the surface, boats floating below it. */
export function Water({ children }: { children: ReactNode }) {
  return (
    <View style={styles.wrap}>
      <Well size={300} />
      <View style={styles.boats}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 18 },
  boats: { gap: 14 },
});