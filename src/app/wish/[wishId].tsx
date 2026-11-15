import { useMutation, useQuery } from "convex/react";
import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { GrantedCard } from "@/components/GrantedCard";
import { PhotoPanel } from "@/components/PhotoPanel";
import { errorMessage } from "@/components/ui";
import { DAvatar, DButton, DCard, DError, DField, Sub } from "@/components/lv/passon/kit";
import { useMe } from "@/lib/device";
import { lv } from "@/theme/tokens";

const STATUS_LABEL = { traveling: "Traveling", found: "Found", granted: "Wish granted", faded: "Faded" } as const;
const TIER_LABEL = { gold: "Gold", silver: "Silver", bronze: "Bronze", red: "Red" } as const;

export default function WishDetail() {
  const { wishId } = useLocalSearchParams<{ wishId: string }>();
  const { deviceId } = useMe();
  const data = useQuery(api.endings.wishDetail, deviceId ? { deviceId, wishId } : "skip");
  const confirmMatch = useMutation(api.endings.confirmMatch);
  const rejectCandidate = useMutation(api.endings.rejectCandidate);
  const setThankYou = useMutation(api.endings.setThankYou);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [contact, setContact] = useState("");
  const [thankYou, setThankYouText] = useState("");
  const [thanksSaved, setThanksSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (data === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={lv.thread} />
      </View>
    );
  }
  if (data === null) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>This wish isn't yours</Text>
        <Sub>Only the wisher can open it here.</Sub>
      </View>
    );
  }

  return (
    <ScrollView testID="wish-detail-screen" style={{ backgroundColor: lv.bg }} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: data.status === "granted" ? "Wish granted" : "Your wish" }} />
      <DCard>
        <Text style={styles.status}>{STATUS_LABEL[data.status]}</Text>
        <Text style={styles.wish}>{data.text}</Text>
        {data.tier ? <Sub>{TIER_LABEL[data.tier]} wish</Sub> : null}
      </DCard>

      {data.status === "traveling" ? (
        <View style={{ gap: 12 }}>
          <Text style={styles.section}>{data.candidates.length ? "They say it's them!" : "No one has said it's them yet"}</Text>
          {data.candidates.length === 0 ? <Sub>When someone taps "It's me!", they'll show up here with the vouches above them.</Sub> : null}
          {data.candidates.map((c) => (
            <DCard key={c.hopId} testID={`candidate-${c.hopId}`}>
              <View style={styles.row}>
                <DAvatar name={c.name} color={c.avatar} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>
                    {c.name}
                    {c.city ? ` · ${c.city}` : ""}
                  </Text>
                  <Sub>
                    {c.depth === 1 ? "1 ripple" : `${c.depth} ripples`} · {TIER_LABEL[c.tier]} if it's them
                  </Sub>
                </View>
              </View>
              <Text style={styles.intro}>“{c.intro}”</Text>
              {c.chain.length ? (
                <View style={styles.chain}>
                  {c.chain.map((h, i) => (
                    <View key={i} style={styles.vouch}>
                      <DAvatar name={h.name} color={h.avatar} size={24} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.vouchBy}>
                          {h.name}
                          {h.city ? ` · ${h.city}` : ""}
                        </Text>
                        {h.vouch ? <Text style={styles.vouchText}>“{h.vouch}”</Text> : null}
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Sub>You sent it to them directly.</Sub>
              )}
              {confirming === c.hopId ? (
                <>
                  <DField
                    label={`One contact for ${c.name} (phone, WeChat or Instagram)`}
                    value={contact}
                    onChangeText={setContact}
                    testID="confirm-contact"
                  />
                  <DField
                    label="A thank-you note for everyone (optional)"
                    value={thankYou}
                    onChangeText={setThankYouText}
                    multiline
                    testID="confirm-thank-you"
                  />
                  <DError error={error} />
                  <DButton
                    testID="confirm-submit"
                    title="Swap contacts"
                    busy={busy}
                    disabled={!contact.trim()}
                    onPress={() => run(() => confirmMatch({ deviceId: deviceId!, hopId: c.hopId as Id<"hops">, contact, thankYou }))}
                  />
                  <DButton title="Back" variant="ghost" onPress={() => setConfirming(null)} />
                </>
              ) : (
                <View style={styles.buttons}>
                  <DButton testID={`candidate-yes-${c.hopId}`} title="Yes, it's you" style={styles.half} onPress={() => setConfirming(c.hopId)} />
                  <DButton
                    testID={`candidate-no-${c.hopId}`}
                    title="Not quite"
                    variant="ghost"
                    style={styles.half}
                    busy={busy}
                    onPress={() => run(() => rejectCandidate({ deviceId: deviceId!, hopId: c.hopId as Id<"hops"> }))}
                  />
                </View>
              )}
            </DCard>
          ))}
        </View>
      ) : null}

      {data.status === "found" && data.match ? (
        <>
          <DCard testID="wish-found">
            <Text style={styles.section}>Found! It's {data.match.name}</Text>
            {data.match.contact ? (
              <Text testID="match-contact" selectable style={styles.contact}>
                Reach {data.match.name}: {data.match.contact}
              </Text>
            ) : (
              <Sub>{data.match.name} will share a contact on their page.</Sub>
            )}
            {data.meetMissed ? <Sub>The 7 days to meet are over, so the ending stays locked.</Sub> : null}
          </DCard>
          {data.meetMissed ? null : (
            <PhotoPanel
              wishId={data._id}
              party={{ deviceId: deviceId! }}
              me="wisher"
              otherName={data.match.name}
              photo={data.photo}
              meetDeadline={data.meetDeadline}
            />
          )}
        </>
      ) : null}

      {data.ending ? <GrantedCard wishId={data._id} ending={data.ending} /> : null}

      {(data.status === "found" || data.status === "granted") && !data.thankYou && !thanksSaved ? (
        <DCard testID="thank-you-card">
          <Text style={styles.section}>Thank everyone who helped</Text>
          <DField value={thankYou} onChangeText={setThankYouText} multiline placeholder="Amy, you knew exactly who to ask…" testID="thank-you-text" />
          <DError error={error} />
          <DButton
            testID="thank-you-save"
            title="Save my note"
            busy={busy}
            disabled={!thankYou.trim()}
            onPress={() =>
              run(async () => {
                await setThankYou({ deviceId: deviceId!, wishId: data._id, thankYou });
                setThanksSaved(true);
              })
            }
          />
        </DCard>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 24, backgroundColor: lv.bg },
  container: { padding: 20, gap: 14, maxWidth: 430, width: "100%", alignSelf: "center", paddingBottom: 48 },
  title: { fontSize: 22, fontWeight: "800", color: lv.fg },
  status: { fontSize: 13, fontWeight: "800", color: lv.thread },
  wish: { fontSize: 19, fontWeight: "800", color: lv.fg, lineHeight: 26 },
  section: { fontSize: 18, fontWeight: "800", color: lv.fg },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  name: { fontSize: 17, fontWeight: "800", color: lv.fg },
  intro: { fontSize: 16, color: lv.fg, lineHeight: 22 },
  chain: { gap: 8, backgroundColor: lv.bg, borderRadius: 14, padding: 10 },
  vouch: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  vouchBy: { fontSize: 13, fontWeight: "700", color: lv.fg },
  vouchText: { fontSize: 14, color: lv.fg, lineHeight: 19 },
  buttons: { flexDirection: "row", gap: 8 },
  half: { flex: 1, minHeight: 46, paddingHorizontal: 10 },
  contact: { fontSize: 16, fontWeight: "700", color: lv.thread },
});
