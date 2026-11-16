import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Glass, Icon } from "@/components/ios";
import { layout, night, type } from "@/theme/tokens";

export type VoyageLog = {
  hopId: string;
  people: number;
  fromCity: string | null;
  toCity: string | null;
  cities: (string | null)[];
  found: { name: string; city: string | null; story: string } | null;
  fastest: number | null;
};

/** The morning card (night-pool style): where yesterday's boat drifted and who found it. */
export function VoyageLogCard({ log, onDismiss }: { log: VoyageLog; onDismiss: () => void }) {
  const router = useRouter();
  const route = log.cities.filter((c): c is string => !!c);
  const people = `${log.people} ${log.people === 1 ? "person" : "people"}`;
  return (
    <Glass
      testID="voyage-log"
      variant="dark"
      onPress={() => router.push({ pathname: "/boat/[hopId]", params: { hopId: log.hopId } })}
      style={styles.card}
    >
      <View style={styles.head}>
        <View style={styles.eyebrowRow}>
          <Icon name="boat" size={13} color={night.gold} />
          <Text style={styles.eyebrow}>Voyage log</Text>
        </View>
        <Pressable
          testID="voyage-log-dismiss"
          accessibilityRole="button"
          accessibilityLabel="Dismiss voyage log"
          hitSlop={12}
          onPress={onDismiss}
          style={({ pressed }) => [styles.dismiss, pressed && { opacity: 0.6 }]}
        >
          <Icon name="close" size={11} color={night.mutedFg} weight="bold" />
        </Pressable>
      </View>
      <Text style={styles.body}>
        Yesterday your boat passed through {people}
        {log.fromCity && log.toCity ? `, from ${log.fromCity} to ${log.toCity}` : ""}.
      </Text>
      {route.length > 0 ? (
        <View style={styles.route}>
          {route.map((city, i) => (
            <View key={`${city}-${i}`} style={styles.routeStep}>
              {i > 0 ? <View style={styles.dash} /> : null}
              <Text style={[styles.routeCity, i === route.length - 1 && styles.routeLast]}>{city}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {log.found ? (
        <View style={styles.found}>
          <Text style={styles.body}>
            It found <Text style={styles.bold}>{log.found.name}</Text>
            {log.found.city ? ` in ${log.found.city}` : ""}: “{log.found.story}”
          </Text>
          <Text style={styles.meta}>You’re only {people} apart.</Text>
        </View>
      ) : (
        <Text style={styles.meta}>It’s still drifting.</Text>
      )}
      {log.fastest != null ? <Text style={styles.meta}>Fastest line today: {log.fastest} hops</Text> : null}
    </Glass>
  );
}

const styles = StyleSheet.create({
  card: { padding: layout.cardPadding, gap: 8 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  eyebrow: { ...type.eyebrow, color: night.gold },
  dismiss: { width: 26, height: 26, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  body: { ...type.subheadline, color: night.fg },
  bold: { fontWeight: "600", color: night.goldBright },
  route: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", rowGap: 6 },
  routeStep: { flexDirection: "row", alignItems: "center" },
  dash: { width: 14, height: 2, backgroundColor: night.gold, borderRadius: 1, marginHorizontal: 6 },
  routeCity: { ...type.footnote, color: night.mutedFg },
  routeLast: { color: night.fg, fontWeight: "600" },
  found: { gap: 4 },
  meta: { ...type.footnote, color: night.mutedFg },
});
