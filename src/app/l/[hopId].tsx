// No-app link page: someone who got a paper boat link makes a free wish, claims or pushes the boat,
// leaves a contact, and sees their wish set sail. No login; the visitor is identified by device id.
import { useMutation, useQuery } from "convex/react";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ClaimStep } from "@/components/link/ClaimStep";
import { ContactStep } from "@/components/link/ContactStep";
import { DoneStep } from "@/components/link/DoneStep";
import { FirstScreen } from "@/components/link/FirstScreen";
import { PushStep } from "@/components/link/PushStep";
import { type HandleChoice, Shell, nextStep, prevStep } from "@/components/link/Shell";
import { SpecialCase } from "@/components/link/SpecialCase";
import { WriteWish } from "@/components/link/WriteWish";
import { DButton, Eyebrow, Sub } from "@/components/lv/passon/kit";
import { useDeviceId } from "@/lib/device";
import type { FinishResult, FirstScreen as FirstScreenData, LinkEvent } from "@/lib/linkApi.types";
import { type LinkStep, clearDraft, loadDraft, saveDraft } from "@/lib/linkDraft";
import { lv } from "@/theme/tokens";

export default function LinkPage() {
  const { hopId } = useLocalSearchParams<{ hopId: string }>();
  const deviceId = useDeviceId();
  const screen = useQuery(api.link.firstScreen, deviceId ? { hopId, deviceId } : "skip") as
    | FirstScreenData
    | null
    | undefined;
  const open = useMutation(api.link.open);
  const trackMut = useMutation(api.linkMetrics.track);
  const saveDraftRemote = useMutation(api.link.saveDraft);

  const [step, setStep] = useState<LinkStep>("first");
  const [choice, setChoice] = useState<HandleChoice>(null);
  const [wishText, setWishText] = useState("");
  const [skipped, setSkipped] = useState(false);
  const [freeWishOnly, setFreeWishOnly] = useState(false);
  const [result, setResult] = useState<FinishResult | null>(null);
  const [hydrated, setHydrated] = useState(false);
  // The server state when the page first loaded. Claiming/pushing flips the live state to
  // "handled" mid-flow; the wizard must not jump to the special-case screen because of that.
  const [entryState, setEntryState] = useState<FirstScreenData["state"] | null>(null);
  const opened = useRef(false);

  const hop = hopId as Id<"hops">;
  function track(event: LinkEvent, wroteWish?: boolean) {
    if (!deviceId) return;
    trackMut({ hopId: hop, deviceId, event, wroteWish }).catch(() => undefined);
  }

  // Restore the local draft (wish text + step) once.
  useEffect(() => {
    let cancelled = false;
    void loadDraft(hopId).then((d) => {
      if (cancelled) return;
      if (d) {
        setWishText(d.wishText);
        setSkipped(d.skipped);
        setStep(d.step);
      }
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [hopId]);

  // Persist every change until the visitor is done.
  useEffect(() => {
    if (!hydrated) return;
    if (step === "done") void clearDraft(hopId);
    else void saveDraft(hopId, { wishText, skipped, step });
  }, [hydrated, hopId, wishText, skipped, step]);

  // Bind the hop to this device and count the open, once per page load.
  useEffect(() => {
    if (!deviceId || opened.current) return;
    opened.current = true;
    open({ hopId: hop, deviceId }).catch(() => undefined);
    track("open");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, hopId]);

  useEffect(() => {
    if (screen && entryState === null) setEntryState(screen.state);
  }, [screen, entryState]);

  const header = <Stack.Screen options={{ headerShown: false, title: "A paper boat for you" }} />;

  if (!deviceId || !hydrated || screen === undefined) {
    return (
      <View style={styles.center} testID="link-loading">
        {header}
        <ActivityIndicator color={lv.fg} />
      </View>
    );
  }

  if (screen === null) {
    return (
      <Shell step="first" testID="link-missing">
        {header}
        <Eyebrow>Paper boat</Eyebrow>
        <Text style={styles.h1}>This link doesn't lead to a boat.</Text>
        <Sub>Ask the person who sent it for a fresh link.</Sub>
      </Shell>
    );
  }

  const opts = { freeWishAvailable: screen.freeWishAvailable, freeWishOnly };
  const go = (from: LinkStep) => setStep(nextStep(from, opts));
  const back = prevStep(step, opts);
  const onBack = back
    ? () => {
        if (step === "handle" && choice) setChoice(null);
        else setStep(back);
      }
    : null;

  const special = (entryState ?? screen.state) !== "open" && !freeWishOnly && step !== "contact" && step !== "done";
  if (special) {
    return (
      <Shell step="first" testID="link-special">
        {header}
        <SpecialCase
          screen={screen}
          onFreeWish={() => {
            setFreeWishOnly(true);
            setChoice(null);
            setStep(nextStep("first", { freeWishAvailable: screen.freeWishAvailable, freeWishOnly: true }));
          }}
        />
      </Shell>
    );
  }

  return (
    <Shell step={step} onBack={onBack} testID="link-page">
      {header}
      {step === "first" ? <FirstScreen screen={screen} onStart={() => go("first")} /> : null}

      {step === "wish" ? (
        <WriteWish
          deviceId={deviceId}
          text={wishText}
          onChangeText={setWishText}
          onContinue={(t) => {
            setWishText(t);
            setSkipped(false);
            track("wish_written", true);
            saveDraftRemote({ deviceId, wishText: t }).catch(() => undefined);
            go("wish");
          }}
          onSkip={() => {
            setSkipped(true);
            track("skip_wish", false);
            go("wish");
          }}
        />
      ) : null}

      {step === "handle" && choice === null ? (
        <View style={{ gap: 14 }} testID="link-handle">
          <View style={{ gap: 8 }}>
            <Eyebrow>Help this boat</Eyebrow>
            <Text style={styles.h1}>Is this wish about you, or someone you know?</Text>
            <Sub style={{ fontStyle: "italic" }}>“{screen.boat.text}”</Sub>
          </View>
          <DButton title="That's me" size="lg" onPress={() => setChoice("claim")} testID="link-thats-me" />
          <DButton
            title="Push to one person"
            variant="ink"
            size="lg"
            onPress={() => setChoice("push")}
            testID="link-push-one"
          />
          <Sub style={{ textAlign: "center", fontSize: 13 }}>Either way, your free wish sets sail when you're done.</Sub>
        </View>
      ) : null}
      {step === "handle" && choice === "claim" ? (
        <ClaimStep hopId={hopId} deviceId={deviceId} kind={screen.boat.kind} onDone={() => go("handle")} />
      ) : null}
      {step === "handle" && choice === "push" ? (
        <PushStep hopId={hopId} deviceId={deviceId} onDone={() => go("handle")} />
      ) : null}

      {step === "contact" ? (
        <ContactStep
          hopId={hopId}
          deviceId={deviceId}
          wishText={skipped || !wishText.trim() ? null : wishText.trim()}
          onDone={(r) => {
            setResult(r);
            setStep("done");
          }}
        />
      ) : null}

      {step === "done" && result ? (
        <DoneStep result={result} wishText={skipped || !wishText.trim() ? null : wishText.trim()} />
      ) : null}
    </Shell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: lv.bg },
  h1: { fontSize: 26, lineHeight: 32, fontWeight: "700", color: lv.fg },
});
