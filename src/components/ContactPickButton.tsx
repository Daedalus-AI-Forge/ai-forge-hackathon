import { Contact, ContactField, getPermissionsAsync, requestPermissionsAsync } from "expo-contacts";
import { useState } from "react";
import { StyleSheet, Text } from "react-native";

import { DButton } from "@/components/lv/passon/kit";
import { choosePhone, toE164 } from "@/lib/contactPick";
import { lv, type } from "@/theme/tokens";

export type PickedContact = { name: string; phone: string | null };

async function readPicked(c: Contact): Promise<PickedContact> {
  const [name, phones] = await Promise.all([c.getFullName(), c.getPhones()]);
  const raw = choosePhone(phones);
  return { name: name.trim(), phone: raw ? toE164(raw) : null };
}

/**
 * The SDK 58 picker hands back only the contact id; name and phones are re-read from the store.
 * If that read comes back without a phone, make sure we may read Contacts (ask in context), then
 * re-read the phones by id once. Returns null when there is still no usable number.
 */
async function rereadPhone(c: Contact): Promise<string | null> {
  const perm = await getPermissionsAsync();
  if (!perm.granted) {
    if (!perm.canAskAgain) return null;
    const { granted } = await requestPermissionsAsync();
    if (!granted) return null;
  }
  const details = await c.getDetails([ContactField.PHONES]);
  const raw = choosePhone(details.phones);
  return raw ? toE164(raw) : null;
}

/**
 * "Pick from contacts": opens the system contact picker (iOS CNContactPickerViewController,
 * which needs no Contacts permission) and returns only the picked name + one phone. Nothing is
 * uploaded; the caller keeps it in state. If reading the picked contact needs permission on this
 * OS, we ask then, in context, and treat a denial as "type it yourself".
 * Native only: ContactPickButton.web.tsx renders nothing (no Contacts Picker API in iOS Safari).
 */
export function ContactPickButton({ onPick, testID = "contact-pick" }: { onPick: (c: PickedContact) => void; testID?: string }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function onPress() {
    setBusy(true);
    setNote(null);
    try {
      const c = await Contact.presentPicker();
      if (!c) return;
      let picked: PickedContact;
      try {
        picked = await readPicked(c);
      } catch {
        const { granted } = await requestPermissionsAsync();
        if (!granted) {
          setNote("No Contacts access — type their name instead.");
          return;
        }
        picked = await readPicked(c);
      }
      if (!picked.phone) picked = { ...picked, phone: await rereadPhone(c).catch(() => null) };
      onPick(picked);
      if (!picked.phone) setNote("No phone number on that contact — you can pick the recipient in Messages.");
    } catch {
      setNote("Couldn't open Contacts — type their name instead.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DButton title="Pick from contacts" icon="contact" variant="ghost" size="sm" busy={busy} onPress={onPress} testID={testID} />
      {note ? (
        <Text style={s.note} testID={`${testID}-note`}>
          {note}
        </Text>
      ) : null}
    </>
  );
}

const s = StyleSheet.create({ note: { ...type.footnote, color: lv.mutedFg, paddingHorizontal: 4 } });
