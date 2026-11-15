// Link page API (docs/superpowers/plans/2026-11-15-link-page.md). Skeleton: signatures only.
// Sections are owned by tasks: T1 core (firstScreen/open/pushOne/finish), T2 claim, T3 drafts/confirm, T4 ending.
import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { LIMITS, clampText, requireDeviceId, userByDevice } from "./lib";
import { checkCode, normalizePhone, smsModeFor } from "./sms";

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
const ALREADY_CLAIMED = "This boat already found its person";
const VERIFY_FIRST = "Verify your phone first";
const CLAIM_ANSWERS_MAX = 3;

/**
 * "It's me" from the link page. Daily boat: intro (+ optional proof photo, name/city
 * visibility). Real wish: intro + answers + a verified phone. Demo numbers are checked
 * inline (no network); Twilio numbers must be verified first via
 * `linkAi.verifyClaimCode` (mutations can't call Twilio), which marks the hop.
 */
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
  handler: async (ctx, args): Promise<{ status: "awaiting_confirmation" }> => {
    requireDeviceId(args.deviceId);
    const hop = await ctx.db.get("hops", args.hopId);
    if (!hop) throw new Error("This link doesn't exist");
    if (hop.action) throw new Error(ALREADY_CLAIMED);
    const wish = await ctx.db.get("wishes", hop.wishId);
    if (!wish || wish.status !== "traveling" || wish.expiresAt < Date.now()) {
      throw new Error("This wish isn't traveling anymore");
    }
    // A hop bound to another visitor's device (forwarded link) can't be claimed here.
    if (hop.holderUserId) {
      const user = await userByDevice(ctx, args.deviceId);
      if (!user || user._id !== hop.holderUserId) throw new Error("This boat is with someone else");
    }
    const intro = clampText(args.intro, LIMITS.intro);
    if (!intro) throw new Error("Write a one-line intro");
    const now = Date.now();

    if (wish.daily) {
      await ctx.db.patch("hops", hop._id, {
        itsMeIntro: intro,
        itsMePublic: args.showNameAndCity,
        proofStorageId: args.proofStorageId,
        action: "its_me",
        actedAt: now,
      });
      return { status: "awaiting_confirmation" };
    }

    const answers = (args.answers ?? [])
      .map((a) => clampText(a, LIMITS.intro))
      .filter(Boolean)
      .slice(0, CLAIM_ANSWERS_MAX);
    if (answers.length === 0) throw new Error("Answer the question first");
    if (!args.phone || !args.code) throw new Error(VERIFY_FIRST);
    const phone = normalizePhone(args.phone);
    const code = clampText(args.code, 12);
    const verified =
      smsModeFor(phone).kind === "demo"
        ? await checkCode(phone, code) // demo: pure comparison, no network
        : hop.claimVerified === true && hop.claimPhone === phone;
    if (!verified) throw new Error(VERIFY_FIRST);
    await ctx.db.patch("hops", hop._id, {
      itsMeIntro: intro,
      claimAnswers: answers,
      claimPhone: phone,
      claimVerified: true,
      action: "its_me",
      actedAt: now,
    });
    return { status: "awaiting_confirmation" };
  },
});

/** Set by `linkAi.verifyClaimCode` after Twilio approved the code for this phone. */
export const markClaimVerified = internalMutation({
  args: { hopId: v.id("hops"), phone: v.string() },
  handler: async (ctx, { hopId, phone }) => {
    const hop = await ctx.db.get("hops", hopId);
    if (!hop) throw new Error("This link doesn't exist");
    if (hop.action) throw new Error(ALREADY_CLAIMED);
    await ctx.db.patch("hops", hopId, { claimPhone: phone, claimVerified: true });
    return null;
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
