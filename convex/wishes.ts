import { bindBotHolder } from "./bots";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, mutation, query, type QueryCtx } from "./_generated/server";
import {
  LIMITS,
  MAX_PASSES,
  WISH_LIFETIME_MS,
  avatarFor,
  clampText,
  cleanTags,
  passDetails,
  recordEdges,
  requireUser,
  rippleSummary,
  userByDevice,
  wishHops,
  wishModeOf,
} from "./lib";
import { wishMode } from "./graphShared";
import { wishType } from "./schema";

async function wishCard(ctx: QueryCtx, wish: Doc<"wishes">) {
  const hops = await wishHops(ctx, wish._id);
  const creator = await ctx.db.get("users", wish.creatorId);
  return {
    _id: wish._id,
    text: wish.text,
    type: wish.type,
    mode: wishModeOf(wish),
    status: wish.status,
    expiresAt: wish.expiresAt,
    tier: wish.tier ?? null,
    creatorName: creator?.name ?? "Someone",
    creatorCity: creator?.city ?? "",
    ...rippleSummary(hops),
    holders: hops.map((h, i) => ({
      key: String(i),
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
    mode: v.optional(wishMode),
    recipients: v.array(
      v.object({
        name: v.string(),
        reason: v.optional(v.string()),
        contact: v.optional(v.string()),
        tags: v.array(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.deviceId);
    const text = clampText(args.text, LIMITS.wish);
    const mode = args.mode ?? "fun"; // omitted = legacy UI; new UI sends "serious"
    const picked = args.recipients
      .slice(0, MAX_PASSES + 1)
      .map((r) => ({ ...r, name: clampText(r.name, LIMITS.name) }))
      .filter((r) => r.name);
    if (!text) throw new Error("Write your wish first");
    if (picked.length === 0 || picked.length > MAX_PASSES) {
      throw new Error("Pick 1 to 3 people");
    }
    const recipients = picked.map((r) => ({
      name: r.name,
      tags: cleanTags(r.tags),
      ...passDetails(mode, r),
    }));
    if (user.wishesLeft < 1) throw new Error("You're out of wishes. Help a friend to earn one!");
    await ctx.db.patch("users", user._id, {
      wishesLeft: user.wishesLeft - 1,
      name: clampText(args.name, LIMITS.name) || user.name,
      city: clampText(args.city, LIMITS.city) || user.city,
    });
    const now = Date.now();
    const wishId = await ctx.db.insert("wishes", {
      creatorId: user._id,
      type: args.type,
      mode,
      text,
      status: "traveling",
      expiresAt: now + WISH_LIFETIME_MS,
    });
    const known = new Set(
      (
        await ctx.db
          .query("network")
          .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
          .take(200)
      ).map((n) => n.personName.toLowerCase()),
    );
    const hopIds = [];
    for (const r of recipients) {
      const hopId = await ctx.db.insert("hops", {
        wishId,
        depth: 1,
        holderName: r.name,
        recipientTags: r.tags,
        viaGroup: false,
      });
      hopIds.push(hopId);
      // A friend who is a wish bot (convex/bots.ts) holds the boat and starts moving it.
      await bindBotHolder(ctx, user._id, hopId, r.name);
      await recordEdges(ctx, {
        owner: { userId: user._id, name: clampText(args.name, LIMITS.name) || user.name },
        personName: r.name,
        tags: r.tags,
        reason: r.reason,
        contact: r.contact,
        wishId,
        hopId,
      });
      if (known.has(r.name.toLowerCase())) continue;
      known.add(r.name.toLowerCase());
      await ctx.db.insert("network", { ownerId: user._id, personName: r.name, tags: r.tags });
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
