import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, mutation, query, type QueryCtx } from "./_generated/server";
import { MAX_PASSES, WISH_LIFETIME_MS, avatarFor, recordEdges, requireUser, rippleSummary, userByDevice, wishHops } from "./lib";
import { wishType } from "./schema";

async function wishCard(ctx: QueryCtx, wish: Doc<"wishes">) {
  const hops = await wishHops(ctx, wish._id);
  const creator = await ctx.db.get("users", wish.creatorId);
  return {
    _id: wish._id,
    text: wish.text,
    type: wish.type,
    status: wish.status,
    expiresAt: wish.expiresAt,
    tier: wish.tier ?? null,
    creatorName: creator?.name ?? "Someone",
    creatorCity: creator?.city ?? "",
    ...rippleSummary(hops),
    holders: hops.map((h) => ({
      hopId: h._id,
      name: h.holderName,
      city: h.city ?? null,
      depth: h.depth,
      avatar: avatarFor(h.holderName),
      acted: h.action ?? null,
    })),
  };
}

export const home = query({
  args: { deviceId: v.string() },
  handler: async (ctx, { deviceId }) => {
    const user = await userByDevice(ctx, deviceId);
    if (!user) return null;
    const recent = await ctx.db
      .query("wishes")
      .withIndex("by_creatorId", (q) => q.eq("creatorId", user._id))
      .order("desc")
      .take(10);
    const active = recent.find((w) => w.status === "traveling" || w.status === "found");
    const held = await ctx.db
      .query("hops")
      .withIndex("by_holderUserId_and_action", (q) =>
        q.eq("holderUserId", user._id).eq("action", undefined),
      )
      .take(10);
    const helpCards = [];
    for (const hop of held) {
      const wish = await ctx.db.get("wishes", hop.wishId);
      if (!wish || wish.status !== "traveling") continue;
      const card = await wishCard(ctx, wish);
      helpCards.push({ hopId: hop._id, depth: hop.depth, ...card, holders: [] });
    }
    return {
      user,
      activeWish: active ? await wishCard(ctx, active) : null,
      helpCards,
    };
  },
});

export const mine = query({
  args: { deviceId: v.string() },
  handler: async (ctx, { deviceId }) => {
    const user = await userByDevice(ctx, deviceId);
    if (!user) return [];
    const wishes = await ctx.db
      .query("wishes")
      .withIndex("by_creatorId", (q) => q.eq("creatorId", user._id))
      .order("desc")
      .take(20);
    const cards = [];
    for (const wish of wishes) cards.push(await wishCard(ctx, wish));
    return cards;
  },
});

export const toss = mutation({
  args: {
    deviceId: v.string(),
    type: wishType,
    text: v.string(),
    name: v.string(),
    city: v.string(),
    recipients: v.array(v.object({ name: v.string(), tags: v.array(v.string()) })),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.deviceId);
    const text = args.text.trim();
    const recipients = args.recipients.filter((r) => r.name.trim());
    if (!text) throw new Error("Write your wish first");
    if (recipients.length === 0 || recipients.length > MAX_PASSES) {
      throw new Error("Pick 1 to 3 people");
    }
    if (user.wishesLeft < 1) throw new Error("You're out of wishes. Help a friend to earn one!");
    await ctx.db.patch("users", user._id, {
      wishesLeft: user.wishesLeft - 1,
      name: args.name.trim() || user.name,
      city: args.city.trim() || user.city,
    });
    const now = Date.now();
    const wishId = await ctx.db.insert("wishes", {
      creatorId: user._id,
      type: args.type,
      text,
      status: "traveling",
      expiresAt: now + WISH_LIFETIME_MS,
    });
    const hopIds = [];
    for (const r of recipients) {
      const hopId = await ctx.db.insert("hops", {
        wishId,
        depth: 1,
        holderName: r.name.trim(),
        recipientTags: r.tags,
        viaGroup: false,
      });
      hopIds.push(hopId);
      await recordEdges(ctx, {
        owner: { userId: user._id, name: args.name.trim() || user.name },
        personName: r.name.trim(),
        tags: r.tags,
        wishId,
        hopId,
      });
      await ctx.db.insert("network", {
        ownerId: user._id,
        personName: r.name.trim(),
        tags: r.tags,
      });
    }
    await ctx.scheduler.runAfter(WISH_LIFETIME_MS, internal.wishes.fade, { wishId });
    return { wishId, hopIds };
  },
});

export const fade = internalMutation({
  args: { wishId: v.id("wishes") },
  handler: async (ctx, { wishId }) => {
    const wish = await ctx.db.get("wishes", wishId);
    if (!wish || wish.status !== "traveling") return null;
    await ctx.db.patch("wishes", wishId, { status: "faded" });
    const creator = await ctx.db.get("users", wish.creatorId);
    if (creator) await ctx.db.patch("users", creator._id, { wishesLeft: creator.wishesLeft + 1 });
    return null;
  },
});
