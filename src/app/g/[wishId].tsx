import { useQuery } from "convex/react";
import { Stack, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import { GetTheApp } from "@/components/GetTheApp";
import { GrantedCard } from "@/components/GrantedCard";
import { Muted } from "@/components/ui";
import { colors } from "@/lib/theme";

/** Shareable, read-only Wish Granted card (no login, no contacts). */
export default function SharedCard() {
  const { wishId } = useLocalSearchParams<{ wishId: string }>();
  const ending = useQuery(api.endings.card, { wishId });
  if (ending === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.red} />
      </View>
    );
  }
  return (
    <ScrollView testID="shared-card-screen" style={{ backgroundColor: colors.cream }} contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: "Wish granted" }} />
      <Text style={styles.brand}>Wishwell</Text>
      {ending ? (
        <GrantedCard wishId={wishId} ending={ending} showThankYou={false} />
      ) : (
        <View style={styles.center}>
          <Text style={styles.title}>Not granted yet</Text>
          <Muted>This card appears once the wish comes true.</Muted>
        </View>
      )}
      <GetTheApp />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 24, backgroundColor: colors.cream },
  container: { padding: 20, gap: 18, maxWidth: 430, width: "100%", alignSelf: "center", paddingBottom: 48 },
  brand: { fontSize: 20, fontWeight: "800", color: colors.red, textAlign: "center", marginTop: 8 },
  title: { fontSize: 22, fontWeight: "800", color: colors.ink },
});
