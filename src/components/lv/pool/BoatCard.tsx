import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { glass } from "@/components/lv/home/glass";
import { DButton } from "@/components/lv/passon/kit";
import { ordinal, timeLeft, useNow } from "@/lib/time";
import { lv } from "@/theme/tokens";

/** A friend's real wish held here: who sent it, how far it's come, and the two ways to act. */
export function BoatCard({
  hopId,
  creatorName,
  text,
  depth,
  expiresAt,
}: {
  hopId: string;
  creatorName: string;
  text: string;
  depth: number;
  expiresAt: number;
}) {
  const router = useRouter();
  const now = useNow(30000);
  const go = (start: string) => router.push({ pathname: "/w/[hopId]", params: { hopId, start } });
  return (
    <View testID={`help-card-${hopId}`} style={[styles.card, glass.light]}>
      <View style={styles.pill}>
        <Text style={styles.pillText}>{creatorName}'s real wish</Text>
      </View>
      <Text style={styles.text}>{text}</Text>
      <Text style={styles.meta}>
        {ordinal(depth)} hop · {timeLeft(expiresAt, now)}
      </Text>
      <View style={styles.actions}>
        <DButton title="That's me" variant="ghost" style={{ flex: 1 }} testID={`help-its-me-${hopId}`} onPress={() => go("its_me")} />
        <DButton title="Push to someone" variant="thread" style={{ flex: 1 }} testID={`help-know-${hopId}`} onPress={() => go("pass")} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: lv.radiusXl, padding: 16, gap: 8 },
  pill: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: lv.accent },
  pillText: { fontSize: 11, fontWeight: "600", letterSpacing: 1.2, textTransform: "uppercase", color: lv.thread },
  text: { fontSize: 20, fontWeight: "600", color: lv.fg, lineHeight: 25 },
  meta: { fontSize: 12, color: lv.mutedFg },
  actions: { flexDirection: "row", gap: 8, marginTop: 4 },
});