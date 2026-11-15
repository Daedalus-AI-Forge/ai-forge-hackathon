// Network queries resolve the caller from the auth session first, then the device.
import { type Infer, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { COACH_THRESHOLD, personKey } from "./graphShared";
import { userByDevice } from "./lib";

const EDGE_READ_LIMIT = 500;
const USER_READ_LIMIT = 300;
const HOP_READ_LIMIT = 1500;
const LOOKUP_BATCH = 250;

const nodeValidator = v.object({
  personKey: v.string(),
  name: v.string(),
  tags: v.array(v.string()),
  edgeCount: v.number(),
});

const linkValidator = v.object({
  edgeId: v.id("edges"),
  personKey: v.string(),
  tag: v.string(),
  reason: v.union(v.string(), v.null()),
  source: v.union(v.literal("pick"), v.literal("daily")),
  createdAt: v.number(),
});

const communityNodeValidator = v.object({
  key: v.string(),
  name: v.string(),
  personKeys: v.array(v.string()),
  edgeIds: v.array(v.id("edges")),
  kind: v.union(v.literal("user"), v.literal("contact")),
});

const communityLinkValidator = v.object({ key: v.string(), source: v.string(), target: v.string() });

function userKey(id: Id<"users">) {
  return `user:${id}`;
}

async function loadMissingById<Key extends string, Value>(
  ids: Key[],
  cache: Map<Key, Value | null>,
  load: (id: Key) => Promise<Value | null>,
) {
  const uncached = [...new Set(ids)].filter((id) => !cache.has(id));
  for (let i = 0; i < uncached.length; i += LOOKUP_BATCH) {
    await Promise.all(uncached.slice(i, i + LOOKUP_BATCH).map(async (id) => {
      cache.set(id, await load(id));
    }));
  }
}

/** The visible community and the caller's saved direct connections. */
export const communityNetwork = query({
  args: { deviceId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      meKey: v.string(),
      nodes: v.array(communityNodeValidator),
      links: v.array(communityLinkValidator),
      truncated: v.boolean(),
    }),
  ),
  handler: async (ctx, { deviceId }) => {
    const viewer = await userByDevice(ctx, deviceId);
    if (!viewer || viewer.demoKey === "well") return null;

    const [users, hops, edges] = await Promise.all([
      ctx.db.query("users").withIndex("by_creation_time").order("desc").take(USER_READ_LIMIT + 1),
      ctx.db.query("hops").withIndex("by_creation_time").order("desc").take(HOP_READ_LIMIT + 1),
      ctx.db.query("edges").withIndex("by_ownerUserId", (q) => q.eq("ownerUserId", viewer._id))
        .order("desc").take(EDGE_READ_LIMIT + 1),
    ]);
    const meKey = userKey(viewer._id);
    const nodes = new Map<string, Infer<typeof communityNodeValidator>>([
      [meKey, { key: meKey, name: viewer.name, personKeys: [], edgeIds: [], kind: "user" }],
    ]);
    for (const user of users.slice(0, USER_READ_LIMIT)) {
      if (user.showInLogs === false || user.demoKey === "well" || user._id === viewer._id) continue;
      const key = userKey(user._id);
      nodes.set(key, { key, name: user.name, personKeys: [], edgeIds: [], kind: "user" });
    }

    const links = new Map<string, Infer<typeof communityLinkValidator>>();
    function connect(a: string, b: string) {
      if (a === b) return;
      const [source, target] = a < b ? [a, b] : [b, a];
      const key = JSON.stringify([source, target]);
      links.set(key, { key, source, target });
    }

    const recentHops = hops.slice(0, HOP_READ_LIMIT);
    const ownedEdges = edges.slice(0, EDGE_READ_LIMIT);
    const hopsById = new Map<Id<"hops">, Doc<"hops"> | null>(recentHops.map((hop) => [hop._id, hop]));
    const wishesById = new Map<Id<"wishes">, Doc<"wishes"> | null>();
    const readHop = (id: Id<"hops">) => ctx.db.get("hops", id);

    function publicParent(hop: Doc<"hops">) {
      const parent = hop.parentHopId ? hopsById.get(hop.parentHopId) : null;
      return parent?.wishId === hop.wishId && parent.itsMePublic !== false ? parent : null;
    }

    const publicHops = recentHops.flatMap((hop) => {
      if (!hop.holderUserId || hop.itsMePublic === false || (!hop.parentHopId && hop.depth !== 1)) return [];
      const holderKey = userKey(hop.holderUserId);
      return nodes.has(holderKey) ? [{ hop, holderKey }] : [];
    });
    const parentIds = publicHops.flatMap(({ hop }) => hop.parentHopId ? [hop.parentHopId] : []);
    const rootWishIds = publicHops.flatMap(({ hop }) => hop.parentHopId ? [] : [hop.wishId]);
    await Promise.all([
      loadMissingById([...parentIds, ...ownedEdges.map((edge) => edge.hopId)], hopsById, readHop),
      loadMissingById(rootWishIds, wishesById, (id) => ctx.db.get("wishes", id)),
    ]);
    for (const { hop, holderKey } of publicHops) {
      let senderId: Id<"users"> | undefined;
      if (hop.parentHopId) {
        senderId = publicParent(hop)?.holderUserId;
      } else {
        // The wish creator sends the first hop of an ordinary wish.
        const wish = wishesById.get(hop.wishId);
        if (wish && !wish.daily) senderId = wish.creatorId;
      }
      if (!senderId) continue;
      const senderKey = userKey(senderId);
      if (nodes.has(senderKey)) connect(senderKey, holderKey);
    }

    const recipients = ownedEdges.map((edge) => {
      const hop = hopsById.get(edge.hopId);
      return hop?.wishId === edge.wishId ? hop : null;
    });
    const ownedParentIds = recipients.flatMap((hop) =>
      hop?.parentHopId && hop.itsMePublic !== false ? [hop.parentHopId] : [],
    );
    await loadMissingById(ownedParentIds, hopsById, readHop);
    for (const [index, edge] of ownedEdges.entries()) {
      const hop = recipients[index];
      if (hop?.holderUserId === viewer._id) continue;
      const detailKey = personKey(edge.personName);
      if (!detailKey) continue;

      const visibleRecipient = hop?.holderUserId && hop.itsMePublic !== false &&
        (!hop.parentHopId || publicParent(hop)) ? nodes.get(userKey(hop.holderUserId)) : null;
      if (visibleRecipient) {
        if (!visibleRecipient.personKeys.includes(detailKey)) visibleRecipient.personKeys.push(detailKey);
        visibleRecipient.edgeIds.push(edge._id);
        connect(meKey, visibleRecipient.key);
      } else {
        // The saved spelling and link belong only to this viewer.
        const key = `contact:${detailKey}`;
        const contact = nodes.get(key);
        if (contact) {
          contact.edgeIds.push(edge._id);
        } else {
          nodes.set(key, {
            key, name: edge.personName.trim(), personKeys: [detailKey], edgeIds: [edge._id], kind: "contact",
          });
        }
        connect(meKey, key);
      }
    }

    return {
      meKey,
      nodes: [...nodes.values()],
      links: [...links.values()],
      truncated: users.length > USER_READ_LIMIT || hops.length > HOP_READ_LIMIT || edges.length > EDGE_READ_LIMIT,
    };
  },
});

/** The caller's own direct connections: one node per person, one link per edge row. */
export const myNetwork = query({
  args: { deviceId: v.string() },
  returns: v.union(
    v.null(),
    v.object({ me: v.object({ name: v.string() }), nodes: v.array(nodeValidator), links: v.array(linkValidator) }),
  ),
  handler: async (ctx, { deviceId }) => {
    const user = await userByDevice(ctx, deviceId);
    if (!user) return null;
    const edges = await ctx.db
      .query("edges")
      .withIndex("by_ownerUserId", (q) => q.eq("ownerUserId", user._id))
      .order("desc")
      .take(EDGE_READ_LIMIT);

    // Newest first, so the first edge seen for a person carries the most recent spelling.
    const nodes = new Map<string, { personKey: string; name: string; tags: Set<string>; edgeCount: number }>();
    const links = [];
    for (const e of edges) {
      const key = personKey(e.personName);
      const node = nodes.get(key) ?? { personKey: key, name: e.personName.trim(), tags: new Set<string>(), edgeCount: 0 };
      node.tags.add(e.tag);
      node.edgeCount += 1;
      nodes.set(key, node);
      links.push({
        edgeId: e._id,
        personKey: key,
        tag: e.tag,
        reason: e.reason ?? null,
        source: e.source,
        createdAt: e._creationTime,
      });
    }
    return {
      me: { name: user.name },
      nodes: [...nodes.values()].map((n) => ({ personKey: n.personKey, name: n.name, tags: [...n.tags], edgeCount: n.edgeCount })),
      links,
    };
  },
});

/** Whether the coach has enough of the caller's own edges to work from. */
export const coachReady = query({
  args: { deviceId: v.string() },
  returns: v.object({ ready: v.boolean(), edgeCount: v.number(), threshold: v.number() }),
  handler: async (ctx, { deviceId }) => {
    const user = await userByDevice(ctx, deviceId);
    if (!user) return { ready: false, edgeCount: 0, threshold: COACH_THRESHOLD };
    const edges = await ctx.db
      .query("edges")
      .withIndex("by_ownerUserId", (q) => q.eq("ownerUserId", user._id))
      .take(EDGE_READ_LIMIT);
    return { ready: edges.length >= COACH_THRESHOLD, edgeCount: edges.length, threshold: COACH_THRESHOLD };
  },
});
