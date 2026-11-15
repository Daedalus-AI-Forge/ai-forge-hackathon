import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { Platform, Pressable, ScrollView, Share, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/convex/_generated/api";
import { AccountCard } from "@/components/AccountCard";
import { LvAvatar } from "@/components/lv/me/EgoGraph";
import { MeNetwork } from "@/components/lv/me/MeNetwork";
import { StarsCard } from "@/components/StarsCard";
import { DButton, DCard } from "@/components/lv/passon/kit";
import { SHELL_TAB_CLEARANCE } from "@/components/lv/shell/tabBarStyle";
import { copyLink } from "@/lib/links";
import { AUTH_ENABLED } from "@/lib/authFlag";
import { useMe } from "@/lib/device";
import { lv } from "@/theme/tokens";

/** Me: how friends see me, my network map, coins & boat progress, privacy, profile. */
export default function Me() {
  const { deviceId, user } = useMe();
  const updateProfile = useMutation(api.users.updateProfile);
  const setShowInLogs = useMutation(api.pool.setShowInLogs);
  const claimDemo = useMutation(api.users.claimDemo);
  const demoEnabled = useQuery(api.users.demoEnabled);
  const coach = useQuery(api.graph.coachReady, deviceId ? { deviceId } : "skip");
  const friendsSay = useQuery(api.pool.friendsSay, deviceId ? { deviceId } : "skip");
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [shareNote, setShareNote] = useState<string | null>(null);
  useEffect(() => {
    if (user) {
      setName(user.name);
      setCity(user.city);
    }
  }, [user?._id]);

  const quotes = (friendsSay ?? []).slice(0, 5);
  const progress = user?.boatProgress ?? 0;
  const stats: [string | number, string][] = [
    [user?.wishesLeft ?? 0, "Coins"],
    [`${progress}/5`, "Boats"],
    [coach?.edgeCount ?? 0, "Connections"],
  ];

  async function onShareQuotes() {
    const lines = quotes.slice(0, 3).map((q) => `“${q.text}” — ${q.byName}`);
    if (lines.length === 0) return;
    const message = lines.join("\n");
    if (Platform.OS === "web") {
      await copyLink(message);
      setShareNote("Copied — paste it anywhere.");
      return;
    }
    await Share.share({ message });
  }

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

        <StarsCard />

        <View testID="me-friends-say" style={{ gap: 10 }}>
          <View style={styles.sectionRow}>
            <Text style={styles.h2}>How friends see you</Text>
            <DButton
              testID="me-friends-share"
              title="Share"
              variant="ghost"
              size="sm"
              disabled={quotes.length === 0}
              onPress={() => void onShareQuotes()}
            />
          </View>
          <View style={styles.glass}>
            {quotes.length === 0 ? (
              <Text style={styles.note}>When friends push a boat on, what they say about you shows up here.</Text>
            ) : (
              quotes.map((q, i) => (
                <View key={q._id} style={[styles.quote, i > 0 && styles.quoteDivider]}>
                  <Text style={styles.quoteText}>
                    “{q.text}” — {q.byName}
                  </Text>
                  {q.tags.length > 0 ? (
                    <View style={styles.tagRow}>
                      {q.tags.map((t) => (
                        <View key={t} style={styles.tag}>
                          <Text style={styles.tagText}>{t}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              ))
            )}
          </View>
          {shareNote ? <Text style={styles.note}>{shareNote}</Text> : null}
        </View>

        {deviceId ? <MeNetwork deviceId={deviceId} /> : null}

        <DCard testID="me-privacy">
          <View style={styles.privacyRow}>
            <Switch
              testID="me-show-in-logs"
              value={user?.showInLogs !== false}
              onValueChange={(value) => {
                if (deviceId) void setShowInLogs({ deviceId, value });
              }}
              trackColor={{ true: lv.thread, false: lv.mutedFg }}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.privacyLabel}>Show me in other people's voyage logs</Text>
              <Text style={styles.note}>Off: finders see "Someone" instead of your name and city.</Text>
            </View>
          </View>
        </DCard>

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
  container: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: SHELL_TAB_CLEARANCE,
    gap: 14,
    maxWidth: 430,
    width: "100%",
    alignSelf: "center",
  },
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 4 },
  h1: { fontSize: 26, fontWeight: "700", color: lv.fg, fontFamily: lv.font.display },
  sub: { marginTop: 4, fontSize: 13, color: lv.mutedFg },
  glass: { backgroundColor: lv.card, borderRadius: lv.radius, borderWidth: StyleSheet.hairlineWidth, borderColor: lv.border, ...lv.shadow },
  stats: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 12 },
  stat: { flex: 1, alignItems: "center" },
  statDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderColor: lv.border },
  num: { fontSize: 20, fontWeight: "600", color: lv.fg },
  statLabel: { marginTop: 4, fontSize: 11, color: lv.mutedFg },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4 },
  h2: { fontSize: 17, fontWeight: "600", color: lv.fg },
  quote: { gap: 6 },
  quoteDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: lv.border, paddingTop: 10, marginTop: 10 },
  quoteText: { fontSize: 14, lineHeight: 20, color: lv.fg },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: lv.muted },
  tagText: { fontSize: 11, fontWeight: "500", color: lv.fg },
  privacyRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  privacyLabel: { fontSize: 14, fontWeight: "500", color: lv.fg },
  note: { fontSize: 13, color: lv.mutedFg, lineHeight: 18 },
  eyebrow: { fontSize: 11, fontWeight: "600", letterSpacing: 1, textTransform: "uppercase", color: lv.mutedFg },
  input: { height: 44, borderRadius: lv.radiusSm, backgroundColor: lv.muted, paddingHorizontal: 14, fontSize: 15, color: lv.fg },
  btn: { height: 44, borderRadius: 999, backgroundColor: lv.primary, alignItems: "center", justifyContent: "center", marginTop: 4 },
  btnText: { color: lv.primaryFg, fontSize: 15, fontWeight: "600" },
  ghostWide: { height: 44, borderRadius: 999, backgroundColor: lv.secondary, alignItems: "center", justifyContent: "center", marginTop: 8 },
  ghostText: { color: lv.fg, fontSize: 14, fontWeight: "600" },
});