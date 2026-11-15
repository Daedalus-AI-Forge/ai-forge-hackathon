import type { PickedContact } from "./ContactPickButton";

/** Web has no Contacts access: no suggestions, the name field works as before. */
export function ContactSuggestions(_props: { query: string; focused: boolean; onPick: (c: PickedContact) => void; testID?: string }) {
  return null;
}
