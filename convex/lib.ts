import { getAuthUserId } from "@convex-dev/auth/server";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { CONTACT_MAX, REASON_MAX, type WishMode } from "./graphShared";

export const MAX_PASSES = 3;
export const MAX_RIPPLES = 6;
export const WISH_LIFETIME_MS = 48 * 60 * 60 * 1000;
/** Every BOATS_PER_COIN boats a person pushes earns them one coin (a wish credit). */
export const BOATS_PER_COIN = 5;

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
  requireDeviceId(deviceId);
  const authUserId = await getAuthUserId(ctx);
  if (authUserId) {
    const authUser = await ctx.db.get("users", authUserId);
    if (authUser) return authUser;
  }
  return await deviceUser(ctx, deviceId);
}

export const DEVICE_ID_PATTERN = /^[A-Za-z0-9_-]{4,64}$/;

export function requireDeviceId(deviceId: string) {
  if (!DEVICE_ID_PATTERN.test(deviceId)) throw new Error("Invalid device id");
  return deviceId;
}

export function clampText(value: string, max: number) {
  return value.trim().slice(0, max);
}

export function cleanTags(tags: string[]) {
  return tags
    .map((t) => clampText(t, 30))
    .filter(Boolean)
    .slice(0, 5);
}

export const LIMITS = { name: 60, city: 60, wish: 500, vouch: 280, intro: 280, contact: 100, message: 600 };

export function demoMode() {
  return process.env.DEMO_MODE === "true";
}

/** The row holding this device id, ignoring any auth session. */
export async function deviceUser(ctx: QueryCtx | MutationCtx, deviceId: string) {
  requireDeviceId(deviceId);
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

export const REASON_REQUIRED = "Add one line on why you picked them";

/**
 * A wish's effective mode: daily wishes are always fun. Missing mode = legacy "fun" so
 * wishes created before the graph API (and today's UI) keep passing without a reason;
 * new UI sends mode "serious" explicitly to require reasons.
 */
export function wishModeOf(wish: Pick<Doc<"wishes">, "mode" | "daily">): WishMode {
  if (wish.daily) return "fun";
  return wish.mode ?? "fun";
}

/**
 * Clamp a recipient's reason/contact; a serious wish needs a non-empty reason.
 * Empty strings become undefined so edge rows never store "".
 */
export function passDetails(mode: WishMode, r: { reason?: string; contact?: string }) {
  const reason = clampText(r.reason ?? "", REASON_MAX) || undefined;
  const contact = clampText(r.contact ?? "", CONTACT_MAX) || undefined;
  if (mode === "serious" && !reason) throw new Error(REASON_REQUIRED);
  return { reason, contact };
}

/**
 * Write one edge row per tag (plus the daily tag) and schedule its async
 * Supermemory ingest. Returns the inserted edge ids.
 */
export async function recordEdges(
  ctx: MutationCtx,
  args: {
    owner: { userId?: Id<"users">; name: string };
    personName: string;
    tags: string[];
    dailyTag?: string;
    reason?: string;
    contact?: string;
    wishId: Id<"wishes">;
    hopId: Id<"hops">;
  },
): Promise<Id<"edges">[]> {
  // Callers clamp too; this is the last line so no edge row is ever unbounded.
  const personName = clampText(args.personName, LIMITS.name);
  if (!personName) return [];
  const reason = clampText(args.reason ?? "", REASON_MAX) || undefined;
  const contact = clampText(args.contact ?? "", CONTACT_MAX) || undefined;
  const tags = new Map<string, "daily" | "pick">(cleanTags(args.tags).map((t) => [t, "pick"]));
  if (args.dailyTag) tags.set(clampText(args.dailyTag, 30), "daily");
  // A pick with a reason but no tags still belongs in the graph.
  if (tags.size === 0 && reason) tags.set("friend", "pick");
  const edgeIds: Id<"edges">[] = [];
  for (const [tag, source] of tags) {
    const edgeId = await ctx.db.insert("edges", {
      ownerUserId: args.owner.userId,
      ownerName: clampText(args.owner.name, LIMITS.name),
      personName,
      tag,
      source,
      wishId: args.wishId,
      hopId: args.hopId,
      reason,
      contact,
    });
    edgeIds.push(edgeId);
    await ctx.scheduler.runAfter(0, internal.memory.ingest, { edgeId });
  }
  return edgeIds;
}

export function rippleSummary(hops: Doc<"hops">[]) {
  return {
    ripples: hops.reduce((max, h) => Math.max(max, h.depth), 0),
    holding: hops.filter((h) => !h.action).length,
    branches: hops.filter((h) => h.depth === 1).length,
  };
}
