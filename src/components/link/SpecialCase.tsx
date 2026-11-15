// Special-case first screens for a link (PRD "special cases" table). The free wish stays reachable.
import type { ReactNode } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { DButton, DCard, Eyebrow, Sub } from "@/components/lv/passon/kit";
import type { FirstScreen } from "@/lib/linkApi.types";
import { lv, type } from "@/theme/tokens";

export type SpecialCaseProps = { screen: FirstScreen; onFreeWish: () => void };

function BoatCard({ screen }: { screen: FirstScreen }) {
  if (!screen.boat?.text) return null;
  return (
    <DCard testID="special-boat">
      <Eyebrow>{screen.boat.kind === "daily" ? "Today's boat" : `${screen.boat.creatorName}'s wish`}</Eyebrow>
      <Text style={styles.boat}>"{screen.boat.text}"</Text>
      <Text style={styles.meta}>
        {screen.ripples} hop{screen.ripples === 1 ? "" : "s"}
      </Text>
    </DCard>
  );
}

export function SpecialCase({ screen, onFreeWish }: SpecialCaseProps) {
  const router = useRouter();
  const cta = screen.freeWishAvailable ? (
    <DButton testID="special-free-wish" size="lg" title="Claim your free wish" onPress={onFreeWish} />
  ) : (
    <Sub>You've already used your free wish — push boats in the app to earn more.</Sub>
  );

  let title: string;
  let body: string | null = null;
  let extra: ReactNode = null;

  switch (screen.state) {
    case "claimed":
      title = "This boat already found its person";
      body = "Someone said \"it's me\" before you got here.";
      extra = screen.wishId ? (
        <DButton testID="special-ending" variant="glass" title="See how it ended" onPress={() => router.push(`/e/${screen.wishId}`)} />
      ) : null;
      break;
    case "expired":
      title = "This boat didn't make it to shore";
      body = "Boats drift for 48 hours. This one ran out of time.";
      break;
    case "handled": {
      const h = screen.handled;
      title = h?.action === "claim" ? "You said \"it's me\"" : "You pushed this boat on";
      const where = h?.lastCity ? ` It's now near ${h.lastCity}.` : "";
      body = h ? `It has drifted ${h.nowRipples} hop${h.nowRipples === 1 ? "" : "s"} so far.${where}` : null;
      break;
    }
    case "forwarded":
      title = `This boat was pushed to ${screen.holderName || "someone else"}`;
      body = "It's theirs to handle — but you can still make a wish of your own.";
      break;
    case "missing":
      return (
        <View style={{ gap: 14 }} testID="special-missing">
          <Text style={styles.h1}>We couldn't find this boat</Text>
          <Sub>The link may be incomplete. Ask the friend who sent it to share it again.</Sub>
        </View>
      );
    default:
      return null;
  }

  return (
    <View style={{ gap: 14 }} testID={`special-${screen.state}`}>
      {screen.senderName ? <Eyebrow>From {screen.senderName}</Eyebrow> : null}
      <Text style={styles.h1}>{title}</Text>
      {body ? <Sub>{body}</Sub> : null}
      <BoatCard screen={screen} />
      {extra}
      {screen.state === "handled" ? null : cta}
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { ...type.title1, color: lv.fg },
  boat: { ...type.body, color: lv.fg },
  meta: { ...type.footnote, color: lv.mutedFg },
});
