import { useRouter } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { ordinal, timeLeft, useNow } from "@/lib/time";
import { fromApiType, LV_WISH_TYPES, type ApiWishType } from "@/lib/lvWishTypes";
import { lv, lvImages } from "@/theme/tokens";

import { glass } from "./glass";

const COVERS = {
  activity: lvImages.coverActivity,
  guide: lvImages.coverGuide,
  been: lvImages.coverBeen,
  same: lvImages.coverSame,
} as const;

/** New-design wish card: cover photo, type chip, countdown chip, dark glass panel with the three actions. */
export function FriendWishCard({
  hopId,
  creatorName,
  text,
  depth,
  expiresAt,
  type,
}: {
  hopId: string;
  creatorName: string;
  text: string;
  depth: number;
  expiresAt: number;
  type: string;
}) {
  const router = useRouter();
  const now = useNow(30000);
  const lvType = fromApiType[type as ApiWishType] ?? "activity";
  const t = LV_WISH_TYPES.find((x) => x.id === lvType)!;
  const go = (start: string) => router.push({ pathname: "/w/[hopId]", params: { hopId, start } });
  return (
    <View testID={`help-card-${hopId}`} style={styles.card}>
      <Image source={COVERS[lvType]} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.18)" }]} />
      <View style={styles.topRow}>
        <View style={[styles.chip, glass.dark]}>
          <Text style={styles.chipText}>
            {t.emoji} {t.label}
          </Text>
        </View>
        <View style={[styles.chip, glass.dark]}>
          <Text style={[styles.chipText, { fontFamily: lv.font.mono }]}>{timeLeft(expiresAt, now)}</Text>
        </View>
      </View>
      <View style={[styles.panel, glass.dark]}>
        <Text style={styles.meta}>
          {creatorName} · {ordinal(depth)} ripple
        </Text>
        <Text style={styles.text} numberOfLines={3}>
          {text}
        </Text>
        <View style={styles.actions}>
          <Pressable testID={`help-its-me-${hopId}`} accessibilityRole="button" onPress={() => go("its_me")} style={[styles.btn, styles.btnLight]}>
            <Text style={styles.btnLightText}>It's me</Text>
          </Pressable>
          <Pressable testID={`help-know-${hopId}`} accessibilityRole="button" onPress={() => go("pass")} style={[styles.btn, styles.btnThread]}>
            <Text style={styles.btnThreadText}>I know someone</Text>
          </Pressable>
          <Pressable
            testID={`help-group-${hopId}`}
            accessibilityRole="button"
            accessibilityLabel="Share to group chat"
            onPress={() => go("group")}
            style={[styles.btn, styles.btnIcon, glass.dark]}
          >
            <Text style={styles.btnThreadText}>↗</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { aspectRatio: 4 / 5, borderRadius: 32, overflow: "hidden", backgroundColor: lv.secondary, justifyContent: "space-between" },
  topRow: { flexDirection: "row", justifyContent: "space-between", padding: 16 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { color: "#fff", fontSize: 12, fontWeight: "500" },
  panel: { margin: 12, borderRadius: 24, padding: 16 },
  meta: { color: "rgba(255,255,255,0.8)", fontSize: 12 },
  text: { color: "#fff", fontSize: 22, fontWeight: "600", lineHeight: 27, marginTop: 8 },
  actions: { flexDirection: "row", gap: 8, marginTop: 16 },
  btn: { height: 44, borderRadius: 999, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  btnLight: { flex: 1, backgroundColor: "rgba(255,255,255,0.88)" },
  btnLightText: { color: lv.fg, fontSize: 14, fontWeight: "600" },
  btnThread: { flex: 1, backgroundColor: lv.thread },
  btnThreadText: { color: lv.threadFg, fontSize: 14, fontWeight: "600" },
  btnIcon: { width: 44, paddingHorizontal: 0 },
});
