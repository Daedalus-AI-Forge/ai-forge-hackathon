// Handled-screen card for a visitor who pushed the boat but may not have sent the message:
// re-drafts the share message for the hop they created and reopens Messages / share / copy.
import { useAction } from "convex/react";
import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Platform, Share, StyleSheet, Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { DButton, DCard, DError, DField, Sub } from "@/components/lv/passon/kit";
import { smsHref } from "@/lib/contactPick";
import { copyLink } from "@/lib/links";
import { lv, type } from "@/theme/tokens";

import { fallbackShareMessage, ogShareUrl, withTimeout } from "./shareCopy";

export type ResendCardProps = { childHopId: string; childName: string; vouch: string; wishText: string };

const AI_TIMEOUT_MS = 3000;

function shareUrl(childHopId: string) {
  const webOrigin = Platform.OS === "web" && typeof window !== "undefined" ? window.location.origin : null;
  return ogShareUrl(childHopId, process.env.EXPO_PUBLIC_CONVEX_SITE_URL, webOrigin);
}

function isAndroid() {
  return Platform.OS === "android" || (typeof navigator !== "undefined" && /android/i.test(navigator.userAgent ?? ""));
}

export function ResendCard({ childHopId, childName, vouch, wishText }: ResendCardProps) {
  const draftPassMessage = useAction(api.ai.draftPassMessage);
  const [message, setMessage] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const name = childName.trim() || "them";

  useEffect(() => {
    let live = true;
    const fallback = fallbackShareMessage(name, vouch, wishText);
    withTimeout(draftPassMessage({ hopId: childHopId as Id<"hops"> }), AI_TIMEOUT_MS)
      .then((d) => live && setMessage(d.trim() || fallback))
      .catch(() => live && setMessage(fallback));
    return () => {
      live = false;
    };
  }, [childHopId]);

  const ready = message !== null && message.trim().length > 0;
  const fullText = () => `${(message ?? "").trim()}\n${shareUrl(childHopId)}`;

  // We never send anything: Messages opens with the draft, the visitor picks the recipient and taps Send.
  async function onOpenMessages() {
    if (!ready) return;
    setError(null);
    try {
      await Linking.openURL(smsHref(fullText(), undefined, isAndroid() ? "android" : "ios"));
      setNote(`Your message to ${name} is ready in Messages — review it and tap Send yourself.`);
    } catch {
      setError("Couldn't open Messages here. Use Share instead.");
    }
  }

  async function onShare() {
    if (!ready) return;
    setError(null);
    const text = fullText();
    if (Platform.OS === "web") {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        try {
          await navigator.share({ text });
        } catch {
          // Share sheet dismissed: nothing to undo.
        }
        return;
      }
      await onCopy(text, `Copied! Paste it in your chat with ${name}.`);
      return;
    }
    try {
      await Share.share({ message: text });
    } catch {
      // Dismissed.
    }
  }

  async function onCopy(text: string, done: string) {
    setError(null);
    try {
      await copyLink(text);
      setNote(done);
    } catch {
      setError("Couldn't copy. Select the message above and copy it.");
    }
  }

  return (
    <DCard testID="handled-resend">
      <Text style={styles.title}>{`Didn't send it yet? Send it to ${name}`}</Text>
      {message === null ? (
        <View style={styles.row}>
          <ActivityIndicator color={lv.thread} />
          <Sub>Writing your message…</Sub>
        </View>
      ) : (
        <DField
          label="Your message (edit freely)"
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={600}
          style={{ minHeight: 110 }}
          testID="resend-message"
        />
      )}
      <DError error={error} />
      {note ? <Sub>{note}</Sub> : null}
      <DButton title="Open in Messages" size="lg" onPress={onOpenMessages} disabled={!ready} testID="resend-open-messages" />
      <DButton title="Share another way" variant="ghost" onPress={onShare} disabled={!ready} testID="resend-share" />
      <DButton
        title="Copy link"
        variant="ghost"
        size="sm"
        onPress={() => onCopy(shareUrl(childHopId), "Link copied.")}
        testID="resend-copy-link"
      />
      <Sub>We only prepare the draft. You choose who gets it and tap Send.</Sub>
    </DCard>
  );
}

const styles = StyleSheet.create({
  title: { ...type.title3, color: lv.fg },
  row: { flexDirection: "row", gap: 8, alignItems: "center" },
});
