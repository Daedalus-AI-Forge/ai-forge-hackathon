/**
 * Join the sign-in form's country code ("+1", "1", "+44") and number into
 * "+<digits>" for `phoneAuth.sendCode`. A number that already starts with "+"
 * (iOS AutoFill or a paste of a full international number) is used as is, so
 * its country code is not prefixed twice.
 */
export function phoneFromParts(countryCode: string, number: string) {
  const national = number.replace(/\D/g, "");
  if (number.trim().startsWith("+")) return `+${national}`;
  return `+${countryCode.replace(/\D/g, "")}${national}`;
}
