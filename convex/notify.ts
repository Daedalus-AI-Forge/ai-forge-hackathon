// Notifications (T3). Skeleton: log only.
import { v } from "convex/values";
import { internalAction } from "./_generated/server";

export const send = internalAction({
  args: {
    to: v.string(),
    kind: v.union(v.literal("landed"), v.literal("ending"), v.literal("claimConfirmed"), v.literal("draftReminder")),
    text: v.string(),
    link: v.optional(v.string()),
  },
  handler: async (_ctx, a) => {
    console.log(JSON.stringify({ event: "notify", kind: a.kind }));
    return null;
  },
});
