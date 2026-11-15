import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { Button, Card, Field } from "@/components/ui";
import { copyLink, hopUrl, shareLink, smsLink } from "@/lib/links";
import { colors, mono } from "@/lib/theme";

export function ShareLink({ hopId, name, message }: { hopId: string; name: string; message: string | null }) {
  const [text, setText] = useState(message ?? "");
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    if (message && !text) setText(message);
  }, [message]);
  const url = hopUrl(hopId);
  return (
    <Card testID={`share-card-${hopId}`}>
      <Text style={styles.to}>For {name}</Text>
      {message === null && !text ? (
        <View style={styles.drafting}>
          <ActivityIndicator color={colors.red} />
          <Text style={styles.muted}>AI is drafting your message…</Text>
        </View>
      ) : (
        <Field value={text} onChangeText={setText} multiline testID={`share-message-${hopId}`} />
      )}
      <Text testID={`share-link-${hopId}`} selectable style={styles.link}>
        {url}
      </Text>
      <View style={styles.row}>
        <Button
          title="Share"
          style={styles.btn}
          testID={`share-native-${hopId}`}
          onPress={async () => {
            const result = await shareLink(text, url);
            if (result === "copied") setNote("Copied! Paste it in your chat.");
          }}
        />
        <Button title="SMS" variant="secondary" style={styles.btn} testID={`share-sms-${hopId}`} onPress={() => smsLink(text, url)} />
        <Button
          title="Copy link"
          variant="secondary"
          style={styles.btn}
          testID={`share-copy-${hopId}`}
          onPress={async () => {
            await copyLink(`${text}\n${url}`);
            setNote("Copied!");
          }}
        />
      </View>
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  to: { fontSize: 16, fontWeight: "800", color: colors.ink },
  drafting: { flexDirection: "row", gap: 8, alignItems: "center", paddingVertical: 8 },
  muted: { color: colors.muted },
  link: { fontFamily: mono, fontSize: 13, color: colors.red },
  row: { flexDirection: "row", gap: 8 },
  btn: { flex: 1, minHeight: 44, paddingHorizontal: 8 },
  note: { color: colors.muted, fontSize: 14 },
});
