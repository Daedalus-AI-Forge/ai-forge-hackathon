// "Someone says it's them" card on the Voyages tab. On "Yes, it's you" the wisher confirms,
// gets an AI-drafted intro (editable), and opens their OWN Messages app prefilled to the
// claimer's verified phone. We never send anything: the wisher reviews it and taps Send.
import { useAction, useMutation } from "convex/react";
import { useState } from "react";
import { Linking, Platform, StyleSheet, Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cleanError } from "@/components/link/claim/errors";
import { withTimeout } from "@/components/link/push/shareCopy";
import { DButton, DCard, DError, DField, Eyebrow, Sub } from "@/components/lv/passon/kit";
import { lv, type } from "@/theme/tokens";

export type PendingClaim = {
  hopId: Id<"hops">;
  wishId: Id<"wishes">;
  wishText: string;
  claimerName: string;
  intro: string;
  answers: string[];
  claimedAt: number;
};

const AI_TIMEOUT_MS = 3500;

/** iOS with a recipient wants `sms:+1555…&body=`, Android `sms:+1555…?body=`. */
export function smsUrl(phone: string, body: string, os: string = Platform.OS) {
  const isAndroid = os === "android" || (os === "web" && typeof navigator !== "undefined" && /android/i.test(navigator.userAgent ?? ""));
  return `sms:${phone}${isAndroid ? "?" : "&"}body=${encodeURIComponent(body)}`;
}

function fallbackIntro(claimer: string, wish: string) {
  return `Hi ${claimer}, it's me from Wishwell — you're the one for my wish "${wish}". Want to meet up or hop on a call?`;
}

type Stage =
  | { kind: "ask" }
  | { kind: "draft"; claimerName: string; phone: string }
  | { kind: "sent"; claimerName: string; phone: string };

export function ClaimCard({
  claim,
  deviceId,
  onDismiss,
  onConfirmed,
}: {
  claim: PendingClaim;
  deviceId: string;
  onDismiss: () => void;
  /** Lets the parent keep this card mounted after the claim leaves pendingClaims. */
  onConfirmed: () => void;
}) {
  const confirmClaim = useMutation(api.link.confirmClaim);
  const introMessage = useAction(api.linkAi.introMessage);
  const [stage, setStage] = useState<Stage>({ kind: "ask" });
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onConfirm() {
    setBusy(true);
    setError(null);
    try {
      const { claimerName, claimerPhone } = await confirmClaim({ hopId: claim.hopId, deviceId });
      onConfirmed();
      const text = await withTimeout(introMessage({ hopId: claim.hopId }), AI_TIMEOUT_MS).catch(() => null);
      setDraft(text || fallbackIntro(claimerName, claim.wishText));
      setStage({ kind: "draft", claimerName, phone: claimerPhone });
    } catch (e) {
      setError(cleanError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onText() {
    if (stage.kind !== "draft" || !draft.trim()) return;
    setError(null);
    try {
      await Linking.openURL(smsUrl(stage.phone, draft.trim()));
      setStage({ kind: "sent", claimerName: stage.claimerName, phone: stage.phone });
    } catch {
      setError("Couldn't open Messages on this device.");
    }
  }

  if (stage.kind === "sent") {
    return (
      <DCard testID={`claim-sent-${claim.hopId}`}>
        <Eyebrow>Found</Eyebrow>
        <Text style={s.title}>Sent from your phone — {stage.claimerName} now has your number.</Text>
        <Sub>Didn’t tap Send? Open Messages again below.</Sub>
        <DButton
          title={`Text ${stage.claimerName} again`}
          variant="ghost"
          onPress={() => setStage({ kind: "draft", claimerName: stage.claimerName, phone: stage.phone })}
          testID="claim-reopen"
        />
      </DCard>
    );
  }

  return (
    <DCard testID={`claim-card-${claim.hopId}`}>
      <Eyebrow>Someone says it’s them</Eyebrow>
      <Text style={s.title}>{claim.claimerName} says they’re the one</Text>
      <Text style={s.wish} numberOfLines={2}>
        For “{claim.wishText}”
      </Text>
      {claim.intro ? <Text style={s.quote}>“{claim.intro}”</Text> : null}
      {claim.answers.map((a, i) => (
        <Text key={i} style={s.answer}>
          · {a}
        </Text>
      ))}

      {stage.kind === "ask" ? (
        <View style={s.actions}>
          <DButton title="Yes, it's you" onPress={onConfirm} busy={busy} testID="claim-confirm" />
          <DButton title="Not quite" variant="ghost" onPress={onDismiss} disabled={busy} testID="claim-dismiss" />
        </View>
      ) : (
        <View style={s.actions}>
          <Sub>Here’s a first text. Edit it, then send it yourself from Messages.</Sub>
          <DField value={draft} onChangeText={setDraft} multiline testID="claim-intro-draft" />
          <DButton
            title={`Text ${stage.claimerName} from my phone`}
            onPress={onText}
            disabled={!draft.trim()}
            testID="claim-text-from-phone"
          />
          <Sub>Opens your Messages app with this text ready. Nothing is sent until you tap Send.</Sub>
        </View>
      )}
      <DError error={error} />
    </DCard>
  );
}

const s = StyleSheet.create({
  title: { ...type.headline, color: lv.fg },
  wish: { ...type.footnote, color: lv.mutedFg },
  quote: { ...type.subheadline, color: lv.fg, fontStyle: "italic" },
  answer: { ...type.subheadline, color: lv.fg },
  actions: { gap: 10, marginTop: 4 },
});
