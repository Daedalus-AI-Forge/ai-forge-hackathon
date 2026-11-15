import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { GlassCard } from "@/components/ios";
import { DButton, DTag } from "@/components/lv/passon/kit";
import { ordinal, timeLeft, useNow } from "@/lib/time";
import { lv, type } from "@/theme/tokens";

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
    <GlassCard testID={`help-card-${hopId}`}>
      <View style={styles.head}>
        <DTag label={`${creatorName}'s real wish`} />
        <Text style={styles.meta}>
          {ordinal(depth)} hop · {timeLeft(expiresAt, now)}
        </Text>
      </View>
      <Text style={styles.text}>{text}</Text>
      <View style={styles.actions}>
        <DButton title="That's me" variant="ghost" style={styles.flex} testID={`help-its-me-${hopId}`} onPress={() => go("its_me")} />
        <DButton title="Push to someone" variant="thread" style={styles.flex} testID={`help-know-${hopId}`} onPress={() => go("pass")} />
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  meta: { ...type.footnote, color: lv.mutedFg, flexShrink: 0 },
  text: { ...type.title3, color: lv.fg },
  actions: { flexDirection: "row", gap: 10, marginTop: 4 },
  flex: { flex: 1 },
});
