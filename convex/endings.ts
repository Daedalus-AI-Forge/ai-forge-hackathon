import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { LIMITS, avatarFor, clampText, requireUser, userByDevice, wishHops } from "./lib";

export const MEET_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const STORY_MAX = 400;

export type Tier = "gold" | "silver" | "bronze" | "red";

export function tierFor(depth: number): Tier {
  if (depth <= 1) return "gold";
  if (depth === 2) return "silver";
  if (depth === 3) return "bronze";
  return "red";
}

type Stop = { name: string; city: string | null };

/** Template story for the Wish Granted card; the AI version replaces it once written. */
export function templateStory(people: { creatorName: string; matchName: string; metInPerson: boolean }, chain: Stop[]) {
  const [origin, ...rest] = chain;
  const ripples = rest.length;
  const through = [...new Set(rest.slice(0, -1).map((s) => s.city).filter((c): c is string => !!c))];
  const first =
    `Tossed in ${origin?.city || "the well"}` +
    (through.length ? `, passed through ${through.join(" and ")}` : "") +
    `, granted ${ripples === 1 ? "1 ripple" : `${ripples} ripples`} later.`;
  const second = `${people.creatorName} and ${people.matchName} finally met${people.metInPerson ? " in person" : ""}.`;
  return `${first} ${second}`;
}

async function hopChain(ctx: QueryCtx, hop: Doc<"hops">) {
  const chain: Doc<"hops">[] = [hop];
  let parentId = hop.parentHopId;
  while (parentId) {
    const parent: Doc<"hops"> | null = await ctx.db.get("hops", parentId);
    if (!parent) break;
    chain.unshift(parent);
    parentId = parent.parentHopId;
  }
  return chain;
}

/** Names and cities from the wisher down to the winning hop. No ids, no contacts. */
async function winningChain(ctx: QueryCtx, wish: Doc<"wishes">, creator: Doc<"users"> | null) {
  const root = { name: creator?.name || "Someone", city: creator?.city || null, avatar: creator?.avatar ?? avatarFor("?") };
  if (!wish.winningHopId) return [root];
  const winner = await ctx.db.get("hops", wish.winningHopId);
  if (!winner) return [root];
  const hops = await hopChain(ctx, winner);
  return [root, ...hops.map((h) => ({ name: h.holderName, city: h.city ?? null, avatar: avatarFor(h.holderName) }))];
}

async function photoUrl(ctx: QueryCtx, wish: Doc<"wishes">) {
  if (wish.photoId) return await ctx.storage.getUrl(wish.photoId);
  return wish.photoUrl ?? null;
}

/** The revealed ending, only once granted. Same shape for the wisher, the match and every hop on the tree. */
async function revealed(ctx: QueryCtx, wish: Doc<"wishes">) {
  if (wish.status !== "granted") return null;
  const creator = await ctx.db.get("users", wish.creatorId);
  const chain = await winningChain(ctx, wish, creator);
  const match = chain[chain.length - 1];
  const metInPerson = wish.metInPerson ?? false;
  return {
    wishText: wish.text,
    tier: wish.tier ?? null,
    photoUrl: await photoUrl(ctx, wish),
    metInPerson,
    thankYou: wish.thankYou ?? null,
    story: wish.story ?? templateStory({ creatorName: chain[0].name, matchName: match.name, metInPerson }, chain),
    chain,
  };
}

const stop = v.object({ name: v.string(), city: v.union(v.null(), v.string()), avatar: v.string() });
const tierValidator = v.union(v.null(), v.literal("gold"), v.literal("silver"), v.literal("bronze"), v.literal("red"));
const endingValidator = v.object({
  wishText: v.string(),
  tier: tierValidator,
  photoUrl: v.union(v.null(), v.string()),
  metInPerson: v.boolean(),
  thankYou: v.union(v.null(), v.string()),
  story: v.string(),
  chain: v.array(stop),
});
const photoState = v.object({
  url: v.union(v.null(), v.string()),
  by: v.union(v.literal("wisher"), v.literal("match")),
  metInPerson: v.boolean(),
});

type Party = "wisher" | "match";

/** Who is acting on a found wish: the wisher (by device) or the match (by holding the winning link). */
async function partyOf(ctx: QueryCtx, wish: Doc<"wishes">, who: { deviceId?: string; hopId?: Id<"hops"> }): Promise<Party> {
  if (who.hopId && wish.winningHopId && who.hopId === wish.winningHopId) return "match";
  if (who.deviceId) {
    const user = await userByDevice(ctx, who.deviceId);
    if (user && user._id === wish.creatorId) return "wisher";
  }
  throw new Error("Only the wisher or their match can do this");
}

async function loadFound(ctx: MutationCtx, wishId: Id<"wishes">) {
  const wish = await ctx.db.get("wishes", wishId);
  if (!wish) throw new Error("This wish doesn't exist");
  if (wish.status !== "found") throw new Error("This wish isn't waiting for a photo");
  if (wish.meetMissed) throw new Error("The 7 days to meet are over");
  return wish;
}

async function ownWish(ctx: MutationCtx, deviceId: string, wishId: Id<"wishes">) {
  const user = await requireUser(ctx, deviceId);
  const wish = await ctx.db.get("wishes", wishId);
  if (!wish || wish.creatorId !== user._id) throw new Error("Only the wisher can do this");
  return wish;
}

const partyArgs = { wishId: v.id("wishes"), deviceId: v.optional(v.string()), hopId: v.optional(v.id("hops")) };

/**
 * The single found -> granted transition. Other features (rewards) hook in here.
 * Returns false when the wish was not waiting to be granted.
 */
export async function markGranted(ctx: MutationCtx, wishId: Id<"wishes">) {
  const wish = await ctx.db.get("wishes", wishId);
  if (!wish || wish.status !== "found" || !wish.winningHopId || wish.meetMissed) return false;
  await ctx.db.patch("wishes", wishId, { status: "granted", grantedAt: Date.now() });
  if (!wish.story) await ctx.scheduler.runAfter(0, internal.ai.writeGrantedStory, { wishId });
  return true;
}

/** Wisher's view of one of their wishes: "It's me!" candidates, the match, the photo and the ending. */
export const wishDetail = query({
  args: { deviceId: v.string(), wishId: v.string() },
  handler: async (ctx, args) => {
    const wishId = ctx.db.normalizeId("wishes", args.wishId);
    if (!wishId) return null;
    const user = await userByDevice(ctx, args.deviceId);
    const wish = await ctx.db.get("wishes", wishId);
    if (!user || !wish || wish.creatorId !== user._id) return null;
    const candidates = [];
    if (wish.status === "traveling") {
      for (const hop of await wishHops(ctx, wish._id)) {
        if (hop.action !== "its_me" || hop.rejected) continue;
        const above = (await hopChain(ctx, hop)).slice(0, -1);
        candidates.push({
          hopId: hop._id,
          name: hop.holderName,
          city: hop.city ?? null,
          intro: hop.itsMeIntro ?? "",
          depth: hop.depth,
          tier: tierFor(hop.depth),
          avatar: avatarFor(hop.holderName),
          chain: above.map((h) => ({
            name: h.holderName,
            city: h.city ?? null,
            vouch: h.vouchForParent ?? null,
            avatar: avatarFor(h.holderName),
          })),
        });
      }
      candidates.sort((a, b) => a.depth - b.depth);
    }
    const winner = wish.winningHopId ? await ctx.db.get("hops", wish.winningHopId) : null;
    return {
      _id: wish._id,
      text: wish.text,
      status: wish.status,
      tier: wish.tier ?? null,
      expiresAt: wish.expiresAt,
      meetDeadline: wish.meetDeadline ?? null,
      meetMissed: wish.meetMissed ?? false,
      thankYou: wish.thankYou ?? null,
      candidates,
      match: winner
        ? { name: winner.holderName, city: winner.city ?? null, contact: winner.holderContact ?? null, avatar: avatarFor(winner.holderName) }
        : null,
      photo:
        wish.status === "found" && wish.photoBy
          ? { url: await photoUrl(ctx, wish), by: wish.photoBy, metInPerson: wish.metInPerson ?? false }
          : null,
      ending: await revealed(ctx, wish),
    };
  },
});

/** What one link holder sees once the wish is found or they said "It's me!": their verdict, or the (locked) ending. */
export const forHop = query({
  args: { hopId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      status: v.union(v.literal("traveling"), v.literal("found"), v.literal("granted"), v.literal("faded")),
      role: v.union(v.literal("match"), v.literal("rejected"), v.literal("pending"), v.literal("helper")),
      wishId: v.id("wishes"),
      wisherName: v.string(),
      meetDeadline: v.union(v.null(), v.number()),
      meetMissed: v.boolean(),
      wisherContact: v.union(v.null(), v.string()),
      hasOwnContact: v.boolean(),
      photo: v.union(v.null(), photoState),
      ending: v.union(v.null(), endingValidator),
    }),
  ),
  handler: async (ctx, args) => {
    const hopId = ctx.db.normalizeId("hops", args.hopId);
    if (!hopId) return null;
    const hop = await ctx.db.get("hops", hopId);
    if (!hop) return null;
    const wish = await ctx.db.get("wishes", hop.wishId);
    if (!wish) return null;
    const creator = await ctx.db.get("users", wish.creatorId);
    const isMatch = wish.winningHopId === hop._id;
    const role: "match" | "rejected" | "pending" | "helper" = isMatch
      ? "match"
      : hop.action === "its_me"
        ? hop.rejected || wish.status !== "traveling"
          ? "rejected"
          : "pending"
        : "helper";
    return {
      status: wish.status,
      role,
      wishId: wish._id,
      wisherName: creator?.name || "The wisher",
      meetDeadline: wish.meetDeadline ?? null,
      meetMissed: wish.meetMissed ?? false,
      wisherContact: isMatch ? (wish.wisherContact ?? null) : null,
      hasOwnContact: !!hop.holderContact,
      photo:
        isMatch && wish.status === "found" && wish.photoBy
          ? { url: await photoUrl(ctx, wish), by: wish.photoBy, metInPerson: wish.metInPerson ?? false }
          : null,
      ending: await revealed(ctx, wish),
    };
  },
});

/** Public, read-only Wish Granted card for sharing: no contacts, no hop ids, no thank-you, granted wishes only. */
export const card = query({
  args: { wishId: v.string() },
  returns: v.union(v.null(), endingValidator),
  handler: async (ctx, args) => {
    const wishId = ctx.db.normalizeId("wishes", args.wishId);
    if (!wishId) return null;
    const wish = await ctx.db.get("wishes", wishId);
    if (!wish) return null;
    const ending = await revealed(ctx, wish);
    return ending ? { ...ending, thankYou: null } : null;
  },
});

/** "Yes, it's you": the wish is found, both sides get one contact, and the 7-day meet clock starts. */
export const confirmMatch = mutation({
  args: { deviceId: v.string(), hopId: v.id("hops"), contact: v.string(), thankYou: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const hop = await ctx.db.get("hops", args.hopId);
    if (!hop) throw new Error("This link doesn't exist");
    const wish = await ownWish(ctx, args.deviceId, hop.wishId);
    if (wish.status !== "traveling") throw new Error("This wish isn't traveling anymore");
    if (hop.action !== "its_me" || hop.rejected) throw new Error("They haven't said it's them");
    const contact = clampText(args.contact, LIMITS.contact);
    if (!contact) throw new Error("Add one contact so they can reach you");
    const meetDeadline = Date.now() + MEET_WINDOW_MS;
    await ctx.db.patch("wishes", wish._id, {
      status: "found",
      winningHopId: hop._id,
      tier: tierFor(hop.depth),
      meetDeadline,
      wisherContact: contact,
      thankYou: clampText(args.thankYou ?? "", LIMITS.message) || undefined,
    });
    await ctx.scheduler.runAt(meetDeadline, internal.endings.meetExpired, { wishId: wish._id });
    return null;
  },
});

/** "Not quite": that candidate is turned down and the wish keeps traveling. */
export const rejectCandidate = mutation({
  args: { deviceId: v.string(), hopId: v.id("hops") },
  handler: async (ctx, args) => {
    const hop = await ctx.db.get("hops", args.hopId);
    if (!hop) throw new Error("This link doesn't exist");
    const wish = await ownWish(ctx, args.deviceId, hop.wishId);
    if (wish.status !== "traveling") throw new Error("This wish isn't traveling anymore");
    if (hop.action !== "its_me") throw new Error("They haven't said it's them");
    await ctx.db.patch("hops", hop._id, { rejected: true });
    return null;
  },
});

export const setThankYou = mutation({
  args: { deviceId: v.string(), wishId: v.id("wishes"), thankYou: v.string() },
  handler: async (ctx, args) => {
    const wish = await ownWish(ctx, args.deviceId, args.wishId);
    if (wish.status !== "found" && wish.status !== "granted") throw new Error("Thank them once they're found");
    await ctx.db.patch("wishes", wish._id, { thankYou: clampText(args.thankYou, LIMITS.message) || undefined });
    return null;
  },
});

/** The match adds a contact after the fact (the "It's me!" form left it optional). */
export const setMatchContact = mutation({
  args: { hopId: v.id("hops"), contact: v.string() },
  handler: async (ctx, args) => {
    const hop = await ctx.db.get("hops", args.hopId);
    const wish = hop ? await ctx.db.get("wishes", hop.wishId) : null;
    if (!hop || !wish || wish.winningHopId !== hop._id) throw new Error("Only the match can do this");
    const contact = clampText(args.contact, LIMITS.contact);
    if (!contact) throw new Error("Add a phone, WeChat or Instagram");
    await ctx.db.patch("hops", hop._id, { holderContact: contact });
    return null;
  },
});

export const generateUploadUrl = mutation({
  args: partyArgs,
  handler: async (ctx, args) => {
    const wish = await loadFound(ctx, args.wishId);
    await partyOf(ctx, wish, args);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Either side uploads the photo together; the other side then confirms it.
 * A refused upload is deleted and the reason returned (a throw would roll the delete back).
 */
export const submitPhoto = mutation({
  args: { ...partyArgs, storageId: v.id("_storage"), metInPerson: v.boolean() },
  returns: v.union(v.null(), v.string()),
  handler: async (ctx, args) => {
    const meta = await ctx.db.system.get("_storage", args.storageId);
    if (!meta) return "Upload the photo first";
    const wish = await ctx.db.get("wishes", args.wishId);
    const open = wish && wish.status === "found" && !wish.meetMissed;
    const by = open ? await partyOf(ctx, wish, args).catch(() => null) : null;
    const refusal = !wish || !by
      ? "Only the wisher or their match can add the photo"
      : !meta.contentType?.startsWith("image/") || meta.size > PHOTO_MAX_BYTES
        ? "Pick a photo under 10 MB"
        : null;
    if (refusal || !wish || !by) {
      await ctx.storage.delete(args.storageId);
      return refusal;
    }
    if (wish.photoId && wish.photoId !== args.storageId) await ctx.storage.delete(wish.photoId);
    await ctx.db.patch("wishes", wish._id, { photoId: args.storageId, photoBy: by, metInPerson: args.metInPerson });
    return null;
  },
});

/** The other side says "yes, that's us" and the wish is granted. */
export const confirmPhoto = mutation({
  args: partyArgs,
  handler: async (ctx, args) => {
    const wish = await loadFound(ctx, args.wishId);
    const by = await partyOf(ctx, wish, args);
    if (!wish.photoBy) throw new Error("No photo yet");
    if (wish.photoBy === by) throw new Error("The other side confirms the photo");
    await markGranted(ctx, wish._id);
    return null;
  },
});

/** 7 days after "found": no confirmed photo means no ending. It stays locked and is marked missed. */
export const meetExpired = internalMutation({
  args: { wishId: v.id("wishes") },
  handler: async (ctx, { wishId }) => {
    const wish = await ctx.db.get("wishes", wishId);
    if (!wish || wish.status !== "found") return null;
    await ctx.db.patch("wishes", wishId, { meetMissed: true });
    return null;
  },
});

export const storyContext = internalQuery({
  args: { wishId: v.id("wishes") },
  handler: async (ctx, { wishId }) => {
    const wish = await ctx.db.get("wishes", wishId);
    if (!wish) return null;
    const ending = await revealed(ctx, wish);
    if (!ending) return null;
    return {
      story: wish.story ?? null,
      fallback: ending.story,
      wishText: wish.text,
      metInPerson: ending.metInPerson,
      chain: ending.chain.map((s) => ({ name: s.name, city: s.city })),
    };
  },
});

export const setStory = internalMutation({
  args: { wishId: v.id("wishes"), story: v.string() },
  handler: async (ctx, { wishId, story }) => {
    const wish = await ctx.db.get("wishes", wishId);
    if (!wish || wish.story) return null;
    await ctx.db.patch("wishes", wishId, { story: clampText(story, STORY_MAX) });
    return null;
  },
});
