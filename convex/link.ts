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
export const ending = query({
  args: { wishId: v.string() },
  handler: async (): Promise<null> => null, // returns EndingView | null when implemented
});
