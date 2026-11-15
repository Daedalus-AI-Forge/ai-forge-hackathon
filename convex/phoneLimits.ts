import { HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";

import { components } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import { phoneAuthError } from "./sms";

/**
 * Per-phone (E.164) OTP limits:
 * - sends: 1 per minute and 5 per hour,
 * - verify attempts: 10 per hour.
 * Token buckets with capacity = rate: a quiet number can use the whole cap,
 * then it refills evenly.
 */
export const phoneRateLimiter = new RateLimiter(components.rateLimiter, {
  phoneSendMinute: { kind: "token bucket", rate: 1, period: MINUTE },
  phoneSendHour: { kind: "token bucket", rate: 5, period: HOUR },
  phoneVerifyHour: { kind: "token bucket", rate: 10, period: HOUR },
});

function rateLimited(retryAfter: number | undefined) {
  const ms = retryAfter ?? 0;
  const seconds = Math.max(1, Math.ceil(ms / 1000));
  const wait = seconds < 120 ? `${seconds}s` : `${Math.ceil(seconds / 60)} min`;
  return phoneAuthError("RATE_LIMITED", `Too many tries. Try again in ${wait}.`, ms);
}

const SEND_LIMITS = ["phoneSendMinute", "phoneSendHour"] as const;

/** Consume one send for `phone`, or throw RATE_LIMITED. Checks both windows before consuming either. */
export async function limitSend(ctx: ActionCtx, phone: string) {
  for (const name of SEND_LIMITS) {
    const status = await phoneRateLimiter.check(ctx, name, { key: phone });
    if (!status.ok) throw rateLimited(status.retryAfter);
  }
  for (const name of SEND_LIMITS) {
    const status = await phoneRateLimiter.limit(ctx, name, { key: phone });
    if (!status.ok) throw rateLimited(status.retryAfter);
  }
}

/** Consume one verify attempt for `phone`, or throw RATE_LIMITED. */
export async function limitVerify(ctx: ActionCtx, phone: string) {
  const status = await phoneRateLimiter.limit(ctx, "phoneVerifyHour", { key: phone });
  if (!status.ok) throw rateLimited(status.retryAfter);
}
