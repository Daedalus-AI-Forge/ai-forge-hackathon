// rankForWish with graphology (Task 4 implements). Skeleton: signature only.
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { candidateValidator, type Candidate } from "./graphShared";

export const rankForWish = internalAction({
  args: { ownerUserId: v.id("users"), wishText: v.string(), limit: v.optional(v.number()) },
  returns: v.array(candidateValidator),
  handler: async (): Promise<Candidate[]> => [],
});
