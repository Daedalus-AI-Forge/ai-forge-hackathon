import { useMutation, useQuery } from "convex/react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import { Avatar, Card, Muted } from "@/components/ui";
import { colors, radius } from "@/lib/theme";

/** Everything the well has learned about my friends from my passes. Mine to read and to delete. */
export function NetworkMap({ deviceId }: { deviceId: string }) {
  const people = useQuery(api.edges.mine, { deviceId });
  const forget = useMutation(api.edges.forget);
  return (
    <Card testID="network-map">
      <Text style={styles.title}>My wish network</Text>
      <Muted>
        What the well has learned from the wishes you passed on. Only you can see it. Red tags came from a daily wish,
        the rest you picked yourself.
      </Muted>
      {people?.length === 0 ? <Muted>Nothing yet. Pass today's wish to a friend and the map starts here.</Muted> : null}
      {people?.map((p) => (
        <View key={p.name} testID={`network-person-${p.name}`} style={styles.row}>
          <Avatar name={p.name} color={p.avatar} size={36} />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={styles.name}>{p.name}</Text>
            <View style={styles.tags}>
              {p.tags.map((t) => (
                <Text key={t.tag} style={[styles.tag, t.source === "daily" && styles.daily]}>
                  {t.tag}
                </Text>
              ))}
            </View>
          </View>
          <Pressable
            testID={`network-forget-${p.name}`}
            accessibilityRole="button"
            onPress={() => void forget({ deviceId, personName: p.name })}
          >
            <Text style={styles.forget}>Forget</Text>
          </Pressable>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: "800", color: colors.ink },
  row: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  name: { fontSize: 16, fontWeight: "700", color: colors.ink },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.muted,
    backgroundColor: colors.water,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: "hidden",
  },
  daily: { color: colors.red, backgroundColor: colors.redSoft },
  forget: { fontSize: 14, fontWeight: "700", color: colors.muted, paddingVertical: 8 },
});
