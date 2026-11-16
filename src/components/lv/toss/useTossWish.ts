import { useAction, useMutation } from "convex/react";
import { useRef, useState } from "react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { errorMessage } from "@/components/ui";
import { toE164 } from "@/lib/contactPick";
import type { ApiWishType } from "@/lib/lvWishTypes";
import { prefillPeople } from "@/lib/tossPeople";

import type { CoachPick } from "./CoachPanel";
import { emptyPerson, type Person } from "./RecipientCard";

export const MAX_PEOPLE = 3;
// Server error text (convex/lib.ts REASON_REQUIRED); shown inline under the card missing a reason.
export const REASON_REQUIRED = "Add one line on why you picked them";
// The contact field holds a phone (picked or typed) or an @handle; only a phone pre-fills SMS.
const smsRecipient = (contact?: string) => (contact && !contact.trim().startsWith("@") ? (toE164(contact) ?? undefined) : undefined);

export type TossLink = { hopId: Id<"hops">; name: string; message: string | null; phone?: string };

/**
 * The recipient + share half of tossing a wish, shared by the /toss screen and the pool's sheet:
 * 1–3 people (coach picks prefilled), the `wishes.toss` mutation, then per-person drafted links.
 */
export function useTossWish(deviceId: string | null | undefined) {
  const toss = useMutation(api.wishes.toss);
  const draftMessage = useAction(api.ai.draftPassMessage);
  const [people, setPeople] = useState<Person[]>([emptyPerson()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reasonMissing, setReasonMissing] = useState(false);
  const [links, setLinks] = useState<TossLink[]>([]);
  // Edited share text per hop, so "Text all" sends what the user sees in each card.
  const [edits, setEdits] = useState<Record<string, string>>({});
  const prefilled = useRef(false);

  const picked = people.filter((p) => p.name.trim());
  const firstTags = picked.map((p) => p.tags[0]);
  const sameCircle = picked.length >= 2 && firstTags.every((t) => t) && new Set(firstTags as string[]).size === 1;

  function onCoachPick(p: CoachPick) {
    setPeople((prev) => {
      const filled = prev.filter((x) => x.name.trim());
      if (filled.some((x) => x.name.trim().toLowerCase() === p.name.toLowerCase())) return prev;
      const next = { ...emptyPerson(), name: p.name, reason: p.why };
      const blank = prev.findIndex((x) => !x.name.trim());
      if (blank >= 0) return prev.map((x, i) => (i === blank ? { ...x, name: p.name, reason: x.reason || p.why } : x));
      return [...prev, next].slice(0, MAX_PEOPLE);
    });
  }

  // First coach answer only: drop its top picks into the slots (up to 3). Later answers are tap-to-add.
  function onCoachSuggestions(picks: CoachPick[]) {
    if (prefilled.current || !picks.length) return;
    prefilled.current = true;
    setPeople((prev) => prefillPeople(prev, picks, MAX_PEOPLE, emptyPerson));
  }

  const updatePerson = (i: number, np: Person) => setPeople((prev) => prev.map((x, j) => (j === i ? np : x)));
  const removePerson = (i: number) => setPeople((prev) => prev.filter((_, j) => j !== i));
  const addPerson = () => setPeople((prev) => [...prev, emptyPerson()]);
  const setEdit = (hopId: string, t: string) => setEdits((prev) => (prev[hopId] === t ? prev : { ...prev, [hopId]: t }));

  /** Calls `wishes.toss`; resolves true once the links exist. */
  async function submit(wish: { type: ApiWishType; text: string; name: string; city: string }): Promise<boolean> {
    if (!deviceId) return false;
    setBusy(true);
    setError(null);
    setReasonMissing(false);
    try {
      const recipients = picked.map((p) => ({
        name: p.name,
        reason: p.reason.trim() || undefined,
        contact: p.contact.trim() || undefined,
        tags: p.tags,
      }));
      const { hopIds } = await toss({ deviceId, ...wish, mode: "serious", recipients });
      const created = hopIds.map((hopId, i) => ({
        hopId,
        name: recipients[i].name,
        message: null as string | null,
        phone: picked[i].phone ?? smsRecipient(picked[i].contact),
      }));
      setLinks(created);
      created.forEach(({ hopId }) => {
        void draftMessage({ hopId })
          .then((message) => setLinks((prev) => prev.map((l) => (l.hopId === hopId ? { ...l, message } : l))))
          .catch(() => setLinks((prev) => prev.map((l) => (l.hopId === hopId ? { ...l, message: "" } : l))));
      });
      return true;
    } catch (e) {
      const msg = errorMessage(e);
      if (msg.includes(REASON_REQUIRED)) setReasonMissing(true);
      else setError(msg);
      return false;
    } finally {
      setBusy(false);
    }
  }

  const textAllTargets = links.map((l) => ({
    hopId: l.hopId,
    name: l.name,
    message: l.message === null ? null : edits[l.hopId] || l.message,
    to: l.phone,
  }));

  return {
    people,
    picked,
    sameCircle,
    busy,
    error,
    setError,
    reasonMissing,
    links,
    textAllTargets,
    onCoachPick,
    onCoachSuggestions,
    updatePerson,
    removePerson,
    addPerson,
    setEdit,
    submit,
  };
}
