import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ContactPickButton } from "@/components/ContactPickButton";
import { ContactSuggestions } from "@/components/ContactSuggestions";
import { Icon } from "@/components/ios";
import { lv, type } from "@/theme/tokens";

import { LvAvatar, LvCard, LvField } from "./parts";

export const TAGS = ["music", "travel", "food", "sports", "tech", "outdoors", "art", "knows everyone"] as const;

/**
 * `phone` is the number picked from Contacts. It stays on this device (state only, never sent to
 * the backend) and only pre-fills the SMS recipient on the share step.
 */
export type Person = { name: string; reason: string; contact: string; tags: string[]; phone?: string };
export const emptyPerson = (): Person => ({ name: "", reason: "", contact: "", tags: [] });

export function RecipientCard({
  index,
  person,
  onChange,
  onRemove,
  reasonError,
}: {
  index: number;
  person: Person;
  onChange: (p: Person) => void;
  onRemove?: () => void;
  reasonError: string | null;
}) {
  const [nameFocused, setNameFocused] = useState(false);
  const toggle = (tag: string) =>
    onChange({
      ...person,
      tags: person.tags.includes(tag) ? person.tags.filter((t) => t !== tag) : [...person.tags, tag].slice(-3),
    });
  return (
    <LvCard testID={`toss-person-card-${index}`}>
      <View style={s.head}>
        <LvAvatar name={person.name || String(index + 1)} size={40} />
        <View style={{ flex: 1 }}>
          <LvField
            testID={`toss-person-${index}`}
            value={person.name}
            placeholder="Their name"
            onChangeText={(name) => onChange({ ...person, name })}
            onFocus={() => setNameFocused(true)}
            onBlur={() => setNameFocused(false)}
          />
        </View>
        {onRemove ? (
          <Pressable
            testID={`toss-remove-person-${index}`}
            accessibilityRole="button"
            accessibilityLabel="Remove"
            onPress={onRemove}
            hitSlop={10}
            style={({ pressed }) => [s.remove, pressed && { opacity: 0.6 }]}
          >
            <Icon name="close" size={12} color={lv.mutedFg} weight="bold" />
          </Pressable>
        ) : null}
      </View>
      <ContactSuggestions
        testID={`contact-suggest-toss-${index}`}
        query={person.name}
        focused={nameFocused}
        onPick={({ name, phone }) => onChange({ ...person, name, phone: phone ?? undefined })}
      />
      <ContactPickButton
        testID={`contact-pick-toss-${index}`}
        onPick={({ name, phone }) => onChange({ ...person, name: name || person.name, phone: phone ?? undefined })}
      />
      <LvField
        testID={`toss-reason-${index}`}
        value={person.reason}
        placeholder="Why them? One line"
        onChangeText={(reason) => onChange({ ...person, reason })}
      />
      {reasonError ? (
        <Text testID={`toss-reason-error-${index}`} style={s.err}>
          {reasonError}
        </Text>
      ) : null}
      <LvField
        testID={`toss-contact-${index}`}
        value={person.contact}
        placeholder="Phone or @handle (optional)"
        autoCapitalize="none"
        onChangeText={(contact) => onChange({ ...person, contact })}
      />
      <View style={s.tags}>
        {TAGS.map((tag) => {
          const on = person.tags.includes(tag);
          return (
            <Pressable
              key={tag}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => toggle(tag)}
              style={[s.tag, on && s.tagOn]}
            >
              <Text style={[s.tagText, on && { color: lv.primaryFg }]}>{tag}</Text>
            </Pressable>
          );
        })}
      </View>
    </LvCard>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  remove: { width: 30, height: 30, borderRadius: 15, backgroundColor: lv.fill, alignItems: "center", justifyContent: "center" },
  err: { ...type.footnote, color: lv.thread, marginTop: -4, paddingHorizontal: 4 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: { minHeight: 34, justifyContent: "center", paddingHorizontal: 14, borderRadius: 999, backgroundColor: lv.fill },
  tagOn: { backgroundColor: lv.primary },
  tagText: { ...type.subheadline, fontWeight: "500", color: lv.fg },
});
