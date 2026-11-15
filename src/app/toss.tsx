import { useAction, useMutation } from "convex/react";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Pool } from "@/components/Pool";
import { ShareLink } from "@/components/ShareLink";
import { errorMessage } from "@/components/ui";
import { CoachPanel, type CoachPick } from "@/components/lv/toss/CoachPanel";
import { Eyebrow, LvButton, LvCard, LvField } from "@/components/lv/toss/parts";
import { RecipientCard, emptyPerson, type Person } from "@/components/lv/toss/RecipientCard";
import { TypeGrid } from "@/components/lv/toss/TypeGrid";
import { useMe } from "@/lib/device";
import { LV_WISH_TYPES, fromApiType, type ApiWishType } from "@/lib/lvWishTypes";
import { lv } from "@/theme/tokens";
import { formScrollProps } from "@/components/keyboard";
import { toE164 } from "@/lib/contactPick";

const MAX_PEOPLE = 3;
// The contact field holds a phone (picked or typed) or an @handle; only a phone pre-fills SMS.
const smsRecipient = (contact?: string) => (contact && !contact.trim().startsWith("@") ? (toE164(contact) ?? undefined) : undefined);
// Server error text (convex/lib.ts REASON_REQUIRED); shown inline under the card missing a reason.
const REASON_REQUIRED = "Add one line on why you picked them";

/** Toss a coin: write one line (AI polish), pick 1–3 starting friends, then splash + prophecy. */
export default function Toss() {
  const router = useRouter();
  const { deviceId, user } = useMe();
  const toss = useMutation(api.wishes.toss);
  const polish = useAction(api.ai.polishWish);
  const draftMessage = useAction(api.ai.draftPassMessage);

  const [step, setStep] = useState<"write" | "people" | "share">("write");
  const [type, setType] = useState<ApiWishType>("do_together");
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [people, setPeople] = useState<Person[]>([emptyPerson()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reasonMissing, setReasonMissing] = useState(false);
  const [links, setLinks] = useState<{ hopId: Id<"hops">; name: string; message: string | null; phone?: string }[]>([]);

  const needsProfile = !user?.name;
  const typeInfo = LV_WISH_TYPES.find((t) => t.id === fromApiType[type])!;
  const picked = people.filter((p) => p.name.trim());
  const firstTags = picked.map((p) => p.tags[0]);
  const sameCircle = picked.length >= 2 && firstTags.every((t) => t) && new Set(firstTags as string[]).size === 1;

  async function onPolish() {
    if (!deviceId || !text.trim()) return;
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

  function onCoachPick(p: CoachPick) {
    setPeople((prev) => {
      const filled = prev.filter((x) => x.name.trim());
      if (filled.some((x) => x.name.trim().toLowerCase() === p.name.toLowerCase())) return prev;
      const next = { ...emptyPerson(), name: p.name, reason: p.why };
      const blank = prev.findIndex((x) => !x.name.trim());
      if (blank >= 0) return prev.map((x, i) => (i === blank ? { ...x, name: p.name, reason: x.reason || p.why } : x));
      return [...prev, next].slice(0, MAX_PEOPLE);
    });
  }

  async function onToss() {
    if (!deviceId) return;
    setBusy(true);
    setError(null);
    setReasonMissing(false);
    try {
      const recipients = picked.map((p) => ({
        name: p.name,
        reason: p.reason.trim() || undefined,
        contact: p.contact.trim() || undefined,
        tags: p.tags,
      }));
      const { hopIds } = await toss({ deviceId, type, text, name, city, mode: "serious", recipients });
      const created = hopIds.map((hopId, i) => ({
        hopId,
        name: recipients[i].name,
        message: null as string | null,
        phone: picked[i].phone ?? smsRecipient(picked[i].contact),
      }));
      setLinks(created);
      setStep("share");
      created.forEach(({ hopId }) => {
        void draftMessage({ hopId })
          .then((message) => setLinks((prev) => prev.map((l) => (l.hopId === hopId ? { ...l, message } : l))))
          .catch(() => setLinks((prev) => prev.map((l) => (l.hopId === hopId ? { ...l, message: "" } : l))));
      });
    } catch (e) {
      const msg = errorMessage(e);
      if (msg.includes(REASON_REQUIRED)) setReasonMissing(true);
      else setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      testID="toss-screen"
      style={{ backgroundColor: lv.bg }}
      contentContainerStyle={styles.container}
      {...formScrollProps}
    >
      {step === "write" ? (
        <>
          <View style={styles.header}>
            <Eyebrow>
              {user
                ? `${user.wishesLeft} coin${user.wishesLeft === 1 ? "" : "s"} · refunded if it fades`
                : "Toss a coin"}
            </Eyebrow>
            <Text style={styles.h1}>Toss a coin: who do you want to meet?</Text>
          </View>
          <TypeGrid value={type} onChange={setType} />
          <LvCard>
            <Text style={styles.small}>A type of person + what to do + why. Never a specific named person.</Text>
            <LvField
              testID="toss-text"
              multiline
              value={text}
              onChangeText={setText}
              placeholder={`${typeInfo.example[0].toUpperCase()}${typeInfo.example.slice(1)}…`}
            />
            <LvButton
              testID="toss-polish"
              variant="ghost"
              title={busy ? "Polishing…" : "✦ Polish with AI"}
              busy={busy}
              disabled={!text.trim()}
              onPress={onPolish}
            />
          </LvCard>
          {needsProfile ? (
            <LvCard>
              <Eyebrow>About you</Eyebrow>
              <LvField value={name} onChangeText={setName} testID="toss-name" placeholder="Your name" />
              <LvField value={city} onChangeText={setCity} testID="toss-city" placeholder="Your city" />
            </LvCard>
          ) : null}
          {error ? <Text style={styles.err}>{error}</Text> : null}
          <LvButton
            testID="toss-next"
            variant="thread"
            title="Next: where does it start?"
            disabled={!text.trim() || (needsProfile && !name.trim())}
            onPress={() => setStep("people")}
          />
        </>
      ) : null}

      {step === "people" ? (
        <>
          <View style={styles.header}>
            <Eyebrow>{`${typeInfo.emoji} ${typeInfo.label}`}</Eyebrow>
            <Text style={styles.h1}>Pick 1–3 friends to start from</Text>
          </View>
          <LvCard>
            <Eyebrow>Your coin</Eyebrow>
            <Text style={styles.wish}>{text}</Text>
          </LvCard>
          <CoachPanel deviceId={deviceId} wishText={text} onPick={onCoachPick} pickedNames={people.map((p) => p.name)} />
          <Text style={styles.small}>Pick up to {MAX_PEOPLE} people most likely to know someone — say why in one line.</Text>
          {people.map((p, i) => (
            <RecipientCard
              key={i}
              index={i}
              person={p}
              reasonError={reasonMissing && p.name.trim() && !p.reason.trim() ? REASON_REQUIRED : null}
              onChange={(np) => setPeople((prev) => prev.map((x, j) => (j === i ? np : x)))}
              onRemove={people.length > 1 ? () => setPeople((prev) => prev.filter((_, j) => j !== i)) : undefined}
            />
          ))}
          {sameCircle ? (
            <View testID="toss-diversity" style={styles.diversity}>
              <Text style={styles.diversityText}>Try a friend from a different circle — boats drift farther.</Text>
            </View>
          ) : null}
          {people.length < MAX_PEOPLE ? (
            <LvButton
              testID="toss-add-person"
              variant="ghost"
              title="+ Add someone"
              onPress={() => setPeople((prev) => [...prev, emptyPerson()])}
            />
          ) : null}
          {error ? <Text style={styles.err}>{error}</Text> : null}
          <LvButton
            testID="toss-submit"
            variant="thread"
            title="Toss it in"
            busy={busy}
            disabled={!people.some((p) => p.name.trim())}
            onPress={onToss}
          />
          <LvButton variant="ghost" title="Back" onPress={() => setStep("write")} />
        </>
      ) : null}

      {step === "share" ? (
        <>
          <View style={styles.header}>
            <Eyebrow color={lv.thread}>Your coin is live</Eyebrow>
            <Text style={styles.h1}>Plop! Your coin is in the pool.</Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <Pool size={180} />
          </View>
          <View style={styles.prophecy}>
            <View style={styles.orb} />
            <Text style={styles.prophecyText}>It might ripple toward {typeInfo.label}.</Text>
            <Text style={styles.prophecySub}>Send each person their own link. Every link carries the trust chain forward.</Text>
          </View>
          {links.map((l) => (
            <ShareLink key={l.hopId} hopId={l.hopId} name={l.name} message={l.message} to={l.phone} />
          ))}
          <LvButton title="Back to the pool" testID="toss-done" variant="ink" onPress={() => router.replace("/")} />
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16, maxWidth: 430, width: "100%", alignSelf: "center", paddingBottom: 64 },
  header: { paddingTop: 24, paddingHorizontal: 4, gap: 4 },
  h1: { fontSize: 32, fontWeight: "700", lineHeight: 38, color: lv.fg, letterSpacing: -0.5 },
  small: { fontSize: 13, lineHeight: 18, color: lv.mutedFg, paddingHorizontal: 4 },
  wish: { fontSize: 20, fontWeight: "600", lineHeight: 26, color: lv.fg },
  err: { fontSize: 14, color: lv.destructive, paddingHorizontal: 4 },
  diversity: { borderRadius: lv.radiusSm, backgroundColor: lv.card, borderWidth: 1, borderColor: lv.gold, padding: 14 },
  diversityText: { fontSize: 14, fontWeight: "600", color: lv.fg, lineHeight: 19 },
  prophecy: { overflow: "hidden", borderRadius: 28, backgroundColor: lv.fg, padding: 24, gap: 8, ...lv.shadow },
  orb: { position: "absolute", right: -48, top: -48, width: 160, height: 160, borderRadius: 80, backgroundColor: lv.gold, opacity: 0.35 },
  prophecyText: { fontSize: 24, fontWeight: "700", lineHeight: 28, letterSpacing: -0.4, color: lv.bg },
  prophecySub: { fontSize: 15, color: lv.bg, opacity: 0.75 },
});