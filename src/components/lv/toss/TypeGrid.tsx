import { Pressable, StyleSheet, Text, View } from "react-native";

import { LV_WISH_TYPES, toApiType, type ApiWishType } from "@/lib/lvWishTypes";
import { lv } from "@/theme/tokens";

export function TypeGrid({ value, onChange }: { value: ApiWishType | null; onChange: (t: ApiWishType) => void }) {
  return (
    <View style={s.grid}>
      {LV_WISH_TYPES.map((x) => {
        const api = toApiType[x.id];
        const on = value === api;
        return (
          <Pressable
            key={x.id}
            testID={`toss-type-${api}`}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(api)}
            style={[s.tile, on ? s.tileOn : s.tileOff]}
          >
            <Text style={s.emoji}>{x.emoji}</Text>
            <Text style={[s.label, { color: on ? lv.primaryFg : lv.fg }]}>{x.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: { width: "48.5%", flexGrow: 1, flexBasis: "45%", borderRadius: lv.radiusSm, borderWidth: 1, padding: 16 },
  tileOn: { backgroundColor: lv.primary, borderColor: lv.fg },
  tileOff: { backgroundColor: lv.card, borderColor: lv.border },
  emoji: { fontSize: 22 },
  label: { marginTop: 8, fontSize: 14, fontWeight: "600" },
});
