// Screen 5: "Your wish set sail" + prophecy + boat progress + a non-blocking "Get the app".
import { useAction } from "convex/react";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import { Eyebrow, Glass, Sub } from "@/components/lv/passon/kit";
import type { FinishResult } from "@/lib/linkApi.types";
import { useDeviceId } from "@/lib/device";
import { lv } from "@/theme/tokens";
import { GetTheApp } from "./end/GetTheApp";
import { PROPHECY_FALLBACK, doneTitle, progressDots, pushMoreLine, withFallback } from "./end/logic";

export type DoneStepProps = { result: FinishResult; wishText: string | null };

export function DoneStep({ result, wishText }: DoneStepProps) {
  const prophecyAction = useAction(api.linkAi.prophecy);
  const deviceId = useDeviceId();
  const sailed = doneTitle(wishText, result) === "Your wish set sail";
  const [prophecy, setProphecy] = useState<string | null>(null);

  useEffect(() => {
    if (!sailed || !wishText) return;
    let cancelled = false;
    void withFallback(prophecyAction({ wishText }), PROPHECY_FALLBACK).then((p) => {
      if (!cancelled) setProphecy(p?.trim() || PROPHECY_FALLBACK);
    });
    return () => {
      cancelled = true;
    };
  }, [sailed, wishText, prophecyAction]);

  return (
    <View style={{ gap: 16 }} testID="done-step">
      <Eyebrow>{sailed ? "Done" : "Boat handled"}</Eyebrow>
      <Text testID="done-title" style={{ fontSize: 30, fontWeight: "700", color: lv.fg }}>
        {sailed ? "⛵ Your wish set sail" : "Thanks for helping"}
      </Text>
      {sailed && wishText ? <Sub>"{wishText}"</Sub> : null}
      {result.freeWishUsed ? <Sub>You already used your free wish — this boat still counts toward your next one.</Sub> : null}
      {sailed ? (
        <Glass testID="done-prophecy">
          <Eyebrow>Prophecy</Eyebrow>
          <Text style={{ fontSize: 17, fontStyle: "italic", color: lv.fg, lineHeight: 24 }}>{prophecy ?? "Reading the tide…"}</Text>
        </Glass>
      ) : null}
      <Glass testID="done-progress">
        <Text accessibilityLabel={`${result.boatProgress} of ${result.boatsPerCoin} boats`} style={{ fontSize: 26, letterSpacing: 6, color: lv.thread }}>
          {progressDots(result.boatProgress, result.boatsPerCoin)}
        </Text>
        <Text style={{ fontSize: 15, color: lv.fg, fontWeight: "600" }}>{pushMoreLine(result.boatProgress, result.boatsPerCoin)}</Text>
        {result.wishesLeft > 0 ? <Sub>You have {result.wishesLeft} wish{result.wishesLeft === 1 ? "" : "es"} ready.</Sub> : null}
      </Glass>
      <Sub>We'll text or email you when it lands.</Sub>
      <GetTheApp deviceId={deviceId} />
    </View>
  );
}
