// Link page API (docs/superpowers/plans/2026-11-15-link-page.md). Skeleton: signatures only.
// Sections are owned by tasks: T1 core (firstScreen/open/pushOne/finish), T2 claim, T3 drafts/confirm, T4 ending.
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const linkEvent = v.union(
  v.literal("open"), v.literal("wish_written"), v.literal("skip_wish"), v.literal("claim"),
  v.literal("push"), v.literal("contact"), v.literal("download_click"),
);
void linkEvent;

// ===== T1: core =====
export const firstScreen = query({
  args: { hopId: v.string(), deviceId: v.optional(v.string()) },
  handler: async (): Promise<null> => null, // returns FirstScreen | null when implemented
});

export const open = mutation({
  args: { hopId: v.id("hops"), deviceId: v.string() },
  handler: async () => null,
});

export const pushOne = mutation({
  args: {
    hopId: v.id("hops"),
    deviceId: v.string(),
    name: v.string(),
    relation: v.string(),
    reason: v.string(),
    vouch: v.string(),
    contact: v.optional(v.string()),
  },
  handler: async (): Promise<{ childHopId: string }> => {
    throw new Error("not implemented");
  },
});

export const finish = mutation({
  args: { hopId: v.id("hops"), deviceId: v.string(), contact: v.string(), wishText: v.optional(v.string()) },
  handler: async (): Promise<{ freeWishUsed: boolean; wishId: string | null; boatProgress: number; boatsPerCoin: number; wishesLeft: number }> => {
    throw new Error("not implemented");
  },
});

// ===== T2: claim =====
export const claim = mutation({
  args: {
    hopId: v.id("hops"),
    deviceId: v.string(),
    intro: v.string(),
    showNameAndCity: v.optional(v.boolean()),
    proofStorageId: v.optional(v.id("_storage")),
    answers: v.optional(v.array(v.string())),
    phone: v.optional(v.string()),
    code: v.optional(v.string()),
  },
  handler: async (): Promise<{ status: "awaiting_confirmation" }> => {
    throw new Error("not implemented");
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
});

// ===== T3: drafts + confirmation =====
export const saveDraft = mutation({
  args: { deviceId: v.string(), contact: v.optional(v.string()), wishText: v.string() },
  handler: async () => null,
});

export const confirmClaim = mutation({
  args: { hopId: v.id("hops"), deviceId: v.string() },
  handler: async () => null,
});

// ===== T4: ending =====
import type { EndingView } from "../src/lib/linkApi.types";

/** Hop cities in depth order, consecutive duplicates collapsed. */
export function endingRoute(hops: { depth: number; city?: string; _creationTime: number }[]) {
  const route: string[] = [];
  const sorted = [...hops].sort((a, b) => a.depth - b.depth || a._creationTime - b._creationTime);
  for (const h of sorted) {
    const city = h.city?.trim();
    if (city && route[route.length - 1] !== city) route.push(city);
  }
  return route;
}

/** Two-sentence template story (no AI). */
export function endingStory(status: "traveling" | "found" | "granted" | "faded", route: string[], ripples: number) {
  const hands = ripples === 1 ? "1 pair of hands" : `${ripples} pairs of hands`;
  const first =
    route.length > 1
      ? `Your wish sailed from ${route[0]} to ${route[route.length - 1]} through ${hands}.`
      : route.length === 1
        ? `Your wish sailed around ${route[0]} through ${hands}.`
        : `Your wish sailed through ${hands}.`;
  const second = {
    traveling: "It is still out there, looking for the right person.",
    found: "Someone said it's me, and the right person found it.",
    granted: "It came true when the right person said it's me.",
    faded: "It faded before anyone claimed it, but every hand that pushed it thought of you.",
  }[status];
  return `${first} ${second}`;
}

export const ending = query({
  args: { wishId: v.string() },
  handler: async (ctx, args) => {
    const wishId = ctx.db.normalizeId("wishes", args.wishId);
    if (!wishId) return null;
    const wish = await ctx.db.get("wishes", wishId);
    if (!wish) return null;
    const hops = await ctx.db
      .query("hops")
      .withIndex("by_wishId", (q) => q.eq("wishId", wishId))
      .take(200);
    const finder =
      (wish.winningHopId && hops.find((h) => h._id === wish.winningHopId && h.proofStorageId)) ||
      hops.find((h) => h.action === "its_me" && h.proofStorageId);
    const proofUrl = finder?.proofStorageId ? await ctx.storage.getUrl(finder.proofStorageId) : null;
    const route = endingRoute(hops);
    const ripples = hops.reduce((max, h) => Math.max(max, h.depth), 0);
    const view: EndingView = {
      status: wish.status,
      wishText: wish.text,
      photoUrl: proofUrl ?? wish.photoUrl ?? null,
      story: endingStory(wish.status, route, ripples),
      route,
      ripples,
    };
    return view;
  },
});
