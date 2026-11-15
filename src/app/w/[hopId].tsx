import { useAction, useMutation, useQuery } from "convex/react";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { GetTheApp } from "@/components/GetTheApp";
import { HopEnding } from "@/components/HopEnding";
import { Pool } from "@/components/Pool";
import { ShareLink } from "@/components/ShareLink";
import { errorMessage } from "@/components/ui";
import { WellHint } from "@/components/WellHint";
import { WhyItWorks } from "@/components/WhyItWorks";
import { DAvatar, DButton, DCard, DChips, DError, DField, Eyebrow, Glass, Progress, Sub } from "@/components/lv/passon/kit";
import { useDeviceId } from "@/lib/device";
import { countdown, ordinal, useNow } from "@/lib/time";
import { lv } from "@/theme/tokens";

const HOW = ["friend", "coworker", "family", "roommate", "classmate", "neighbor"] as const;
const HOW_LONG = ["under a year", "1–5 years", "5–10 years", "10+ years"] as const;
const WORDS = ["reliable", "fun", "kind", "adventurous"] as const;
const TAGS = ["music", "travel", "food", "sports", "tech", "outdoors", "art", "knows everyone"] as const;

type Mode = "view" | "its_me" | "me" | "vouch" | "pass" | "done";

function Header({ title, sub, onBack }: { title: string; sub?: string; onBack?: () => void }) {
  return (
    <View style={{ paddingTop: 4, gap: 8 }}>
      {onBack ? (
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} testID="pass-back">
          <Text style={styles.back}>←</Text>
        </Pressable>
      ) : null}
      <Text style={styles.h1}>{title}</Text>
      {sub ? <Sub>{sub}</Sub> : null}
    </View>
  );
}

export default function PassOn() {
  const { hopId, start } = useLocalSearchParams<{ hopId: string; start?: string }>();
  const data = useQuery(api.hops.page, { hopId });
  const deviceId = useDeviceId();
  const claim = useMutation(api.hops.claim);
  const ensure = useMutation(api.users.ensure);
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
  const [nextReason, setNextReason] = useState("");
  const [nextTags, setNextTags] = useState<string[]>([]);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (Platform.OS === "web" || !deviceId || !data || data.hop.action) return;
    void ensure({ deviceId }).then(() => claim({ hopId: data.hop._id, deviceId }));
  }, [deviceId, data?.hop._id]);

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

  const go = (m: Mode) => {
    setError(null);
    setMode(m);
  };

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
        <Text style={styles.h1}>This link has faded.</Text>
        <Sub>Ask whoever sent it for a fresh one.</Sub>
      </View>
    );
  }

  const { wish, hop } = data;
  const id = hop._id as Id<"hops">;
  const open = wish.status === "traveling" && wish.expiresAt > now;
  const limit = action === "group" ? 1 : 3;
  const canAddMore = data.children.length < limit && data.canPass && open;
  const fromTheWell = !!wish.daily && data.chain.length === 0;
  // Older backends may not send `mode`; treat missing as "fun" (no reason required).
  const serious = (wish as { mode?: string }).mode === "serious";

  return (
    <ScrollView
      testID="pass-on-screen"
      style={{ backgroundColor: lv.bg }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: `${wish.creatorName} made a wish` }} />

      {mode === "view" || (!open && mode !== "done") ? (
        <>
          <View style={styles.pill}>
            <Text style={styles.pillText}>🪙 Wishwell</Text>
          </View>
          <Text style={styles.hero}>A wish is{"\n"}passing through you.</Text>
          <Sub>
            {data.chain.length > 0
              ? `${data.senderName} passed it to you.`
              : fromTheWell
                ? "Today's wish, straight from the well."
                : `${data.senderName} sent this straight to you.`}
          </Sub>

          <Glass testID="pass-on-wish">
            <View style={styles.between}>
              <Eyebrow>Passing through you</Eyebrow>
              <View style={styles.row}>
                <View style={[styles.dot, !open && { backgroundColor: lv.mutedFg }]} />
                <Text testID="pass-on-countdown" style={styles.mono}>
                  {open ? countdown(wish.expiresAt, now) : "00:00:00"}
                </Text>
              </View>
            </View>
            <View style={styles.row}>
              <DAvatar name={wish.creatorName} color={wish.creatorAvatar} size={28} />
              <Text style={styles.who}>
                {wish.creatorName}
                {wish.creatorCity ? ` · ${wish.creatorCity}` : ""} made a wish
              </Text>
            </View>
            <Text style={styles.wishText}>{wish.text}</Text>
            <Text testID="pass-on-ripples" style={styles.rippleLine}>
              {data.ripples === 1 ? "1 ripple in" : `${data.ripples} ripples in`} · Ripple {hop.depth}
              {data.chain.length > 0 ? ` · from ${data.senderName}` : ""}
            </Text>
            <View style={styles.poolWrap}>
              <Pool size={110} testID="pass-on-pool" />
            </View>

            {data.chain.length > 0 ? (
              <View testID="pass-on-chain" style={{ gap: 12, marginTop: 4 }}>
                <Eyebrow>The trust chain</Eyebrow>
                {data.chain.map((c) => (
                  <View key={c.depth} style={styles.vouch}>
                    <DAvatar name={c.name} color={c.avatar} size={28} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.vouchBy}>
                        <Text style={{ color: lv.fg, fontWeight: "600" }}>{c.name}</Text>
                        {c.city ? ` · ${c.city}` : ""}
                        {c.viaGroup ? " · via group chat" : ""} · Ripple {c.depth}
                      </Text>
                      {c.vouch ? <Text style={styles.vouchText}>“{c.vouch}”</Text> : null}
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            {!open ? (
              <View style={styles.closed}>
                <Text style={styles.closedText}>
                  {wish.status === "granted"
                    ? "Wish granted ✨"
                    : wish.status === "found"
                      ? "This wish found its person. 🎉"
                      : "This wish faded before it found its person."}{" "}
                  Thanks for being part of the ripple.
                </Text>
              </View>
            ) : (
              <View style={{ gap: 8, marginTop: 6 }}>
                <View style={styles.grid}>
                  <DButton testID="pass-its-me" title="It's me!" variant="ink" style={{ flex: 1 }} onPress={() => go("its_me")} />
                  <DButton
                    testID="pass-know-someone"
                    title="I know someone"
                    variant="thread"
                    style={{ flex: 1 }}
                    onPress={() => {
                      setAction("pass");
                      go("me");
                    }}
                  />
                </View>
                <DButton
                  testID="pass-group"
                  title="👥  Share to a group chat"
                  variant="ghost"
                  size="sm"
                  onPress={() => {
                    setAction("group");
                    go("me");
                  }}
                />
              </View>
            )}
          </Glass>

          {wish.daily ? <WellHint daily={wish.daily} /> : null}
          {open ? <WhyItWorks /> : null}
        </>
      ) : null}

      {!open || hop.action === "its_me" ? <HopEnding hopId={id} /> : null}

      {open && mode === "its_me" ? (
        <>
          <Header title={`Are you who ${wish.creatorName} is looking for?`} sub={wish.text} onBack={() => go("view")} />
          <DCard>
            <View style={styles.pair}>
              <DField placeholder="Your name" value={name} onChangeText={setName} testID="its-me-name" />
              <DField placeholder="Your city" value={city} onChangeText={setCity} testID="its-me-city" />
            </View>
            <DField
              placeholder="One line about you — I've drummed in a band for 8 years…"
              value={intro}
              onChangeText={setIntro}
              multiline
              testID="its-me-intro"
            />
            <DField
              placeholder="One contact (phone, WeChat or Instagram)"
              value={contact}
              onChangeText={setContact}
              testID="its-me-contact"
            />
            <DError error={error} />
            <DButton
              testID="its-me-submit"
              title={`Send to ${wish.creatorName}`}
              size="lg"
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
          </DCard>
        </>
      ) : null}

      {open && mode === "me" ? (
        <>
          <Header
            title={action === "group" ? "Share to a group chat" : "Pass it on"}
            sub="First, who are you?"
            onBack={() => go("view")}
          />
          <DCard>
            <View style={styles.pair}>
              <DField placeholder="Your name" value={name} onChangeText={setName} testID="pass-name" />
              <DField placeholder="Where are you?" value={city} onChangeText={setCity} testID="pass-city" />
            </View>
            <DError error={fromTheWell ? error : null} />
          </DCard>
          <DButton
            testID="pass-me-next"
            title="Next"
            variant="thread"
            size="lg"
            busy={busy}
            disabled={!name.trim() || !city.trim()}
            onPress={() => {
              if (!fromTheWell) return go("vouch");
              void run(async () => {
                await act({ hopId: id, action, name, city, vouch: "", tags: [] });
                setMode("pass");
              });
            }}
          />
        </>
      ) : null}

      {open && mode === "vouch" ? (
        <>
          <Header title={`Vouch for ${data.senderName}`} sub="Three taps, then the AI drafts a line you can edit." onBack={() => go("me")} />
          <DCard testID="vouch-card">
            <Text style={styles.cardTitle}>Vouch for {data.senderName}, who sent you this</Text>
            <DChips label="How you met" options={HOW} value={how} onChange={setHow} testIDPrefix="vouch-how" />
            <DChips label="How long" options={HOW_LONG} value={howLong} onChange={setHowLong} testIDPrefix="vouch-long" />
            <DChips label="One word" options={WORDS} value={word} onChange={setWord} testIDPrefix="vouch-word" />
            <DButton
              testID="vouch-draft"
              title="✨ Draft my vouch"
              variant="ghost"
              size="sm"
              busy={busy && !vouch}
              disabled={!how || !howLong || !word}
              onPress={() =>
                run(async () => {
                  setVouch(await draftVouch({ hopId: id, name, how: how!, howLong: howLong!, word: word! }));
                })
              }
            />
            {vouch ? <DField value={vouch} onChangeText={setVouch} multiline testID="vouch-text" /> : null}
            <DError error={error} />
          </DCard>
          <DButton
            testID="vouch-submit"
            title="Vouch and continue"
            variant="ink"
            size="lg"
            busy={busy && !!vouch}
            disabled={!vouch.trim()}
            onPress={() =>
              run(async () => {
                await act({ hopId: id, action, name, city, vouch, tags: word ? [word] : [] });
                setMode("pass");
              })
            }
          />
        </>
      ) : null}

      {mode === "pass" ? (
        <>
          <Header title={action === "group" ? "Share to a group chat" : "Pass it on"} />
          <Progress done={data.children.length} of={limit} />

          <View style={styles.clue}>
            <Text style={styles.clueEyebrow}>{wish.creatorName}'s wish</Text>
            <Text style={styles.clueText}>{wish.text}</Text>
            <Text style={styles.clueJog}>· Who do you know who'd light up at this?</Text>
            <Text style={styles.clueJog}>· Or who knows everyone who might?</Text>
          </View>

          {data.children.map((c) => (
            <ShareLink key={c.hopId} hopId={c.hopId} name={c.name} message={messages[c.hopId] ?? c.passMessage} />
          ))}

          {canAddMore ? (
            <Glass>
              <Text style={styles.cardTitle}>
                {action === "group"
                  ? "Which group chat?"
                  : data.children.length === 0
                    ? "Who are you passing it to?"
                    : `Someone else? (${data.children.length}/3)`}
              </Text>
              <DField
                testID="pass-next-name"
                value={nextName}
                onChangeText={setNextName}
                placeholder={action === "group" ? "Climbing crew" : `Friend ${data.children.length + 1}`}
              />
              {serious ? (
                <DField
                  testID="pass-next-reason"
                  value={nextReason}
                  onChangeText={setNextReason}
                  placeholder="One line on why you picked them (required)"
                  maxLength={140}
                />
              ) : null}
              <DChips
                label="2–3 tags about them"
                options={TAGS}
                value={nextTags}
                onChange={(t) => setNextTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t].slice(-3)))}
                testIDPrefix="pass-tag"
              />
              <DError error={error} />
              <DButton
                testID="pass-create-link"
                title={nextName.trim() ? `Create ${nextName.trim()}'s link` : "Create their link"}
                variant="thread"
                busy={busy}
                disabled={(action !== "group" && !nextName.trim()) || (serious && !nextReason.trim())}
                onPress={() =>
                  run(async () => {
                    const childId = await passTo({
                      parentHopId: id,
                      name: nextName,
                      tags: nextTags,
                      ...(serious ? { reason: nextReason.trim() } : {}),
                    });
                    setNextName("");
                    setNextReason("");
                    setNextTags([]);
                    void draftMessage({ hopId: childId })
                      .then((m) => setMessages((prev) => ({ ...prev, [childId]: m })))
                      .catch(() => setMessages((prev) => ({ ...prev, [childId]: "" })));
                  })
                }
              />
            </Glass>
          ) : null}

          {data.children.length > 0 ? (
            <DButton testID="pass-done" title="I'm done" variant="ink" size="lg" onPress={() => go("done")} />
          ) : (
            <Text style={styles.hint}>Create a link for someone to start sending.</Text>
          )}
        </>
      ) : null}

      {mode === "done" ? (
        <View style={{ gap: 14, paddingTop: 8 }}>
          <Eyebrow>The ripple</Eyebrow>
          <View testID="pass-on-done" style={styles.prophecy}>
            <View style={styles.orb} />
            <Text style={styles.prophecyText}>🔮 You're ripple #{hop.depth} on this wish!</Text>
            <Text style={styles.prophecySub}>We'll show you how it ends.</Text>
          </View>
          <DCard>
            <Text style={styles.cardTitle}>Where should we send the ending?</Text>
            {contactSaved ? (
              <Text style={styles.saved}>✓ Got it. We'll send the ending to {contact}.</Text>
            ) : (
              <View style={styles.pair}>
                <DField value={contact} onChangeText={setContact} placeholder="Phone, WeChat or Instagram" testID="done-contact" />
                <DButton
                  testID="done-save-contact"
                  title="Tell me"
                  variant="ink"
                  busy={busy}
                  disabled={!contact.trim()}
                  onPress={() =>
                    run(async () => {
                      await saveContact({ hopId: id, contact });
                      setContactSaved(true);
                    })
                  }
                />
              </View>
            )}
            <DError error={error} />
          </DCard>
          <GetTheApp />
        </View>
      ) : null}

      <Text style={styles.footer}>{ordinal(hop.depth)} ripple · up to 6 ripples, 48 hours</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 24, backgroundColor: lv.bg },
  container: { paddingHorizontal: 20, paddingTop: 24, gap: 16, maxWidth: 430, width: "100%", alignSelf: "center", paddingBottom: 56 },
  pill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(254,253,251,0.72)",
    borderWidth: 1,
    borderColor: lv.border,
  },
  pillText: { fontSize: 12, fontWeight: "500", color: lv.fg },
  hero: { fontSize: 40, fontWeight: "700", lineHeight: 42, letterSpacing: -1, color: lv.fg, marginTop: 12 },
  h1: { fontSize: 30, fontWeight: "700", lineHeight: 33, letterSpacing: -0.6, color: lv.fg },
  back: { fontSize: 22, color: lv.mutedFg },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: lv.thread },
  mono: { fontFamily: lv.font.mono, fontSize: 12, color: lv.fg },
  who: { fontSize: 13, color: lv.mutedFg, flex: 1 },
  wishText: { fontSize: 22, fontWeight: "700", lineHeight: 27, color: lv.fg },
  rippleLine: { fontSize: 12, fontWeight: "500", color: lv.fg },
  poolWrap: { alignItems: "center", borderRadius: lv.radius, backgroundColor: "rgba(249,246,241,0.5)", paddingVertical: 6 },
  vouch: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  vouchBy: { fontSize: 12, color: lv.mutedFg },
  vouchText: { fontSize: 13.5, lineHeight: 18, color: lv.fg },
  closed: { borderRadius: 12, backgroundColor: lv.muted, padding: 12, marginTop: 6 },
  closedText: { fontSize: 14, color: lv.fg, lineHeight: 20 },
  grid: { flexDirection: "row", gap: 8 },
  pair: { flexDirection: "row", gap: 8, alignItems: "flex-end" },
  cardTitle: { fontSize: 14, fontWeight: "500", color: lv.fg },
  clue: { borderRadius: 24, backgroundColor: lv.fg, padding: 16, gap: 4 },
  clueEyebrow: { fontSize: 11, fontWeight: "600", letterSpacing: 1.5, textTransform: "uppercase", color: lv.bg, opacity: 0.6 },
  clueText: { fontSize: 18, fontWeight: "700", lineHeight: 24, color: lv.bg, marginBottom: 6 },
  clueJog: { fontSize: 13, color: lv.bg, opacity: 0.8 },
  hint: { fontSize: 12, color: lv.mutedFg, textAlign: "center" },
  prophecy: { overflow: "hidden", borderRadius: 28, backgroundColor: lv.fg, padding: 24, gap: 8, ...lv.shadow },
  orb: { position: "absolute", right: -48, top: -48, width: 160, height: 160, borderRadius: 80, backgroundColor: lv.gold, opacity: 0.35 },
  prophecyText: { fontSize: 24, fontWeight: "700", lineHeight: 28, letterSpacing: -0.4, color: lv.bg },
  prophecySub: { fontSize: 15, color: lv.bg, opacity: 0.75 },
  saved: { fontSize: 14, color: lv.thread },
  footer: { fontSize: 12, color: lv.mutedFg, textAlign: "center" },
});
