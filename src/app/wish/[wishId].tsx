import { useMutation, useQuery } from "convex/react";
import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { GrantedCard } from "@/components/GrantedCard";
import { PhotoPanel } from "@/components/PhotoPanel";
import { Avatar, Button, Card, ErrorText, Field, Muted, errorMessage } from "@/components/ui";
import { useMe } from "@/lib/device";
import { colors } from "@/lib/theme";

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
        <ActivityIndicator color={colors.red} />
      </View>
    );
  }
  if (data === null) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>This wish isn't yours</Text>
        <Muted>Only the wisher can open it here.</Muted>
      </View>
    );
  }

  return (
    <ScrollView testID="wish-detail-screen" style={{ backgroundColor: colors.cream }} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: data.status === "granted" ? "Wish granted" : "Your wish" }} />
      <Card>
        <Text style={styles.status}>{STATUS_LABEL[data.status]}</Text>
        <Text style={styles.wish}>{data.text}</Text>
        {data.tier ? <Muted>{TIER_LABEL[data.tier]} wish</Muted> : null}
      </Card>

      {data.status === "traveling" ? (
        <View style={{ gap: 12 }}>
          <Text style={styles.section}>{data.candidates.length ? "They say it's them!" : "No one has said it's them yet"}</Text>
          {data.candidates.length === 0 ? <Muted>When someone taps "It's me!", they'll show up here with the vouches above them.</Muted> : null}
          {data.candidates.map((c) => (
            <Card key={c.hopId} testID={`candidate-${c.hopId}`}>
              <View style={styles.row}>
                <Avatar name={c.name} color={c.avatar} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>
                    {c.name}
                    {c.city ? ` · ${c.city}` : ""}
                  </Text>
                  <Muted>
                    {c.depth === 1 ? "1 ripple" : `${c.depth} ripples`} · {TIER_LABEL[c.tier]} if it's them
                  </Muted>
                </View>
              </View>
              <Text style={styles.intro}>“{c.intro}”</Text>
              {c.chain.length ? (
                <View style={styles.chain}>
                  {c.chain.map((h, i) => (
                    <View key={i} style={styles.vouch}>
                      <Avatar name={h.name} color={h.avatar} size={24} />
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
                <Muted>You sent it to them directly.</Muted>
              )}
              {confirming === c.hopId ? (
                <>
                  <Field
                    label={`One contact for ${c.name} (phone, WeChat or Instagram)`}
                    value={contact}
                    onChangeText={setContact}
                    testID="confirm-contact"
                  />
                  <Field
                    label="A thank-you note for everyone (optional)"
                    value={thankYou}
                    onChangeText={setThankYouText}
                    multiline
                    testID="confirm-thank-you"
                  />
                  <ErrorText error={error} />
                  <Button
                    testID="confirm-submit"
                    title="Swap contacts"
                    busy={busy}
                    disabled={!contact.trim()}
                    onPress={() => run(() => confirmMatch({ deviceId: deviceId!, hopId: c.hopId as Id<"hops">, contact, thankYou }))}
                  />
                  <Button title="Back" variant="ghost" onPress={() => setConfirming(null)} />
                </>
              ) : (
                <View style={styles.buttons}>
                  <Button testID={`candidate-yes-${c.hopId}`} title="Yes, it's you" style={styles.half} onPress={() => setConfirming(c.hopId)} />
                  <Button
                    testID={`candidate-no-${c.hopId}`}
                    title="Not quite"
                    variant="secondary"
                    style={styles.half}
                    busy={busy}
                    onPress={() => run(() => rejectCandidate({ deviceId: deviceId!, hopId: c.hopId as Id<"hops"> }))}
                  />
                </View>
              )}
            </Card>
          ))}
        </View>
      ) : null}

      {data.status === "found" && data.match ? (
        <>
          <Card testID="wish-found">
            <Text style={styles.section}>Found! It's {data.match.name}</Text>
            {data.match.contact ? (
              <Text testID="match-contact" selectable style={styles.contact}>
                Reach {data.match.name}: {data.match.contact}
              </Text>
            ) : (
              <Muted>{data.match.name} will share a contact on their page.</Muted>
            )}
            {data.meetMissed ? <Muted>The 7 days to meet are over, so the ending stays locked.</Muted> : null}
          </Card>
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
        <Card testID="thank-you-card">
          <Text style={styles.section}>Thank everyone who helped</Text>
          <Field value={thankYou} onChangeText={setThankYouText} multiline placeholder="Amy, you knew exactly who to ask…" testID="thank-you-text" />
          <ErrorText error={error} />
          <Button
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
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 24, backgroundColor: colors.cream },
  container: { padding: 20, gap: 14, maxWidth: 430, width: "100%", alignSelf: "center", paddingBottom: 48 },
  title: { fontSize: 22, fontWeight: "800", color: colors.ink },
  status: { fontSize: 13, fontWeight: "800", color: colors.red },
  wish: { fontSize: 19, fontWeight: "800", color: colors.ink, lineHeight: 26 },
  section: { fontSize: 18, fontWeight: "800", color: colors.ink },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  name: { fontSize: 17, fontWeight: "800", color: colors.ink },
  intro: { fontSize: 16, color: colors.ink, lineHeight: 22 },
  chain: { gap: 8, backgroundColor: colors.cream, borderRadius: 14, padding: 10 },
  vouch: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  vouchBy: { fontSize: 13, fontWeight: "700", color: colors.ink },
  vouchText: { fontSize: 14, color: colors.ink, lineHeight: 19 },
  buttons: { flexDirection: "row", gap: 8 },
  half: { flex: 1, minHeight: 46, paddingHorizontal: 10 },
  contact: { fontSize: 16, fontWeight: "700", color: colors.red },
});
