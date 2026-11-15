import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { Platform, Share, StyleSheet, Switch, Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import { AccountCard } from "@/components/AccountCard";
import { GlassCard, Screen, SectionHeader } from "@/components/ios";
import { LvAvatar } from "@/components/lv/me/EgoGraph";
import { MeNetwork } from "@/components/lv/me/MeNetwork";
import { DButton, DCard, DField } from "@/components/lv/passon/kit";
import { copyLink } from "@/lib/links";
import { AUTH_ENABLED } from "@/lib/authFlag";
import { useMe } from "@/lib/device";
import { lv, type } from "@/theme/tokens";

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
    <Screen tab testID="me-screen">
      <View style={styles.header}>
        <LvAvatar name={user?.name || "?"} size={64} ring />
        <View style={styles.headerText}>
          <Text style={styles.name} numberOfLines={1}>
            {user?.name || "You"}
          </Text>
          <Text numberOfLines={1} style={styles.city}>
            {user?.city || "Somewhere"}
          </Text>
        </View>
      </View>

      <GlassCard style={styles.stats}>
        {stats.map(([v, l], i) => (
          <View key={l} style={[styles.stat, i > 0 && styles.statDivider]}>
            <Text style={styles.num}>{v}</Text>
            <Text style={styles.statLabel}>{l}</Text>
          </View>
        ))}
      </GlassCard>

      <View testID="me-friends-say" style={styles.group}>
        <SectionHeader
          variant="title"
          title="How friends see you"
          right={
            <DButton
              testID="me-friends-share"
              title="Share"
              icon="share"
              variant="plain"
              size="sm"
              disabled={quotes.length === 0}
              onPress={() => void onShareQuotes()}
            />
          }
        />
        <GlassCard style={styles.list}>
          {quotes.length === 0 ? (
            <Text style={[styles.note, styles.listPad]}>When friends push a boat on, what they say about you shows up here.</Text>
          ) : (
            quotes.map((q, i) => (
              <View key={q._id} style={[styles.quote, i > 0 && styles.quoteDivider]}>
                <Text style={styles.quoteText}>“{q.text}”</Text>
                <Text style={styles.quoteBy}>— {q.byName}</Text>
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
        </GlassCard>
        {shareNote ? <Text style={[styles.note, styles.inset]}>{shareNote}</Text> : null}
      </View>

      {deviceId ? <MeNetwork deviceId={deviceId} /> : null}

      <View style={styles.group}>
        <SectionHeader title="Privacy" />
        <GlassCard testID="me-privacy">
          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Text style={styles.rowLabel}>Show me in the network and voyage logs</Text>
              <Text style={styles.note}>Off: your profile stays off the public network, and finders see “Someone” instead of your name and city.</Text>
            </View>
            <Switch
              testID="me-show-in-logs"
              value={user?.showInLogs !== false}
              onValueChange={(value) => {
                if (deviceId) void setShowInLogs({ deviceId, value });
              }}
              trackColor={{ true: lv.thread, false: lv.fillStrong }}
              ios_backgroundColor={lv.fillStrong}
            />
          </View>
        </GlassCard>
      </View>

      <View style={styles.group}>
        <SectionHeader title="Profile" />
        <DCard>
          <DField label="Your name" value={name} onChangeText={setName} testID="me-name" />
          <DField label="Your city" value={city} onChangeText={setCity} testID="me-city" />
          <DButton
            testID="me-save"
            title="Save"
            variant="ink"
            style={styles.save}
            onPress={() => {
              if (!deviceId) return;
              void updateProfile({ deviceId, name, city });
            }}
          />
        </DCard>
      </View>

      {AUTH_ENABLED ? <AccountCard /> : null}

      {demoEnabled ? (
        <DButton
          testID="use-demo-profile-me"
          title="Use demo profile (Mia, SF)"
          variant="glass"
          onPress={() => deviceId && void claimDemo({ deviceId })}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingTop: 12 },
  headerText: { flex: 1, minWidth: 0, gap: 2 },
  name: { ...type.title1, color: lv.fg },
  city: { ...type.subheadline, color: lv.mutedFg },
  group: { gap: 16 },
  inset: { paddingHorizontal: 16 },
  stats: { flexDirection: "row", alignItems: "center", paddingHorizontal: 0, paddingVertical: 14 },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderColor: lv.separator },
  num: { ...type.title2, fontWeight: "600", color: lv.fg, fontVariant: ["tabular-nums"] },
  statLabel: { ...type.caption1, color: lv.mutedFg },
  list: { padding: 0, gap: 0 },
  listPad: { padding: 16 },
  quote: { gap: 4, paddingHorizontal: 16, paddingVertical: 14 },
  quoteDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: lv.separator, marginLeft: 16, paddingLeft: 0 },
  quoteText: { ...type.callout, color: lv.fg },
  quoteBy: { ...type.footnote, color: lv.mutedFg },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  tag: { borderRadius: 999, paddingHorizontal: 10, height: 24, justifyContent: "center", backgroundColor: lv.fill },
  tagText: { ...type.caption1, fontWeight: "500", color: lv.fg },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  switchText: { flex: 1, gap: 2 },
  rowLabel: { ...type.body, color: lv.fg },
  note: { ...type.footnote, color: lv.mutedFg },
  save: { marginTop: 4 },
});
