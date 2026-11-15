import { phoneFromParts } from "./phoneNumber";

/** A phone entry as the Contacts picker returns it (label may be iOS-style "_$!<Mobile>!$_"). */
export type PickedPhone = { label?: string; number?: string };

const MOBILE = /mobile|iphone|cell/i;
const hasDigits = (n?: string): n is string => !!n && /\d/.test(n);

/** Pick one entry: a mobile/iPhone/cell label first, else the first number with digits. */
export function choosePhoneEntry(phones: PickedPhone[] | undefined | null): (PickedPhone & { number: string }) | null {
  const usable = (phones ?? []).filter((p): p is PickedPhone & { number: string } => hasDigits(p.number));
  return usable.find((p) => MOBILE.test(p.label ?? "")) ?? usable[0] ?? null;
}

/** Pick one number: a mobile/iPhone/cell label first, else the first number with digits. */
export function choosePhone(phones: PickedPhone[] | undefined | null): string | null {
  return choosePhoneEntry(phones)?.number ?? null;
}

/** A Contacts label as people read it: iOS "_$!<Mobile>!$_" -> "mobile"; empty -> "phone". */
export function phoneLabel(label?: string): string {
  const clean = (label ?? "").replace(/^_\$!<|>!\$_$/g, "").trim().toLowerCase();
  return clean || "phone";
}

/** One name-field suggestion. Lives in component state only; never sent to the backend. */
export type ContactSuggestion = { key: string; name: string; phone: string; label: string };

/**
 * Turn Contacts query results into at most `max` suggestions: only contacts with a usable phone,
 * one chip per person+number. The query itself is a name prefix; we don't re-filter here.
 */
export function toSuggestions(
  contacts: { fullName?: string | null; phones?: PickedPhone[] | null }[],
  max = 3,
  defaultCountry = "1",
): ContactSuggestion[] {
  const out: ContactSuggestion[] = [];
  for (const c of contacts) {
    const name = (c.fullName ?? "").trim();
    const entry = choosePhoneEntry(c.phones);
    const phone = entry ? toE164(entry.number, defaultCountry) : null;
    if (!name || !phone) continue;
    const key = `${name}|${phone}`;
    if (out.some((s) => s.key === key)) continue;
    out.push({ key, name, phone, label: phoneLabel(entry?.label) });
    if (out.length >= max) break;
  }
  return out;
}

/** Last four digits for a "texting ••0100" hint, so the full number is never shown on screen. */
export function phoneTail(phone: string): string {
  return phone.replace(/\D/g, "").slice(-4);
}

/**
 * Normalize a contact's number to E.164. A number without "+" or "00" is national for
 * `defaultCountry` (default +1); an 11-digit "1…" number in +1 is not prefixed twice.
 */
export function toE164(raw: string, defaultCountry = "1"): string | null {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7) return null;
  if (trimmed.startsWith("00")) return `+${digits.slice(2)}`;
  if (!trimmed.startsWith("+") && defaultCountry === "1" && digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  return phoneFromParts(defaultCountry, trimmed);
}

/** `sms:` URL with an optional pre-filled recipient. iOS wants `&body=`, Android `?body=`. */
export function smsHref(body: string, to: string | undefined, os: "ios" | "android") {
  const recipient = to?.trim() ?? "";
  return `sms:${recipient}${os === "ios" ? "&" : "?"}body=${encodeURIComponent(body)}`;
}
