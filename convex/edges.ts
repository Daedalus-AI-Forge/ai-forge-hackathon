import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalQuery, mutation, query, type QueryCtx } from "./_generated/server";
import { avatarFor, requireUser, userByDevice } from "./lib";

async function peopleOf(ctx: QueryCtx, userId: Id<"users">) {
  const edges = await ctx.db
    .query("edges")
    .withIndex("by_ownerUserId", (q) => q.eq("ownerUserId", userId))
    .take(500);
  const people = new Map<string, { name: string; tags: Map<string, "daily" | "pick">; wishes: Set<string> }>();
  for (const e of edges) {
    const key = e.personName.trim().toLowerCase();
    const person = people.get(key) ?? { name: e.personName, tags: new Map(), wishes: new Set() };
    if (person.tags.get(e.tag) !== "daily") person.tags.set(e.tag, e.source);
    person.wishes.add(e.wishId);
    people.set(key, person);
  }
  return [...people.values()]
    .map((p) => ({
      name: p.name,
      avatar: avatarFor(p.name),
      tags: [...p.tags].map(([tag, source]) => ({ tag, source })),
      wishes: p.wishes.size,
    }))
    .sort((a, b) => b.tags.length - a.tags.length);
}

/** My wish network: everything the well has learned from my passes. Only the owner can read it. */
export const mine = query({
  args: { deviceId: v.string() },
  handler: async (ctx, { deviceId }) => {
    const user = await userByDevice(ctx, deviceId);
    return user ? await peopleOf(ctx, user._id) : [];
  },
});

/** Delete everything the well remembers about one person in my network. */
export const forget = mutation({
  args: { deviceId: v.string(), personName: v.string() },
  handler: async (ctx, { deviceId, personName }) => {
    const user = await requireUser(ctx, deviceId);
    const key = personName.trim().toLowerCase();
    const edges = await ctx.db
      .query("edges")
      .withIndex("by_ownerUserId", (q) => q.eq("ownerUserId", user._id))
      .take(500);
    for (const e of edges) {
      if (e.personName.trim().toLowerCase() === key) await ctx.db.delete("edges", e._id);
    }
    return null;
  },
});

export const forAsk = internalQuery({
  args: { deviceId: v.string() },
  handler: async (ctx, { deviceId }) => {
    const user = await userByDevice(ctx, deviceId);
    return user ? await peopleOf(ctx, user._id) : [];
  },
});
