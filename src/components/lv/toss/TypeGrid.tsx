import { StyleSheet, Text, View } from "react-native";

import { Glass } from "@/components/ios";
import { LV_WISH_TYPES, toApiType, type ApiWishType } from "@/lib/lvWishTypes";
import { lv, type } from "@/theme/tokens";

/** Wish type picker: a 2-column grid of glass tiles; the chosen one turns ink. */
export function TypeGrid({ value, onChange }: { value: ApiWishType | null; onChange: (t: ApiWishType) => void }) {
  return (
    <View style={s.grid}>
      {LV_WISH_TYPES.map((x) => {
        const api = toApiType[x.id];
        const on = value === api;
        return (
          <Glass
            key={x.id}
            testID={`toss-type-${api}`}
            accessibilityState={{ selected: on }}
            onPress={() => onChange(api)}
            radius={lv.radiusMd + 2}
            style={[s.tile, on && s.tileOn]}
          >
            {on ? <View style={s.ink} /> : null}
            <Text style={s.emoji}>{x.emoji}</Text>
            <Text style={[s.label, { color: on ? lv.primaryFg : lv.fg }]}>{x.label}</Text>
          </Glass>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: { flexGrow: 1, flexBasis: "45%", padding: 16 },
  tileOn: { borderColor: lv.primary },
  // Solid ink above the glass material for the chosen tile.
  ink: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: lv.primary },
  emoji: { fontSize: 24 },
  label: { ...type.subheadline, fontWeight: "600", marginTop: 8 },
});
