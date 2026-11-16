import { v } from "convex/values";

import { action } from "./_generated/server";
import { limitSend } from "./phoneLimits";
import { maskPhone, normalizePhone, sendCode as sendSmsCode, smsModeFor } from "./sms";

/** How long the client should wait before offering "Resend code". */
export const RESEND_AFTER_MS = 30_000;

/**
 * Step 1 of phone sign-in: send a one-time code to `phone` (any format with a
 * country code). Returns the normalized E.164 number to pass to step 2.
 *
 * Step 2 is `signIn("phone", { phone, code })` (convex/phoneProvider.ts).
 * Sending is a separate action, not `signIn("phone", { phone })`, because a
 * Convex Auth 0.0.98 credentials provider can only return a session or
 * `null`, and `null` makes the client drop its current (anonymous) session.
 *
 * Errors: `ConvexError<{ code, message, retryAfterMs? }>` with code
 * INVALID_PHONE | NOT_CONFIGURED | RATE_LIMITED | SEND_FAILED.
 */
export const sendCode = action({
  args: { phone: v.string() },
  returns: v.object({ phone: v.string(), resendAfterMs: v.number() }),
  handler: async (ctx, args) => {
    const phone = normalizePhone(args.phone);
    smsModeFor(phone); // NOT_CONFIGURED before any rate limit is spent.
    const { mode } = await limitSend(ctx, phone, () => sendSmsCode(phone));
    console.log(JSON.stringify({ event: "phone_auth.code_sent", phone: maskPhone(phone), mode }));
    return { phone, resendAfterMs: RESEND_AFTER_MS };
  },
});
