import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { avatarFor, requireUser, userByDevice } from "./lib";
import { distanceKm, placeOf } from "./places";
import { summaryBasis, summaryFallback, visibleVouchesAbout } from "./vouchMemory";

const NEXT_DOOR_KM = 5;
const ACTIONS = ["pass", "group", "its_me"] as const;

async function actedHops(ctx: QueryCtx, userId: Id<"users">) {
  const out: Doc<"hops">[] = [];
  for (const action of ACTIONS) {
    out.push(
      ...(await ctx.db
        .query("hops")
        .withIndex("by_holderUserId_and_action", (q) => q.eq("holderUserId", userId).eq("action", action))
        .take(200)),
    );
  }
  return out;
}

async function winningChain(ctx: QueryCtx, wish: Doc<"wishes">) {
  const chain: Doc<"hops">[] = [];
  let id = wish.winningHopId;
  while (id && chain.length < 10) {
    const hop: Doc<"hops"> | null = await ctx.db.get("hops", id);
    if (!hop) break;
    chain.unshift(hop);
    id = hop.parentHopId;
  }
  return chain;
}

function pointOf(hop: Doc<"hops">) {
  if (hop.lat !== undefined && hop.lng !== undefined) return { lat: hop.lat, lng: hop.lng };
  return placeOf(hop.city);
}

/** Badges one granted wish earns, from the wisher's city and the winning chain's cities. */
export function wishBadges(creatorCity: string, chain: Pick<Doc<"hops">, "city" | "lat" | "lng">[]) {
  const earned: ("boomerang" | "around_the_world" | "next_door")[] = [];
  const winner = chain[chain.length - 1];
  if (!winner) return earned;
  const home = placeOf(creatorCity);
  const cityKey = (city: string | undefined) => (placeOf(city)?.city ?? city ?? "").trim().toLowerCase();
  const start = cityKey(creatorCity);
  if (start && cityKey(winner.city) === start && chain.some((h) => cityKey(h.city) && cityKey(h.city) !== start)) {
    earned.push("boomerang");
  }
  const countries = new Set([home?.country, ...chain.map((h) => placeOf(h.city)?.country)].filter(Boolean));
  if (countries.size >= 3) earned.push("around_the_world");
  const end = pointOf(winner as Doc<"hops">);
  if (home && end && distanceKm(home, end) < NEXT_DOOR_KM) earned.push("next_door");
  return earned;
}

const BADGES = [
  { key: "boomerang", label: "Boomerang", description: "A wish that left town and came home" },
  { key: "around_the_world", label: "Around the world", description: "3+ countries on the winning chain" },
  { key: "next_door", label: "Right next door", description: "The match lived under 5 km away" },
] as const;

const tierValidator = v.union(v.literal("gold"), v.literal("silver"), v.literal("bronze"), v.literal("red"), v.null());

/** Everything on the Me tab beyond the user row: reputation, vouches about me, summary, granted cards, badges. */
export const profile = query({
  args: { deviceId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      reputation: v.object({ vouches: v.number(), helped: v.number() }),
      summary: v.union(v.null(), v.object({ text: v.string(), friends: v.number() })),
      vouches: v.array(
        v.object({
          _id: v.id("vouches"),
          byName: v.string(),
          text: v.string(),
          tags: v.array(v.string()),
          hidden: v.boolean(),
          wishText: v.string(),
        }),
      ),
      cards: v.array(
        v.object({
          wishId: v.id("wishes"),
          text: v.string(),
          tier: tierValidator,
          photoUrl: v.union(v.null(), v.string()),
          creatorName: v.string(),
          role: v.union(v.literal("wished"), v.literal("helped"), v.literal("matched")),
        }),
      ),
      badges: v.array(
        v.object({
          key: v.string(),
          label: v.string(),
          description: v.string(),
          earned: v.boolean(),
          wishText: v.union(v.null(), v.string()),
        }),
      ),
    }),
  ),
  handler: async (ctx, { deviceId }) => {
    const user = await userByDevice(ctx, deviceId);
    if (!user) return null;
    const wishCache = new Map<Id<"wishes">, Doc<"wishes"> | null>();
    const wishOf = async (id: Id<"wishes">) => {
      if (!wishCache.has(id)) wishCache.set(id, await ctx.db.get("wishes", id));
      return wishCache.get(id) ?? null;
    };

    const allAboutMe = await ctx.db
      .query("vouches")
      .withIndex("by_aboutUserId", (q) => q.eq("aboutUserId", user._id))
      .order("desc")
      .take(100);
    const visible = await visibleVouchesAbout(ctx, user._id);
    const friends = new Set(visible.map((x) => x.byName.trim().toLowerCase())).size;
    const cached = user.friendsSummary;
    const summaryText =
      cached && cached.basis === summaryBasis(visible) ? cached.text : summaryFallback(visible);

    const hops = await actedHops(ctx, user._id);
    const helped = new Set<Id<"wishes">>();
    const cards = new Map<Id<"wishes">, { wish: Doc<"wishes">; role: "wished" | "helped" | "matched" }>();
    for (const hop of hops) {
      const wish = await wishOf(hop.wishId);
      if (!wish || wish.creatorId === user._id) continue;
      helped.add(wish._id);
      if (wish.status === "granted") {
        const role = wish.winningHopId === hop._id ? "matched" : "helped";
        if (cards.get(wish._id)?.role !== "matched") cards.set(wish._id, { wish, role });
      }
    }
    const mine = await ctx.db
      .query("wishes")
      .withIndex("by_creatorId", (q) => q.eq("creatorId", user._id))
      .order("desc")
      .take(50);
    for (const wish of mine) if (wish.status === "granted") cards.set(wish._id, { wish, role: "wished" });

    const earned = new Map<string, string>();
    const cardRows = [];
    for (const { wish, role } of cards.values()) {
      const creator = await ctx.db.get("users", wish.creatorId);
      cardRows.push({
        wishId: wish._id,
        text: wish.text,
        tier: wish.tier ?? null,
        photoUrl: wish.photoUrl ?? null,
        creatorName: creator?.name ?? "Someone",
        role,
      });
      for (const badge of wishBadges(creator?.city ?? "", await winningChain(ctx, wish))) {
        if (!earned.has(badge)) earned.set(badge, wish.text);
      }
    }

    const vouchRows = [];
    for (const x of allAboutMe) {
      vouchRows.push({
        _id: x._id,
        byName: x.byName,
        text: x.text,
        tags: x.tags,
        hidden: !!x.hidden,
        wishText: (await wishOf(x.wishId))?.text ?? "",
      });
    }

    return {
      reputation: { vouches: visible.length, helped: helped.size },
      summary: summaryText ? { text: summaryText, friends } : null,
      vouches: vouchRows,
      cards: cardRows,
      badges: BADGES.map((b) => ({
        ...b,
        earned: earned.has(b.key),
        wishText: earned.get(b.key) ?? null,
      })),
    };
  },
});

/** Hide or show a vouch about me. Hidden vouches leave the summary, reputation and the chain on pass-on pages. */
export const setVouchHidden = mutation({
  args: { deviceId: v.string(), vouchId: v.id("vouches"), hidden: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { deviceId, vouchId, hidden }) => {
    const user = await requireUser(ctx, deviceId);
    const vouch = await ctx.db.get("vouches", vouchId);
    if (!vouch || vouch.aboutUserId !== user._id) throw new Error("You can only hide vouches about you");
    await ctx.db.patch("vouches", vouchId, { hidden: hidden || undefined });
    const hop = await ctx.db.get("hops", vouch.hopId);
    if (hop) await ctx.db.patch("hops", hop._id, { vouchForParent: hidden ? undefined : vouch.text });
    await ctx.scheduler.runAfter(0, internal.vouchMemory.refreshSummary, { userId: user._id });
    return null;
  },
});

type Relation = "passed_to" | "passed_me" | "met";
type Entry = {
  name: string;
  contact: string | null;
  channel: string | null;
  tags: string[];
  wishes: Set<string>;
  relations: Set<Relation>;
};

const nameKey = (name: string) => name.trim().toLowerCase();

/**
 * My wish network: people I passed wishes to, people who passed wishes to me and people
 * I met through a granted wish. Only direct neighbours, never distant strangers on a tree.
 */
export const network = query({
  args: { deviceId: v.string() },
  returns: v.array(
    v.object({
      key: v.string(),
      name: v.string(),
      avatar: v.string(),
      contact: v.union(v.null(), v.string()),
      channel: v.union(v.null(), v.string()),
      tags: v.array(v.string()),
      wishes: v.number(),
      relations: v.array(v.union(v.literal("passed_to"), v.literal("passed_me"), v.literal("met"))),
    }),
  ),
  handler: async (ctx, { deviceId }) => {
    const user = await userByDevice(ctx, deviceId);
    if (!user) return [];
    const byName = new Map<string, Entry[]>();
    const add = (
      name: string,
      relation: Relation,
      opts: { contact?: string; channel?: string; tags?: string[]; wishId?: Id<"wishes"> } = {},
    ) => {
      const key = nameKey(name);
      if (!key || key === nameKey(user.name)) return;
      const contact = opts.contact?.trim() || null;
      const list = byName.get(key) ?? [];
      let entry = list.find((e) => !e.contact || !contact || e.contact.toLowerCase() === contact.toLowerCase());
      if (!entry) {
        entry = { name: name.trim(), contact, channel: null, tags: [], wishes: new Set(), relations: new Set() };
        list.push(entry);
        byName.set(key, list);
      }
      entry.contact = entry.contact ?? contact;
      entry.channel = entry.channel ?? opts.channel ?? null;
      for (const t of opts.tags ?? []) {
        if (!entry.tags.some((x) => x.toLowerCase() === t.toLowerCase())) entry.tags.push(t);
      }
      if (opts.wishId) entry.wishes.add(opts.wishId);
      entry.relations.add(relation);
    };
    const wishIds = new Set<Id<"wishes">>();

    const rows = await ctx.db
      .query("network")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
      .take(200);
    for (const r of rows) {
      add(r.personName, "passed_to", { contact: r.personContact, channel: r.channel, tags: r.tags });
    }
    const edges = await ctx.db
      .query("edges")
      .withIndex("by_ownerUserId", (q) => q.eq("ownerUserId", user._id))
      .take(300);
    for (const e of edges) add(e.personName, "passed_to", { contact: e.contact, tags: [e.tag], wishId: e.wishId });

    const mine = await ctx.db
      .query("wishes")
      .withIndex("by_creatorId", (q) => q.eq("creatorId", user._id))
      .order("desc")
      .take(30);
    for (const wish of mine) {
      wishIds.add(wish._id);
      const hops = await ctx.db
        .query("hops")
        .withIndex("by_wishId", (q) => q.eq("wishId", wish._id))
        .take(200);
      for (const h of hops) {
        if (h.depth === 1 && !h.viaGroup) {
          add(h.holderName, "passed_to", { contact: h.holderContact, tags: h.recipientTags, wishId: wish._id });
        }
        if (wish.status === "granted" && h._id === wish.winningHopId) {
          add(h.holderName, "met", { contact: h.holderContact, wishId: wish._id });
        }
      }
    }

    const held = [
      ...(await actedHops(ctx, user._id)),
      ...(await ctx.db
        .query("hops")
        .withIndex("by_holderUserId_and_action", (q) => q.eq("holderUserId", user._id).eq("action", undefined))
        .take(100)),
    ];
    for (const hop of held) {
      const wish = await ctx.db.get("wishes", hop.wishId);
      if (!wish || wish.creatorId === user._id) continue;
      wishIds.add(wish._id);
      const parent = hop.parentHopId ? await ctx.db.get("hops", hop.parentHopId) : null;
      const creator = await ctx.db.get("users", wish.creatorId);
      if (parent && !parent.viaGroup) {
        add(parent.holderName, "passed_me", { contact: parent.holderContact, wishId: wish._id });
      } else if (!parent && creator) {
        add(creator.name, "passed_me", { wishId: wish._id });
      }
      const children = await ctx.db
        .query("hops")
        .withIndex("by_parentHopId", (q) => q.eq("parentHopId", hop._id))
        .take(3);
      for (const c of children) {
        if (!c.viaGroup) add(c.holderName, "passed_to", { contact: c.holderContact, tags: c.recipientTags, wishId: wish._id });
      }
      if (wish.status === "granted" && wish.winningHopId === hop._id && creator) {
        add(creator.name, "met", { wishId: wish._id });
      }
    }

    for (const wishId of wishIds) {
      const vouches = await ctx.db
        .query("vouches")
        .withIndex("by_wishId", (q) => q.eq("wishId", wishId))
        .take(50);
      for (const x of vouches) {
        if (x.hidden) continue;
        for (const entry of byName.get(nameKey(x.aboutName)) ?? []) {
          for (const t of x.tags) {
            if (!entry.tags.some((y) => y.toLowerCase() === t.toLowerCase())) entry.tags.push(t);
          }
        }
      }
    }

    return [...byName.values()]
      .flat()
      .map((e, i) => ({
        key: `${nameKey(e.name)}|${e.contact ?? i}`,
        name: e.name,
        avatar: avatarFor(e.name),
        contact: e.contact,
        channel: e.channel,
        tags: e.tags.slice(0, 8),
        wishes: e.wishes.size,
        relations: [...e.relations],
      }))
      .sort((a, b) => b.wishes - a.wishes || b.tags.length - a.tags.length || a.name.localeCompare(b.name));
  },
});
