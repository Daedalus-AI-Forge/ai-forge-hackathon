// Screen 4: leave a phone number or email (required) so we can tell the visitor when their wish lands.
import { useMutation } from "convex/react";
import { useState } from "react";
import { Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { errorMessage } from "@/components/ui";
import { DButton, DChips, DError, DField, Eyebrow, Glass, Sub } from "@/components/lv/passon/kit";
import type { FinishResult } from "@/lib/linkApi.types";
import { lv } from "@/theme/tokens";
import { CONTACT_REQUIRED, type ContactKind, validateContact } from "./end/logic";

export type ContactStepProps = { hopId: string; deviceId: string; wishText: string | null; onDone: (r: FinishResult) => void };

export function ContactStep({ hopId, deviceId, wishText, onDone }: ContactStepProps) {
  const finish = useMutation(api.link.finish);
  const track = useMutation(api.linkMetrics.track);
  const [kind, setKind] = useState<ContactKind>("phone");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const v = validateContact(kind, value);
    if (!v.ok) return setError(v.error);
    setError(null);
    setBusy(true);
    try {
      const result: FinishResult = await finish({
        hopId: hopId as Id<"hops">,
        deviceId,
        contact: v.value,
        ...(wishText ? { wishText } : {}),
      });
      void track({ hopId: hopId as Id<"hops">, deviceId, event: "contact", wroteWish: !!wishText }).catch(() => {});
      onDone(result);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 14 }} testID="contact-step">
      <Eyebrow>Almost there</Eyebrow>
      <Text style={{ fontSize: 26, fontWeight: "700", color: lv.fg }}>Where should we tell you?</Text>
      <Sub>{CONTACT_REQUIRED}.</Sub>
      <Glass>
        <DChips
          testIDPrefix="contact-kind"
          options={["Phone", "Email"]}
          value={kind === "phone" ? "Phone" : "Email"}
          onChange={(o: string) => {
            setKind(o === "Email" ? "email" : "phone");
            setError(null);
          }}
        />
        <DField
          testID="contact-input"
          label={kind === "phone" ? "Phone number" : "Email"}
          placeholder={kind === "phone" ? "+1 415 555 0100" : "you@example.com"}
          value={value}
          onChangeText={(t) => {
            setValue(t);
            if (error) setError(null);
          }}
          keyboardType={kind === "phone" ? "phone-pad" : "email-address"}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={kind === "phone" ? "tel" : "email"}
          onSubmitEditing={submit}
        />
        <DError error={error} />
        <DButton testID="contact-submit" size="lg" title="Set my wish sailing" onPress={submit} busy={busy} disabled={!value.trim()} />
        <Text style={{ fontSize: 12, color: lv.mutedFg }}>We only use this to tell you when your boat or wish lands. No spam.</Text>
      </Glass>
    </View>
  );
}
