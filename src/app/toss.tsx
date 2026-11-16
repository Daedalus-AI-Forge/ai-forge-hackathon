import { useAction } from "convex/react";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ImageBackground, StyleSheet, Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import { Screen } from "@/components/ios";
import { errorMessage } from "@/components/ui";
import { DButton, DField } from "@/components/lv/passon/kit";
import { NightPool } from "@/components/lv/pool/NightPool";
import { NightTitle, TossPeopleStep, TossShareStep } from "@/components/lv/toss/TossSteps";
import { TypeGrid } from "@/components/lv/toss/TypeGrid";
import { useTossWish } from "@/components/lv/toss/useTossWish";
import { ToneProvider } from "@/components/lv/tone";
import { useMe } from "@/lib/device";
import { LV_WISH_TYPES, fromApiType, type ApiWishType } from "@/lib/lvWishTypes";
import { night, poolImages, type } from "@/theme/tokens";

/** Toss a coin (any entry point other than the pool): write one line, pick 1–3 friends, share. Night look. */
export default function Toss() {
  const router = useRouter();
  const { deviceId, user } = useMe();
  const polish = useAction(api.ai.polishWish);
  const t = useTossWish(deviceId);

  const [step, setStep] = useState<"write" | "people" | "share">("write");
  const [type, setType] = useState<ApiWishType>("do_together");
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [polishing, setPolishing] = useState(false);
  const [polishError, setPolishError] = useState<string | null>(null);

  const needsProfile = !user?.name;
  const typeInfo = LV_WISH_TYPES.find((x) => x.id === fromApiType[type])!;

  async function onPolish() {
    if (!deviceId || !text.trim()) return;
    setPolishing(true);
    setPolishError(null);
    try {
      setText(await polish({ deviceId, type, text }));
    } catch (e) {
      setPolishError(errorMessage(e));
    } finally {
      setPolishing(false);
    }
  }

  async function onToss() {
    if (await t.submit({ type, text, name, city })) setStep("share");
  }

  // ToneProvider: every card, field and chip in this flow takes the night palette.
  return (
    <ToneProvider tone="night">
      <Screen testID="toss-screen" nativeHeader tone="night" backdrop={<NightBackdrop />}>
      {step === "write" ? (
        <>
          <NightTitle sub={user ? `${user.wishesLeft} coin${user.wishesLeft === 1 ? "" : "s"}, refunded if it fades` : undefined}>
            Toss a coin: who do you want to meet?
          </NightTitle>
          <TypeGrid value={type} onChange={setType} />
          <Text style={styles.small}>A type of person + what to do + why. Never a specific named person.</Text>
          <DField
            testID="toss-text"
            multiline
            value={text}
            onChangeText={setText}
            placeholder={`${typeInfo.example[0].toUpperCase()}${typeInfo.example.slice(1)}…`}
          />
          <DButton
            testID="toss-polish"
            variant="ghost"
            tone="night"
            title={polishing ? "Polishing…" : "✦ Polish with AI"}
            busy={polishing}
            disabled={!text.trim()}
            onPress={() => void onPolish()}
          />
          {needsProfile ? (
            <View style={styles.fields}>
              <DField value={name} onChangeText={setName} testID="toss-name" placeholder="Your name" />
              <DField value={city} onChangeText={setCity} testID="toss-city" placeholder="Your city" />
            </View>
          ) : null}
          {polishError ? <Text style={styles.err}>{polishError}</Text> : null}
          <DButton
            testID="toss-next"
            variant="gold"
            size="lg"
            title="Next: who should it reach first?"
            disabled={!text.trim() || (needsProfile && !name.trim())}
            onPress={() => setStep("people")}
          />
        </>
      ) : null}

      {step === "people" ? (
        <>
          <TossPeopleStep t={t} deviceId={deviceId} wishText={text} onSend={() => void onToss()} />
          <DButton variant="plain" tone="night" title="Back" onPress={() => setStep("write")} style={styles.back} />
        </>
      ) : null}

      {step === "share" ? (
        <>
          <NightPool size={200} coins={1} />
          <TossShareStep t={t} onDone={() => router.replace("/")} />
        </>
      ) : null}
      </Screen>
    </ToneProvider>
  );
}

function NightBackdrop() {
  return (
    <View style={[StyleSheet.absoluteFill, styles.night]}>
      <ImageBackground source={poolImages.fountain} style={StyleSheet.absoluteFill} resizeMode="cover" imageStyle={styles.fountain}>
        <View style={[StyleSheet.absoluteFill, styles.dim]} />
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  small: { ...type.footnote, color: night.mutedFg },
  err: { ...type.footnote, color: "#FF8A80" },
  fields: { gap: 10 },
  back: { alignSelf: "center" },
  night: { backgroundColor: night.deep, pointerEvents: "none" },
  fountain: { opacity: 0.4, width: "100%", height: "100%" },
  dim: { backgroundColor: "rgba(7,20,26,0.62)" },
});
