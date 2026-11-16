// No-app link page: someone who got a paper boat link passes the boat on (or says "that's me") right on
// the first screen, sees which pass theirs was, then makes their own free wish, leaves a contact, and is
// pointed at the app. No login; the visitor is identified by device id.
import { useMutation, useQuery } from "convex/react";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text } from "react-native";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { CenterScreen } from "@/components/ios";
import { ClaimStep } from "@/components/link/ClaimStep";
import { ContactStep } from "@/components/link/ContactStep";
import { DoneStep } from "@/components/link/DoneStep";
import { FirstScreen } from "@/components/link/FirstScreen";
import { type Passed, PushStep } from "@/components/link/PushStep";
import { PassedCard } from "@/components/link/push/PassedCard";
import { Shell, nextStep, prevStep } from "@/components/link/Shell";
import { SpecialCase } from "@/components/link/SpecialCase";
import { WriteWish } from "@/components/link/WriteWish";
import { DButton, Eyebrow, Sub } from "@/components/lv/passon/kit";
import { MeetForWish } from "@/components/lv/meet/MeetCard";
import { useDeviceId } from "@/lib/device";
import type { FinishResult, FirstScreen as FirstScreenData, LinkEvent } from "@/lib/linkApi.types";
import { type LinkStep, clearDraft, loadDraft, saveDraft } from "@/lib/linkDraft";
import { lv, type } from "@/theme/tokens";

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
  const [passed, setPassed] = useState<Passed | null>(null);
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
        // "handle" is now only the claim form, opened from the first screen: never resume into it.
        setStep(d.step === "handle" ? "first" : d.step);
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
      <CenterScreen testID="link-loading">
        {header}
      </CenterScreen>
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
  const onBack = back ? () => setStep(back) : null;
  // This device handled the boat (now, or before a reload) and is on its way to its own wish.
  const handledHere = screen.state === "handled" && (step === "wish" || step === "handle");

  const special =
    (entryState ?? screen.state) !== "open" && !freeWishOnly && !handledHere && step !== "contact" && step !== "done";
  if (special) {
    return (
      <Shell step="first" testID="link-special">
        {header}
        <MeetForWish wishId={screen.wishId} deviceId={deviceId} />
        <SpecialCase
          screen={screen}
          onFreeWish={() => {
            setFreeWishOnly(true);
            setStep(nextStep("first", { freeWishAvailable: screen.freeWishAvailable, freeWishOnly: true }));
          }}
        />
      </Shell>
    );
  }

  return (
    <Shell step={step} onBack={onBack} testID="link-page">
      {header}
      {step === "first" ? <MeetForWish wishId={screen.wishId} deviceId={deviceId} /> : null}
      {step === "first" ? (
        <FirstScreen screen={screen}>
          <PushStep
            hopId={hopId}
            deviceId={deviceId}
            wishText={screen.boat.text}
            onPassed={(p) => {
              setPassed(p);
              go("first");
            }}
          />
          <DButton
            title={screen.boat.kind === "daily" ? "That's me" : `It's me. I'm who ${screen.boat.creatorName} is looking for`}
            variant="plain"
            onPress={() => setStep("handle")}
            testID="link-thats-me"
          />
          {!screen.freeWishAvailable ? (
            <Sub style={styles.footnote}>{"You've used your free wish. Helping still moves you toward the next one."}</Sub>
          ) : null}
        </FirstScreen>
      ) : null}

      {step === "handle" ? (
        <ClaimStep hopId={hopId} wishId={screen.wishId} deviceId={deviceId} kind={screen.boat.kind} onDone={() => go("handle")} />
      ) : null}

      {step === "wish" && !freeWishOnly && screen.handled?.action !== "claim" ? (
        <PassedCard screen={screen} passed={passed} />
      ) : null}
      {step === "wish" ? (
        <WriteWish
          deviceId={deviceId}
          text={wishText}
          onChangeText={setWishText}
          eyebrow={freeWishOnly ? undefined : "Your turn"}
          title={freeWishOnly ? undefined : "You can make a wish too. Let's make it happen."}
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
        <DoneStep result={result} boatWishId={screen.wishId} wishText={skipped || !wishText.trim() ? null : wishText.trim()} />
      ) : null}
    </Shell>
  );
}

const styles = StyleSheet.create({
  h1: { ...type.title1, color: lv.fg },
  footnote: { ...type.footnote, textAlign: "center" },
});
