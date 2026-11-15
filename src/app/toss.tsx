import { useAction, useMutation } from "convex/react";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Pool } from "@/components/Pool";
import { ShareLink } from "@/components/ShareLink";
import { Button, Card, ChipRow, ErrorText, Field, Muted, Title, errorMessage } from "@/components/ui";
import { useMe } from "@/lib/device";
import { colors } from "@/lib/theme";

const TYPES = [
  { key: "do_together", title: "Someone to do something with", example: "Someone to jam on drums with" },
  { key: "local", title: "A local", example: "A local in Tokyo to show me izakayas" },
  { key: "been_there", title: "Someone who's been there", example: "Someone who has been to Antarctica" },
  { key: "same_boat", title: "Someone in the same boat", example: "Someone who also just moved to SF" },
] as const;

type WishType = (typeof TYPES)[number]["key"];
const TAGS = ["music", "travel", "food", "sports", "tech", "outdoors", "art", "knows everyone"] as const;

type Person = { name: string; tags: string[] };

export default function Toss() {
  const router = useRouter();
  const { deviceId, user } = useMe();
  const toss = useMutation(api.wishes.toss);
  const polish = useAction(api.ai.polishWish);
  const draftMessage = useAction(api.ai.draftPassMessage);

  const [step, setStep] = useState<"type" | "write" | "people" | "share">("type");
  const [type, setType] = useState<WishType | null>(null);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [people, setPeople] = useState<Person[]>([{ name: "", tags: [] }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [links, setLinks] = useState<{ hopId: Id<"hops">; name: string; message: string | null }[]>([]);

  const needsProfile = !user?.name;
  const typeInfo = TYPES.find((t) => t.key === type);

  async function onPolish() {
    if (!deviceId || !type || !text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setText(await polish({ deviceId, type, text }));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function onToss() {
    if (!deviceId || !type) return;
    setBusy(true);
    setError(null);
    try {
      const recipients = people.filter((p) => p.name.trim());
      const { hopIds } = await toss({ deviceId, type, text, name, city, recipients });
      const created = hopIds.map((hopId, i) => ({ hopId, name: recipients[i].name, message: null as string | null }));
      setLinks(created);
      setStep("share");
      created.forEach(({ hopId }) => {
        void draftMessage({ hopId }).then((message) =>
          setLinks((prev) => prev.map((l) => (l.hopId === hopId ? { ...l, message } : l))),
        );
      });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView testID="toss-screen" contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {step === "type" ? (
        <>
          <Title>What kind of person?</Title>
          <Muted>Wish for a type of person, never a specific one.</Muted>
          {TYPES.map((t) => (
            <Pressable
              key={t.key}
              testID={`toss-type-${t.key}`}
              onPress={() => {
                setType(t.key);
                setStep("write");
              }}
            >
              <Card>
                <Text style={styles.typeTitle}>{t.title}</Text>
                <Muted>“{t.example}”</Muted>
              </Card>
            </Pressable>
          ))}
        </>
      ) : null}

      {step === "write" && typeInfo ? (
        <>
          <Title>Make your wish</Title>
          <Muted>Who + what to do + why. Friends help more when they know why.</Muted>
          <Field
            testID="toss-text"
            multiline
            value={text}
            onChangeText={setText}
            placeholder={`${typeInfo.example}…`}
          />
          <Button testID="toss-polish" title="✨ AI polish" variant="secondary" busy={busy} disabled={!text.trim()} onPress={onPolish} />
          {needsProfile ? (
            <Card>
              <Field label="Your name" value={name} onChangeText={setName} testID="toss-name" placeholder="Louise" />
              <Field label="Your city" value={city} onChangeText={setCity} testID="toss-city" placeholder="San Francisco" />
            </Card>
          ) : null}
          <ErrorText error={error} />
          <Button
            testID="toss-next"
            title="Next"
            disabled={!text.trim() || (needsProfile && !name.trim())}
            onPress={() => setStep("people")}
          />
          <Button title="Back" variant="ghost" onPress={() => setStep("type")} />
        </>
      ) : null}

      {step === "people" ? (
        <>
          <Title>Who should get it first?</Title>
          <Card testID="ask-the-well">
            <Text style={styles.typeTitle}>Ask the well · 1 star</Text>
            <Muted>Soon: the well reads your friends' vouches and suggests who to send this to first.</Muted>
          </Card>
          <Muted>Pick up to 3 people most likely to know someone.</Muted>
          {people.map((p, i) => (
            <Card key={i}>
              <Field
                testID={`toss-person-${i}`}
                label={`Person ${i + 1}`}
                value={p.name}
                placeholder="Their name"
                onChangeText={(v) => setPeople((prev) => prev.map((x, j) => (j === i ? { ...x, name: v } : x)))}
              />
              <ChipRow
                options={TAGS}
                value={null}
                onChange={(tag) =>
                  setPeople((prev) =>
                    prev.map((x, j) =>
                      j === i ? { ...x, tags: x.tags.includes(tag) ? x.tags.filter((t) => t !== tag) : [...x.tags, tag].slice(-3) } : x,
                    ),
                  )
                }
              />
              {p.tags.length ? <Muted>Tags: {p.tags.join(", ")}</Muted> : null}
            </Card>
          ))}
          {people.length < 3 ? (
            <Button title="+ Add someone" variant="ghost" testID="toss-add-person" onPress={() => setPeople((prev) => [...prev, { name: "", tags: [] }])} />
          ) : null}
          <ErrorText error={error} />
          <Button
            testID="toss-submit"
            title="Toss it into the well"
            busy={busy}
            disabled={!people.some((p) => p.name.trim())}
            onPress={onToss}
          />
          <Button title="Back" variant="ghost" onPress={() => setStep("write")} />
        </>
      ) : null}

      {step === "share" ? (
        <>
          <Pool size={180} />
          <Title>Splash! Your wish is in the well.</Title>
          <Muted>Send each person their own link. Every link carries the trust chain forward.</Muted>
          {links.map((l) => (
            <ShareLink key={l.hopId} hopId={l.hopId} name={l.name} message={l.message} />
          ))}
          <Button title="Watch it ripple" testID="toss-done" onPress={() => router.replace("/")} />
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 14, maxWidth: 430, width: "100%", alignSelf: "center", paddingBottom: 48 },
  typeTitle: { fontSize: 17, fontWeight: "800", color: colors.ink },
});
