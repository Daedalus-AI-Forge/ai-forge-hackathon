// First-screen pass-on card: name (+ phone on the web; Contacts picker where the platform has one), then a tappable reason the AI suggests
// (or "Something else"), then one button that pushes the boat and opens Messages with the text ready.
// The picked reason is the vouch the next person sees, so there is nothing else to write.
import { useAction, useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Platform, StyleSheet, Text } from "react-native";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { DButton, DCard, DChips, DError, DField, Eyebrow, Sub } from "@/components/lv/passon/kit";
import { ContactPickButton } from "@/components/ContactPickButton";
import { ContactSuggestions } from "@/components/ContactSuggestions";
import { phoneTail, smsHref, toE164 } from "@/lib/contactPick";
import { copyLink } from "@/lib/links";
import { lv, type } from "@/theme/tokens";

import { cleanError } from "./claim/errors";
import { fallbackShareMessage, ogShareUrl, withTimeout } from "./push/shareCopy";

export type Passed = { childHopId: string; name: string; reason: string };
export type PushStepProps = { hopId: string; deviceId: string; wishText: string; onPassed: (p: Passed) => void };

const OTHER = "Something else";
const FALLBACK_REASONS = ["Is into this kind of thing", "Knows a lot of people", "Would love to help"];
const AI_TIMEOUT_MS = 3000;

function isAndroid() {
  return Platform.OS === "android" || (typeof navigator !== "undefined" && /android/i.test(navigator.userAgent ?? ""));
}

/** Phones can open `sms:`; a desktop browser cannot, so there we copy the message instead. */
function canText() {
  if (Platform.OS !== "web") return true;
  return typeof navigator !== "undefined" && /iphone|ipad|ipod|android/i.test(navigator.userAgent ?? "");
}

export function PushStep({ hopId, deviceId, wishText, onPassed }: PushStepProps) {
  const hop = hopId as Id<"hops">;
  const memoryPrompt = useAction(api.linkAi.memoryPrompt);
  const passReasons = useAction(api.linkAi.passReasons);
  const pushOne = useMutation(api.link.pushOne);
  const track = useMutation(api.linkMetrics.track);

  const [hint, setHint] = useState<string | null>(null);
  const [reasons, setReasons] = useState<string[] | null>(null);
  const [name, setName] = useState("");
  // Picked from Contacts (native), kept in state only: pre-fills the Messages recipient.
  const [phone, setPhone] = useState<string | null>(null);
  // Web: the number as typed, AutoFilled, or picked (Contact Picker API). State only: it becomes the
  // `sms:` recipient and is never sent to the server.
  const [phoneInput, setPhoneInput] = useState("");
  const [nameFocused, setNameFocused] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [custom, setCustom] = useState("");
  const [pushing, setPushing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    withTimeout(memoryPrompt({ hopId: hop }), AI_TIMEOUT_MS)
      .then((h) => live && setHint(h))
      .catch(() => live && setHint("Who do you know who might fit?"));
    // The first suggestion starts selected, so a name plus one tap is enough.
    const use = (r: string[]) => {
      if (!live) return;
      setReasons(r);
      setPicked((p) => p ?? r[0] ?? OTHER);
    };
    withTimeout(passReasons({ hopId: hop }), AI_TIMEOUT_MS)
      .then((r) => use(r.length > 0 ? r : FALLBACK_REASONS))
      .catch(() => use(FALLBACK_REASONS));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hopId]);

  const first = name.trim().split(/\s+/)[0] ?? "";
  const reason = picked === OTHER ? custom.trim() : (picked ?? "");
  const text = canText();
  const web = Platform.OS === "web";
  const recipient = web ? toE164(phoneInput) : phone;

  async function onPass() {
    const to = name.trim();
    if (!to) return setError("Add their name first.");
    if (!reason) return setError(picked === OTHER ? "Add your reason in a few words." : "Pick a reason, or add your own.");
    setError(null);
    setPushing(true);
    let childHopId: string;
    try {
      const res = await pushOne({ hopId: hop, deviceId, name: to, relation: "", reason, vouch: reason });
      childHopId = res.childHopId;
    } catch (e) {
      setError(cleanError(e));
      setPushing(false);
      return;
    }
    const webOrigin = Platform.OS === "web" && typeof window !== "undefined" ? window.location.origin : null;
    const url = ogShareUrl(childHopId, process.env.EXPO_PUBLIC_CONVEX_SITE_URL, webOrigin);
    const body = `${fallbackShareMessage(first || to, reason, wishText)}\n${url}`;
    // We only prepare the draft: the visitor reviews it in Messages and taps Send themselves.
    // If Messages can't open (or this is a desktop browser), the next screen keeps the message one tap away.
    try {
      if (text) await Linking.openURL(smsHref(body, recipient ?? undefined, isAndroid() ? "android" : "ios"));
      else await copyLink(body);
    } catch {
      // Handled on the next screen ("Didn't send it?").
    }
    void track({ hopId: hop, deviceId, event: "push" }).catch(() => {});
    setPushing(false);
    onPassed({ childHopId, name: first || to, reason });
  }

  return (
    <DCard testID="push-step">
      <Eyebrow>Who should get this boat next?</Eyebrow>
      {hint ? <Text style={styles.hint}>{hint}</Text> : <ActivityIndicator color={lv.tint} />}

      <DField
        label="Their name"
        value={name}
        onChangeText={(t) => {
          setName(t);
          setPhone(null);
          setError(null);
        }}
        placeholder="Maya"
        maxLength={60}
        testID="push-name"
        {...(web ? { autoComplete: "name" as const } : null)}
        onFocus={() => setNameFocused(true)}
        onBlur={() => setNameFocused(false)}
      />
      <ContactSuggestions
        testID="contact-suggest-push"
        query={name}
        focused={nameFocused}
        onPick={({ name: n, phone: p }) => {
          setName(n);
          setPhone(p);
        }}
      />
      {web ? (
        <DField
          label="Their phone (optional)"
          value={phoneInput}
          onChangeText={setPhoneInput}
          placeholder="So Messages opens to them"
          maxLength={24}
          keyboardType="phone-pad"
          inputMode="tel"
          autoComplete="tel"
          textContentType="telephoneNumber"
          testID="push-phone"
        />
      ) : null}
      <ContactPickButton
        testID="contact-pick-push"
        onPick={({ name: n, phone: p }) => {
          if (n) setName(n);
          setPhone(p);
          if (web) setPhoneInput(p ?? "");
        }}
      />
      {!web && phone ? <Sub>Texting the number ending in {phoneTail(phone)}.</Sub> : null}

      {reasons ? (
        <DChips
          label={first ? `Why ${first}?` : "Why them?"}
          options={[...reasons, OTHER]}
          value={picked}
          onChange={(r) => {
            setPicked(r);
            setError(null);
          }}
          testIDPrefix="push-reason"
        />
      ) : (
        <ActivityIndicator color={lv.tint} />
      )}
      {picked === OTHER ? (
        <DField
          value={custom}
          onChangeText={(t) => {
            setCustom(t);
            setError(null);
          }}
          placeholder="Your reason, in a few words"
          maxLength={140}
          autoFocus
          testID="push-reason-other"
          accessibilityLabel="Your own reason"
        />
      ) : null}
      {first && reason ? (
        <Sub>
          {first} will see “You about {first}: {reason}”
        </Sub>
      ) : null}

      <DError error={error} />
      <DButton
        title={text ? (first ? `Pass it on to ${first} in Messages` : "Pass it on in Messages") : first ? `Pass it on to ${first}` : "Pass it on"}
        size="lg"
        onPress={onPass}
        busy={pushing}
        testID="push-submit"
      />
      <Sub style={styles.note}>
        {!text
          ? "We copy the message and link for you to paste."
          : recipient
            ? "Messages opens to them with the text ready. You tap Send."
            : "Messages opens with the text ready. Choose who gets it, then tap Send."}
      </Sub>
    </DCard>
  );
}

const styles = StyleSheet.create({
  hint: { ...type.body, lineHeight: 24, color: lv.mutedFg, fontStyle: "italic" },
  note: { ...type.footnote, textAlign: "center" },
});
