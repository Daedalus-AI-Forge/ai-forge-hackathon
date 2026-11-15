// Link page API (docs/superpowers/plans/2026-11-15-link-page.md). Skeleton: signatures only.
// Sections are owned by tasks: T1 core (firstScreen/open/pushOne/finish), T2 claim, T3 drafts/confirm, T4 ending.
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { FinishResult, FirstScreen, FirstScreenState } from "../src/lib/linkApi.types";
import { stepAt } from "./daily";
import { personKey } from "./graphShared";
import {
  BOATS_PER_COIN, LIMITS, MAX_RIPPLES, WISH_LIFETIME_MS, avatarFor, clampText, cleanTags,
  passDetails, recordEdges, rippleSummary, userByDevice, wishHops, wishModeOf,
} from "./lib";
import { normalizePhone } from "./sms";

const linkEvent = v.union(
  v.literal("open"), v.literal("wish_written"), v.literal("skip_wish"), v.literal("claim"),
  v.literal("push"), v.literal("contact"), v.literal("download_click"),
);
void linkEvent;

// ===== T1: core =====
// Private helpers for the T1 section.
const PICK_SOMEONE_ELSE = "Pick someone else — this boat already passed through them";
const FREE_WISH_TYPE = "do_together" as const;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const firstScreenValidator = v.object({
  state: v.union(
    v.literal("open"), v.literal("claimed"), v.literal("expired"),
    v.literal("handled"), v.literal("forwarded"), v.literal("missing"),
  ),
  hopId: v.string(),
  wishId: v.string(),
  senderName: v.string(),
  vouchForMe: v.union(v.string(), v.null()),
  holderName: v.string(),
  boat: v.object({
    text: v.string(),
    kind: v.union(v.literal("daily"), v.literal("real")),
    creatorName: v.string(),
    mode: v.union(v.literal("serious"), v.literal("fun")),
  }),
  chain: v.array(v.object({ name: v.string(), city: v.union(v.string(), v.null()), vouch: v.union(v.string(), v.null()) })),
  ripples: v.number(),
  expiresAt: v.number(),
  freeWishAvailable: v.boolean(),
  handled: v.union(
    v.null(),
    v.object({
      action: v.union(v.literal("claim"), v.literal("push")),
      nowRipples: v.number(),
      lastCity: v.union(v.string(), v.null()),
    }),
  ),
});

const finishResultValidator = v.object({
  freeWishUsed: v.boolean(),
  wishId: v.union(v.id("wishes"), v.null()),
  boatProgress: v.number(),
  boatsPerCoin: v.number(),
  wishesLeft: v.number(),
});

/** The hops above this one, root first (bounded by MAX_RIPPLES). */
async function upstreamHops(ctx: QueryCtx, hop: Doc<"hops">) {
  const chain: Doc<"hops">[] = [];
  let parentId = hop.parentHopId;
  while (parentId && chain.length <= MAX_RIPPLES) {
    const parent: Doc<"hops"> | null = await ctx.db.get("hops", parentId);
    if (!parent) break;
    chain.unshift(parent);
    parentId = parent.parentHopId;
  }
  return chain;
}

/** Who pushed this boat to the hop's holder: the parent hop's holder, or the wish creator at depth 1. */
async function linkSender(ctx: QueryCtx, hop: Doc<"hops">, wish: Doc<"wishes">) {
  if (hop.parentHopId) {
    const parent = await ctx.db.get("hops", hop.parentHopId);
    if (parent) return { name: parent.holderName, userId: parent.holderUserId };
  }
  const creator = await ctx.db.get("users", wish.creatorId);
  return { name: creator?.name || "Someone", userId: creator?._id };
}

/** The visitor's user row; created (like users.ensure) on first contact so no app/login is needed. */
async function ensureVisitor(ctx: MutationCtx, deviceId: string): Promise<Doc<"users">> {
  const existing = await userByDevice(ctx, deviceId);
  if (existing) return existing;
  const id = await ctx.db.insert("users", {
    name: "", avatar: avatarFor(deviceId), city: "", wishesLeft: 1, stars: 0, deviceId,
  });
  return (await ctx.db.get("users", id))!;
}

async function hasUsedFreeWish(ctx: QueryCtx, userId: Id<"users">) {
  const rows = await ctx.db
    .query("linkVisitors")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .take(20);
  return rows.some((r) => r.freeWishId);
}

/** Normalized dedupe key: E.164 phone or lowercase email. */
function contactKeyOf(raw: string): { contactKey: string; contactKind: "phone" | "email" } {
  const value = clampText(raw, LIMITS.contact);
  if (!value) throw new Error("Leave a phone number or email");
  if (value.includes("@")) {
    const email = value.toLowerCase();
    if (!EMAIL_PATTERN.test(email)) throw new Error("That email doesn't look right");
    return { contactKey: email, contactKind: "email" };
  }
  return { contactKey: normalizePhone(value), contactKind: "phone" };
}

function emptyScreen(hopId: string): FirstScreen {
  return {
    state: "missing", hopId, wishId: "", senderName: "", vouchForMe: null, holderName: "",
    boat: { text: "", kind: "real", creatorName: "", mode: "fun" },
    chain: [], ripples: 0, expiresAt: 0, freeWishAvailable: true, handled: null,
  };
}

/** The first screen of a link, from this device's point of view. Never returns contacts. */
export const firstScreen = query({
  args: { hopId: v.string(), deviceId: v.optional(v.string()) },
  returns: v.union(firstScreenValidator, v.null()),
  handler: async (ctx, args): Promise<FirstScreen | null> => {
    const hopId = ctx.db.normalizeId("hops", args.hopId);
    const hop = hopId && (await ctx.db.get("hops", hopId));
    if (!hop) return emptyScreen(args.hopId);
    const wish = await ctx.db.get("wishes", hop.wishId);
    if (!wish) return emptyScreen(args.hopId);
    const viewer = args.deviceId ? await userByDevice(ctx, args.deviceId) : null;
    const creator = await ctx.db.get("users", wish.creatorId);
    const sender = await linkSender(ctx, hop, wish);
    const chain = await upstreamHops(ctx, hop);
    const all = await wishHops(ctx, wish._id);
    const { ripples } = rippleSummary(all);
    const isMine = !!viewer && hop.holderUserId === viewer._id;

    let state: FirstScreenState = "open";
    let handled: FirstScreen["handled"] = null;
    if (isMine && hop.action) {
      state = "handled";
      const deepestWithCity = [...all].sort((a, b) => b.depth - a.depth).find((h) => h.city);
      handled = {
        action: hop.action === "its_me" ? "claim" : "push",
        nowRipples: ripples,
        lastCity: deepestWithCity?.city ?? null,
      };
    } else if (wish.status === "found" || wish.status === "granted" || all.some((h) => h.action === "its_me")) {
      state = "claimed";
    } else if (wish.status === "faded" || wish.expiresAt < Date.now()) {
      state = "expired";
    } else if ((hop.holderUserId && !isMine) || hop.action) {
      state = "forwarded";
    }

    return {
      state,
      hopId: hop._id,
      wishId: wish._id,
      senderName: sender.name,
      vouchForMe: hop.introVouch ?? null,
      holderName: hop.holderName,
      boat: {
        text: wish.text,
        kind: wish.daily ? "daily" : "real",
        creatorName: creator?.name || "Someone",
        mode: wishModeOf(wish),
      },
      chain: chain.map((h) => ({ name: h.holderName, city: h.city ?? null, vouch: h.vouchForParent ?? null })),
      ripples,
      expiresAt: wish.expiresAt,
      freeWishAvailable: viewer ? !(await hasUsedFreeWish(ctx, viewer._id)) : true,
      handled,
    };
  },
});

/** The visitor opened the link: bind an unbound, unacted hop to this device's user. */
export const open = mutation({
  args: { hopId: v.id("hops"), deviceId: v.string() },
  returns: v.null(),
  handler: async (ctx, { hopId, deviceId }) => {
    const user = await ensureVisitor(ctx, deviceId);
    const hop = await ctx.db.get("hops", hopId);
    if (!hop || hop.holderUserId || hop.action) return null;
    const wish = await ctx.db.get("wishes", hop.wishId);
    if (!wish || wish.creatorId === user._id || wish.status !== "traveling") return null;
    await ctx.db.patch("hops", hop._id, { holderUserId: user._id });
    return null;
  },
});

/** Push this boat to exactly one next person. One child per link. */
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
  returns: v.object({ childHopId: v.id("hops") }),
  handler: async (ctx, args): Promise<{ childHopId: Id<"hops"> }> => {
    const user = await ensureVisitor(ctx, args.deviceId);
    const hop = await ctx.db.get("hops", args.hopId);
    if (!hop) throw new Error("This link doesn't exist");
    const wish = await ctx.db.get("wishes", hop.wishId);
    if (!wish) throw new Error("This wish doesn't exist");
    if (wish.status !== "traveling" || wish.expiresAt < Date.now()) throw new Error("This wish isn't traveling anymore");
    if (hop.holderUserId && hop.holderUserId !== user._id) throw new Error("This boat was pushed to someone else");
    if (wish.creatorId === user._id) throw new Error("This is your own wish");
    if (hop.action) throw new Error("You've already handled this boat");
    const existing = await ctx.db
      .query("hops")
      .withIndex("by_parentHopId", (q) => q.eq("parentHopId", hop._id))
      .first();
    if (existing) throw new Error("You've already handled this boat");
    if (hop.depth >= MAX_RIPPLES) throw new Error("This wish has traveled as far as it can");

    const name = clampText(args.name, LIMITS.name);
    if (!name) throw new Error("Who are you pushing it to?");
    const creator = await ctx.db.get("users", wish.creatorId);
    const upstream = await upstreamHops(ctx, hop);
    const taken = new Set(
      [hop.holderName, user.name, creator?.name ?? "", ...upstream.map((h) => h.holderName)]
        .map(personKey)
        .filter(Boolean),
    );
    if (taken.has(personKey(name))) throw new Error(PICK_SOMEONE_ELSE);
    const vouch = clampText(args.vouch, LIMITS.vouch);
    if (!vouch) throw new Error("Write one line about them");
    const relation = clampText(args.relation, 30) || undefined;
    const details = passDetails(wishModeOf(wish), { reason: args.reason, contact: args.contact });
    const tags = relation ? cleanTags([relation]) : [];

    const childHopId = await ctx.db.insert("hops", {
      wishId: wish._id,
      parentHopId: hop._id,
      depth: hop.depth + 1,
      holderName: name,
      holderContact: details.contact,
      recipientTags: tags,
      viaGroup: false,
      introVouch: vouch,
      relation,
    });
    await ctx.db.patch("hops", hop._id, { holderUserId: user._id, action: "pass", actedAt: Date.now() });
    const progress = (user.boatProgress ?? 0) + 1;
    await ctx.db.patch("users", user._id, {
      name: user.name || hop.holderName,
      boatProgress: progress % BOATS_PER_COIN,
      wishesLeft: user.wishesLeft + Math.floor(progress / BOATS_PER_COIN),
    });
    await recordEdges(ctx, {
      owner: { userId: user._id, name: user.name || hop.holderName },
      personName: name,
      tags,
      dailyTag: wish.daily && stepAt(wish.daily, hop.depth).tag,
      ...details,
      wishId: wish._id,
      hopId: childHopId,
    });
    return { childHopId };
  },
});

/**
 * Leave a contact (required) and let the visitor's free wish set sail, once per
 * normalized contact. The free wish's first hop goes to whoever sent this link.
 */
export const finish = mutation({
  args: { hopId: v.id("hops"), deviceId: v.string(), contact: v.string(), wishText: v.optional(v.string()) },
  returns: finishResultValidator,
  handler: async (ctx, args): Promise<FinishResult & { wishId: Id<"wishes"> | null }> => {
    const user = await ensureVisitor(ctx, args.deviceId);
    const { contactKey, contactKind } = contactKeyOf(args.contact);
    const hop = await ctx.db.get("hops", args.hopId);
    if (!hop) throw new Error("This link doesn't exist");
    const wish = await ctx.db.get("wishes", hop.wishId);
    if (!wish) throw new Error("This wish doesn't exist");

    const row = await ctx.db
      .query("linkVisitors")
      .withIndex("by_contactKey", (q) => q.eq("contactKey", contactKey))
      .unique();
    const freeWishUsed = !!row?.freeWishId || (await hasUsedFreeWish(ctx, user._id));
    const text = clampText(args.wishText ?? "", LIMITS.wish);
    const visitorName = hop.holderUserId === user._id ? hop.holderName : "";
    if (!user.name && visitorName) await ctx.db.patch("users", user._id, { name: visitorName });

    let wishId: Id<"wishes"> | null = null;
    if (!freeWishUsed && text) {
      const sender = await linkSender(ctx, hop, wish);
      wishId = await ctx.db.insert("wishes", {
        creatorId: user._id,
        type: FREE_WISH_TYPE,
        mode: "serious",
        text,
        status: "traveling",
        expiresAt: Date.now() + WISH_LIFETIME_MS,
      });
      await ctx.db.insert("hops", {
        wishId,
        depth: 1,
        holderName: sender.name,
        holderUserId: sender.userId !== user._id ? sender.userId : undefined,
        recipientTags: [],
        viaGroup: false,
      });
    }

    if (!row) {
      await ctx.db.insert("linkVisitors", { contactKey, contactKind, userId: user._id, freeWishId: wishId ?? undefined });
    } else if (wishId) {
      await ctx.db.patch("linkVisitors", row._id, { freeWishId: wishId });
    }

    const fresh = (await ctx.db.get("users", user._id))!;
    return {
      freeWishUsed,
      wishId,
      boatProgress: fresh.boatProgress ?? 0,
      boatsPerCoin: BOATS_PER_COIN,
      wishesLeft: fresh.wishesLeft,
    };
  },
});

// ===== T2: claim =====
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
  handler: async (): Promise<{ status: "awaiting_confirmation" }> => {
    throw new Error("not implemented");
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
