import { useAuthActions } from "@convex-dev/auth/react";
import { useAction } from "convex/react";
import { ConvexError } from "convex/values";
import { useCallback } from "react";

import { api } from "@/convex/_generated/api";

/**
 * Phone number sign-in (API only, no screens). Two steps:
 *
 *   const { sendCode, verifyCode } = usePhoneAuth();
 *   const { phone } = await sendCode(phoneFromParts("+1", "555 555 0100"));
 *   await verifyCode(phone, "000000"); // signed in; AuthBridge runs linkDevice
 *
 * Requires EXPO_PUBLIC_AUTH_ENABLED=true (ConvexAuthProvider + AuthBridge).
 * Errors carry `ConvexError.data = { code, message, retryAfterMs? }`; show
 * `phoneAuthErrorMessage(e)` to the user.
 */

/** Stable error codes from the backend (convex/sms.ts). */
export type PhoneAuthErrorCode =
  | "INVALID_PHONE"
  | "INVALID_CODE"
  | "NOT_CONFIGURED"
  | "RATE_LIMITED"
  | "SEND_FAILED"
  | "VERIFY_FAILED";

export type PhoneAuthErrorData = { code: PhoneAuthErrorCode; message: string; retryAfterMs?: number };

/** Seconds before the UI offers "Resend code". */
export const RESEND_SECONDS = 30;

export { phoneFromParts } from "@/lib/phoneNumber";

export function phoneAuthErrorData(e: unknown): PhoneAuthErrorData | null {
  if (e instanceof ConvexError && typeof e.data === "object" && e.data !== null && "code" in e.data) {
    return e.data as PhoneAuthErrorData;
  }
  return null;
}

export function phoneAuthErrorMessage(e: unknown) {
  return phoneAuthErrorData(e)?.message ?? "Something went wrong. Try again.";
}

export function usePhoneAuth() {
  const { signIn } = useAuthActions();
  const send = useAction(api.phoneAuth.sendCode);

  /** Step 1. Returns the normalized E.164 number; pass it to verifyCode. */
  const sendCode = useCallback((phone: string) => send({ phone }), [send]);

  /** Step 2. Resolves once signed in; throws (e.g. INVALID_CODE) otherwise. */
  const verifyCode = useCallback(
    async (phone: string, code: string) => {
      const { signingIn } = await signIn("phone", { phone, code: code.trim() });
      if (!signingIn) throw new Error("Phone sign-in did not complete");
    },
    [signIn],
  );

  return { sendCode, verifyCode };
}
