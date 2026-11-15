import { v } from "convex/values";
import { internalMutation, mutation } from "./_generated/server";
import { requireUser, userByDevice } from "./lib";

export const STARS_PER_WISH = 2;
export const ASK_COST = 1;
export const NO_STARS = "Ask the well costs 1 star. Help a friend's wish to earn one!";

/** Trade 2 stars for 1 wish. */
export const tradeForWish = mutation({
  args: { deviceId: v.string() },
  returns: v.object({ stars: v.number(), wishesLeft: v.number() }),
  handler: async (ctx, { deviceId }) => {
    const user = await requireUser(ctx, deviceId);
    if (user.stars < STARS_PER_WISH) throw new Error("You need 2 stars to trade for a wish");
    const next = { stars: user.stars - STARS_PER_WISH, wishesLeft: user.wishesLeft + 1 };
    await ctx.db.patch("users", user._id, next);
    return next;
  },
});

/** Spend the star for Ask the well. "no_user" keeps the old null answer for unknown devices. */
export const spendForAsk = internalMutation({
  args: { deviceId: v.string() },
  returns: v.union(v.literal("ok"), v.literal("no_user"), v.literal("no_stars")),
  handler: async (ctx, { deviceId }) => {
    const user = await userByDevice(ctx, deviceId);
    if (!user) return "no_user" as const;
    if (user.stars < ASK_COST) return "no_stars" as const;
    await ctx.db.patch("users", user._id, { stars: user.stars - ASK_COST });
    return "ok" as const;
  },
});

/** Give the Ask the well star back when the well had nothing to suggest or failed. */
export const refundAsk = internalMutation({
  args: { deviceId: v.string() },
  returns: v.null(),
  handler: async (ctx, { deviceId }) => {
    const user = await userByDevice(ctx, deviceId);
    if (user) await ctx.db.patch("users", user._id, { stars: user.stars + ASK_COST });
    return null;
  },
});
