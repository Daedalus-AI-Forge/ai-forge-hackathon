// Link page funnel (T4). Skeleton.
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const track = mutation({
  args: {
    hopId: v.optional(v.id("hops")),
    deviceId: v.string(),
    event: v.union(
      v.literal("open"), v.literal("wish_written"), v.literal("skip_wish"), v.literal("claim"),
      v.literal("push"), v.literal("contact"), v.literal("download_click"),
    ),
    wroteWish: v.optional(v.boolean()),
  },
  handler: async () => null,
});

export const metrics = query({ args: {}, handler: async () => null });
