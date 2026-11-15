import { getAuthUserId } from "@convex-dev/auth/server";

import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export const MAX_PASSES = 3;
export const MAX_RIPPLES = 6;
export const WISH_LIFETIME_MS = 48 * 60 * 60 * 1000;

const AVATAR_COLORS = ["#F4A261", "#2A9D8F", "#E9C46A", "#8AB17D", "#6D597A", "#457B9D", "#E76F51", "#B5838D"];

export function avatarFor(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/**
 * The current user. A Convex Auth session (anonymous, Google or Apple) wins;
 * otherwise fall back to the anonymous device identity, so every existing
 * `{ deviceId }` function keeps working with auth on or off.
 */
export async function userByDevice(ctx: QueryCtx | MutationCtx, deviceId: string) {
  const authUserId = await getAuthUserId(ctx);
  if (authUserId) {
    const authUser = await ctx.db.get("users", authUserId);
    if (authUser) return authUser;
  }
  return await deviceUser(ctx, deviceId);
}

/** The row holding this device id, ignoring any auth session. */
export async function deviceUser(ctx: QueryCtx | MutationCtx, deviceId: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_deviceId", (q) => q.eq("deviceId", deviceId))
    .unique();
}

export async function requireUser(ctx: MutationCtx, deviceId: string): Promise<Doc<"users">> {
  const user = await userByDevice(ctx, deviceId);
  if (!user) throw new Error("Unknown device");
  return user;
}

export async function wishHops(ctx: QueryCtx, wishId: Id<"wishes">) {
  return await ctx.db
    .query("hops")
    .withIndex("by_wishId", (q) => q.eq("wishId", wishId))
    .take(200);
}

export function rippleSummary(hops: Doc<"hops">[]) {
  return {
    ripples: hops.reduce((max, h) => Math.max(max, h.depth), 0),
    holding: hops.filter((h) => !h.action).length,
    branches: hops.filter((h) => h.depth === 1).length,
  };
}
