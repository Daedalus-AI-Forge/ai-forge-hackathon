import type { PickedContact } from "./ContactPickButton";

export type { PickedContact };

/** Web (incl. iOS Safari) has no Contacts Picker API: render nothing, the name field still works. */
export function ContactPickButton(_props: { onPick: (c: PickedContact) => void; testID?: string }) {
  return null;
}
