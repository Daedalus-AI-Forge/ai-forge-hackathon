import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { MAX_PASSES, MAX_RIPPLES, avatarFor, recordEdges, rippleSummary, wishHops } from "./lib";

async function chainAbove(ctx: QueryCtx, hop: Doc<"hops">) {
  const chain: Doc<"hops">[] = [];
  let parentId = hop.parentHopId;
  while (parentId) {
    const parent: Doc<"hops"> | null = await ctx.db.get("hops", parentId);
    if (!parent) break;
    chain.unshift(parent);
    parentId = parent.parentHopId;
  }
  return chain;
}

async function senderOf(ctx: QueryCtx, hop: Doc<"hops">, wish: Doc<"wishes">) {
  if (hop.parentHopId) {
    const parent = await ctx.db.get("hops", hop.parentHopId);
    if (parent) return { name: parent.holderName, userId: parent.holderUserId };
  }
  const creator = await ctx.db.get("users", wish.creatorId);
  return { name: creator?.name ?? "Someone", userId: creator?._id };
}

async function loadOpen(ctx: MutationCtx, hopId: Id<"hops">) {
  const hop = await ctx.db.get("hops", hopId);
  if (!hop) throw new Error("This link doesn't exist");
  const wish = await ctx.db.get("wishes", hop.wishId);
  if (!wish) throw new Error("This wish doesn't exist");
  if (wish.status !== "traveling" || wish.expiresAt < Date.now()) {
    throw new Error("This wish isn't traveling anymore");
  }
  return { hop, wish };
}

export const page = query({
  args: { hopId: v.string() },
  handler: async (ctx, args) => {
    const hopId = ctx.db.normalizeId("hops", args.hopId);
    if (!hopId) return null;
    const hop = await ctx.db.get("hops", hopId);
    if (!hop) return null;
    const wish = await ctx.db.get("wishes", hop.wishId);
    if (!wish) return null;
    const creator = await ctx.db.get("users", wish.creatorId);
    const chain = await chainAbove(ctx, hop);
    const children = await ctx.db
      .query("hops")
      .withIndex("by_parentHopId", (q) => q.eq("parentHopId", hop._id))
      .take(MAX_PASSES);
    const sender = await senderOf(ctx, hop, wish);
    return {
      hop: {
        _id: hop._id,
        depth: hop.depth,
        holderName: hop.holderName,
        action: hop.action ?? null,
        viaGroup: hop.viaGroup,
        passMessage: hop.passMessage ?? null,
        holderContact: hop.holderContact ?? null,
      },
      wish: {
        _id: wish._id,
        text: wish.text,
        type: wish.type,
        status: wish.status,
        expiresAt: wish.expiresAt,
        creatorName: creator?.name ?? "Someone",
        creatorCity: creator?.city ?? "",
        creatorAvatar: creator?.avatar ?? avatarFor("?"),
        daily: wish.daily ?? null,
      },
      senderName: sender.name,
      chain: chain.map((h) => ({
        hopId: h._id,
        name: h.holderName,
        city: h.city ?? null,
        depth: h.depth,
        viaGroup: h.viaGroup,
        vouch: h.vouchForParent ?? null,
        avatar: avatarFor(h.holderName),
      })),
      ...rippleSummary(await wishHops(ctx, wish._id)),
      children: children.map((c) => ({
        hopId: c._id,
        name: c.holderName,
        passMessage: c.passMessage ?? null,
        viaGroup: c.viaGroup,
      })),
      canPass: hop.depth < MAX_RIPPLES,
    };
  },
});

export const act = mutation({
  args: {
    hopId: v.id("hops"),
    action: v.union(v.literal("pass"), v.literal("group")),
    name: v.string(),
    city: v.string(),
    vouch: v.string(),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const { hop, wish } = await loadOpen(ctx, args.hopId);
    if (hop.depth >= MAX_RIPPLES) throw new Error("This wish has traveled as far as it can");
    const name = args.name.trim() || hop.holderName;
    const vouch = args.vouch.trim();
    const fromTheWell = !!wish.daily && !hop.parentHopId;
    if (!vouch && !fromTheWell) throw new Error("Vouch for the person who sent this to you");
    await ctx.db.patch("hops", hop._id, {
      holderName: name,
      city: args.city.trim() || undefined,
      vouchForParent: vouch || undefined,
      action: args.action,
      actedAt: hop.actedAt ?? Date.now(),
    });
    if (vouch && !hop.vouchForParent) {
      const sender = await senderOf(ctx, hop, wish);
      await ctx.db.insert("vouches", {
        aboutName: sender.name,
        aboutUserId: sender.userId,
        byName: name,
        text: vouch,
        tags: args.tags,
        wishId: wish._id,
        hopId: hop._id,
      });
    }
    return null;
  },
});

export const passTo = mutation({
  args: {
    parentHopId: v.id("hops"),
    name: v.string(),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const { hop, wish } = await loadOpen(ctx, args.parentHopId);
    if (hop.action !== "pass" && hop.action !== "group") {
      throw new Error("Vouch first, then pass it on");
    }
    const existing = await ctx.db
      .query("hops")
      .withIndex("by_parentHopId", (q) => q.eq("parentHopId", hop._id))
      .take(MAX_PASSES);
    const limit = hop.action === "group" ? 1 : MAX_PASSES;
    if (existing.length >= limit) throw new Error("You've passed this wish to " + limit + " already");
    const viaGroup = hop.action === "group";
    const childId = await ctx.db.insert("hops", {
      wishId: wish._id,
      parentHopId: hop._id,
      depth: hop.depth + 1,
      holderName: viaGroup ? args.name.trim() || "Group chat" : args.name.trim(),
      recipientTags: args.tags,
      viaGroup,
    });
    if (!viaGroup) {
      await recordEdges(ctx, {
        owner: { userId: hop.holderUserId, name: hop.holderName },
        personName: args.name.trim(),
        tags: args.tags,
        dailyTag: wish.daily?.tag,
        wishId: wish._id,
        hopId: childId,
      });
    }
    return childId;
  },
});

export const itsMe = mutation({
  args: { hopId: v.id("hops"), name: v.string(), city: v.string(), intro: v.string(), contact: v.string() },
  handler: async (ctx, args) => {
    const { hop } = await loadOpen(ctx, args.hopId);
    if (!args.intro.trim()) throw new Error("Write a one-line intro");
    await ctx.db.patch("hops", hop._id, {
      holderName: args.name.trim() || hop.holderName,
      city: args.city.trim() || undefined,
      itsMeIntro: args.intro.trim(),
      holderContact: args.contact.trim() || hop.holderContact,
      action: "its_me",
      actedAt: Date.now(),
    });
    return null;
  },
});

export const saveContact = mutation({
  args: { hopId: v.id("hops"), contact: v.string() },
  handler: async (ctx, { hopId, contact }) => {
    const hop = await ctx.db.get("hops", hopId);
    if (!hop) throw new Error("This link doesn't exist");
    await ctx.db.patch("hops", hopId, { holderContact: contact.trim() });
    return null;
  },
});

export const aiContext = internalQuery({
  args: { hopId: v.id("hops") },
  handler: async (ctx, { hopId }) => {
    const hop = await ctx.db.get("hops", hopId);
    if (!hop) return null;
    const wish = await ctx.db.get("wishes", hop.wishId);
    if (!wish) return null;
    const creator = await ctx.db.get("users", wish.creatorId);
    const sender = await senderOf(ctx, hop, wish);
    return {
      wisherName: creator?.name ?? "Someone",
      wishText: wish.text,
      holderName: hop.holderName,
      senderName: sender.name,
      depth: hop.depth,
      tags: hop.recipientTags,
      ripples: rippleSummary(await wishHops(ctx, wish._id)).ripples,
      expiresAt: wish.expiresAt,
    };
  },
});

export const setPassMessage = internalMutation({
  args: { hopId: v.id("hops"), message: v.string() },
  handler: async (ctx, { hopId, message }) => {
    await ctx.db.patch("hops", hopId, { passMessage: message });
    return null;
  },
});
