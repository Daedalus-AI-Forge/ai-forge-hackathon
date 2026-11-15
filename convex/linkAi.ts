// Link page AI (T2). Skeleton: template outputs; T2 replaces with OpenAI + fallbacks.
import { v } from "convex/values";
import { action } from "./_generated/server";

export const claimQuestions = action({ args: { hopId: v.id("hops") }, handler: async (): Promise<string[]> => ["What makes you a fit for this wish?"] });
export const vouchFor = action({
  args: { hopId: v.id("hops"), name: v.string(), relation: v.string(), reason: v.string() },
  handler: async (_ctx, a): Promise<string> => `${a.name} is my ${a.relation} — ${a.reason}`,
});
export const memoryPrompt = action({ args: { hopId: v.id("hops") }, handler: async (): Promise<string> => "Who do you know who might fit?" });
export const prophecy = action({ args: { wishText: v.string() }, handler: async (): Promise<string> => "Someone two friends away is already closer than you think." });
// Also used for sendClaimCode (T2): verification code to the claimer's phone.
export const sendClaimCode = action({
  args: { hopId: v.id("hops"), phone: v.string() },
  handler: async (): Promise<{ resendAfterMs: number }> => {
    throw new Error("not implemented");
  },
});
