// Wish chains that came true and passed through the caller: as the wisher, as someone who
// pushed the boat on, or as the person who said "it's me". Each comes with its final photo.
import { type Infer, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";
import { userByDevice, wishHops } from "./lib";

/** Candidates read per role (wisher, finder, passer) and chains returned. */
const READ_LIMIT = 15;
const CHAIN_LIMIT = 12;

type Hop = Doc<"hops">;

const personValidator = v.object({
  name: v.string(),
  city: v.union(v.string(), v.null()),
  /** `user:<id>` for registered users shown on the community map, so the map can draw the chain. */
  userKey: v.union(v.string(), v.null()),
  me: v.boolean(),
});

export const chainValidator = v.object({
  wishId: v.id("wishes"),
  text: v.string(),
  daily: v.boolean(),
  status: v.union(v.literal("found"), v.literal("granted")),
  tier: v.union(v.literal("gold"), v.literal("silver"), v.literal("bronze"), v.literal("red"), v.null()),
  role: v.union(v.literal("wisher"), v.literal("passer"), v.literal("finder")),
  /** The caller's own hop on this wish (passer/finder), for linking to the boat page. */
  myHopId: v.union(v.id("hops"), v.null()),
  /** From the wisher (or the first holder of a daily boat) to the person who said "it's me". */
  people: v.array(personValidator),
  photoUrl: v.union(v.string(), v.null()),
  story: v.union(v.string(), v.null()),
  endedAt: v.number(),
});

export type Chain = Infer<typeof chainValidator>;

/**
 * The final photo of a chain that came true, under the same rules as the public ending (link.ending):
 * a real wish shows its meet-up photo only once both people confirmed it (status "granted"); until
 * then it is theirs alone. A daily boat has no meet-up, so its finder's proof photo is the ending.
 */
async function chainPhotoUrl(ctx: QueryCtx, wish: Doc<"wishes">, finder: Hop) {
  if (wish.daily) {
    const proof = finder.proofStorageId ? await ctx.storage.getUrl(finder.proofStorageId) : null;
    return proof ?? wish.photoUrl ?? null;
  }
  if (wish.status !== "granted") return null;
  const met = wish.meetingPhoto ? await ctx.storage.getUrl(wish.meetingPhoto.storageId) : null;
  return met ?? wish.photoUrl ?? null;
}

/** Who said "it's me" and made this wish come true, or null if it hasn't. */
function finderOf(wish: Doc<"wishes">, hops: Hop[], mine: Hop | null) {
  const landings = hops.filter((h) => h.action === "its_me").sort((a, b) => a.depth - b.depth);
  if (wish.daily) {
    // Daily boats have many landings; the one that counts is the first below my own hop.
    if (!mine) return null;
    const byId = new Map(hops.map((h) => [h._id, h]));
    return landings.find((h) => isAncestor(mine, h, byId)) ?? null;
  }
  if (wish.status !== "found" && wish.status !== "granted") return null;
  const winner = wish.winningHopId ? hops.find((h) => h._id === wish.winningHopId) : landings[0];
  return winner?.action === "its_me" ? winner : null;
}

function isAncestor(ancestor: Hop, hop: Hop, byId: Map<Id<"hops">, Hop>) {
  for (let h: Hop | undefined = hop; h; h = h.parentHopId ? byId.get(h.parentHopId) : undefined) {
    if (h._id === ancestor._id) return true;
  }
  return false;
}

/** Root-to-finder hops, following parent links. */
function pathTo(finder: Hop, hops: Hop[]) {
  const byId = new Map(hops.map((h) => [h._id, h]));
  const path: Hop[] = [];
  const seen = new Set<Id<"hops">>();
  for (let h: Hop | undefined = finder; h && !seen.has(h._id); h = h.parentHopId ? byId.get(h.parentHopId) : undefined) {
    seen.add(h._id);
    path.unshift(h);
  }
  return path;
}

export const mine = query({
  args: { deviceId: v.string() },
  returns: v.array(chainValidator),
  handler: async (ctx, { deviceId }) => {
    const me = await userByDevice(ctx, deviceId);
    if (!me) return [];

    const [created, landed, passed, grouped] = await Promise.all([
      ctx.db.query("wishes").withIndex("by_creatorId", (q) => q.eq("creatorId", me._id)).order("desc").take(READ_LIMIT),
      ctx.db.query("hops").withIndex("by_holderUserId_and_action", (q) => q.eq("holderUserId", me._id).eq("action", "its_me"))
        .order("desc").take(READ_LIMIT),
      ctx.db.query("hops").withIndex("by_holderUserId_and_action", (q) => q.eq("holderUserId", me._id).eq("action", "pass"))
        .order("desc").take(READ_LIMIT),
      ctx.db.query("hops").withIndex("by_holderUserId_and_action", (q) => q.eq("holderUserId", me._id).eq("action", "group"))
        .order("desc").take(READ_LIMIT),
    ]);

    // Wisher first, then finder, then passer: the first role found for a wish wins.
    const candidates: { wishId: Id<"wishes">; mine: Hop | null; role: Chain["role"] }[] = [
      ...created.filter((w) => !w.daily && (w.status === "found" || w.status === "granted"))
        .map((w) => ({ wishId: w._id, mine: null, role: "wisher" as const })),
      ...landed.map((h) => ({ wishId: h.wishId, mine: h, role: "finder" as const })),
      ...[...passed, ...grouped].map((h) => ({ wishId: h.wishId, mine: h, role: "passer" as const })),
    ];

    const users = new Map<Id<"users">, Doc<"users"> | null>();
    const userOf = async (id: Id<"users">) => {
      if (!users.has(id)) users.set(id, await ctx.db.get("users", id));
      return users.get(id) ?? null;
    };
    const visibleKey = async (id: Id<"users"> | undefined, publicHop: boolean) => {
      if (!id || !publicHop) return null;
      const user = await userOf(id);
      return user && user.showInLogs !== false && user.demoKey !== "well" ? `user:${id}` : null;
    };

    const seen = new Set<Id<"wishes">>();
    const chains: Chain[] = [];
    for (const { wishId, mine: myHop, role } of candidates) {
      if (seen.has(wishId)) continue;
      const wish = await ctx.db.get("wishes", wishId);
      if (!wish) continue;
      // Skip real wishes that never came true before reading their hops.
      if (!wish.daily && wish.status !== "found" && wish.status !== "granted") continue;
      const hops = await wishHops(ctx, wishId);
      const finder = finderOf(wish, hops, myHop);
      if (!finder) continue;
      const path = pathTo(finder, hops);
      // A boat I pushed only counts if it was my branch that found the person.
      if (myHop && !path.some((h) => h._id === myHop._id)) continue;
      seen.add(wishId);

      const people: Chain["people"] = [];
      if (!wish.daily) {
        const creator = await userOf(wish.creatorId);
        const isMe = wish.creatorId === me._id;
        const shown = isMe || creator?.showInLogs !== false;
        people.push({
          name: creator?.name || "Someone",
          city: shown ? creator?.city || null : null,
          userKey: await visibleKey(wish.creatorId, true),
          me: isMe,
        });
      }
      for (const h of path) {
        const isMe = h.holderUserId === me._id;
        const hidden = !isMe && h.action === "its_me" && h.itsMePublic === false;
        people.push({
          name: hidden ? "Someone" : h.holderName,
          city: hidden ? null : h.city ?? null,
          userKey: await visibleKey(h.holderUserId, h.itsMePublic !== false),
          me: isMe,
        });
      }

      chains.push({
        wishId,
        text: wish.text,
        daily: !!wish.daily,
        status: wish.status === "granted" ? "granted" : "found",
        tier: wish.tier ?? null,
        role,
        myHopId: myHop?._id ?? null,
        people,
        photoUrl: await chainPhotoUrl(ctx, wish, finder),
        story: finder.itsMeIntro ?? null,
        endedAt: finder.actedAt ?? finder._creationTime,
      });
    }
    return chains.sort((a, b) => b.endedAt - a.endedAt).slice(0, CHAIN_LIMIT);
  },
});
