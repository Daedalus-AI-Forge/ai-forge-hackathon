import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { DButton, DCard, DField } from "@/components/lv/passon/kit";
import { phoneTail } from "@/lib/contactPick";
import { copyLink, hopUrl, shareLink, smsLink } from "@/lib/links";
import { lv } from "@/theme/tokens";

/** One share row for a boat link: editable AI message, the link, and share actions. */
export function ShareLink({
  hopId,
  name,
  message,
  label,
  to,
  onTextChange,
}: {
  hopId: string;
  name: string;
  message: string | null;
  label?: string;
  /** Picked phone (E.164) to pre-fill as the SMS recipient. */
  to?: string;
  /** Mirrors edits so a parent flow (e.g. "Text all") sends the edited text. */
  onTextChange?: (text: string) => void;
}) {
  const [text, setText] = useState(message ?? "");
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    if (message && !text) setText(message);
  }, [message]);
  const edit = (t: string) => {
    setText(t);
    onTextChange?.(t);
  };
  const url = hopUrl(hopId);
  return (
    <DCard testID={`share-card-${hopId}`}>
      <Text style={styles.to}>{label ?? `For ${name}`}</Text>
      {to ? (
        <Text style={styles.muted} testID={`share-sms-to-${hopId}`}>
          SMS goes to the number ending {phoneTail(to)}
        </Text>
      ) : null}
      {message === null && !text ? (
        <View style={styles.drafting}>
          <ActivityIndicator color={lv.thread} />
          <Text style={styles.muted}>AI is drafting your message…</Text>
        </View>
      ) : (
        <DField value={text} onChangeText={edit} multiline style={{ minHeight: 96 }} testID={`share-message-${hopId}`} />
      )}
      <Text testID={`share-link-${hopId}`} selectable style={styles.link}>
        {url}
      </Text>
      <View style={styles.row}>
        <DButton
          title="Share"
          variant="thread"
          size="sm"
          style={styles.btn}
          testID={`share-native-${hopId}`}
          onPress={async () => {
            const result = await shareLink(text, url);
            if (result === "copied") setNote("Copied! Paste it in your chat.");
          }}
        />
        <DButton title="SMS" variant="ghost" size="sm" style={styles.btn} testID={`share-sms-${hopId}`} onPress={() => smsLink(text, url, to)} />
        <DButton
          title="Copy link"
          variant="ghost"
          size="sm"
          style={styles.btn}
          testID={`share-copy-${hopId}`}
          onPress={async () => {
            await copyLink(`${text}\n${url}`);
            setNote("Copied!");
          }}
        />
      </View>
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </DCard>
  );
}

const styles = StyleSheet.create({
  to: { fontSize: 16, fontWeight: "700", color: lv.fg },
  drafting: { flexDirection: "row", gap: 8, alignItems: "center", paddingVertical: 8 },
  muted: { color: lv.mutedFg },
  link: { fontFamily: lv.font.mono, fontSize: 13, color: lv.thread },
  row: { flexDirection: "row", gap: 8 },
  btn: { flex: 1 },
  note: { color: lv.mutedFg, fontSize: 14 },
});