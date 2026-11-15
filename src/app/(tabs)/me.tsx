import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/convex/_generated/api";
import { AccountCard } from "@/components/AccountCard";
import { LvAvatar } from "@/components/lv/me/EgoGraph";
import { MeNetwork } from "@/components/lv/me/MeNetwork";
import { AUTH_ENABLED } from "@/lib/authFlag";
import { useMe } from "@/lib/device";
import { appUrl, shareLink } from "@/lib/links";
import { lv } from "@/theme/tokens";

const TIERS = [
  { key: "gold", label: "Gold", color: lv.gold },
  { key: "silver", label: "Silver", color: lv.silver },
  { key: "bronze", label: "Bronze", color: lv.bronze },
  { key: "red", label: "Red", color: lv.thread },
] as const;

const BADGE_ICONS: Record<string, string> = { boomerang: "↺", around_the_world: "◍", next_door: "⌂" };
const ROLE_TEXT = { wished: "Your wish", helped: "You helped", matched: "You were the match" } as const;

export default function Me() {
  const router = useRouter();
  const { deviceId, user } = useMe();
  const profile = useQuery(api.me.profile, deviceId ? { deviceId } : "skip");
  const setVouchHidden = useMutation(api.me.setVouchHidden);
  const [shareNote, setShareNote] = useState<string | null>(null);
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

  const cardsByTier = TIERS.map((tier) => ({
    ...tier,
    cards: (profile?.cards ?? []).filter((c) => (c.tier ?? "red") === tier.key),
  })).filter((t) => t.cards.length > 0);

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

        <View testID="me-stars-slot" />

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

        <View testID="friends-see-you" style={[styles.glass, { padding: 16, gap: 10 }]}>
          <Text style={styles.eyebrow}>How friends see you</Text>
          {profile?.summary ? (
            <Text testID="friends-summary" style={styles.summary}>
              {profile.summary.text}
            </Text>
          ) : (
            <Text style={styles.note}>No vouches yet. Help pass a friend's wish on and they'll vouch for you.</Text>
          )}
          {profile?.summary ? (
            <Pressable
              testID="friends-share"
              accessibilityRole="button"
              style={styles.ghostWide}
              onPress={async () => {
                const result = await shareLink(`${profile.summary!.text} Make a wish on Wishwell:`, appUrl("/"));
                setShareNote(result === "copied" ? "Copied! Paste it anywhere." : null);
              }}
            >
              <Text style={styles.ghostText}>Share it</Text>
            </Pressable>
          ) : null}
          {shareNote ? <Text style={styles.note}>{shareNote}</Text> : null}
          {profile?.vouches.map((vouch, i) => (
            <View key={vouch._id} testID={`vouch-${i}`} style={[styles.vouch, vouch.hidden && { opacity: 0.45 }]}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.vouchText}>"{vouch.text}"</Text>
                <Text style={styles.note}>
                  {vouch.byName}
                  {vouch.tags.length ? ` · ${vouch.tags.join(", ")}` : ""}
                </Text>
              </View>
              <Pressable
                testID={`vouch-hide-${i}`}
                accessibilityRole="button"
                onPress={() => deviceId && void setVouchHidden({ deviceId, vouchId: vouch._id, hidden: !vouch.hidden })}
              >
                <Text style={styles.hide}>{vouch.hidden ? "Show" : "Hide"}</Text>
              </Pressable>
            </View>
          ))}
          {profile?.vouches.length ? (
            <Text style={styles.note}>Hidden vouches leave your summary, your reputation and every wish chain.</Text>
          ) : null}
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

        <Pressable testID="me-open-network" accessibilityRole="button" style={styles.btn} onPress={() => router.push("/network")}>
          <Text style={styles.btnText}>People in my wish network</Text>
        </Pressable>

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
  note: { fontSize: 13, color: lv.mutedFg, lineHeight: 18 },
  repRow: { flexDirection: "row", gap: 10 },
  rep: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: lv.radiusSm, backgroundColor: lv.muted },
  summary: { fontSize: 18, lineHeight: 24, fontWeight: "600", color: lv.fg, fontFamily: lv.font.display },
  vouch: { flexDirection: "row", gap: 10, alignItems: "flex-start", paddingVertical: 4 },
  vouchText: { fontSize: 14, color: lv.fg, lineHeight: 20 },
  hide: { fontSize: 13, fontWeight: "600", color: lv.thread, paddingVertical: 4 },
  polaroid: { flexDirection: "row", gap: 12, padding: 10, borderRadius: lv.radiusSm, borderWidth: 2, backgroundColor: lv.bg },
  photo: { width: 60, height: 60, borderRadius: 12, backgroundColor: lv.muted },
  cardText: { fontSize: 14, fontWeight: "600", color: lv.fg },
  badgeRow: { flexDirection: "row", gap: 8 },
  badge: { flex: 1, alignItems: "center", gap: 4, padding: 10, borderRadius: lv.radiusSm, backgroundColor: lv.accent },
  locked: { backgroundColor: lv.muted, opacity: 0.7 },
  badgeIcon: { fontSize: 26, color: lv.thread, fontWeight: "700" },
  badgeLabel: { fontSize: 13, fontWeight: "700", color: lv.fg, textAlign: "center" },
});
