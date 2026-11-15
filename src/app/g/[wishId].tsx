import { useQuery } from "convex/react";
import { Stack, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import { GrantedCard } from "@/components/GrantedCard";
import { Sub } from "@/components/lv/passon/kit";
import { lv } from "@/theme/tokens";

/** Shareable, read-only Wish Granted card (no login, no contacts). */
export default function SharedCard() {
  const { wishId } = useLocalSearchParams<{ wishId: string }>();
  const ending = useQuery(api.endings.card, { wishId });
  if (ending === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={lv.thread} />
      </View>
    );
  }
  return (
    <ScrollView testID="shared-card-screen" style={{ backgroundColor: lv.bg }} contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: "Wish granted" }} />
      <Text style={styles.brand}>Wishwell</Text>
      {ending ? (
        <GrantedCard wishId={wishId} ending={ending} showThankYou={false} />
      ) : (
        <View style={styles.center}>
          <Text style={styles.title}>Not granted yet</Text>
          <Sub>This card appears once the wish comes true.</Sub>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 24, backgroundColor: lv.bg },
  container: { padding: 20, gap: 18, maxWidth: 430, width: "100%", alignSelf: "center", paddingBottom: 48 },
  brand: { fontSize: 20, fontWeight: "800", color: lv.thread, textAlign: "center", marginTop: 8 },
  title: { fontSize: 22, fontWeight: "800", color: lv.fg },
});
