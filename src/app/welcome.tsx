import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, Platform, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/convex/_generated/api";
import { Backdrop, Glass } from "@/components/ios";
import { DButton } from "@/components/lv/passon/kit";
import { Avatar } from "@/components/ui";
import { AUTH_ENABLED } from "@/lib/authFlag";
import { lv, lvImages, type } from "@/theme/tokens";

const useNativeDriver = Platform.OS !== "web";

const ONBOARDED_KEY = "wishwell.onboarded";

const BANK = [
  { name: "Amy", color: lv.thread },
  { name: "Ben", color: lv.primary },
  { name: "Priya", color: lv.gold },
  { name: "Sam", color: "#8E8E93" },
];

/** First open: one screen that names the loop — push a paper boat, see who it met. */
export default function Welcome() {
  const router = useRouter();
  const account = useQuery(api.users.account);
  const [busy, setBusy] = useState(false);
  const drift = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const driftAnim = Animated.loop(Animated.timing(drift, { toValue: 1, duration: 9000, easing: Easing.linear, useNativeDriver }));
    const bobAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver }),
        Animated.timing(bob, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver }),
      ]),
    );
    driftAnim.start();
    bobAnim.start();
    return () => {
      driftAnim.stop();
      bobAnim.stop();
    };
  }, [drift, bob]);

  const start = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await AsyncStorage.setItem(ONBOARDED_KEY, "1");
      if (AUTH_ENABLED && account && account.signedIn && account.hasAccount === false) {
        router.replace("/sign-in");
      } else {
        router.replace("/");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <Backdrop />
      <SafeAreaView testID="welcome-screen" style={styles.safe}>
      <View style={styles.wrap}>
        <Text style={styles.title}>
          Push a paper boat.{"\n"}Tomorrow, see who it met.
        </Text>
        <Text style={styles.sub}>Every day the well sends you one boat. Pick a friend, say why, push it on.</Text>

        <View style={styles.scene}>
          <Glass variant="thin" radius={58} curve="circular" style={styles.rim}>
          <View style={styles.water}>
            <Image source={lvImages.wellPool} style={StyleSheet.absoluteFill} resizeMode="cover" />
            {BANK.map((p, i) => (
              <View key={p.name} style={[styles.holder, { left: `${8 + i * 28}%`, top: 33 }]}>
                <Avatar name={p.name} color={p.color} size={38} />
              </View>
            ))}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.boat,
                {
                  transform: [
                    { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [-170, 420] }) },
                    { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [-2, 2] }) },
                  ],
                },
              ]}
            >
              <Text style={styles.boatGlyph}>⛵︎</Text>
            </Animated.View>
          </View>
          </Glass>
        </View>

        <DButton testID="welcome-start" title="Start" size="lg" disabled={busy} onPress={() => void start()} style={styles.start} />
      </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: lv.bg },
  safe: { flex: 1 },
  wrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 24,
    paddingBottom: 32,
    maxWidth: 440,
    width: "100%",
    alignSelf: "center",
  },
  title: { ...type.largeTitle, color: lv.fg, textAlign: "center" },
  sub: { ...type.callout, color: lv.mutedFg, textAlign: "center", maxWidth: 320, marginTop: 4 },
  scene: { width: "100%", paddingVertical: 28 },
  rim: { padding: 6 },
  water: { height: 104, borderRadius: 52, overflow: "hidden", backgroundColor: lv.water },
  holder: {
    position: "absolute",
    marginLeft: -19,
    zIndex: 2,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.85)",
  },
  boat: { position: "absolute", top: 30, zIndex: 1, left: 0 },
  boatGlyph: { fontSize: 40, textShadowColor: "rgba(42,32,22,0.25)", textShadowRadius: 4, textShadowOffset: { width: 0, height: 2 } },
  start: { width: "100%", maxWidth: 320, marginTop: 4 },
});
