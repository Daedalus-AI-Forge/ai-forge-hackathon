import { useState } from "react";
import { StyleSheet, Text } from "react-native";

import { DButton } from "@/components/lv/passon/kit";
import { type WebPickerContact, fromWebPicker } from "@/lib/contactPick";
import { lv, type } from "@/theme/tokens";

import type { PickedContact } from "./ContactPickButton";

export type { PickedContact };

type ContactsManager = {
  select: (props: string[], opts: { multiple: boolean }) => Promise<WebPickerContact[]>;
};

function contactsManager(): ContactsManager | null {
  if (typeof navigator === "undefined" || typeof window === "undefined") return null;
  if (!("contacts" in navigator) || !("ContactsManager" in window)) return null;
  return (navigator as unknown as { contacts: ContactsManager }).contacts;
}

/**
 * Web "Pick from contacts" via the W3C Contact Picker API (Android Chrome; iOS Safari only when
 * the user turned it on in Settings > Safari > Advanced). The browser shows its own picker and
 * hands back only the one contact chosen; nothing is uploaded, the caller keeps it in state.
 * Renders nothing where the API is missing; the phone field (with AutoFill) still works there.
 */
export function ContactPickButton({ onPick, testID = "contact-pick" }: { onPick: (c: PickedContact) => void; testID?: string }) {
  // The web build is a client-only SPA (web.output "single"), so detecting on first render is safe.
  const [manager] = useState<ContactsManager | null>(contactsManager);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  if (!manager) return null;

  async function onPress() {
    if (!manager) return;
    setBusy(true);
    setNote(null);
    try {
      const picked = fromWebPicker(await manager.select(["name", "tel"], { multiple: false }));
      if (!picked) return;
      onPick(picked);
      if (!picked.phone) setNote("That contact has no phone number. Type it in instead.");
    } catch {
      setNote("Couldn't open your contacts. Type their name and number instead.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DButton title="Pick from contacts" icon="contact" variant="ghost" size="sm" busy={busy} onPress={onPress} testID={testID} />
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </>
  );
}

const styles = StyleSheet.create({
  note: { ...type.footnote, color: lv.mutedFg, textAlign: "center" },
});
