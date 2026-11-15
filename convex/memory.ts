// Supermemory derived index of a user's edges (Task 3 implements; skeleton = no-op stubs).
import { v } from "convex/values";
import { internalAction } from "./_generated/server";

export const ingest = internalAction({
  args: { edgeId: v.id("edges") },
  returns: v.null(),
  handler: async () => null,
});

export const forget = internalAction({
  args: { edgeId: v.string(), ownerUserId: v.optional(v.id("users")) },
  returns: v.null(),
  handler: async () => null,
});

export const backfill = internalAction({
  args: { ownerUserId: v.optional(v.id("users")) },
  returns: v.null(),
  handler: async () => null,
});
