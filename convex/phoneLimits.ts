import { HOUR, RateLimiter, SECOND } from "@convex-dev/rate-limiter";

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
  // One send per 30s per phone (matches the client's RESEND_SECONDS = 30).
  phoneSendMinute: { kind: "token bucket", rate: 1, period: 30 * SECOND },
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

/** Throw RATE_LIMITED if `phone` can't send now. Consumes nothing (see `limitSend`). */
export async function checkSend(ctx: ActionCtx, phone: string) {
  for (const name of SEND_LIMITS) {
    const status = await phoneRateLimiter.check(ctx, name, { key: phone });
    if (!status.ok) throw rateLimited(status.retryAfter);
  }
}

/**
 * Run `send` only if `phone` is within its send limits, and spend a send only when it
 * succeeds — a provider error (e.g. Twilio down) must not lock the person out.
 */
export async function limitSend<T>(ctx: ActionCtx, phone: string, send: () => Promise<T>): Promise<T> {
  await checkSend(ctx, phone);
  const result = await send();
  for (const name of SEND_LIMITS) {
    await phoneRateLimiter.limit(ctx, name, { key: phone });
  }
  return result;
}

/** Consume one verify attempt for `phone`, or throw RATE_LIMITED. */
export async function limitVerify(ctx: ActionCtx, phone: string) {
  const status = await phoneRateLimiter.limit(ctx, "phoneVerifyHour", { key: phone });
  if (!status.ok) throw rateLimited(status.retryAfter);
}
