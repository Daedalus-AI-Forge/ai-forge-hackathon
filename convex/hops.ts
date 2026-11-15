import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { stepAt } from "./daily";
import {
  BOATS_PER_COIN,
  LIMITS,
  MAX_PASSES,
  MAX_RIPPLES,
  avatarFor,
  clampText,
  cleanTags,
  passDetails,
  recordEdges,
  rippleSummary,
  userByDevice,
  wishHops,
  wishModeOf,
} from "./lib";
import { wishMode } from "./graphShared";
import { coordsFor } from "./places";
import { wishType } from "./schema";

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

async function loadUnacted(ctx: MutationCtx, hopId: Id<"hops">) {
  const loaded = await loadOpen(ctx, hopId);
  if (loaded.hop.action) throw new Error("You've already acted on this wish");
  return loaded;
}

const pageValidator = v.union(
  v.null(),
  v.object({
    hop: v.object({
      _id: v.id("hops"),
      depth: v.number(),
      holderName: v.string(),
      action: v.union(v.null(), v.literal("pass"), v.literal("group"), v.literal("its_me")),
      viaGroup: v.boolean(),
      passMessage: v.union(v.null(), v.string()),
      holderContact: v.union(v.null(), v.string()),
    }),
    wish: v.object({
      _id: v.id("wishes"),
      text: v.string(),
      type: wishType,
      mode: wishMode,
      status: v.union(v.literal("traveling"), v.literal("found"), v.literal("granted"), v.literal("faded")),
      expiresAt: v.number(),
      creatorName: v.string(),
      creatorCity: v.string(),
      creatorAvatar: v.string(),
      daily: v.union(
        v.null(),
        v.object({
          tag: v.string(),
          learns: v.string(),
          hint: v.string(),
          step: v.number(),
          of: v.number(),
          reasoning: v.string(),
        }),
      ),
    }),
    senderName: v.string(),
    chain: v.array(
      v.object({
        name: v.string(),
        city: v.union(v.null(), v.string()),
        depth: v.number(),
        viaGroup: v.boolean(),
        vouch: v.union(v.null(), v.string()),
        avatar: v.string(),
      }),
    ),
    ripples: v.number(),
    holding: v.number(),
    branches: v.number(),
    children: v.array(
      v.object({
        hopId: v.id("hops"),
        name: v.string(),
        passMessage: v.union(v.null(), v.string()),
        viaGroup: v.boolean(),
      }),
    ),
    canPass: v.boolean(),
  }),
);

/**
 * Everything the holder of one link may see: the wish, the vouch chain above
 * them (names and vouches only, never other hops' ids or contacts) and the
 * links they created themselves.
 */
export const page = query({
  args: { hopId: v.string() },
  returns: pageValidator,
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
        mode: wishModeOf(wish),
        status: wish.status,
        expiresAt: wish.expiresAt,
        creatorName: creator?.name ?? "Someone",
        creatorCity: creator?.city ?? "",
        creatorAvatar: creator?.avatar ?? avatarFor("?"),
        daily: wish.daily
          ? {
              ...stepAt(wish.daily, hop.depth),
              step: hop.depth,
              of: wish.daily.steps.length,
              reasoning: wish.daily.reasoning,
            }
          : null,
      },
      senderName: sender.name,
      chain: chain.map((h) => ({
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

/** Opened inside the app: attach an unclaimed, unacted hop to this user so it shows under "Friends' wishes". */
export const claim = mutation({
  args: { hopId: v.id("hops"), deviceId: v.string() },
  handler: async (ctx, { hopId, deviceId }) => {
    const hop = await ctx.db.get("hops", hopId);
    if (!hop || hop.holderUserId || hop.action) return null;
    const user = await userByDevice(ctx, deviceId);
    if (!user) return null;
    const wish = await ctx.db.get("wishes", hop.wishId);
    if (!wish || wish.creatorId === user._id || wish.status !== "traveling") return null;
    await ctx.db.patch("hops", hopId, { holderUserId: user._id });
    return null;
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
    const { hop, wish } = await loadUnacted(ctx, args.hopId);
    if (hop.depth >= MAX_RIPPLES) throw new Error("This wish has traveled as far as it can");
    const name = clampText(args.name, LIMITS.name) || hop.holderName;
    const vouch = clampText(args.vouch, LIMITS.vouch);
    const fromTheWell = !!wish.daily && !hop.parentHopId;
    if (!vouch && !fromTheWell) throw new Error("Vouch for the person who sent this to you");
    const city = clampText(args.city, LIMITS.city) || undefined;
    await ctx.db.patch("hops", hop._id, {
      holderName: name,
      city,
      ...coordsFor(city),
      vouchForParent: vouch || undefined,
      action: args.action,
      actedAt: Date.now(),
    });
    const holder = hop.holderUserId && (await ctx.db.get("users", hop.holderUserId));
    if (holder) {
      const progress = (holder.boatProgress ?? 0) + 1;
      await ctx.db.patch("users", holder._id, {
        boatProgress: progress % BOATS_PER_COIN,
        wishesLeft: holder.wishesLeft + Math.floor(progress / BOATS_PER_COIN),
      });
    }
    if (vouch) {
      const sender = await senderOf(ctx, hop, wish);
      const vouchId = await ctx.db.insert("vouches", {
        aboutName: sender.name,
        aboutUserId: sender.userId,
        byName: name,
        text: vouch,
        tags: cleanTags(args.tags),
        wishId: wish._id,
        hopId: hop._id,
      });
      await ctx.scheduler.runAfter(0, internal.vouchMemory.tagVouch, { vouchId });
    }
    return null;
  },
});

export const passTo = mutation({
  args: {
    parentHopId: v.id("hops"),
    name: v.string(),
    reason: v.optional(v.string()),
    contact: v.optional(v.string()),
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
    const viaGroup = hop.action === "group";
    const limit = viaGroup ? 1 : MAX_PASSES;
    if (existing.length >= limit) throw new Error("You've passed this wish to " + limit + " already");
    const name = clampText(args.name, LIMITS.name);
    if (!viaGroup && !name) throw new Error("Who are you passing it to?");
    // A group-chat pass names no one, so there is no pick to explain.
    const details = viaGroup ? {} : passDetails(wishModeOf(wish), args);
    const childId = await ctx.db.insert("hops", {
      wishId: wish._id,
      parentHopId: hop._id,
      depth: hop.depth + 1,
      holderName: viaGroup ? name || "Group chat" : name,
      recipientTags: cleanTags(args.tags),
      viaGroup,
    });
    if (!viaGroup) {
      await recordEdges(ctx, {
        owner: { userId: hop.holderUserId, name: hop.holderName },
        personName: name,
        tags: cleanTags(args.tags),
        dailyTag: wish.daily && stepAt(wish.daily, hop.depth).tag,
        ...details,
        wishId: wish._id,
        hopId: childId,
      });
    }
    return childId;
  },
});

export const itsMe = mutation({
  args: {
    hopId: v.id("hops"),
    name: v.string(),
    city: v.string(),
    intro: v.string(),
    contact: v.string(),
    showNameAndCity: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { hop } = await loadUnacted(ctx, args.hopId);
    const intro = clampText(args.intro, LIMITS.intro);
    if (!intro) throw new Error("Write a one-line intro");
    const city = clampText(args.city, LIMITS.city) || undefined;
    await ctx.db.patch("hops", hop._id, {
      holderName: clampText(args.name, LIMITS.name) || hop.holderName,
      city,
      ...coordsFor(city),
      itsMeIntro: intro,
      itsMePublic: args.showNameAndCity,
      holderContact: clampText(args.contact, LIMITS.contact) || hop.holderContact,
      action: "its_me",
      actedAt: Date.now(),
    });
    return null;
  },
});

export const saveContact = mutation({
  args: { hopId: v.id("hops"), contact: v.string() },
  handler: async (ctx, { hopId, contact }) => {
    const { hop } = await loadOpen(ctx, hopId);
    const value = clampText(contact, LIMITS.contact);
    if (!value) throw new Error("Add a phone, WeChat or Instagram");
    await ctx.db.patch("hops", hop._id, { holderContact: value });
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
      status: wish.status,
      passMessage: hop.passMessage ?? null,
    };
  },
});

export const setPassMessage = internalMutation({
  args: { hopId: v.id("hops"), message: v.string() },
  handler: async (ctx, { hopId, message }) => {
    await ctx.db.patch("hops", hopId, { passMessage: message.slice(0, LIMITS.message) });
    return null;
  },
});
