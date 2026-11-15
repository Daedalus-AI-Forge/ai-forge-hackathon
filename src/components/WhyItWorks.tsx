import { useQuery } from "convex/react";
import { StyleSheet, Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import { Card, Muted } from "@/components/ui";
import { colors } from "@/lib/theme";

const STEPS = [
  ["Is it you?", "Tap It's me and say hi in one line."],
  ["Know someone?", "Pass it to up to 3 friends. One line vouching for whoever sent it to you."],
  ["See how it ends.", "Everyone on the chain gets the ending when the two meet."],
] as const;

/** For people who have never seen Wishwell: what to do, and why a wish passed this way gets answered. */
export function WhyItWorks() {
  const stats = useQuery(api.stats.summary, {});
  return (
    <Card testID="why-it-works">
      <Text style={styles.title}>How it works</Text>
      {STEPS.map(([head, body], i) => (
        <View key={head} style={styles.step}>
          <Text style={styles.num}>{i + 1}</Text>
          <Text style={styles.body}>
            <Text style={styles.head}>{head} </Text>
            {body}
          </Text>
        </View>
      ))}
      <Text style={styles.title}>Why it works</Text>
      {stats && stats.passes > 0 ? (
        <Text testID="why-stats" style={styles.stats}>
          {stats.people} people linked by {stats.passes} friend-to-friend passes
          {stats.vouches > 0 ? `, ${stats.vouches} with a personal vouch` : ""}.
          {stats.granted > 0 && stats.avgRipples !== null
            ? ` ${stats.granted} ${stats.granted === 1 ? "wish" : "wishes"} granted, ${stats.avgRipples} ripples away on average.`
            : ""}
        </Text>
      ) : null}
      <Muted>
        Every link is a friend who chose a friend, not a contact list. By the time two people meet they have already
        finished a chain together, so it never starts as a cold intro.
      </Muted>
      <Muted>The well remembers who passes to whom, and the tags you pick, to route future wishes.</Muted>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 16, fontWeight: "800", color: colors.ink },
  step: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  num: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.redSoft,
    color: colors.red,
    fontWeight: "800",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 22,
    overflow: "hidden",
  },
  head: { fontWeight: "800", color: colors.ink },
  body: { flex: 1, fontSize: 15, color: colors.muted, lineHeight: 21 },
  stats: { fontSize: 15, fontWeight: "700", color: colors.red, lineHeight: 21 },
});
