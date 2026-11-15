// Link page API (docs/superpowers/plans/2026-11-15-link-page.md). Skeleton: signatures only.
// Sections are owned by tasks: T1 core (firstScreen/open/pushOne/finish), T2 claim, T3 drafts/confirm, T4 ending.
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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
 * The wisher confirms a verified "it's me" claim: the wish is found and both sides get
 * each other's number. Idempotent: confirming the same hop again sends nothing new.
 */
export const confirmClaim = mutation({
  args: { hopId: v.id("hops"), deviceId: v.string() },
  handler: async (ctx, a) => {
    const user = await t3UserByDevice(ctx, a.deviceId);
    const hop = await ctx.db.get("hops", a.hopId);
    if (!hop) throw new Error("Boat not found");
    const wish = await ctx.db.get("wishes", hop.wishId);
    if (!wish) throw new Error("Boat not found");
    if (!user || wish.creatorId !== user._id) throw new Error("Only the wisher can confirm this claim");
    if (hop.action !== "its_me" || !hop.claimVerified) throw new Error("This claim isn't verified yet");
    if (wish.status === "found" && wish.winningHopId === hop._id) return null;
    if (wish.status !== "traveling") throw new Error("This wish isn't open anymore");

    await ctx.db.patch("wishes", wish._id, { status: "found", winningHopId: hop._id });

    const creatorName = t3DisplayName(user.name, "The wisher");
    const claimerName = t3DisplayName(hop.holderName, "your match");
    const creatorContact = await t3ContactOf(ctx, user);
    const claimPhone = hop.claimPhone;

    if (claimPhone) {
      const theirs = creatorContact ? ` Reach them at ${creatorContact}.` : "";
      await ctx.scheduler.runAfter(0, t3Internal.notify.send, {
        to: claimPhone,
        kind: "claimConfirmed",
        text: `${creatorName} confirmed — it's you! We sent you their number, and yours to them.${theirs}`,
      });
    }
    if (creatorContact) {
      const theirs = claimPhone ? ` Reach them at ${claimPhone}.` : "";
      await ctx.scheduler.runAfter(0, t3Internal.notify.send, {
        to: creatorContact,
        kind: "claimConfirmed",
        text: `You confirmed ${claimerName} — it's them! We sent you their number, and yours to them.${theirs}`,
      });
    } else {
      console.log(JSON.stringify({ event: "notify_skipped", kind: "claimConfirmed", reason: "creator_no_contact", wishId: wish._id }));
    }
    return null;
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
export const ending = query({
  args: { wishId: v.string() },
  handler: async (): Promise<null> => null, // returns EndingView | null when implemented
});
