// Screen 1 of the link page: the vouch about you, the boat that drifted to you, one main button.
// The main button must sit above the fold on a phone, so the chain is collapsed and the explainer is last.
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { DButton, Eyebrow, Sub } from "@/components/lv/passon/kit";
import type { FirstScreen as FirstScreenData } from "@/lib/linkApi.types";
import { ordinal, timeLeft, useNow } from "@/lib/time";
import { lv } from "@/theme/tokens";

export type FirstScreenProps = { screen: FirstScreenData; onStart: () => void };

const HOW_IT_WORKS = [
  "Make one wish. It's free, no app needed.",
  "Help this boat: it's you, or push it to the one person it fits.",
  "Your wish sets sail through friends of friends.",
] as const;

export function sourceTag(boat: FirstScreenData["boat"]) {
  return boat.kind === "daily" ? "Today's boat" : `${boat.creatorName}'s real wish`;
}

export function FirstScreen({ screen, onStart }: FirstScreenProps) {
  const now = useNow(30_000);
  const [chainOpen, setChainOpen] = useState(false);
  const { boat, chain } = screen;

  return (
    <View style={{ gap: 14 }} testID="link-first">
      {screen.vouchForMe ? (
        <View style={styles.vouch} testID="link-vouch">
          <Eyebrow>{screen.senderName} about you</Eyebrow>
          <Text style={styles.vouchText}>“{screen.vouchForMe}”</Text>
        </View>
      ) : (
        <Eyebrow>{screen.senderName} sent you a paper boat</Eyebrow>
      )}

      <View style={styles.card} testID="link-boat">
        <View style={styles.tagRow}>
          <Text style={styles.tag} testID="link-source-tag">
            {sourceTag(boat)}
          </Text>
          <Text style={styles.meta}>{timeLeft(screen.expiresAt, now)}</Text>
        </View>
        <Text style={styles.wish} testID="link-wish">
          {boat.text}
        </Text>
        <View style={styles.tagRow}>
          <Text style={styles.meta} testID="link-ripples">
            {screen.ripples === 0 ? "Just set sail" : `${ordinal(screen.ripples)} ripple`}
          </Text>
          {chain.length > 0 ? (
            <Pressable
              onPress={() => setChainOpen((o) => !o)}
              accessibilityRole="button"
              accessibilityState={{ expanded: chainOpen }}
              hitSlop={8}
              testID="link-chain-toggle"
            >
              <Text style={styles.link}>
                {chainOpen ? "Hide" : "See"} who passed it ({chain.length}) {chainOpen ? "▴" : "▾"}
              </Text>
            </Pressable>
          ) : null}
        </View>
        {chainOpen ? (
          <View style={styles.chain} testID="link-chain">
            {chain.map((c, i) => (
              <View key={`${c.name}-${i}`} style={styles.chainItem}>
                <Text style={styles.chainName}>
                  {c.name}
                  {c.city ? <Text style={styles.meta}> · {c.city}</Text> : null}
                </Text>
                {c.vouch ? <Text style={styles.chainVouch}>“{c.vouch}”</Text> : null}
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <DButton
        title={screen.freeWishAvailable ? "Claim your free wish" : "Help this boat"}
        onPress={onStart}
        size="lg"
        testID="link-start"
      />
      {!screen.freeWishAvailable ? (
        <Sub style={{ textAlign: "center", fontSize: 13 }}>You've used your free wish. Helping still moves you toward the next one.</Sub>
      ) : null}

      <View style={styles.how} testID="link-how">
        <Eyebrow>How it works</Eyebrow>
        {HOW_IT_WORKS.map((t, i) => (
          <View key={t} style={styles.howRow}>
            <Text style={styles.howNum}>{i + 1}</Text>
            <Text style={styles.howText}>{t}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  vouch: { gap: 6, paddingTop: 4 },
  vouchText: { fontSize: 19, lineHeight: 26, color: lv.fg, fontWeight: "600" },
  card: { backgroundColor: lv.card, borderRadius: lv.radiusXl, borderWidth: 1, borderColor: lv.border, padding: 18, gap: 12, ...lv.shadow },
  tagRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  tag: {
    fontSize: 12,
    fontWeight: "600",
    color: lv.thread,
    backgroundColor: lv.accent,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: "hidden",
  },
  wish: { fontSize: 22, lineHeight: 29, color: lv.fg, fontWeight: "700" },
  meta: { fontSize: 13, color: lv.mutedFg },
  link: { fontSize: 13, color: lv.fg, fontWeight: "600" },
  chain: { gap: 10, borderTopWidth: 1, borderTopColor: lv.border, paddingTop: 10 },
  chainItem: { gap: 2 },
  chainName: { fontSize: 14, fontWeight: "600", color: lv.fg },
  chainVouch: { fontSize: 14, color: lv.mutedFg, fontStyle: "italic" },
  how: { gap: 10, marginTop: 18, padding: 16, borderRadius: lv.radius, backgroundColor: lv.muted },
  howRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  howNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: lv.fg,
    color: lv.bg,
    textAlign: "center",
    lineHeight: 22,
    fontSize: 12,
    fontWeight: "700",
    overflow: "hidden",
  },
  howText: { flex: 1, fontSize: 14, lineHeight: 20, color: lv.fg },
});
