// Screen 3b: push the boat to exactly one person. Memory hint → name, relation, reason →
// AI vouch (editable) → link.pushOne → AI-drafted share message (editable) → share sheet.
import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Platform, Share, StyleSheet, Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { DButton, DCard, DChips, DError, DField, Eyebrow, Sub } from "@/components/lv/passon/kit";
import { copyLink } from "@/lib/links";
import type { FirstScreen } from "@/lib/linkApi.types";
import { lv } from "@/theme/tokens";

import { cleanError } from "./claim/errors";
import { fallbackShareMessage, ogShareUrl, withTimeout } from "./push/shareCopy";

export type PushStepProps = { hopId: string; deviceId: string; onDone: (childHopId: string) => void };

const RELATIONS = ["friend", "coworker", "classmate", "family", "neighbor"] as const;
const AI_TIMEOUT_MS = 3000;

export function PushStep({ hopId, deviceId, onDone }: PushStepProps) {
  const hop = hopId as Id<"hops">;
  const screen = useQuery(api.link.firstScreen, { hopId, deviceId }) as FirstScreen | null | undefined;
  const memoryPrompt = useAction(api.linkAi.memoryPrompt);
  const vouchFor = useAction(api.linkAi.vouchFor);
  const draftPassMessage = useAction(api.ai.draftPassMessage);
  const pushOne = useMutation(api.link.pushOne);
  const track = useMutation(api.linkMetrics.track);

  const [hint, setHint] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [relation, setRelation] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [vouch, setVouch] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [childHopId, setChildHopId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    withTimeout(memoryPrompt({ hopId: hop }), AI_TIMEOUT_MS)
      .then((h) => live && setHint(h))
      .catch(() => live && setHint("Who do you know who might fit?"));
    return () => {
      live = false;
    };
  }, [hopId]);

  const wishText = screen?.boat.text ?? "";
  const formReady = name.trim().length > 0 && relation !== null && reason.trim().length > 0;

  async function onWriteVouch() {
    if (!relation) return;
    setError(null);
    setWriting(true);
    try {
      const v = await withTimeout(vouchFor({ hopId: hop, name: name.trim(), relation, reason: reason.trim() }), AI_TIMEOUT_MS);
      setVouch(v);
    } catch {
      setVouch(`${name.trim()} is my ${relation} — ${reason.trim()}`);
    } finally {
      setWriting(false);
    }
  }

  async function onPush() {
    if (!relation || !vouch?.trim()) return;
    setError(null);
    setPushing(true);
    let child: string;
    try {
      const res = await pushOne({
        hopId: hop,
        deviceId,
        name: name.trim(),
        relation,
        reason: reason.trim(),
        vouch: vouch.trim(),
      });
      child = res.childHopId;
    } catch (e) {
      setError(cleanError(e));
      setPushing(false);
      return;
    }
    setChildHopId(child);
    setPushing(false);
    const fallback = fallbackShareMessage(name, vouch, wishText);
    try {
      const drafted = await withTimeout(draftPassMessage({ hopId: child as Id<"hops"> }), AI_TIMEOUT_MS);
      setMessage(drafted.trim() || fallback);
    } catch {
      setMessage(fallback);
    }
  }

  async function onShare() {
    if (!childHopId || message === null) return;
    const webOrigin = Platform.OS === "web" && typeof window !== "undefined" ? window.location.origin : null;
    const url = ogShareUrl(childHopId, process.env.EXPO_PUBLIC_CONVEX_SITE_URL, webOrigin);
    const text = `${message.trim()}\n${url}`;
    setError(null);
    const webShare = Platform.OS === "web" ? webShareFn() : null;
    if (Platform.OS === "web" && !webShare) {
      // No Web Share API (most desktop browsers): copy and let the visitor paste it themselves.
      try {
        await copyLink(text);
        setNote(`Copied! Paste it in your chat with ${name.trim()}.`);
      } catch {
        setError("Couldn't copy. Select the message and link above and copy them.");
        return;
      }
      void track({ hopId: hop, deviceId, event: "push" }).catch(() => {});
      return;
    }
    try {
      if (webShare) await webShare({ text });
      else await Share.share({ message: text });
    } catch {
      // Share sheet dismissed: the boat is already pushed, so the visitor may continue anyway.
    }
    void track({ hopId: hop, deviceId, event: "push" }).catch(() => {});
    onDone(childHopId);
  }

  // Open the visitor's own Messages app with the AI draft prefilled. We never send anything:
  // the person reviews it, picks the recipient and taps Send themselves.
  async function onOpenMessages() {
    if (!childHopId || message === null) return;
    const webOrigin = Platform.OS === "web" && typeof window !== "undefined" ? window.location.origin : null;
    const url = ogShareUrl(childHopId, process.env.EXPO_PUBLIC_CONVEX_SITE_URL, webOrigin);
    const body = encodeURIComponent(`${message.trim()}\n${url}`);
    // iOS expects `sms:&body=`, Android `sms:?body=`.
    const isAndroid = Platform.OS === "android" || (typeof navigator !== "undefined" && /android/i.test(navigator.userAgent ?? ""));
    const smsUrl = isAndroid ? `sms:?body=${body}` : `sms:&body=${body}`;
    setError(null);
    try {
      await Linking.openURL(smsUrl);
      setNote(`Your message to ${name.trim()} is ready in Messages — review it and tap Send yourself.`);
      void track({ hopId: hop, deviceId, event: "push" }).catch(() => {});
    } catch {
      setError("Couldn't open Messages here. Use Share instead.");
    }
  }

  if (childHopId) {
    return (
      <DCard testID="push-share">
        <Eyebrow>Boat pushed</Eyebrow>
        <Text style={styles.title}>Send it to {name.trim()}</Text>
        {message === null ? (
          <View style={styles.row}>
            <ActivityIndicator color={lv.thread} />
            <Sub>Writing your message…</Sub>
          </View>
        ) : (
          <DField value={message} onChangeText={setMessage} multiline maxLength={600} style={{ minHeight: 110 }} testID="push-message" />
        )}
        <DError error={error} />
        {note ? (
          <>
            <Sub>{note}</Sub>
            <DButton title="Next" onPress={() => onDone(childHopId)} testID="push-next" />
          </>
        ) : (
          <>
            <DButton
              title="Open in Messages"
              onPress={onOpenMessages}
              disabled={message === null || !message.trim()}
              testID="push-open-messages"
            />
            <DButton
              title="Share another way"
              variant="ghost"
              onPress={onShare}
              disabled={message === null || !message.trim()}
              testID="push-share-btn"
            />
            <Sub>We only prepare the draft. You choose who gets it and tap Send.</Sub>
          </>
        )}
      </DCard>
    );
  }

  return (
    <DCard testID="push-step">
      <Eyebrow>Push it to one person</Eyebrow>
      {hint ? <Text style={styles.hint}>{hint}</Text> : <ActivityIndicator color={lv.thread} />}
      <DField label="Their name" value={name} onChangeText={setName} placeholder="Ben" maxLength={60} testID="push-name" />
      <DChips label="They are my…" options={RELATIONS} value={relation} onChange={setRelation} testIDPrefix="push-relation" />
      <DField
        label="Why them, in one line"
        value={reason}
        onChangeText={setReason}
        placeholder="They always know someone who…"
        maxLength={200}
        testID="push-reason"
      />
      {vouch === null ? (
        <DButton title="Write the vouch" variant="ink" onPress={onWriteVouch} busy={writing} disabled={!formReady} testID="push-write-vouch" />
      ) : (
        <>
          <DField label="Your vouch (edit freely)" value={vouch} onChangeText={setVouch} multiline maxLength={400} testID="push-vouch" />
          <DButton title="Rewrite" variant="ghost" size="sm" onPress={onWriteVouch} busy={writing} disabled={!formReady} testID="push-rewrite" />
        </>
      )}
      <DError error={error} />
      {vouch !== null ? (
        <DButton title={`Push to ${name.trim() || "them"}`} onPress={onPush} busy={pushing} disabled={!formReady || !vouch.trim()} testID="push-submit" />
      ) : null}
    </DCard>
  );
}

function webShareFn(): ((d: ShareData) => Promise<void>) | null {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") return null;
  return (d) => navigator.share(d);
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: "700", color: lv.fg },
  hint: { fontSize: 16, color: lv.mutedFg, fontStyle: "italic" },
  row: { flexDirection: "row", gap: 8, alignItems: "center" },
});
