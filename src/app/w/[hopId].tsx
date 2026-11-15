import { useAction, useMutation, useQuery } from "convex/react";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Pool } from "@/components/Pool";
import { ShareLink } from "@/components/ShareLink";
import { Avatar, Button, Card, ChipRow, ErrorText, Field, Muted, errorMessage } from "@/components/ui";
import { colors, mono } from "@/lib/theme";
import { countdown, ordinal, useNow } from "@/lib/time";

const HOW = ["friend", "coworker", "family", "roommate", "classmate", "neighbor"] as const;
const HOW_LONG = ["under a year", "1–5 years", "5–10 years", "10+ years"] as const;
const WORDS = ["reliable", "fun", "kind", "adventurous"] as const;
const TAGS = ["music", "travel", "food", "sports", "tech", "outdoors", "art", "knows everyone"] as const;

type Mode = "view" | "its_me" | "me" | "vouch" | "pass" | "done";

export default function PassOn() {
  const { hopId, start } = useLocalSearchParams<{ hopId: string; start?: string }>();
  const data = useQuery(api.hops.page, { hopId });
  const act = useMutation(api.hops.act);
  const passTo = useMutation(api.hops.passTo);
  const itsMe = useMutation(api.hops.itsMe);
  const saveContact = useMutation(api.hops.saveContact);
  const draftVouch = useAction(api.ai.draftVouch);
  const draftMessage = useAction(api.ai.draftPassMessage);
  const now = useNow();

  const [mode, setMode] = useState<Mode>("view");
  const [action, setAction] = useState<"pass" | "group">("pass");
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [how, setHow] = useState<string | null>(null);
  const [howLong, setHowLong] = useState<string | null>(null);
  const [word, setWord] = useState<string | null>(null);
  const [vouch, setVouch] = useState("");
  const [intro, setIntro] = useState("");
  const [contact, setContact] = useState("");
  const [contactSaved, setContactSaved] = useState(false);
  const [nextName, setNextName] = useState("");
  const [nextTags, setNextTags] = useState<string[]>([]);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!data || initialized) return;
    setInitialized(true);
    setName(data.hop.holderName === "Group chat" ? "" : data.hop.holderName);
    setContact(data.hop.holderContact ?? "");
    if (data.hop.action === "pass" || data.hop.action === "group") {
      setAction(data.hop.action);
      setMode("pass");
    } else if (data.hop.action === "its_me") {
      setMode("done");
    } else if (start === "its_me") {
      setMode("its_me");
    } else if (start === "pass" || start === "group") {
      setAction(start);
      setMode("me");
    }
  }, [data, initialized, start]);

  async function run(fn: () => Promise<void>) {
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
        <Text style={styles.big}>This link has faded.</Text>
        <Muted>Ask whoever sent it for a fresh one.</Muted>
      </View>
    );
  }

  const { wish, hop } = data;
  const id = hop._id as Id<"hops">;
  const open = wish.status === "traveling" && wish.expiresAt > now;
  const limit = action === "group" ? 1 : 3;
  const canAddMore = data.children.length < limit && data.canPass && open;

  return (
    <ScrollView testID="pass-on-screen" style={{ backgroundColor: colors.cream }} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: `${wish.creatorName} made a wish` }} />
      <Text style={styles.brand}>Wishwell</Text>
      <Pool size={140} testID="pass-on-pool" />
      <Card testID="pass-on-wish">
        <View style={styles.row}>
          <Avatar name={wish.creatorName} color={wish.creatorAvatar} size={32} />
          <Text style={styles.who}>
            {wish.creatorName}
            {wish.creatorCity ? ` · ${wish.creatorCity}` : ""} made a wish
          </Text>
        </View>
        <Text style={styles.wishText}>{wish.text}</Text>
        <View style={styles.statsRow}>
          <Text testID="pass-on-ripples" style={styles.stat}>
            {data.ripples === 1 ? "1 ripple in" : `${data.ripples} ripples in`}
          </Text>
          <Text testID="pass-on-countdown" style={styles.countdown}>
            {open ? countdown(wish.expiresAt, now) : "00:00:00"}
          </Text>
        </View>
      </Card>

      {data.chain.length > 0 ? (
        <Card testID="pass-on-chain">
          <Text style={styles.section}>The trust chain</Text>
          {data.chain.map((c) => (
            <View key={c.hopId} style={styles.vouch}>
              <Avatar name={c.name} color={c.avatar} size={28} />
              <View style={{ flex: 1 }}>
                <Text style={styles.vouchBy}>
                  {c.name}
                  {c.city ? ` · ${c.city}` : ""}
                  {c.viaGroup ? " · via group chat" : ""}
                </Text>
                {c.vouch ? <Text style={styles.vouchText}>“{c.vouch}”</Text> : null}
              </View>
            </View>
          ))}
          <Muted>{data.senderName} passed it to you.</Muted>
        </Card>
      ) : (
        <Muted style={{ textAlign: "center" }}>{data.senderName} sent this straight to you.</Muted>
      )}

      {!open && mode !== "done" ? (
        <Card>
          <Text style={styles.section}>
            {wish.status === "granted" ? "Wish granted ✨" : wish.status === "found" ? "Someone was found!" : "This wish has faded."}
          </Text>
          <Muted>Thanks for being part of the ripple.</Muted>
        </Card>
      ) : null}

      {open && mode === "view" ? (
        <View style={{ gap: 10 }}>
          <Button testID="pass-its-me" title="It's me!" variant="secondary" onPress={() => setMode("its_me")} />
          <Button
            testID="pass-know-someone"
            title="I know someone"
            onPress={() => {
              setAction("pass");
              setMode("me");
            }}
          />
          <Button
            testID="pass-group"
            title="Share to a group chat"
            variant="secondary"
            onPress={() => {
              setAction("group");
              setMode("me");
            }}
          />
        </View>
      ) : null}

      {mode === "its_me" ? (
        <Card>
          <Text style={styles.section}>It's you? Wonderful.</Text>
          <Field label="Your name" value={name} onChangeText={setName} testID="its-me-name" />
          <Field label="Your city" value={city} onChangeText={setCity} testID="its-me-city" />
          <Field label="One line about you" value={intro} onChangeText={setIntro} multiline testID="its-me-intro" placeholder="I've drummed in a band for 8 years…" />
          <Field label="One contact (phone, WeChat or Instagram)" value={contact} onChangeText={setContact} testID="its-me-contact" />
          <ErrorText error={error} />
          <Button
            testID="its-me-submit"
            title="Send to the wisher"
            busy={busy}
            disabled={!intro.trim()}
            onPress={() =>
              run(async () => {
                await itsMe({ hopId: id, name, city, intro, contact });
                setContactSaved(!!contact.trim());
                setMode("done");
              })
            }
          />
          <Button title="Back" variant="ghost" onPress={() => setMode("view")} />
        </Card>
      ) : null}

      {mode === "me" ? (
        <Card>
          <Text style={styles.section}>{action === "group" ? "Share to a group chat" : "Pass it on"}</Text>
          <Field label="Your name" value={name} onChangeText={setName} testID="pass-name" />
          <Field label="Your city" value={city} onChangeText={setCity} testID="pass-city" placeholder="Where are you?" />
          <Button testID="pass-me-next" title="Next" disabled={!name.trim() || !city.trim()} onPress={() => setMode("vouch")} />
          <Button title="Back" variant="ghost" onPress={() => setMode("view")} />
        </Card>
      ) : null}

      {mode === "vouch" ? (
        <Card testID="vouch-card">
          <Text style={styles.section}>Vouch for {data.senderName}</Text>
          <Muted>Three taps, then the AI drafts a line you can edit.</Muted>
          <Text style={styles.label}>How do you know them?</Text>
          <ChipRow options={HOW} value={how} onChange={setHow} testIDPrefix="vouch-how" />
          <Text style={styles.label}>For how long?</Text>
          <ChipRow options={HOW_LONG} value={howLong} onChange={setHowLong} testIDPrefix="vouch-long" />
          <Text style={styles.label}>One word</Text>
          <ChipRow options={WORDS} value={word} onChange={setWord} testIDPrefix="vouch-word" />
          <Button
            testID="vouch-draft"
            title="✨ Draft my vouch"
            variant="secondary"
            busy={busy && !vouch}
            disabled={!how || !howLong || !word}
            onPress={() =>
              run(async () => {
                setVouch(await draftVouch({ hopId: id, name, how: how!, howLong: howLong!, word: word! }));
              })
            }
          />
          {vouch ? <Field value={vouch} onChangeText={setVouch} multiline testID="vouch-text" /> : null}
          <ErrorText error={error} />
          <Button
            testID="vouch-submit"
            title="Vouch and continue"
            busy={busy && !!vouch}
            disabled={!vouch.trim()}
            onPress={() =>
              run(async () => {
                await act({ hopId: id, action, name, city, vouch, tags: word ? [word] : [] });
                setMode("pass");
              })
            }
          />
        </Card>
      ) : null}

      {mode === "pass" ? (
        <View style={{ gap: 12 }}>
          {data.children.map((c) => (
            <ShareLink key={c.hopId} hopId={c.hopId} name={c.name} message={messages[c.hopId] ?? c.passMessage} />
          ))}
          {canAddMore ? (
            <Card>
              <Text style={styles.section}>
                {action === "group"
                  ? "Which group chat?"
                  : data.children.length === 0
                    ? "Who are you passing it to?"
                    : `Someone else? (${data.children.length}/3)`}
              </Text>
              <Field
                testID="pass-next-name"
                value={nextName}
                onChangeText={setNextName}
                placeholder={action === "group" ? "Climbing crew" : "Their name"}
              />
              <Text style={styles.label}>2–3 tags about them</Text>
              <ChipRow
                options={TAGS}
                value={null}
                onChange={(t) => setNextTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t].slice(-3)))}
                testIDPrefix="pass-tag"
              />
              {nextTags.length ? <Muted>Tags: {nextTags.join(", ")}</Muted> : null}
              <ErrorText error={error} />
              <Button
                testID="pass-create-link"
                title="Create their link"
                busy={busy}
                disabled={action !== "group" && !nextName.trim()}
                onPress={() =>
                  run(async () => {
                    const childId = await passTo({ parentHopId: id, name: nextName, tags: nextTags });
                    setNextName("");
                    setNextTags([]);
                    void draftMessage({ hopId: childId }).then((m) => setMessages((prev) => ({ ...prev, [childId]: m })));
                  })
                }
              />
            </Card>
          ) : null}
          {data.children.length > 0 ? <Button testID="pass-done" title="I'm done" variant="secondary" onPress={() => setMode("done")} /> : null}
        </View>
      ) : null}

      {mode === "done" ? (
        <Card testID="pass-on-done">
          <Text style={styles.big}>You're ripple #{hop.depth} on this wish!</Text>
          <Muted>We'll show you how it ends.</Muted>
          {contactSaved ? (
            <Text style={styles.saved}>Got it. We'll send the ending to {contact}.</Text>
          ) : (
            <>
              <Field label="Where should we send the ending?" value={contact} onChangeText={setContact} placeholder="Phone, WeChat or Instagram" testID="done-contact" />
              <Button
                testID="done-save-contact"
                title="Tell me how it ends"
                busy={busy}
                disabled={!contact.trim()}
                onPress={() =>
                  run(async () => {
                    await saveContact({ hopId: id, contact });
                    setContactSaved(true);
                  })
                }
              />
            </>
          )}
          <Muted style={{ marginTop: 8 }}>Got a wish of your own? Get the Wishwell app and toss it into the well.</Muted>
        </Card>
      ) : null}
      <Text style={styles.footer}>{ordinal(hop.depth)} ripple · up to 6 ripples, 48 hours</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 24, backgroundColor: colors.cream },
  container: { padding: 20, gap: 14, maxWidth: 430, width: "100%", alignSelf: "center", paddingBottom: 48 },
  brand: { fontSize: 20, fontWeight: "800", color: colors.red, textAlign: "center", marginTop: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  who: { fontSize: 15, color: colors.muted, fontWeight: "600", flex: 1 },
  wishText: { fontSize: 21, fontWeight: "800", color: colors.ink, lineHeight: 28 },
  statsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  stat: { fontSize: 15, color: colors.red, fontWeight: "700" },
  countdown: { fontFamily: mono, fontSize: 22, fontWeight: "800", color: colors.ink },
  section: { fontSize: 18, fontWeight: "800", color: colors.ink },
  label: { fontSize: 14, color: colors.muted, fontWeight: "600" },
  vouch: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  vouchBy: { fontSize: 14, fontWeight: "700", color: colors.ink },
  vouchText: { fontSize: 15, color: colors.ink, lineHeight: 21 },
  big: { fontSize: 22, fontWeight: "800", color: colors.ink },
  saved: { fontSize: 15, color: colors.red, fontWeight: "600" },
  footer: { fontSize: 12, color: colors.muted, textAlign: "center" },
});
