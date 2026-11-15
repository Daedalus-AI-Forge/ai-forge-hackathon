import { phoneFromParts } from "./phoneNumber";

/** A phone entry as the Contacts picker returns it (label may be iOS-style "_$!<Mobile>!$_"). */
export type PickedPhone = { label?: string; number?: string };

const MOBILE = /mobile|iphone|cell/i;
const hasDigits = (n?: string): n is string => !!n && /\d/.test(n);

/** Pick one number: a mobile/iPhone/cell label first, else the first number with digits. */
export function choosePhone(phones: PickedPhone[]): string | null {
  const usable = phones.filter((p) => hasDigits(p.number));
  const mobile = usable.find((p) => MOBILE.test(p.label ?? ""));
  return (mobile ?? usable[0])?.number ?? null;
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
