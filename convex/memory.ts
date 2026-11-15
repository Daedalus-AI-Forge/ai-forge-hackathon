// Supermemory derived index of a user's edges (docs/api/wishwell-graph-api.md §3).
// Convex stays the source of truth: every failure here is logged and swallowed so the
// UI path that scheduled us never breaks. Without SUPERMEMORY_API_KEY everything no-ops.
//
// REST (namespace in the path, not v3 containerTag):
//   add/update: POST   /ns/{ns}/document  { id, content, metadata }
//               https://supermemory.ai/docs/ingestion/add-memories.md
//   delete:     DELETE /ns/{ns}/document  { ids: [...] }
//               https://supermemory.ai/docs/ingestion/document-operations.md
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalQuery } from "./_generated/server";
import { memoryNamespace, personKey } from "./graphShared";

const SUPERMEMORY_BASE = "https://api.supermemory.ai";
const REQUEST_TIMEOUT_MS = 10_000;
const BACKFILL_BATCH = 100;

function apiKey() {
  return process.env.SUPERMEMORY_API_KEY || null;
}

async function callSupermemory(method: "POST" | "DELETE", namespace: string, body: unknown, what: string) {
  const key = apiKey();
  if (!key) return;
  try {
    const res = await fetch(`${SUPERMEMORY_BASE}/ns/${encodeURIComponent(namespace)}/document`, {
      method,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) console.warn(`supermemory ${what} failed`, { namespace, status: res.status });
  } catch (err) {
    console.warn(`supermemory ${what} error`, { namespace, error: String(err) });
  }
}

/** Edge fields the index needs. Internal only. */
export const edgeForIngest = internalQuery({
  args: { edgeId: v.id("edges") },
  returns: v.union(
    v.null(),
    v.object({
      ownerUserId: v.union(v.id("users"), v.null()),
      personName: v.string(),
      tag: v.string(),
      reason: v.union(v.string(), v.null()),
      source: v.union(v.literal("pick"), v.literal("daily")),
    }),
  ),
  handler: async (ctx, { edgeId }) => {
    const e = await ctx.db.get("edges", edgeId);
    if (!e) return null;
    return {
      ownerUserId: e.ownerUserId ?? null,
      personName: e.personName,
      tag: e.tag,
      reason: e.reason ?? null,
      source: e.source,
    };
  },
});

/** Upsert one edge as a Supermemory document (document id = edge id). */
export const ingest = internalAction({
  args: { edgeId: v.id("edges") },
  returns: v.null(),
  handler: async (ctx, { edgeId }) => {
    if (!apiKey()) return null;
    const edge = await ctx.runQuery(internal.memory.edgeForIngest, { edgeId });
    if (!edge || !edge.ownerUserId) return null;
    await callSupermemory(
      "POST",
      memoryNamespace(edge.ownerUserId),
      {
        id: edgeId,
        content: `${edge.personName}: ${edge.reason ?? ""} [${edge.tag}]`,
        metadata: { personKey: personKey(edge.personName), tag: edge.tag, source: edge.source },
      },
      "ingest",
    );
    return null;
  },
});

/** Remove one edge's document. The edge row is already gone, so the owner is passed in. */
export const forget = internalAction({
  args: { edgeId: v.string(), ownerUserId: v.optional(v.id("users")) },
  returns: v.null(),
  handler: async (_ctx, { edgeId, ownerUserId }) => {
    if (!apiKey() || !ownerUserId) return null;
    await callSupermemory("DELETE", memoryNamespace(ownerUserId), { ids: [edgeId] }, "forget");
    return null;
  },
});

/** One page of edge ids, for one owner or for everyone. */
export const edgeIdsPage = internalQuery({
  args: { ownerUserId: v.optional(v.id("users")), cursor: v.union(v.string(), v.null()) },
  returns: v.object({ ids: v.array(v.id("edges")), isDone: v.boolean(), continueCursor: v.string() }),
  handler: async (ctx, { ownerUserId, cursor }) => {
    const base = ownerUserId
      ? ctx.db.query("edges").withIndex("by_ownerUserId", (q) => q.eq("ownerUserId", ownerUserId))
      : ctx.db.query("edges");
    const page = await base.paginate({ numItems: BACKFILL_BATCH, cursor });
    return { ids: page.page.map((e) => e._id), isDone: page.isDone, continueCursor: page.continueCursor };
  },
});

/** Re-index every edge (or one owner's) in bounded batches. */
export const backfill = internalAction({
  args: { ownerUserId: v.optional(v.id("users")) },
  returns: v.null(),
  handler: async (ctx, { ownerUserId }) => {
    if (!apiKey()) return null;
    await ctx.scheduler.runAfter(0, internal.memory.backfillPage, { ownerUserId, cursor: null });
    return null;
  },
});

export const backfillPage = internalAction({
  args: { ownerUserId: v.optional(v.id("users")), cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, { ownerUserId, cursor }) => {
    const page = await ctx.runQuery(internal.memory.edgeIdsPage, { ownerUserId, cursor });
    for (const edgeId of page.ids) await ctx.scheduler.runAfter(0, internal.memory.ingest, { edgeId });
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.memory.backfillPage, { ownerUserId, cursor: page.continueCursor });
    }
    return null;
  },
});
