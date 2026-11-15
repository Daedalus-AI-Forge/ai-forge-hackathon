import { useAction, useMutation, useQuery } from "convex/react";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ContactPickButton } from "@/components/ContactPickButton";
import { ShareLink } from "@/components/ShareLink";
import { WellHint } from "@/components/WellHint";
import { errorMessage } from "@/components/ui";
import { DAvatar, DButton, DCard, DChips, DError, DField, Eyebrow, Glass, Sub } from "@/components/lv/passon/kit";
import { useDeviceId, useMe } from "@/lib/device";
import { countdown, useNow } from "@/lib/time";
import { lv } from "@/theme/tokens";
import { formScrollProps } from "@/components/keyboard";

const HOW = ["friend", "coworker", "family", "roommate", "classmate", "neighbor"] as const;
const HOW_LONG = ["under a year", "1–5 years", "5–10 years", "10+ years"] as const;
const WORDS = ["reliable", "fun", "kind", "adventurous"] as const;
const TAGS = ["music", "travel", "food", "sports", "tech", "outdoors", "art", "knows everyone"] as const;

type Mode = "view" | "its_me" | "me" | "vouch" | "pass" | "done";

function Header({ eyebrow, title, sub, onBack }: { eyebrow?: string; title: string; sub?: string; onBack?: () => void }) {
  return (
    <View style={{ paddingTop: 4, gap: 8 }}>
      {onBack ? (
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} testID="pass-back">
          <Text style={styles.back}>←</Text>
        </Pressable>
      ) : null}
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <Text style={styles.h1}>{title}</Text>
      {sub ? <Sub>{sub}</Sub> : null}
    </View>
  );
}

/** The boat screen: one paper boat that drifted to you, and the two ways to act on it. */
export default function PassOn() {
  const { hopId, start } = useLocalSearchParams<{ hopId: string; start?: string }>();
  const data = useQuery(api.hops.page, { hopId });
  const deviceId = useDeviceId();
  const { user } = useMe();
  const claim = useMutation(api.hops.claim);
  const ensure = useMutation(api.users.ensure);
  const act = useMutation(api.hops.act);
  const passTo = useMutation(api.hops.passTo);
  const itsMe = useMutation(api.hops.itsMe);
  const saveContact = useMutation(api.hops.saveContact);
  const draftVouch = useAction(api.ai.draftVouch);
  const draftMessage = useAction(api.ai.draftPassMessage);
  const now = useNow();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<Mode>("view");
  const [action, setAction] = useState<"pass" | "group">("pass");
  const [actedAs, setActedAs] = useState<"push" | "its_me" | null>(null);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [how, setHow] = useState<string | null>(null);
  const [howLong, setHowLong] = useState<string | null>(null);
  const [word, setWord] = useState<string | null>(null);
  const [vouch, setVouch] = useState("");
  const [intro, setIntro] = useState("");
  const [contact, setContact] = useState("");
  const [contactSaved, setContactSaved] = useState(false);
  const [showNameAndCity, setShowNameAndCity] = useState(true);
  const [nextName, setNextName] = useState("");
  // Picked from Contacts, kept on this device only: pre-fills the SMS recipient for that boat.
  const [nextPhone, setNextPhone] = useState<string | null>(null);
  const [phones, setPhones] = useState<Record<string, string>>({});
  const [nextReason, setNextReason] = useState("");
  const [nextTags, setNextTags] = useState<string[]>([]);
  const [lastTags, setLastTags] = useState<string[]>([]);
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
      setActedAs("its_me");
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
  const progress = user?.boatProgress ?? 0;
  const firstTag = lastTags[0] ?? "someone unexpected";
  const doneKind = actedAs ?? (hop.action === "its_me" ? "its_me" : null);

  return (
    <ScrollView
      testID="pass-on-screen"
      style={{ backgroundColor: lv.bg }}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}
      {...formScrollProps}
    >
      <Stack.Screen options={{ title: "A paper boat for you" }} />

      {mode === "view" || (!open && mode !== "done") ? (
        <>
          <Text style={styles.hero}>
            A paper boat{"\n"}drifted to you.
          </Text>
          <Sub>
            {data.chain.length > 0
              ? `${data.senderName} pushed it to you.`
              : fromTheWell
                ? "Today's boat, straight from the well."
                : `${data.senderName} sent this straight to you.`}
          </Sub>

          <Glass testID="pass-on-wish">
            <Text style={styles.wishText}>{wish.text}</Text>
            <View style={styles.sourceRow}>
              <View style={[styles.sourcePill, wish.daily ? styles.sourceGold : styles.sourceThread]}>
                <Text style={[styles.sourceText, !wish.daily && { color: lv.threadFg }]}>
                  {wish.daily ? "Today's boat" : `${wish.creatorName}'s real wish`}
                </Text>
              </View>
              <View style={styles.row}>
                <View style={[styles.dot, !open && { backgroundColor: lv.mutedFg }]} />
                <Text testID="pass-on-countdown" style={styles.mono}>
                  {open ? countdown(wish.expiresAt, now) : "00:00:00"}
                </Text>
              </View>
            </View>

            {data.chain.length > 0 ? (
              <View style={styles.chainWrap}>
                <Eyebrow>How it got here</Eyebrow>
                <View testID="pass-on-chain">
                  {data.chain.map((c, i) => {
                    const next = data.chain[i + 1]?.name ?? "you";
                    const last = i === data.chain.length - 1;
                    return (
                      <View key={c.depth} style={styles.chainRow}>
                        <View style={styles.avatarCol}>
                          <DAvatar name={c.name} color={c.avatar} size={28} />
                          {last ? null : <View style={styles.avatarStem} />}
                        </View>
                        <View style={styles.chainText}>
                          <Text style={styles.vouchBy}>
                            <Text style={styles.vouchName}>{c.name}</Text>
                            {c.city ? ` · ${c.city}` : ""} → {next}
                          </Text>
                          {c.vouch ? <Text style={styles.vouchText}>“{c.vouch}”</Text> : null}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {!open ? (
              <View style={styles.closed} testID="pass-on-closed">
                <Text style={styles.closedText}>
                  {wish.status === "faded" ? "This boat faded before it found anyone." : "This boat landed"}
                </Text>
              </View>
            ) : (
              <View style={{ gap: 8, marginTop: 6 }}>
                <View style={styles.grid}>
                  <DButton testID="pass-its-me" title="That's me" variant="ink" style={{ flex: 1 }} onPress={() => go("its_me")} />
                  <DButton
                    testID="pass-know-someone"
                    title="Push to someone"
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
                  title="👥  Push to a group chat"
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
        </>
      ) : null}

      {open && mode === "its_me" ? (
        <>
          <Header
            eyebrow="That's me"
            title={wish.daily ? "You're the one?" : `Are you who ${wish.creatorName} is looking for?`}
            sub={wish.text}
            onBack={() => go("view")}
          />
          <DCard>
            {wish.daily ? (
              <>
                <DField
                  placeholder="Tell us the proof in one line — e.g. 12 of my own oil paintings hang at home"
                  value={intro}
                  onChangeText={setIntro}
                  multiline
                  testID="its-me-intro"
                />
                <View style={styles.pair}>
                  <DField placeholder="Your name" value={name} onChangeText={setName} testID="its-me-name" containerStyle={{ flex: 1 }} />
                  <DField placeholder="Your city" value={city} onChangeText={setCity} testID="its-me-city" containerStyle={{ flex: 1 }} />
                </View>
                <View style={styles.toggleRow}>
                  <Switch
                    testID="its-me-show"
                    value={showNameAndCity}
                    onValueChange={setShowNameAndCity}
                    trackColor={{ true: lv.thread, false: lv.mutedFg }}
                  />
                  <Text style={styles.toggleLabel}>Show my name and city in their voyage log</Text>
                </View>
                <DError error={error} />
                <DButton
                  testID="its-me-submit"
                  title="Land this boat"
                  size="lg"
                  busy={busy}
                  disabled={!intro.trim() || !name.trim() || !city.trim()}
                  onPress={() =>
                    run(async () => {
                      await itsMe({ hopId: id, name, city, intro, contact: "", showNameAndCity });
                      setContactSaved(!!contact.trim());
                      setActedAs("its_me");
                      setMode("done");
                    })
                  }
                />
              </>
            ) : (
              <>
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
                <View style={styles.pair}>
                  <DField placeholder="Your name" value={name} onChangeText={setName} testID="its-me-name" containerStyle={{ flex: 1 }} />
                  <DField placeholder="Your city" value={city} onChangeText={setCity} testID="its-me-city" containerStyle={{ flex: 1 }} />
                </View>
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
                      setActedAs("its_me");
                      setMode("done");
                    })
                  }
                />
              </>
            )}
          </DCard>
        </>
      ) : null}

      {open && mode === "me" ? (
        <>
          <Header eyebrow="Step 1 of 3" title="Who are you?" onBack={() => go("view")} />
          <DCard>
            <View style={styles.pair}>
              <DField placeholder="Your name" value={name} onChangeText={setName} testID="pass-name" containerStyle={{ flex: 1 }} />
              <DField placeholder="Where are you?" value={city} onChangeText={setCity} testID="pass-city" containerStyle={{ flex: 1 }} />
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
          <Header
            eyebrow="Step 2 of 3"
            title={`Vouch for ${data.senderName}`}
            sub="Three taps, then the AI drafts a line you can edit."
            onBack={() => go("me")}
          />
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
        <View style={{ gap: 16 }}>
          <Header eyebrow="Step 3 of 3" title={action === "group" ? "Share to a group chat" : "Push it to someone"} />

          <View style={styles.clue}>
            <Text style={styles.clueEyebrow}>{wish.daily ? "Today's boat" : `${wish.creatorName}'s real wish`}</Text>
            <Text style={styles.clueText}>{wish.text}</Text>
            <Text style={styles.clueJog}>· Who do you know who'd light up at this?</Text>
            <Text style={styles.clueJog}>· Or who knows everyone who might?</Text>
          </View>

          {data.children.map((c) => (
            <ShareLink key={c.hopId} hopId={c.hopId} name={c.name} message={messages[c.hopId] ?? c.passMessage} label={`Send ${c.name} their boat`} to={phones[c.hopId]} />
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
              {action !== "group" ? (
                <ContactPickButton
                  testID="contact-pick-pass"
                  onPick={({ name: picked, phone }) => {
                    if (picked) setNextName(picked);
                    setNextPhone(phone);
                  }}
                />
              ) : null}
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
                title={nextName.trim() ? `Create ${nextName.trim()}'s boat link` : "Create their boat link"}
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
                    setLastTags(nextTags);
                    if (nextPhone) setPhones((prev) => ({ ...prev, [childId]: nextPhone }));
                    setNextPhone(null);
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
            <DButton
              testID="pass-done"
              title="I'm done"
              variant="ink"
              size="lg"
              onPress={() => {
                setActedAs("push");
                go("done");
              }}
            />
          ) : (
            <Text style={styles.hint}>Create a link for someone to start sending.</Text>
          )}
        </View>
      ) : null}

      {mode === "done" ? (
        doneKind === "its_me" ? (
          <View style={{ gap: 14, paddingTop: 8 }}>
            <Eyebrow>{wish.daily ? "That's me" : "Sent"}</Eyebrow>
            <DCard testID="pass-on-done">
              <Text style={styles.cardTitle}>
                {wish.daily ? "⛵︎ Landed." : `Waiting for ${wish.creatorName} to confirm.`}
              </Text>
              <Sub>
                {wish.daily
                  ? "Whoever pushed it will see you in tomorrow's voyage log."
                  : "If it's you, you'll swap contacts and we'll remind you to share a photo together."}
              </Sub>
            </DCard>
          </View>
        ) : (
          <View style={{ gap: 14, paddingTop: 8 }}>
            <Eyebrow>Done for today</Eyebrow>
            <View testID="pass-on-done" style={styles.prophecy}>
              <View style={styles.orb} />
              <Text style={styles.prophecyText}>🔮 It might drift toward {firstTag}.</Text>
              <Text style={styles.prophecySub}>Tomorrow morning your voyage log shows where it went.</Text>
            </View>
            {user ? (
              <DCard>
                <View style={styles.progressRow} testID="pass-progress">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <View key={i} style={[styles.progDot, i < progress && styles.progDotOn]} />
                  ))}
                  <Text style={styles.mono}>{progress}/5 boats toward your next coin</Text>
                </View>
              </DCard>
            ) : null}
            {!user ? (
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
            ) : null}
          </View>
        )
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 24, backgroundColor: lv.bg },
  container: { paddingHorizontal: 20, paddingTop: 24, gap: 16, maxWidth: 430, width: "100%", alignSelf: "center", paddingBottom: 56 },
  hero: { fontSize: 34, fontWeight: "700", lineHeight: 40, letterSpacing: -0.5, color: lv.fg, marginTop: 12 },
  h1: { fontSize: 30, fontWeight: "700", lineHeight: 33, letterSpacing: -0.5, color: lv.fg },
  back: { fontSize: 22, color: lv.mutedFg },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: lv.thread },
  mono: { fontFamily: lv.font.mono, fontSize: 12, color: lv.fg },
  wishText: { fontSize: 22, fontWeight: "700", lineHeight: 27, color: lv.fg },
  sourceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sourcePill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, alignSelf: "flex-start" },
  sourceGold: { backgroundColor: lv.gold },
  sourceThread: { backgroundColor: lv.thread },
  sourceText: { fontSize: 12, fontWeight: "600", color: lv.fg },
  chainWrap: { gap: 10 },
  chainRow: { flexDirection: "row", alignItems: "stretch", marginBottom: 10 },
  avatarCol: { width: 28, alignItems: "center" },
  avatarStem: { width: 1, flex: 1, backgroundColor: lv.thread, marginTop: 3 },
  chainText: { flex: 1, gap: 2, paddingTop: 4 },
  vouchBy: { fontSize: 12, color: lv.mutedFg },
  vouchName: { color: lv.fg, fontWeight: "600" },
  vouchText: { fontSize: 13.5, lineHeight: 18, color: lv.fg },
  closed: { borderRadius: 12, backgroundColor: lv.muted, padding: 12 },
  closedText: { fontSize: 14, color: lv.fg, lineHeight: 20 },
  grid: { flexDirection: "row", gap: 8 },
  pair: { flexDirection: "row", gap: 8, alignItems: "flex-end" },
  cardTitle: { fontSize: 14, fontWeight: "500", color: lv.fg },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  toggleLabel: { flex: 1, fontSize: 14, color: lv.fg, lineHeight: 19 },
  clue: { borderRadius: 24, backgroundColor: lv.fg, padding: 16, gap: 4 },
  clueEyebrow: { fontSize: 11, fontWeight: "600", letterSpacing: 1.5, textTransform: "uppercase", color: lv.bg, opacity: 0.6 },
  clueText: { fontSize: 18, fontWeight: "700", lineHeight: 24, color: lv.bg, marginBottom: 6 },
  clueJog: { fontSize: 13, color: lv.bg, opacity: 0.8 },
  hint: { fontSize: 12, color: lv.mutedFg, textAlign: "center" },
  prophecy: { overflow: "hidden", borderRadius: 28, backgroundColor: lv.fg, padding: 24, gap: 8, ...lv.shadow },
  orb: { position: "absolute", right: -48, top: -48, width: 160, height: 160, borderRadius: 80, backgroundColor: lv.gold, opacity: 0.35 },
  prophecyText: { fontSize: 24, fontWeight: "700", lineHeight: 28, letterSpacing: -0.4, color: lv.bg },
  prophecySub: { fontSize: 15, color: lv.bg, opacity: 0.75 },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  progDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "rgba(28,25,21,0.12)" },
  progDotOn: { backgroundColor: lv.thread },
  saved: { fontSize: 14, color: lv.thread },
});