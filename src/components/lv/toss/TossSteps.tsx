// The night-styled recipient + share steps, shared by the pool's toss sheet and the /toss screen.
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ShareLink } from "@/components/ShareLink";
import { TextAll } from "@/components/TextAll";
import { DButton } from "@/components/lv/passon/kit";
import { night, type } from "@/theme/tokens";

import { CoachPanel } from "./CoachPanel";
import { RecipientCard } from "./RecipientCard";
import { MAX_PEOPLE, REASON_REQUIRED, type useTossWish } from "./useTossWish";

type Toss = ReturnType<typeof useTossWish>;

export function NightTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <View style={s.header}>
      <Text accessibilityRole="header" style={s.title}>
        {children}
      </Text>
      {sub ? <Text style={s.sub}>{sub}</Text> : null}
    </View>
  );
}

/** "Who should it reach first?": coach picks prefilled into 1–3 recipient cards, then "Send the boat". */
export function TossPeopleStep({
  t,
  deviceId,
  wishText,
  onSend,
  extra,
}: {
  t: Toss;
  deviceId: string | null | undefined;
  wishText: string;
  onSend: () => void;
  extra?: ReactNode;
}) {
  return (
    <>
      <NightTitle sub="Pick up to three people most likely to know someone. Say why in one line.">Who should it reach first?</NightTitle>
      <View style={s.coin}>
        <Text style={s.coinText} numberOfLines={3}>
          “{wishText}”
        </Text>
      </View>
      <CoachPanel deviceId={deviceId ?? null} wishText={wishText} onPick={t.onCoachPick} onSuggestions={t.onCoachSuggestions} pickedNames={t.people.map((p) => p.name)} />
      {t.people.map((p, i) => (
        <RecipientCard
          key={i}
          index={i}
          person={p}
          reasonError={t.reasonMissing && p.name.trim() && !p.reason.trim() ? REASON_REQUIRED : null}
          onChange={(np) => t.updatePerson(i, np)}
          onRemove={t.people.length > 1 ? () => t.removePerson(i) : undefined}
        />
      ))}
      {t.sameCircle ? (
        <View testID="toss-diversity" style={s.note}>
          <Text style={s.noteText}>Try a friend from a different circle. Boats drift farther.</Text>
        </View>
      ) : null}
      {t.people.length < MAX_PEOPLE ? (
        <DButton testID="toss-add-person" variant="ghost" tone="night" title="+ Add someone" onPress={t.addPerson} />
      ) : null}
      {extra}
      {t.error ? <Text style={s.err}>{t.error}</Text> : null}
      <DButton testID="toss-submit" variant="gold" size="lg" title="Send the boat" busy={t.busy} disabled={!t.picked.length} onPress={onSend} />
    </>
  );
}

/** After `wishes.toss`: one "Text all N" flow plus each person's own link. */
export function TossShareStep({ t, onDone }: { t: Toss; onDone: () => void }) {
  return (
    <>
      <NightTitle sub="Send each person their own link. Every link carries the trust chain forward.">The boat is on its way</NightTitle>
      <TextAll targets={t.textAllTargets} />
      {t.links.map((l) => (
        <ShareLink key={l.hopId} hopId={l.hopId} name={l.name} message={l.message} to={l.phone} onTextChange={(x) => t.setEdit(l.hopId, x)} />
      ))}
      <DButton testID="toss-done" variant="ghost" tone="night" size="lg" title="Back to the pool" onPress={onDone} />
    </>
  );
}

const s = StyleSheet.create({
  header: { gap: 6, paddingTop: 4 },
  title: { fontFamily: night.serif, fontSize: 30, lineHeight: 36, color: night.fg },
  sub: { ...type.subheadline, color: night.mutedFg },
  coin: {
    borderRadius: 18,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(233,199,102,0.45)",
    backgroundColor: "rgba(233,199,102,0.08)",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  coinText: { fontFamily: night.serif, fontSize: 19, lineHeight: 26, color: night.goldBright },
  note: { padding: 14, borderRadius: 16, borderWidth: 1, borderColor: night.gold },
  noteText: { ...type.subheadline, fontWeight: "600", color: night.fg },
  err: { ...type.footnote, color: "#FF8A80" },
});
