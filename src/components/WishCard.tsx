import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Button, Card } from "@/components/ui";
import { colors, mono } from "@/lib/theme";
import { ordinal, timeLeft, useNow } from "@/lib/time";

export function HelpCard({
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
    <Card testID={`help-card-${hopId}`}>
      <Text style={styles.who}>{creatorName} made a wish</Text>
      <Text style={styles.text}>{text}</Text>
      <Text style={styles.meta}>
        {ordinal(depth)} ripple · <Text style={{ fontFamily: mono, fontWeight: "800" }}>{timeLeft(expiresAt, now)}</Text>
      </Text>
      <View style={styles.row}>
        <Button title="It's me!" variant="secondary" style={styles.small} onPress={() => go("its_me")} testID={`help-its-me-${hopId}`} />
        <Button title="I know someone" style={styles.small} onPress={() => go("pass")} testID={`help-know-${hopId}`} />
      </View>
      <Button title="Share to group" variant="ghost" onPress={() => go("group")} testID={`help-group-${hopId}`} />
    </Card>
  );
}

const styles = StyleSheet.create({
  who: { fontSize: 14, color: colors.muted, fontWeight: "600" },
  text: { fontSize: 18, color: colors.ink, fontWeight: "700", lineHeight: 24 },
  meta: { fontSize: 14, color: colors.red, fontWeight: "600" },
  row: { flexDirection: "row", gap: 8 },
  small: { flex: 1, minHeight: 44, paddingHorizontal: 10 },
});
