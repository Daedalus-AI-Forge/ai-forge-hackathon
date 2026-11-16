import { useEffect, useState, type ReactNode } from "react";
import { Animated, Easing, Image, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Glass, Icon } from "@/components/ios";
import { tabClearance } from "@/components/ios/metrics";
import { night, poolImages } from "@/theme/tokens";

import { countdown, nextUtcMidnight, useNow } from "@/lib/time";

import { MOTES, SPARKLES, wishLine, type WishLike } from "./logic";

const useNativeDriver = Platform.OS !== "web";

/** Prototype --night (oklch 0.12 0.025 220) as rgb, for the scrim bands. */
const SCRIM_RGB = "7,20,26";
const BANDS = 24;

export type FountainChallenge = { title: string; done: boolean } | null;

type Props = {
  /** 0 = standing at the fountain, 1 = dived (zoomed into the water). Driven by the Well tab. */
  zoom: Animated.Value;
  /** Opacity of the copy and buttons; fades out as the dive starts. */
  ui: Animated.Value;
  /** Reduce Motion: no zoom, no twinkle, no breathing. */
  still: boolean;
  /** True once the dive has started: the scene stops taking touches and leaves the a11y tree. */
  leaving: boolean;
  eyebrow: string;
  avatar: ReactNode;
  /** Your wishes (api.wishes.mine); the newest traveling one shows above the buttons. */
  wishes: readonly WishLike[] | undefined;
  challenge: FountainChallenge;
  pendingActions?: ReactNode;
  onToss: () => void;
  onChallenge: () => void;
};

/**
 * The Well tab's first page, ported from Katie-Lan's prototype FountainScene: the night-garden
 * fountain seen from the front, gold sparkles and drifting motes, the Wishwell title, your wish in
 * flight, "Toss a coin", and today's boat with its countdown. Diving zooms into the water.
 */
export function FountainScene({ zoom, ui, still, leaving, eyebrow, avatar, wishes, challenge, pendingActions, onToss, onChallenge }: Props) {
  const insets = useSafeAreaInsets();
  // The ticking clock lives here, so only the fountain re-renders each second (and only while shown).
  const now = useNow(1000);
  const wish = wishLine(wishes, now);
  const left = countdown(nextUtcMidnight(now), now);
  // Say whose wish the card is; with several in flight it shows the newest.
  const traveling = wishes?.filter((w) => w.status === "traveling").length ?? 0;
  const [breath] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (still) return;
    const ease = Easing.inOut(Easing.sin);
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: 7000,
          easing: ease,
          useNativeDriver,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: 7000,
          easing: ease,
          useNativeDriver,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [breath, still]);

  const sceneScale = still ? 1 : zoom.interpolate({ inputRange: [0, 1], outputRange: [1, 3.6] });
  const breathe = still ? 1.02 : breath.interpolate({ inputRange: [0, 1], outputRange: [1.02, 1.045] });

  return (
    <View
      style={[StyleSheet.absoluteFill, styles.root, leaving && styles.noTouch]}
      accessibilityElementsHidden={leaving}
      importantForAccessibility={leaving ? "no-hide-descendants" : "auto"}
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.zoomOrigin, { transform: [{ scale: sceneScale }] }]}>
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale: breathe }] }]}>
          <Image
            source={poolImages.fountain}
            style={styles.image}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
            accessible
            accessibilityLabel="A white marble fountain in a night garden, glowing paper boats floating on the water"
          />
        </Animated.View>
        {SPARKLES.map((s, i) => (
          <Twinkle
            key={i}
            still={still}
            dur={s.dur}
            delay={s.delay}
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: s.size,
              height: s.size,
            }}
          />
        ))}
        {still ? null : MOTES.map((m, i) => <Mote key={`m${i}`} left={m.left} top={m.top} dur={m.dur} delay={m.delay} />)}
      </Animated.View>

      <Scrim />

      <Animated.View
        style={[
          styles.content,
          {
            opacity: ui,
            paddingTop: insets.top + 24,
            paddingBottom: tabClearance(insets.bottom) - 8,
          },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>{eyebrow}</Text>
            <Text style={styles.title} accessibilityRole="header">
              Wishwell
            </Text>
          </View>
          {avatar}
        </View>
        {pendingActions ? <View style={styles.pending}>{pendingActions}</View> : null}

        <View style={styles.bottom}>
          {wish ? (
            <Glass variant="dark" radius={20} style={styles.wish}>
              <Text style={styles.wishLabel}>{traveling > 1 ? `Your wish · 1 of ${traveling}` : "Your wish"}</Text>
              <Text style={styles.wishText} numberOfLines={2}>
                {wish.text}
              </Text>
              <Text style={styles.wishMeta}>{wish.meta}</Text>
            </Glass>
          ) : null}

          <Pressable
            testID="fountain-toss"
            accessibilityRole="button"
            accessibilityLabel="Toss a coin"
            onPress={onToss}
            style={({ pressed }) => [styles.gold, pressed && styles.pressed]}
          >
            <View style={styles.goldSheen} />
            <Icon name="sparkles" size={20} color={night.goldFg} />
            <Text style={styles.goldText}>Toss a coin</Text>
          </Pressable>

          <Glass
            testID="fountain-challenge"
            variant="dark"
            radius={20}
            onPress={onChallenge}
            accessibilityLabel={challenge ? (challenge.done ? "Today's boat, pushed" : `Today's boat: ${challenge.title}`) : "Today's boat"}
            accessibilityHint="Dives into the pool and opens today's boat"
            style={styles.challenge}
          >
            <View style={styles.star}>
              <Text style={styles.starGlyph}>{challenge?.done ? "✓" : "★"}</Text>
            </View>
            <View style={styles.challengeText}>
              <Text style={styles.challengeLabel}>{challenge?.done ? "Today's boat · pushed" : `Today's boat · ${left} left`}</Text>
              <Text style={styles.challengeTitle} numberOfLines={1}>
                {challenge?.title ?? " "}
              </Text>
              {/* Not anyone's wish: the well sends the same boat to everyone each day. */}
              {challenge && !challenge.done ? <Text style={styles.challengeNote}>Everyone gets this boat today</Text> : null}
            </View>
            <Icon name="forward" size={14} color={night.mutedFg} />
          </Glass>
        </View>
      </Animated.View>
    </View>
  );
}

/** The prototype's bg-scrim: dark at the top, clear through the middle, darkest at the bottom. */
function Scrim() {
  const top = Array.from({ length: BANDS }, (_, i) => 0.75 * (1 - i / BANDS));
  const bottom = Array.from({ length: BANDS }, (_, i) => (0.85 * (i + 1)) / BANDS);
  return (
    <View style={[StyleSheet.absoluteFill, styles.noTouch]}>
      <View style={styles.scrimTop}>
        {top.map((a, i) => (
          <View key={i} style={[styles.band, { backgroundColor: `rgba(${SCRIM_RGB},${a.toFixed(3)})` }]} />
        ))}
      </View>
      <View style={styles.scrimBottom}>
        {bottom.map((a, i) => (
          <View key={i} style={[styles.band, { backgroundColor: `rgba(${SCRIM_RGB},${a.toFixed(3)})` }]} />
        ))}
      </View>
    </View>
  );
}

function useLoop(still: boolean, dur: number, delay: number, kind: "pulse" | "rise") {
  const [v] = useState(() => new Animated.Value(still ? 1 : 0));
  useEffect(() => {
    if (still) return;
    const ms = dur * 1000;
    const anim =
      kind === "pulse"
        ? Animated.loop(
            Animated.sequence([
              Animated.timing(v, {
                toValue: 1,
                duration: ms / 2,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver,
              }),
              Animated.timing(v, {
                toValue: 0,
                duration: ms / 2,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver,
              }),
            ]),
          )
        : Animated.loop(
            Animated.sequence([
              Animated.timing(v, {
                toValue: 1,
                duration: ms,
                easing: Easing.linear,
                useNativeDriver,
              }),
              Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver }),
            ]),
          );
    const t = setTimeout(() => anim.start(), delay * 1000);
    return () => {
      clearTimeout(t);
      anim.stop();
    };
  }, [v, still, dur, delay, kind]);
  return v;
}

function Twinkle({ still, dur, delay, style }: { still: boolean; dur: number; delay: number; style: ViewStyle }) {
  const v = useLoop(still, dur, delay, "pulse");
  return (
    <Animated.View
      style={[
        styles.sparkle,
        style,
        {
          opacity: still ? 0.7 : v.interpolate({ inputRange: [0, 1], outputRange: [0.15, 1] }),
          transform: [
            {
              scale: still ? 1 : v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }),
            },
          ],
        },
      ]}
    />
  );
}

function Mote({ left, top, dur, delay }: { left: number; top: number; dur: number; delay: number }) {
  const v = useLoop(false, dur, delay, "rise");
  return (
    <Animated.View
      style={[
        styles.mote,
        {
          left: `${left}%`,
          top: `${top}%`,
          opacity: v.interpolate({
            inputRange: [0, 0.15, 1],
            outputRange: [0, 1, 0],
          }),
          transform: [
            {
              translateY: v.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -120],
              }),
            },
          ],
        },
      ]}
    />
  );
}

const serif = night.serif;
const goldGlow = "0px 0px 24px rgba(233,199,102,0.55), 0px 10px 30px -10px rgba(169,119,43,0.8)";

const styles = StyleSheet.create({
  root: { backgroundColor: night.deep, overflow: "hidden" },
  noTouch: { pointerEvents: "none" },
  // The prototype zooms toward the water at the fountain's foot (origin 34% 72%).
  zoomOrigin: { transformOrigin: "34% 72%" },
  image: { width: "100%", height: "100%" },
  sparkle: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: night.goldBright,
    boxShadow: `0px 0px 10px ${night.gold}`,
  },
  mote: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: night.gold,
    boxShadow: `0px 0px 8px ${night.gold}`,
  },
  scrimTop: { position: "absolute", top: 0, left: 0, right: 0, height: "28%" },
  scrimBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "45%",
  },
  band: { flex: 1 },
  content: {
    flex: 1,
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  headerText: { flex: 1 },
  eyebrow: {
    fontFamily: serif,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: night.mutedFg,
  },
  title: {
    marginTop: 4,
    fontFamily: serif,
    fontSize: 48,
    lineHeight: 54,
    color: night.fg,
    textShadowColor: "rgba(233,199,102,0.55)",
    textShadowRadius: 18,
    textShadowOffset: { width: 0, height: 0 },
  },
  bottom: { marginTop: "auto", gap: 12 },
  pending: { marginTop: 8 },
  wish: { paddingHorizontal: 16, paddingVertical: 12, alignItems: "center" },
  wishText: {
    fontFamily: serif,
    fontSize: 20,
    lineHeight: 26,
    color: night.fg,
    textAlign: "center",
  },
  wishLabel: {
    marginBottom: 2,
    fontFamily: serif,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: night.gold,
  },
  wishMeta: {
    marginTop: 2,
    fontFamily: serif,
    fontSize: 16,
    lineHeight: 22,
    color: night.mutedFg,
    fontVariant: ["tabular-nums"],
  },
  gold: {
    height: 56,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: night.gold,
    boxShadow: goldGlow,
    overflow: "hidden",
  },
  // Stands in for the prototype's top-to-bottom gold gradient (no gradient module in the app).
  goldSheen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "50%",
    backgroundColor: night.goldBright,
    opacity: 0.45,
  },
  goldText: {
    fontFamily: serif,
    fontSize: 24,
    lineHeight: 30,
    color: night.goldFg,
  },
  pressed: { transform: [{ scale: 0.98 }] },
  challenge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  star: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: night.gold,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: goldGlow,
  },
  starGlyph: { fontSize: 16, lineHeight: 20, color: night.goldFg },
  challengeText: { flex: 1, minWidth: 0 },
  challengeLabel: {
    fontFamily: serif,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: night.mutedFg,
    fontVariant: ["tabular-nums"],
  },
  challengeNote: {
    fontFamily: serif,
    fontSize: 13,
    lineHeight: 18,
    color: night.mutedFg,
  },
  challengeTitle: {
    fontFamily: serif,
    fontSize: 18,
    lineHeight: 24,
    color: night.fg,
  },
});
