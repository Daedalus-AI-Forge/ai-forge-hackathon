import { useQuery } from "convex/react";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import { Avatar, Button, Card, Muted } from "@/components/ui";
import { useMe } from "@/lib/device";
import { appUrl, copyLink, looksLikePhone, smsLink } from "@/lib/links";
import { colors, radius } from "@/lib/theme";

const RELATION_TEXT = { passed_to: "you passed them a wish", passed_me: "passed you a wish", met: "met through a wish" } as const;

export default function Network() {
  const { deviceId, user } = useMe();
  const people = useQuery(api.me.network, deviceId ? { deviceId } : "skip");
  const [copied, setCopied] = useState<string | null>(null);
  const tossUrl = appUrl("/toss");

  return (
    <ScrollView testID="network-screen" contentContainerStyle={styles.container}>
      <Muted>
        People you passed wishes to, people who passed wishes to you, and people you met through a granted wish.
      </Muted>
      {people?.length === 0 ? <Muted>No one yet. Toss a wish and your network starts here.</Muted> : null}
      {people?.map((p, i) => {
        const message = `Hey ${p.name}! ${user?.name || "A friend"} here. I'm on Wishwell, toss a wish and I'll pass it on:`;
        const phone = looksLikePhone(p.contact) ? p.contact! : null;
        return (
          <Card key={p.key} testID={`network-entry-${i}`}>
            <View style={styles.row}>
              <Avatar name={p.name} color={p.avatar} size={40} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.name}>{p.name}</Text>
                <Muted style={{ fontSize: 13 }}>
                  {p.contact ?? (p.channel ? `via ${p.channel}` : "no contact yet")}
                  {p.wishes ? ` · ${p.wishes} ${p.wishes === 1 ? "wish" : "wishes"} together` : ""}
                </Muted>
                <Muted style={{ fontSize: 13 }}>{p.relations.map((r) => RELATION_TEXT[r]).join(", ")}</Muted>
              </View>
            </View>
            {p.tags.length ? (
              <View style={styles.tags}>
                {p.tags.map((t) => (
                  <Text key={t} style={styles.tag}>
                    {t}
                  </Text>
                ))}
              </View>
            ) : null}
            <Button
              title={phone ? "Send them a wish" : copied === p.key ? "Link copied!" : "Copy a wish link"}
              variant="secondary"
              style={{ minHeight: 44 }}
              testID={`network-send-${i}`}
              onPress={async () => {
                if (phone) return smsLink(message, tossUrl, phone);
                await copyLink(`${message}\n${tossUrl}`);
                setCopied(p.key);
              }}
            />
          </Card>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12, maxWidth: 430, width: "100%", alignSelf: "center" },
  row: { flexDirection: "row", gap: 12, alignItems: "center" },
  name: { fontSize: 17, fontWeight: "800", color: colors.ink },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.muted,
    backgroundColor: colors.water,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: "hidden",
  },
});
