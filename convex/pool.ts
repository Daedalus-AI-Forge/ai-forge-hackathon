import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { requireUser, userByDevice, wishHops } from "./lib";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type Hop = Doc<"hops">;

/** Every hop under `root` (inclusive), from one bounded read of the wish's hops. */
function subtree(hops: Hop[], root: Hop) {
  const children = new Map<string, Hop[]>();
  for (const h of hops) {
    if (!h.parentHopId) continue;
    const list = children.get(h.parentHopId) ?? [];
    list.push(h);
    children.set(h.parentHopId, list);
  }
  const out: Hop[] = [];
  const queue = [root];
  while (queue.length) {
    const h = queue.shift()!;
    out.push(h);
    queue.push(...(children.get(h._id) ?? []));
  }
  return { out, byId: new Map(hops.map((h) => [h._id as string, h])) };
}

/** Where a boat pushed from `root` ended up: the person who said "that's me", else the farthest holder. */
function endpointOf(hops: Hop[], root: Hop) {
  const { out, byId } = subtree(hops, root);
  const found = out.filter((h) => h.action === "its_me").sort((a, b) => a.depth - b.depth)[0];
  const end = found ?? out.reduce((far, h) => (h.depth > far.depth ? h : far), root);
  const path: Hop[] = [];
  for (let h: Hop | undefined = end; h; h = h.parentHopId ? byId.get(h.parentHopId) : undefined) {
    path.unshift(h);
    if (h._id === root._id) break;
  }
  return { end, found: found ?? null, path };
}

async function pushedHops(ctx: QueryCtx, userId: Id<"users">, take: number) {
  const pass = await ctx.db
    .query("hops")
    .withIndex("by_holderUserId_and_action", (q) => q.eq("holderUserId", userId).eq("action", "pass"))
    .order("desc")
    .take(take);
  const group = await ctx.db
    .query("hops")
    .withIndex("by_holderUserId_and_action", (q) => q.eq("holderUserId", userId).eq("action", "group"))
    .order("desc")
    .take(take);
  return [...pass, ...group].sort((a, b) => (b.actedAt ?? 0) - (a.actedAt ?? 0)).slice(0, take);
}

function foundCard(found: Hop | null) {
  if (!found) return null;
  const shown = found.itsMePublic !== false;
  return {
    name: shown ? found.holderName : "Someone",
    city: shown ? (found.city ?? null) : null,
    story: found.itsMeIntro ?? "",
  };
}

/**
 * The voyage log: where the daily boat I pushed most recently before `date`
 * (the client's UTC day, YYYY-MM-DD) has drifted, and who it found.
 */
export const voyageLog = query({
  args: { deviceId: v.string(), date: v.string() },
  handler: async (ctx, { deviceId, date }) => {
    if (!DATE_PATTERN.test(date)) throw new Error("Invalid date");
    const user = await userByDevice(ctx, deviceId);
    if (!user) return null;
    for (const mine of await pushedHops(ctx, user._id, 20)) {
      const wish = await ctx.db.get("wishes", mine.wishId);
      if (!wish?.daily || wish.daily.date >= date) continue;
      const hops = await wishHops(ctx, wish._id);
      const { end, found, path } = endpointOf(hops, mine);
      const landings = hops.filter((h) => h.action === "its_me").map((h) => h.depth);
      return {
        date: wish.daily.date,
        title: wish.text,
        hopId: mine._id,
        people: end.depth - mine.depth,
        fromCity: mine.city ?? (user.city || null),
        toCity: end.city ?? null,
        cities: path.map((h) => h.city ?? null),
        found: foundCard(found),
        fastest: landings.length ? Math.min(...landings) : null,
      };
    }
    return null;
  },
});

/** Boats I pushed, newest first, each with how far it drifted past me. Coins come from wishes.mine. */
export const voyages = query({
  args: { deviceId: v.string() },
  handler: async (ctx, { deviceId }) => {
    const user = await userByDevice(ctx, deviceId);
    if (!user) return [];
    const cards = [];
    for (const mine of await pushedHops(ctx, user._id, 20)) {
      const wish = await ctx.db.get("wishes", mine.wishId);
      if (!wish) continue;
      const creator = await ctx.db.get("users", wish.creatorId);
      const { end, found, path } = endpointOf(await wishHops(ctx, wish._id), mine);
      cards.push({
        hopId: mine._id,
        wishId: wish._id,
        text: wish.text,
        source: wish.daily ? ("daily" as const) : ("friend" as const),
        creatorName: creator?.name ?? "Someone",
        pushedAt: mine.actedAt ?? mine._creationTime,
        hops: end.depth - mine.depth,
        cities: path.map((h) => h.city ?? null),
        status: found
          ? ("landed" as const)
          : wish.status === "granted"
            ? ("granted" as const)
            : wish.status === "traveling"
              ? ("drifting" as const)
              : ("faded" as const),
        found: foundCard(found),
      });
    }
    return cards;
  },
});

/** What friends wrote about me when they pushed a boat on, newest first. */
export const friendsSay = query({
  args: { deviceId: v.string() },
  handler: async (ctx, { deviceId }) => {
    const user = await userByDevice(ctx, deviceId);
    if (!user) return [];
    const vouches = await ctx.db
      .query("vouches")
      .withIndex("by_aboutUserId", (q) => q.eq("aboutUserId", user._id))
      .order("desc")
      .take(20);
    return vouches.filter((x) => !x.hidden).map((x) => ({ _id: x._id, byName: x.byName, text: x.text, tags: x.tags }));
  },
});

/** Whether people who find my boats may show my name and city in their voyage log. */
export const setShowInLogs = mutation({
  args: { deviceId: v.string(), value: v.boolean() },
  handler: async (ctx, { deviceId, value }) => {
    const user = await requireUser(ctx, deviceId);
    await ctx.db.patch("users", user._id, { showInLogs: value });
    return null;
  },
});

