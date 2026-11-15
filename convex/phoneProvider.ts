import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { createAccount } from "@convex-dev/auth/server";

import type { DataModel, Doc } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import { limitVerify } from "./phoneLimits";
import { checkCode, maskPhone, normalizePhone, phoneAuthError } from "./sms";

type AuthProfile = Omit<Doc<"users">, "_id" | "_creationTime">;

const CODE_PATTERN = /^\d{4,10}$/;

/**
 * Step 2 of phone sign-in: `signIn("phone", { phone, code })`.
 * (Step 1, sending the code, is the `phoneAuth.sendCode` action.)
 *
 * Checks the code (demo or Twilio Verify, see convex/sms.ts), then finds or
 * creates the account keyed by the E.164 number (account id = phone), so the
 * same number always signs in to the same user. A wrong code throws
 * INVALID_CODE instead of returning null, because null would clear the
 * client's current session.
 *
 * Errors: `ConvexError<{ code, message, retryAfterMs? }>` with code
 * INVALID_PHONE | INVALID_CODE | NOT_CONFIGURED | RATE_LIMITED | VERIFY_FAILED.
 */
export const PhoneOtp = ConvexCredentials<DataModel>({
  id: "phone",
  authorize: async (params, ctx) => {
    const phone = normalizePhone(params.phone);
    const code = typeof params.code === "string" ? params.code.trim() : "";
    if (!CODE_PATTERN.test(code)) {
      throw phoneAuthError("INVALID_CODE", "Enter the code we texted you.");
    }
    // Same runtime ctx; Convex Auth types it without our generated components.
    await limitVerify(ctx as unknown as ActionCtx, phone);
    if (!(await checkCode(phone, code))) {
      console.log(JSON.stringify({ event: "phone_auth.code_rejected", phone: maskPhone(phone) }));
      throw phoneAuthError("INVALID_CODE", "That code didn't work. Check it and try again.");
    }
    const { user } = await createAccount(ctx, {
      provider: "phone",
      account: { id: phone },
      // createOrUpdateUser (convex/authUsers.ts) builds the users row.
      profile: { phone, phoneVerified: true } as unknown as AuthProfile,
    });
    console.log(JSON.stringify({ event: "phone_auth.signed_in", phone: maskPhone(phone), userId: user._id }));
    return { userId: user._id };
  },
});
