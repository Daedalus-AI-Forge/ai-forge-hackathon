// Ego graph queries (Task 2 implements). Skeleton: signatures per docs/api/wishwell-graph-api.md.
import { v } from "convex/values";
import { query } from "./_generated/server";
import { COACH_THRESHOLD } from "./graphShared";

export const coachReady = query({
  args: { deviceId: v.string() },
  returns: v.object({ ready: v.boolean(), edgeCount: v.number(), threshold: v.number() }),
  handler: async () => ({ ready: false, edgeCount: 0, threshold: COACH_THRESHOLD }),
});
