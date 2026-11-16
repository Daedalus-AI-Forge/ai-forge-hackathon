import { useEffect, useState } from "react";
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Glass, Icon } from "@/components/ios";
import { formScrollProps } from "@/components/keyboard";
import { DField } from "@/components/lv/passon/kit";
import { TossPeopleStep, TossShareStep } from "@/components/lv/toss/TossSteps";
import { useTossWish } from "@/components/lv/toss/useTossWish";
import { inferWishType } from "@/lib/tossWish";
import { layout, night } from "@/theme/tokens";

const useNativeDriver = Platform.OS !== "web";

/**
 * After a coin sinks in the pool: a night sheet slides up to pick who the wish reaches first,
 * calls `wishes.toss`, then hosts the share links. Mounted only while a wish is in flight.
 */
export function TossSheet({
  wish,
  deviceId,
  needsProfile,
  still,
  onClose,
}: {
  wish: string;
  deviceId: string;
  needsProfile: boolean;
  still: boolean;
  onClose: () => void;
}) {
  const t = useTossWish(deviceId);
  const [step, setStep] = useState<"people" | "share">("people");
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [y] = useState(() => new Animated.Value(still ? 0 : 1));
  useEffect(() => {
    if (still) return;
    Animated.timing(y, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver }).start();
  }, [y, still]);

  const send = async () => {
    if (needsProfile && !name.trim()) {
      t.setError("Add your name so friends know who it's from");
      return;
    }
    if (await t.submit({ type: inferWishType(wish), text: wish, name, city })) setStep("share");
  };

  return (
    <View style={styles.scrim} testID="toss-sheet">
      <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Close" onPress={step === "share" ? onClose : undefined} />
      <Animated.View
        style={[
          styles.sheet,
          { maxHeight: height * 0.88, transform: [{ translateY: y.interpolate({ inputRange: [0, 1], outputRange: [0, height] }) }] },
        ]}
        accessibilityViewIsModal
      >
        <Glass variant="dark" radius={28} style={styles.glass}>
          <View style={styles.grabber} />
          <Pressable
            testID="toss-sheet-close"
            accessibilityRole="button"
            accessibilityLabel={step === "share" ? "Close" : "Not now"}
            hitSlop={10}
            onPress={onClose}
            style={styles.close}
          >
            <Icon name="close" size={13} color={night.fg} weight="bold" />
          </Pressable>
          <ScrollView {...formScrollProps} contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
            {step === "people" ? (
              <TossPeopleStep
                t={t}
                deviceId={deviceId}
                wishText={wish}
                onSend={() => void send()}
                extra={
                  needsProfile ? (
                    <View style={styles.fields}>
                      <DField value={name} onChangeText={setName} testID="toss-name" placeholder="Your name" />
                      <DField value={city} onChangeText={setCity} testID="toss-city" placeholder="Your city" />
                    </View>
                  ) : null
                }
              />
            ) : (
              <TossShareStep t={t} onDone={onClose} />
            )}
          </ScrollView>
        </Glass>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, justifyContent: "flex-end", backgroundColor: "rgba(4,12,16,0.55)", zIndex: 30 },
  sheet: { width: "100%", maxWidth: layout.maxWidth, alignSelf: "center" },
  glass: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderColor: "rgba(233,199,102,0.35)",
    backgroundColor: night.glassStrong,
  },
  grabber: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: "rgba(248,242,226,0.3)", marginTop: 8 },
  close: {
    position: "absolute",
    right: 14,
    top: 14,
    zIndex: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(248,242,226,0.12)",
  },
  body: { paddingHorizontal: 18, paddingTop: 12, gap: 14 },
  fields: { gap: 10 },
});
