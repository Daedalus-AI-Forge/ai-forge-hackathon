import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, query, type MutationCtx } from "./_generated/server";
import { userByDevice, wishHops } from "./lib";

export type Tier = "gold" | "silver" | "bronze" | "red";

/** 1 ripple = gold, 2 = silver, 3 = bronze, 4–6 = red. */
export function tierFor(depth: number): Tier {
  if (depth <= 1) return "gold";
  if (depth === 2) return "silver";
  if (depth === 3) return "bronze";
  return "red";
}

const BRANCH_LABELS = ["A", "B", "C", "D", "E", "F"];

/**
 * One summary per first-ripple branch, without hop ids or names. The leader is the
 * winning branch once there is one, else the branch with the shortest "It's me!",
 * else the branch that has travelled furthest (more people holding it breaks ties).
 */
export function branchRace(hops: Doc<"hops">[], winningHopId?: Id<"hops">) {
  const byId = new Map(hops.map((h) => [h._id, h]));
  const rootOf = (hop: Doc<"hops">) => {
    let cur = hop;
    for (let i = 0; i < 10 && cur.parentHopId; i++) {
      const parent = byId.get(cur.parentHopId);
      if (!parent) break;
      cur = parent;
    }
    return cur;
  };
  const branches = hops
    .filter((h) => h.depth === 1)
    .map((root, i) => ({
      root: root._id,
      label: "Branch " + (BRANCH_LABELS[i] ?? String(i + 1)),
      depth: 0,
      people: 0,
      holding: 0,
      foundDepth: null as number | null,
      won: false,
    }));
  const byRoot = new Map(branches.map((b) => [b.root, b]));
  for (const hop of hops) {
    const branch = byRoot.get(rootOf(hop)._id);
    if (!branch) continue;
    branch.depth = Math.max(branch.depth, hop.depth);
    branch.people += 1;
    if (!hop.action) branch.holding += 1;
    if (hop.action === "its_me") {
      branch.foundDepth = branch.foundDepth === null ? hop.depth : Math.min(branch.foundDepth, hop.depth);
    }
    if (winningHopId && hop._id === winningHopId) branch.won = true;
  }
  const leader =
    branches.find((b) => b.won) ??
    branches
      .filter((b) => b.foundDepth !== null)
      .sort((a, b) => (a.foundDepth ?? 0) - (b.foundDepth ?? 0))[0] ??
    [...branches].sort((a, b) => b.depth - a.depth || b.holding - a.holding)[0];
  return branches.map((b) => ({
    label: b.label,
    depth: b.depth,
    people: b.people,
    holding: b.holding,
    found: b.foundDepth !== null,
    won: b.won,
    leading: b === leader,
    tier: tierFor(b.foundDepth ?? b.depth),
  }));
}

/** The branch race for a wish. Only its wisher or someone holding it can look. */
export const race = query({
  args: { deviceId: v.string(), wishId: v.id("wishes") },
  handler: async (ctx, { deviceId, wishId }) => {
    const user = await userByDevice(ctx, deviceId);
    const wish = await ctx.db.get("wishes", wishId);
    if (!user || !wish) return null;
    if (wish.creatorId !== user._id) {
      const held = await ctx.db
        .query("hops")
        .withIndex("by_wishId_and_holderUserId", (q) => q.eq("wishId", wishId).eq("holderUserId", user._id))
        .first();
      if (!held) return null;
    }
    const hops = await wishHops(ctx, wishId);
    return {
      status: wish.status,
      expiresAt: wish.expiresAt,
      tier: wish.tier ?? null,
      branches: branchRace(hops, wish.winningHopId),
    };
  },
});

/**
 * Hand out the rewards for a granted wish (spec "Wishes and stars"). Idempotent:
 * a wish whose rewards were applied is skipped. Returns the per-user deltas.
 */
export async function grantRewards(ctx: MutationCtx, wishId: Id<"wishes">) {
  const wish = await ctx.db.get("wishes", wishId);
  if (!wish || wish.rewardsAppliedAt || !wish.winningHopId) return null;
  const winner = await ctx.db.get("hops", wish.winningHopId);
  if (!winner || winner.wishId !== wishId) return null;

  const ancestors: Doc<"hops">[] = [];
  let parentId = winner.parentHopId;
  for (let i = 0; i < 10 && parentId; i++) {
    const parent = await ctx.db.get("hops", parentId);
    if (!parent || parent.wishId !== wishId) break;
    ancestors.push(parent);
    parentId = parent.parentHopId;
  }

  const tier = wish.tier ?? tierFor(winner.depth);
  const deltas = new Map<Id<"users">, { wishes: number; stars: number }>();
  const add = (userId: Id<"users"> | undefined, wishes: number, stars: number) => {
    if (!userId) return;
    const d = deltas.get(userId) ?? { wishes: 0, stars: 0 };
    d.wishes += wishes;
    d.stars += stars;
    deltas.set(userId, d);
  };

  const match = winner.holderUserId;
  const helpers = [...new Set(ancestors.flatMap((h) => (h.holderUserId ? [h.holderUserId] : [])))];
  add(wish.creatorId, 1, 0);
  add(match, 1, 0);
  for (const helper of helpers) add(helper, 0, 1);
  if (tier === "gold") {
    for (const userId of new Set([wish.creatorId, ...helpers, ...(match ? [match] : [])])) add(userId, 0, 1);
  }
  if (wish.metInPerson) {
    add(wish.creatorId, 0, 1);
    add(match, 0, 1);
  }

  for (const [userId, d] of deltas) {
    const user = await ctx.db.get("users", userId);
    if (!user) continue;
    await ctx.db.patch("users", userId, { wishesLeft: user.wishesLeft + d.wishes, stars: user.stars + d.stars });
  }
  await ctx.db.patch("wishes", wishId, { rewardsAppliedAt: Date.now(), tier });
  return [...deltas].map(([userId, d]) => ({ userId, ...d }));
}

/** Schedulable wrapper: ctx.scheduler.runAfter(0, internal.rewards.apply, { wishId }). */
export const apply = internalMutation({
  args: { wishId: v.id("wishes") },
  returns: v.null(),
  handler: async (ctx, { wishId }) => {
    await grantRewards(ctx, wishId);
    return null;
  },
});
