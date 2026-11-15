import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/convex/_generated/api";
import { AccountCard } from "@/components/AccountCard";
import { LvAvatar } from "@/components/lv/me/EgoGraph";
import { MeNetwork } from "@/components/lv/me/MeNetwork";
import { AUTH_ENABLED } from "@/lib/authFlag";
import { useMe } from "@/lib/device";
import { lv } from "@/theme/tokens";

export default function Me() {
  const { deviceId, user } = useMe();
  const updateProfile = useMutation(api.users.updateProfile);
  const claimDemo = useMutation(api.users.claimDemo);
  const demoEnabled = useQuery(api.users.demoEnabled);
  const coach = useQuery(api.graph.coachReady, deviceId ? { deviceId } : "skip");
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  useEffect(() => {
    if (user) {
      setName(user.name);
      setCity(user.city);
    }
  }, [user?._id]);

  const stats: [string | number, string][] = [
    [user?.wishesLeft ?? 0, "Wishes"],
    [user?.stars ?? 0, "Stars"],
    [coach?.edgeCount ?? 0, "Connections"],
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: lv.bg }} edges={["top"]}>
      <ScrollView testID="me-screen" contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <LvAvatar name={user?.name || "?"} size={56} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.h1}>{user?.name || "You"}</Text>
            <Text numberOfLines={1} style={styles.sub}>
              {user?.city || "Somewhere"}
            </Text>
          </View>
        </View>

        <View style={[styles.glass, styles.stats]}>
          {stats.map(([v, l], i) => (
            <View key={l} style={[styles.stat, i > 0 && styles.statDivider]}>
              <Text style={styles.num}>{v}</Text>
              <Text style={styles.statLabel}>{l}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.glass, { padding: 16, gap: 10 }]}>
          <Text style={styles.eyebrow}>Your name</Text>
          <TextInput value={name} onChangeText={setName} testID="me-name" style={styles.input} placeholderTextColor={lv.mutedFg} />
          <Text style={styles.eyebrow}>Your city</Text>
          <TextInput value={city} onChangeText={setCity} testID="me-city" style={styles.input} placeholderTextColor={lv.mutedFg} />
          <Pressable
            testID="me-save"
            accessibilityRole="button"
            onPress={() => {
              if (!deviceId) return;
              void updateProfile({ deviceId, name, city });
            }}
            style={styles.btn}
          >
            <Text style={styles.btnText}>Save</Text>
          </Pressable>
        </View>

        {AUTH_ENABLED ? <AccountCard /> : null}
        {deviceId ? <MeNetwork deviceId={deviceId} /> : null}

        {demoEnabled ? (
          <Pressable
            testID="use-demo-profile-me"
            accessibilityRole="button"
            onPress={() => deviceId && void claimDemo({ deviceId })}
            style={styles.ghostWide}
          >
            <Text style={styles.ghostText}>Use demo profile (Mia, SF)</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 40, gap: 12, maxWidth: 430, width: "100%", alignSelf: "center" },
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 4 },
  h1: { fontSize: 26, fontWeight: "700", color: lv.fg, fontFamily: lv.font.display },
  sub: { marginTop: 4, fontSize: 13, color: lv.mutedFg },
  glass: { backgroundColor: lv.card, borderRadius: lv.radius, borderWidth: StyleSheet.hairlineWidth, borderColor: lv.border, ...lv.shadow },
  stats: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 12 },
  stat: { flex: 1, alignItems: "center" },
  statDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderColor: lv.border },
  num: { fontSize: 20, fontWeight: "600", color: lv.fg },
  statLabel: { marginTop: 4, fontSize: 11, color: lv.mutedFg },
  eyebrow: { fontSize: 11, fontWeight: "600", letterSpacing: 1, textTransform: "uppercase", color: lv.mutedFg },
  input: { height: 44, borderRadius: lv.radiusSm, backgroundColor: lv.muted, paddingHorizontal: 14, fontSize: 15, color: lv.fg },
  btn: { height: 44, borderRadius: 999, backgroundColor: lv.primary, alignItems: "center", justifyContent: "center", marginTop: 4 },
  btnText: { color: lv.primaryFg, fontSize: 15, fontWeight: "600" },
  ghostWide: { height: 44, borderRadius: 999, backgroundColor: lv.secondary, alignItems: "center", justifyContent: "center", marginTop: 8 },
  ghostText: { color: lv.fg, fontSize: 14, fontWeight: "600" },
});
