import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Platform, Pressable, ScrollView, Share, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/convex/_generated/api";
import { AccountCard } from "@/components/AccountCard";
import { LvAvatar } from "@/components/lv/me/EgoGraph";
import { MeNetwork } from "@/components/lv/me/MeNetwork";
import { DButton, DCard } from "@/components/lv/passon/kit";
import { SHELL_TAB_CLEARANCE } from "@/components/lv/shell/tabBarStyle";
import { appUrl, copyLink } from "@/lib/links";
import { AUTH_ENABLED } from "@/lib/authFlag";
import { useMe } from "@/lib/device";
import { lv } from "@/theme/tokens";

const TIERS = [
  { key: "gold", label: "Gold", color: lv.gold },
  { key: "silver", label: "Silver", color: lv.silver },
  { key: "bronze", label: "Bronze", color: lv.bronze },
  { key: "red", label: "Red", color: lv.thread },
] as const;

const BADGE_ICONS: Record<string, string> = { boomerang: "↺", around_the_world: "◍", next_door: "⌂" };
const ROLE_TEXT = { wished: "Your wish", helped: "You helped", matched: "You were the match" } as const;

/** Me: how friends see me, reputation, cards, badges, my network map, coins & boat progress, privacy, profile. */
export default function Me() {
  const router = useRouter();
  const { deviceId, user } = useMe();
  const profile = useQuery(api.me.profile, deviceId ? { deviceId } : "skip");
  const setVouchHidden = useMutation(api.me.setVouchHidden);
  const updateProfile = useMutation(api.users.updateProfile);
  const setShowInLogs = useMutation(api.pool.setShowInLogs);
  const claimDemo = useMutation(api.users.claimDemo);
  const demoEnabled = useQuery(api.users.demoEnabled);
  const coach = useQuery(api.graph.coachReady, deviceId ? { deviceId } : "skip");
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [shareNote, setShareNote] = useState<string | null>(null);
  useEffect(() => {
    if (user) {
      setName(user.name);
      setCity(user.city);
    }
  }, [user?._id]);

  const vouches = profile?.vouches ?? [];
  const visible = vouches.filter((q) => !q.hidden);
  const summary = profile?.summary?.text ?? null;
  const cardsByTier = TIERS.map((tier) => ({
    ...tier,
    cards: (profile?.cards ?? []).filter((c) => (c.tier ?? "red") === tier.key),
  })).filter((t) => t.cards.length > 0);
  const progress = user?.boatProgress ?? 0;
  const stats: [string | number, string][] = [
    [user?.wishesLeft ?? 0, "Coins"],
    [`${progress}/5`, "Boats"],
    [coach?.edgeCount ?? 0, "Connections"],
  ];

  async function onShareQuotes() {
    const lines = visible.slice(0, 3).map((q) => `“${q.text}” — ${q.byName}`);
    if (!summary && lines.length === 0) return;
    const message = [summary, ...lines, `Make a wish on Wishwell: ${appUrl("/")}`].filter(Boolean).join("\n");
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

        <View testID="me-stars-slot" />

        <View testID="me-friends-say" style={{ gap: 10 }}>
          <View style={styles.sectionRow}>
            <Text style={styles.h2}>How friends see you</Text>
            <View testID="friends-share">
              <DButton
                testID="me-friends-share"
                title="Share"
                variant="ghost"
                size="sm"
                disabled={!summary && visible.length === 0}
                onPress={() => void onShareQuotes()}
              />
            </View>
          </View>
          <View testID="friends-see-you" style={[styles.glass, { padding: 16 }]}>
            {summary ? (
              <Text testID="friends-summary" style={styles.summary}>
                {summary}
              </Text>
            ) : null}
            {vouches.length === 0 ? (
              <Text style={styles.note}>When friends push a boat on, what they say about you shows up here.</Text>
            ) : (
              vouches.map((q, i) => (
                <View
                  key={q._id}
                  testID={`vouch-${i}`}
                  style={[styles.quote, (i > 0 || summary) && styles.quoteDivider, q.hidden && { opacity: 0.45 }]}
                >
                  <View style={styles.quoteRow}>
                    <Text style={[styles.quoteText, { flex: 1 }]}>
                      “{q.text}” — {q.byName}
                    </Text>
                    <Pressable
                      testID={`vouch-hide-${i}`}
                      accessibilityRole="button"
                      onPress={() => deviceId && void setVouchHidden({ deviceId, vouchId: q._id, hidden: !q.hidden })}
                    >
                      <Text style={styles.hide}>{q.hidden ? "Show" : "Hide"}</Text>
                    </Pressable>
                  </View>
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
          {vouches.length > 0 ? (
            <Text style={styles.note}>Hidden vouches leave your summary, your reputation and every wish chain.</Text>
          ) : null}
          {shareNote ? <Text style={styles.note}>{shareNote}</Text> : null}
        </View>

        <View testID="me-reputation" style={[styles.glass, { padding: 16, gap: 10 }]}>
          <Text style={styles.eyebrow}>Reputation</Text>
          <Text style={styles.note}>It travels with your wishes. It can't be spent.</Text>
          <View style={styles.repRow}>
            <View style={styles.rep}>
              <Text style={styles.num}>{profile?.reputation.vouches ?? 0}</Text>
              <Text style={styles.statLabel}>vouches received</Text>
            </View>
            <View style={styles.rep}>
              <Text style={styles.num}>{profile?.reputation.helped ?? 0}</Text>
              <Text style={styles.statLabel}>wishes helped</Text>
            </View>
          </View>
        </View>

        <View testID="granted-cards" style={[styles.glass, { padding: 16, gap: 10 }]}>
          <Text style={styles.eyebrow}>Wish granted cards</Text>
          {cardsByTier.length === 0 ? <Text style={styles.note}>Granted wishes you made or helped on land here.</Text> : null}
          {cardsByTier.map((tier) => (
            <View key={tier.key} style={{ gap: 8 }}>
              <Text style={styles.statLabel}>
                {tier.label} · {tier.cards.length}
              </Text>
              {tier.cards.map((card) => (
                <View key={card.wishId} testID={`granted-card-${card.wishId}`} style={[styles.polaroid, { borderColor: tier.color }]}>
                  {card.photoUrl ? <Image source={{ uri: card.photoUrl }} style={styles.photo} /> : null}
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.cardText} numberOfLines={3}>
                      {card.text}
                    </Text>
                    <Text style={styles.note}>
                      {ROLE_TEXT[card.role]}
                      {card.role === "wished" ? "" : ` · ${card.creatorName}'s wish`}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>

        <View testID="badges" style={[styles.glass, { padding: 16, gap: 10 }]}>
          <Text style={styles.eyebrow}>Badges</Text>
          <View style={styles.badgeRow}>
            {profile?.badges.map((b) => (
              <View key={b.key} testID={`badge-${b.key}`} style={[styles.badge, !b.earned && styles.locked]}>
                <Text style={[styles.badgeIcon, !b.earned && { color: lv.mutedFg }]}>{BADGE_ICONS[b.key] ?? "★"}</Text>
                <Text style={styles.badgeLabel}>{b.label}</Text>
                <Text style={[styles.statLabel, { textAlign: "center" }]}>{b.earned ? "Earned" : b.description}</Text>
              </View>
            ))}
          </View>
        </View>

        <DButton
          testID="me-open-network"
          title="People in my wish network"
          variant="ghost"
          onPress={() => router.push("/network")}
        />

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
  quoteRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  hide: { fontSize: 13, fontWeight: "600", color: lv.thread, paddingVertical: 2 },
  summary: { fontSize: 17, lineHeight: 23, fontWeight: "600", color: lv.fg, fontFamily: lv.font.display },
  repRow: { flexDirection: "row", gap: 10 },
  rep: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: lv.radiusSm, backgroundColor: lv.muted },
  polaroid: { flexDirection: "row", gap: 12, padding: 10, borderRadius: lv.radiusSm, borderWidth: 2, backgroundColor: lv.bg },
  photo: { width: 60, height: 60, borderRadius: 12, backgroundColor: lv.muted },
  cardText: { fontSize: 14, fontWeight: "600", color: lv.fg },
  badgeRow: { flexDirection: "row", gap: 8 },
  badge: { flex: 1, alignItems: "center", gap: 4, padding: 10, borderRadius: lv.radiusSm, backgroundColor: lv.accent },
  locked: { backgroundColor: lv.muted, opacity: 0.7 },
  badgeIcon: { fontSize: 26, color: lv.thread, fontWeight: "700" },
  badgeLabel: { fontSize: 13, fontWeight: "700", color: lv.fg, textAlign: "center" },
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