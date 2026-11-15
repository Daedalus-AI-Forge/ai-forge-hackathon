// Ego graph queries (docs/api/wishwell-graph-api.md §3). Owner-scoped: the caller is
// resolved from the auth session, then deviceId — never from an owner id argument.
import { v } from "convex/values";
import { query } from "./_generated/server";
import { COACH_THRESHOLD, personKey } from "./graphShared";
import { userByDevice } from "./lib";

const EDGE_READ_LIMIT = 500;

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
