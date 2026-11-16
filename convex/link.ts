// Link page API (docs/superpowers/plans/2026-11-15-link-page.md). Skeleton: signatures only.
// Sections are owned by tasks: T1 core (firstScreen/open/pushOne/finish), T2 claim, T3 drafts/confirm, T4 ending.
import { v, type Infer } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { EndingView, FinishResult, FirstScreen, FirstScreenState } from "../src/lib/linkApi.types";
import { stepAt } from "./daily";
import { personKey } from "./graphShared";
import {
  BOATS_PER_COIN, LIMITS, MAX_RIPPLES, WISH_LIFETIME_MS, avatarFor, clampText, cleanTags,
  passDetails, recordEdges, requireDeviceId, rippleSummary, userByDevice, wishHops, wishModeOf,
} from "./lib";
import { MEET_WINDOW_MS, tierFor, winningBranch } from "./meetings";
import { hopAction, meetingTier } from "./schema";
import { checkCode, normalizePhone, smsModeFor } from "./sms";

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
      // Push only, and only to the device that pushed: lets it resend a message it never sent.
      childHopId: v.optional(v.string()),
      childName: v.optional(v.string()),
      vouch: v.optional(v.string()),
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
    if (parent) return { name: senderDisplayName(parent.holderName), userId: parent.holderUserId };
  }
  const creator = await ctx.db.get("users", wish.creatorId);
  return { name: senderDisplayName(creator?.name), userId: creator?._id };
}

/** A sender with no name (or the daily join placeholder "You") shows as "A friend", never "You". */
export function senderDisplayName(name: string | null | undefined) {
  const n = (name ?? "").trim();
  return !n || n.toLowerCase() === "you" ? "A friend" : n;
}

/**
 * What the sender said about this hop's holder: the link-page vouch, or for a first hop the
 * toss reason (the creator's own words about this recipient). Never tags.
 */
export async function vouchForHolder(ctx: QueryCtx, hop: Doc<"hops">, wish: Doc<"wishes">): Promise<string | null> {
  const vouch = hop.introVouch?.trim();
  if (vouch) return vouch;
  if (hop.parentHopId) return null;
  const edges = await ctx.db
    .query("edges")
    .withIndex("by_ownerUserId_and_personName", (q) => q.eq("ownerUserId", wish.creatorId).eq("personName", hop.holderName))
    .take(100);
  return edges.find((e) => e.hopId === hop._id && e.reason?.trim())?.reason?.trim() ?? null;
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
      if (handled.action === "push") {
        // isMine guarantees this is the pushing device; other viewers never get the child link.
        const child = await ctx.db
          .query("hops")
          .withIndex("by_parentHopId", (q) => q.eq("parentHopId", hop._id))
          .first();
        if (child) {
          handled.childHopId = child._id;
          handled.childName = child.holderName;
          if (child.introVouch) handled.vouch = child.introVouch;
        }
      }
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
      vouchForMe: await vouchForHolder(ctx, hop, wish),
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
    // Record where the boat was when it was pushed, so ripples and receipts can say "now in <city>".
    const city = hop.city ?? (user.city.trim() || undefined);
    await ctx.db.patch("hops", hop._id, { holderUserId: user._id, action: "pass", actedAt: Date.now(), city });
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
  returns: v.object({ status: v.literal("awaiting_confirmation") }),
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
    const user = await userByDevice(ctx, args.deviceId);
    if (hop.holderUserId && user?._id !== hop.holderUserId) throw new Error("This boat is with someone else");
    const intro = clampText(args.intro, LIMITS.intro);
    if (!intro) throw new Error("Write a one-line intro");
    const now = Date.now();

    if (wish.daily) {
      if (args.proofStorageId && await ctx.db.query("meetingUploads")
        .withIndex("by_storageId", q => q.eq("storageId", args.proofStorageId)).first()) {
        throw new Error("Choose a separate photo for this daily boat");
      }
      await ctx.db.patch("hops", hop._id, {
        itsMeIntro: intro,
        itsMePublic: args.showNameAndCity,
        proofStorageId: args.proofStorageId,
        action: "its_me",
        actedAt: now,
      });
      await ctx.scheduler.runAfter(0, t3Internal.link.notifyLanded, { hopId: hop._id });
      return { status: "awaiting_confirmation" };
    }

    if (user?._id === wish.creatorId) throw new Error("You can't claim your own wish");
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
    const visitor = user ?? await ensureVisitor(ctx, args.deviceId);
    await ctx.db.patch("hops", hop._id, {
      holderUserId: visitor._id,
      itsMeIntro: intro,
      claimAnswers: answers,
      claimPhone: phone,
      claimVerified: true,
      action: "its_me",
      actedAt: now,
    });
    // Tell whoever pushed this boat that it landed (log-only without a contact).
    await ctx.scheduler.runAfter(0, t3Internal.link.notifyLanded, { hopId: hop._id });
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
// Imports live here (hoisted) so parallel sections don't collide on the file header.
import { internalMutation as t3InternalMutation, type MutationCtx as T3MutationCtx } from "./_generated/server";
import { internal as t3Internal } from "./_generated/api";
import type { Doc as T3Doc, Id as T3Id } from "./_generated/dataModel";
import { clampText as t3Clamp, LIMITS as T3_LIMITS, requireUser as t3RequireUser, userByDevice as t3UserByDevice } from "./lib";
import { normalizePhone as t3NormalizePhone } from "./sms";

export const DRAFT_REMINDER_MS = 24 * 60 * 60 * 1000;
export const DRAFT_REMINDER_TEXT = "Your wish is still waiting on the shore to set sail";
const CONTACT_REQUIRED = "Leave a phone number or email";

/** Normalized dedupe key for a visitor contact: E.164 phone or lowercase email. */
function t3ContactKey(contact: string): { contactKey: string; contactKind: "phone" | "email" } {
  const raw = t3Clamp(contact, T3_LIMITS.contact);
  if (raw.includes("@")) {
    const email = raw.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(CONTACT_REQUIRED);
    return { contactKey: email, contactKind: "email" };
  }
  if (!raw) throw new Error(CONTACT_REQUIRED);
  return { contactKey: t3NormalizePhone(raw), contactKind: "phone" };
}

/** Best known contact for a user: verified phone first, then any link-page contact. */
async function t3ContactOf(ctx: T3MutationCtx, user: T3Doc<"users"> | null) {
  if (!user) return undefined;
  const visitors = await ctx.db
    .query("linkVisitors")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .take(10);
  return user.phone ?? visitors.find((r) => r.contactKind === "phone")?.contactKey ?? visitors[0]?.contactKey;
}

function t3DisplayName(name: string | undefined, fallback: string) {
  const n = (name ?? "").trim();
  return n || fallback;
}

/**
 * Save the visitor's unfinished wish. With a contact, the draft is attached to that
 * contact's visitor row (created if new) and one reminder is queued for +24h; without
 * one, it lands on the device's existing row, or is a no-op when there is none yet
 * (the client keeps its local draft until a contact exists).
 */
export const saveDraft = mutation({
  args: { deviceId: v.string(), contact: v.optional(v.string()), wishText: v.string() },
  handler: async (ctx, a) => {
    const user = await t3RequireUser(ctx, a.deviceId);
    const draftText = t3Clamp(a.wishText, T3_LIMITS.wish);
    const now = Date.now();
    const contact = a.contact?.trim() ? t3ContactKey(a.contact) : null;

    let row = contact
      ? await ctx.db
          .query("linkVisitors")
          .withIndex("by_contactKey", (q) => q.eq("contactKey", contact.contactKey))
          .first()
      : await ctx.db
          .query("linkVisitors")
          .withIndex("by_userId", (q) => q.eq("userId", user._id))
          .first();
    if (!row) {
      if (!contact) return null;
      const id = await ctx.db.insert("linkVisitors", { ...contact, userId: user._id });
      row = (await ctx.db.get("linkVisitors", id))!;
    }
    if (row.freeWishId) return null; // already sailed; nothing left to remind about
    const firstDraft = row.draftAt === undefined;
    await ctx.db.patch("linkVisitors", row._id, { draftText, draftAt: now });
    if (contact && firstDraft && !row.remindedAt) {
      await ctx.scheduler.runAfter(DRAFT_REMINDER_MS, t3Internal.link.draftReminder, { visitorId: row._id });
    }
    return null;
  },
});

/** Scheduled by saveDraft: nudge once, only if the visitor still hasn't made their free wish. */
export const draftReminder = t3InternalMutation({
  args: { visitorId: v.id("linkVisitors") },
  handler: async (ctx, a) => {
    const row = await ctx.db.get("linkVisitors", a.visitorId);
    if (!row || row.freeWishId || row.remindedAt || !row.draftText) return null;
    await ctx.db.patch("linkVisitors", row._id, { remindedAt: Date.now() });
    await ctx.scheduler.runAfter(0, t3Internal.notify.send, {
      to: row.contactKey,
      kind: "draftReminder",
      text: DRAFT_REMINDER_TEXT,
    });
    return null;
  },
});

/**
 * The wisher confirms a verified "it's me" claim: the wish is found and the claimer's
 * verified phone is returned to the wisher only, so the app can open the wisher's OWN
 * Messages app prefilled to them. We never text anyone's number on their behalf; the
 * scheduled notices below carry no phone numbers. Idempotent for the same hop.
 */
export const confirmClaim = mutation({
  args: { hopId: v.id("hops"), deviceId: v.string() },
  returns: v.object({ claimerName: v.string(), claimerPhone: v.string() }),
  handler: async (ctx, a): Promise<{ claimerName: string; claimerPhone: string }> => {
    const user = await t3UserByDevice(ctx, a.deviceId);
    const hop = await ctx.db.get("hops", a.hopId);
    if (!hop) throw new Error("Boat not found");
    const wish = await ctx.db.get("wishes", hop.wishId);
    if (!wish) throw new Error("Boat not found");
    if (!user || wish.creatorId !== user._id) throw new Error("Only the wisher can confirm this claim");
    if (hop.action !== "its_me" || !hop.claimVerified || !hop.claimPhone) throw new Error("This claim isn't verified yet");
    const claimerName = t3DisplayName(hop.holderName, "your match");
    const result = { claimerName, claimerPhone: hop.claimPhone };
    if ((wish.status === "found" || wish.status === "granted") && wish.winningHopId === hop._id) return result;
    const now = Date.now();
    if (wish.status !== "traveling" || wish.expiresAt <= now) throw new Error("This wish isn't open anymore");

    await ctx.db.patch("wishes", wish._id, {
      status: "found",
      winningHopId: hop._id,
      ...(wish.daily ? {} : { meetDeadline: now + MEET_WINDOW_MS }),
    });

    const creatorName = t3DisplayName(user.name, "The wisher");
    const creatorContact = await t3ContactOf(ctx, user);
    await ctx.scheduler.runAfter(0, t3Internal.notify.send, {
      to: hop.claimPhone,
      kind: "claimConfirmed",
      text: `${creatorName} confirmed — it's you! Watch for a text from them.`,
    });
    if (creatorContact) {
      await ctx.scheduler.runAfter(0, t3Internal.notify.send, {
        to: creatorContact,
        kind: "claimConfirmed",
        text: `You confirmed ${claimerName}. Text them from your phone to say hi.`,
      });
    } else {
      console.log(JSON.stringify({ event: "notify_skipped", kind: "claimConfirmed", reason: "creator_no_contact", wishId: wish._id }));
    }
    return result;
  },
});

/**
 * Verified "it's me" claims on the caller's traveling wishes, newest first, for the
 * app's confirm card. Never includes the claimer's phone (confirmClaim returns it).
 */
export const pendingClaims = query({
  args: { deviceId: v.string() },
  returns: v.array(
    v.object({
      hopId: v.id("hops"),
      wishId: v.id("wishes"),
      wishText: v.string(),
      claimerName: v.string(),
      intro: v.string(),
      answers: v.array(v.string()),
      claimedAt: v.number(),
    }),
  ),
  handler: async (ctx, a) => {
    const user = await t3UserByDevice(ctx, a.deviceId);
    if (!user) return [];
    const wishes = await ctx.db
      .query("wishes")
      .withIndex("by_creatorId", (q) => q.eq("creatorId", user._id))
      .order("desc")
      .take(20);
    const out = [];
    for (const wish of wishes) {
      if (wish.status !== "traveling") continue;
      const hops = await ctx.db
        .query("hops")
        .withIndex("by_wishId", (q) => q.eq("wishId", wish._id))
        .take(200);
      for (const h of hops) {
        if (h.action !== "its_me" || !h.claimVerified) continue;
        out.push({
          hopId: h._id,
          wishId: wish._id,
          wishText: wish.text,
          claimerName: t3DisplayName(h.holderName, "Someone"),
          intro: h.itsMeIntro ?? "",
          answers: h.claimAnswers ?? [],
          claimedAt: h.actedAt ?? h._creationTime,
        });
      }
    }
    return out.sort((x, y) => y.claimedAt - x.claimedAt);
  },
});

/**
 * Called by the claim flow: tell whoever pushed this boat that it landed. The pusher is
 * the parent hop's holder (or the wish creator at depth 1). Log-only without a contact.
 */
export const notifyLanded = t3InternalMutation({
  args: { hopId: v.id("hops") },
  handler: async (ctx, a) => {
    const hop = await ctx.db.get("hops", a.hopId);
    if (!hop) return null;
    const wish = await ctx.db.get("wishes", hop.wishId);
    if (!wish) return null;
    const parent = hop.parentHopId ? await ctx.db.get("hops", hop.parentHopId) : null;
    const pusherId: T3Id<"users"> | undefined = parent ? parent.holderUserId : wish.creatorId;
    const pusher = pusherId ? await ctx.db.get("users", pusherId) : null;
    const to = await t3ContactOf(ctx, pusher);
    if (!to) {
      console.log(JSON.stringify({ event: "notify_skipped", kind: "landed", reason: "pusher_no_contact", hopId: hop._id }));
      return null;
    }
    await ctx.scheduler.runAfter(0, t3Internal.notify.send, {
      to,
      kind: "landed",
      text: `Your boat landed — ${t3DisplayName(hop.holderName, "someone")} says it's them!`,
    });
    return null;
  },
});

// ===== T4: ending =====
/** Hop cities in depth order, consecutive duplicates collapsed. */
export function endingRoute(hops: { depth: number; city?: string; _creationTime: number }[]) {
  const route: string[] = [];
  const sorted = [...hops].sort((a, b) => a.depth - b.depth || a._creationTime - b._creationTime);
  for (const h of sorted) {
    const city = h.city?.trim();
    if (city && route[route.length - 1] !== city) route.push(city);
  }
  return route;
}

/** Two-sentence template story (no AI). */
export function endingStory(status: "traveling" | "found" | "granted" | "faded", route: string[], ripples: number, metInPerson?: boolean) {
  const hands = ripples === 1 ? "1 pair of hands" : `${ripples} pairs of hands`;
  const first =
    route.length > 1
      ? `Your wish sailed from ${route[0]} to ${route[route.length - 1]} through ${hands}.`
      : route.length === 1
        ? `Your wish sailed around ${route[0]} through ${hands}.`
        : `Your wish sailed through ${hands}.`;
  const second = {
    traveling: "It is still out there, looking for the right person.",
    found: "Someone said it's me, and the right person found it.",
    granted: metInPerson === undefined ? "It came true when the right person said it's me." :
      metInPerson ? "The two made it come true when they met in person." : "The two made it come true when they met on a call.",
    faded: "It faded before anyone claimed it, but every hand that pushed it thought of you.",
  }[status];
  return `${first} ${second}`;
}

type EndingHolder = {
  key: string;
  name: string;
  city: string | null;
  depth: number;
  avatar: string;
  acted: Infer<typeof hopAction> | null;
};

type PublicEnding = EndingView & {
  locked: boolean;
  thankYou: string;
  tier: Infer<typeof meetingTier> | null;
  metInPerson: boolean | null;
  holders?: EndingHolder[];
};

async function endingHolders(ctx: QueryCtx, creator: Doc<"users"> | null, hops: Doc<"hops">[]): Promise<EndingHolder[]> {
  const creatorVisible = creator?.showInLogs !== false;
  const creatorName = (creatorVisible && creator?.name.trim()) || "The wisher";
  const root: EndingHolder = { key: "creator", name: creatorName, city: creatorVisible ? creator?.city.trim() || null : null,
    depth: 0, avatar: creatorVisible && creator?.avatar ? creator.avatar : avatarFor(creatorName), acted: null };
  const branch = await Promise.all(hops.map(async (hop, index): Promise<EndingHolder> => {
    const holder = hop.holderUserId ? await ctx.db.get("users", hop.holderUserId) : null;
    const shown = hop.itsMePublic !== false && holder?.showInLogs !== false;
    const name = (shown && hop.holderName.trim()) || "Someone";
    return { key: String(index), name, city: shown ? hop.city?.trim() || null : null, depth: hop.depth,
      avatar: shown && holder?.avatar ? holder.avatar : avatarFor(name), acted: hop.action ?? null };
  }));
  return [root, ...branch];
}

export const ending = query({
  args: { wishId: v.string() },
  returns: v.union(v.null(), v.object({
    status: v.union(v.literal("traveling"), v.literal("found"), v.literal("granted"), v.literal("faded")),
    wishText: v.string(),
    photoUrl: v.union(v.string(), v.null()),
    locked: v.boolean(),
    story: v.string(),
    route: v.array(v.string()),
    ripples: v.number(),
    thankYou: v.string(),
    tier: v.union(meetingTier, v.null()),
    metInPerson: v.union(v.boolean(), v.null()),
    holders: v.optional(v.array(v.object({ key: v.string(), name: v.string(), city: v.union(v.string(), v.null()),
      depth: v.number(), avatar: v.string(), acted: v.union(hopAction, v.null()) }))),
  })),
  handler: async (ctx, args): Promise<PublicEnding | null> => {
    const wishId = ctx.db.normalizeId("wishes", args.wishId);
    if (!wishId) return null;
    const wish = await ctx.db.get("wishes", wishId);
    if (!wish) return null;
    const base = { status: wish.status, wishText: wish.text };
    if (!wish.daily && wish.status !== "granted") {
      const story = {
        traveling: "This wish is still looking for its person.",
        found: "The ending unlocks after the participants meet and confirm their photo.",
        faded: "This wish faded before it was granted.",
      }[wish.status];
      return { ...base, locked: true, photoUrl: null, story, route: [], ripples: 0, thankYou: "", tier: null, metInPerson: null };
    }
    const winningHop = wish.winningHopId ? await ctx.db.get("hops", wish.winningHopId) : null;
    const winner = winningHop?.wishId === wish._id ? winningHop : null;
    if (wish.daily) {
      const hops = await wishHops(ctx, wish._id);
      const finder = (winner?.proofStorageId && winner) || hops.find(h => h.action === "its_me" && h.proofStorageId);
      const proofUrl = finder?.proofStorageId ? await ctx.storage.getUrl(finder.proofStorageId) : null;
      const route = endingRoute(hops);
      const { ripples } = rippleSummary(hops);
      // Daily boats have no confirmClaim, so wish.status stays "traveling": a claim is the ending.
      const claimer = finder ?? hops.find(h => h.action === "its_me");
      const status = claimer && wish.status === "traveling" ? "found" : wish.status;
      const intro = claimer?.itsMeIntro?.trim();
      const story = endingStory(status, route, ripples) + (claimer && intro ? ` In their words: "${intro}"` : "");
      return { ...base, status, locked: false, photoUrl: proofUrl ?? wish.photoUrl ?? null,
        route, ripples, story, thankYou: "", tier: null, metInPerson: null };
    }
    // Older granted rows may lack a recorded winner. Prefer their recorded finder when present.
    const recordedWinner = winner ?? (await wishHops(ctx, wish._id)).find(h => h.action === "its_me");
    const hops = recordedWinner ? await winningBranch(ctx, recordedWinner) : [];
    const creator = await ctx.db.get("users", wish.creatorId);
    const holders = await endingHolders(ctx, creator, hops);
    const route = endingRoute(holders.map((h, index) => ({ depth: h.depth, city: h.city ?? undefined, _creationTime: index })));
    const ripples = recordedWinner?.depth ?? 0;
    const photo = wish.meetingPhoto;
    return {
      ...base, locked: false, route, ripples, holders,
      photoUrl: (photo && await ctx.storage.getUrl(photo.storageId)) ?? wish.photoUrl ?? null,
      story: wish.endingStory ?? endingStory(wish.status, route, ripples, photo?.metInPerson ?? wish.metInPerson),
      thankYou: photo?.thankYou ?? "",
      tier: wish.tier ?? (ripples > 0 ? tierFor(ripples) : null),
      metInPerson: photo?.metInPerson ?? wish.metInPerson ?? null,
    };
  },
});
