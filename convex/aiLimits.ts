import { HOUR, RateLimiter } from "@convex-dev/rate-limiter";

import { components } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";

/**
 * OpenAI spend guards for the public AI actions: per device or per hop link,
 * plus a deployment-wide ceiling. Over the limit, callers use their template
 * fallback instead of calling OpenAI.
 */
export const aiRateLimiter = new RateLimiter(components.rateLimiter, {
  aiPerKeyHour: { kind: "token bucket", rate: 20, period: HOUR },
  aiGlobalHour: { kind: "token bucket", rate: 500, period: HOUR },
});

export async function aiAllowed(ctx: ActionCtx, key: string) {
  const own = await aiRateLimiter.limit(ctx, "aiPerKeyHour", { key });
  if (!own.ok) return false;
  const global = await aiRateLimiter.limit(ctx, "aiGlobalHour");
  return global.ok;
}
