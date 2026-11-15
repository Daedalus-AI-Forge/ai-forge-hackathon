import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { glass } from "@/components/lv/home/glass";
import { lv } from "@/theme/tokens";

export type VoyageLog = {
  hopId: string;
  people: number;
  fromCity: string | null;
  toCity: string | null;
  cities: (string | null)[];
  found: { name: string; city: string | null; story: string } | null;
  fastest: number | null;
};

/** The morning card: where yesterday's boat drifted and who found it. */
export function VoyageLogCard({ log, onDismiss }: { log: VoyageLog; onDismiss: () => void }) {
  const router = useRouter();
  const route = log.cities.filter((c): c is string => !!c);
  const people = `${log.people} ${log.people === 1 ? "person" : "people"}`;
  return (
    <Pressable
      testID="voyage-log"
      accessibilityRole="button"
      onPress={() => router.push({ pathname: "/boat/[hopId]", params: { hopId: log.hopId } })}
      style={({ pressed }) => [styles.card, glass.light, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.head}>
        <Text style={glass.eyebrow}>⛵︎ Voyage log</Text>
        <Pressable
          testID="voyage-log-dismiss"
          accessibilityRole="button"
          accessibilityLabel="Dismiss voyage log"
          hitSlop={12}
          onPress={onDismiss}
          style={styles.dismiss}
        >
          <Text style={styles.dismissText}>✕</Text>
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
              <Text style={styles.routeCity}>{city}</Text>
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
          <Text style={styles.hop}>You're only {people} apart.</Text>
        </View>
      ) : (
        <Text style={styles.hop}>It's still drifting.</Text>
      )}
      {log.fastest != null ? <Text style={styles.fastest}>Fastest line today: {log.fastest} hops</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: lv.radiusXl, padding: 16, gap: 8 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dismiss: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  dismissText: { color: lv.mutedFg, fontSize: 14, fontWeight: "600" },
  body: { fontSize: 15, color: lv.fg, lineHeight: 21 },
  bold: { fontWeight: "700" },
  route: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  routeStep: { flexDirection: "row", alignItems: "center", gap: 6 },
  dash: { width: 14, height: 2, backgroundColor: lv.thread, borderRadius: 1 },
  routeCity: { fontSize: 12, color: lv.mutedFg },
  found: { gap: 2 },
  hop: { fontSize: 13, color: lv.mutedFg },
  fastest: { fontSize: 12, color: lv.mutedFg },
});