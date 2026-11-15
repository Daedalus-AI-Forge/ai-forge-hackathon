import { Contact, ContactField, getPermissionsAsync, requestPermissionsAsync } from "expo-contacts";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { PickedContact } from "@/components/ContactPickButton";
import { toSuggestions, type ContactSuggestion } from "@/lib/contactPick";
import { lv, type } from "@/theme/tokens";

const MIN_CHARS = 2;
const FIELDS = [ContactField.FULL_NAME, ContactField.PHONES] as const;

// Once per app session: the in-context ask is offered at most once, and a "no" (here or in the
// system prompt) means no suggestions and no further asking.
type Access = "unknown" | "ask" | "granted" | "off";
let sessionAccess: Access = "unknown";

/**
 * Name-field typeahead from the phone's Contacts (native only; the .web file renders nothing).
 * After the field is first focused we check permission; if it was never asked we show one short
 * in-context line with "Allow". With access, ≥2 typed chars query Contacts by name and show up to
 * 3 chips ("Louise Chen · mobile"); tapping one fills name + phone in the caller's state.
 * Nothing is uploaded.
 */
export function ContactSuggestions({
  query,
  focused,
  onPick,
  testID = "contact-suggest",
}: {
  query: string;
  focused: boolean;
  onPick: (c: PickedContact) => void;
  testID?: string;
}) {
  const [access, setAccess] = useState<Access>(sessionAccess);
  const [items, setItems] = useState<ContactSuggestion[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);

  const update = (a: Access) => {
    sessionAccess = a;
    setAccess(a);
  };

  useEffect(() => {
    if (!focused || access !== "unknown") return;
    getPermissionsAsync()
      .then((p) => update(p.granted ? "granted" : p.canAskAgain ? "ask" : "off"))
      .catch(() => update("off"));
  }, [focused, access]);

  const q = query.trim();
  const active = access === "granted" && q.length >= MIN_CHARS && q !== chosen;
  useEffect(() => {
    if (!active) return;
    let live = true;
    const t = setTimeout(() => {
      Contact.getAllDetails(FIELDS, { name: q, limit: 5 })
        .then((rows) => live && setItems(toSuggestions(rows)))
        .catch(() => live && setItems([]));
    }, 150);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [active, q]);

  if (access === "ask" && focused) {
    return (
      <View style={s.ask} testID={`${testID}-ask`}>
        <Text style={s.askText}>Suggest names from your Contacts? They stay on this phone.</Text>
        <View style={s.row}>
          <Pressable
            testID={`${testID}-allow`}
            style={[s.chip, s.allow]}
            onPress={() =>
              requestPermissionsAsync()
                .then((p) => update(p.granted ? "granted" : "off"))
                .catch(() => update("off"))
            }
          >
            <Text style={[s.chipText, s.allowText]}>Allow</Text>
          </Pressable>
          <Pressable testID={`${testID}-no`} style={s.plain} onPress={() => update("off")}>
            <Text style={s.plainText}>Not now</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!active || !items.length) return null;
  return (
    <View style={s.row} testID={testID}>
      {items.map((it, i) => (
        <Pressable
          key={it.key}
          testID={`${testID}-${i}`}
          style={s.chip}
          accessibilityRole="button"
          accessibilityLabel={`Use ${it.name}, ${it.label}`}
          onPress={() => {
            setChosen(it.name);
            setItems([]);
            onPick({ name: it.name, phone: it.phone });
          }}
        >
          <Text style={s.chipText} numberOfLines={1}>
            {it.name} · {it.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  chip: { minHeight: 34, justifyContent: "center", paddingHorizontal: 14, borderRadius: 999, backgroundColor: lv.fill, maxWidth: "100%" },
  chipText: { ...type.subheadline, fontWeight: "500", color: lv.fg },
  allow: { backgroundColor: lv.threadTint },
  allowText: { color: lv.thread, fontWeight: "600" },
  ask: { gap: 8 },
  askText: { ...type.footnote, color: lv.mutedFg, paddingHorizontal: 4 },
  plain: { paddingHorizontal: 8, minHeight: 34, justifyContent: "center" },
  plainText: { ...type.subheadline, color: lv.mutedFg },
});
