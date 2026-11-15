// Ranks the people in one owner's ego graph for a wish (docs/api/wishwell-graph-api.md §4).
// Grounding rule: a candidate's evidence is only ever the owner's own edges (tag + reason).
import Graph from "graphology";
import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalQuery, type QueryCtx } from "./_generated/server";
import { COACH_THRESHOLD, candidateValidator, memoryNamespace, personKey, type Candidate } from "./graphShared";
import { userByDevice } from "./lib";

const EDGE_READ_MAX = 500;
const SENDER_HOPS_MAX = 100;
const EVIDENCE_MAX = 5;
const DEFAULT_LIMIT = 5;
const LIMIT_MAX = 20;
const SUPERMEMORY_TIMEOUT_MS = 5000;
/** Small boost for people who also passed a wish to the owner (they pass wishes along). */
const SENDER_BOOST = 0.5;

// ---------- pure helpers (unit-tested) ----------

const STOPWORDS = new Set(
  (
    "the and for with that this from into onto about who whom whose what when where which why how " +
    "someone somebody anyone anybody something anything person people one ones want wants wanted wish wishes " +
    "need needs looking look find know knows like just really very some any can could would should will " +
    "are was were been being have has had our ours your yours their theirs them they she her his him its " +
    "you not but all out get got too also than then there here more most much many lot lots me my mine"
  ).split(" "),
);

function stem(word: string) {
  return word.length > 4 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word;
}

/** Lowercase word tokens (letters/digits), stopwords dropped, length >= 3, light plural stemming. */
export function tokenize(text: string): string[] {
  const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const out = new Set<string>();
  for (const w of words) {
    if (w.length < 3 || STOPWORDS.has(w)) continue;
    out.add(stem(w));
  }
  return [...out];
}

export type RankEdge = {
  edgeId: string;
  personName: string;
  tag: string;
  reason: string | null;
  source: "pick" | "daily";
  createdAt: number;
};

/** Keyword score of one edge against the wish tokens: tag match +2, each matching reason word +1. */
export function scoreKeyword(wishTokens: Set<string> | string[], edge: { tag: string; reason: string | null }) {
  const words = wishTokens instanceof Set ? wishTokens : new Set(wishTokens);
  let score = 0;
  if (tokenize(edge.tag).some((t) => words.has(t))) score += 2;
  if (edge.reason) score += tokenize(edge.reason).filter((t) => words.has(t)).length;
  return score;
}

/**
 * Builds the owner's ego graph and ranks people. `edgeScores` maps edgeId -> score; edges with
 * score > 0 become the candidate's evidence. People with no scored edge are not candidates.
 */
export function rankGraph(args: {
  edges: RankEdge[];
  senders: string[];
  edgeScores: Map<string, number>;
  limit: number;
}): Candidate[] {
  const graph = new Graph({ multi: true, type: "directed" });
  graph.addNode("me");
  for (const e of args.edges) {
    const key = personKey(e.personName);
    if (!key) continue;
    if (!graph.hasNode(key)) graph.addNode(key, { name: e.personName.trim(), sender: false });
    graph.addDirectedEdgeWithKey(e.edgeId, "me", key, {
      tag: e.tag,
      reason: e.reason,
      source: e.source,
      createdAt: e.createdAt,
    });
  }
  // Second-hop sources: people who passed a wish to me. No edge attrs, no evidence of their own.
  for (const name of args.senders) {
    const key = personKey(name);
    if (!key) continue;
    if (graph.hasNode(key)) graph.mergeNodeAttributes(key, { sender: true });
    else graph.addNode(key, { name: name.trim(), sender: true });
  }

  const ranked: (Candidate & { recency: number })[] = [];
  graph.forEachNode((key, attrs) => {
    if (key === "me") return;
    let score = 0;
    let recency = 0;
    const evidence: { score: number; createdAt: number; tag: string; reason: string | null }[] = [];
    graph.forEachInEdge(key, (edgeId, e) => {
      recency = Math.max(recency, e.createdAt as number);
      const s = args.edgeScores.get(edgeId) ?? 0;
      if (s <= 0) return;
      score += s;
      evidence.push({ score: s, createdAt: e.createdAt as number, tag: e.tag as string, reason: (e.reason as string | null) ?? null });
    });
    if (score <= 0) return; // grounding: no matching evidence, not a candidate
    if (attrs.sender) score += SENDER_BOOST;
    evidence.sort((a, b) => b.score - a.score || b.createdAt - a.createdAt);
    ranked.push({
      personKey: key,
      name: attrs.name as string,
      score: Math.round(score * 1000) / 1000,
      evidence: evidence.slice(0, EVIDENCE_MAX).map(({ tag, reason }) => ({ tag, reason })),
      recency,
    });
  });
  ranked.sort((a, b) => b.score - a.score || b.recency - a.recency);
  return ranked.slice(0, args.limit).map(({ recency: _recency, ...c }) => c);
}

/** Supermemory hit -> edgeId. Ingest stores document id = edgeId; try the shapes the API may return. */
function hitEdgeId(hit: Record<string, unknown>, known: Set<string>): string | null {
  const meta = (hit.metadata ?? {}) as Record<string, unknown>;
  const doc = ((hit.included as Record<string, unknown> | undefined)?.document ?? {}) as Record<string, unknown>;
  for (const c of [meta.edgeId, doc.customId, doc.id, hit.documentId, hit.customId, hit.id]) {
    if (typeof c === "string" && known.has(c)) return c;
  }
  return null;
}

async function supermemoryScores(ownerUserId: string, wishText: string, edges: RankEdge[]) {
  const apiKey = process.env.SUPERMEMORY_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(`https://api.supermemory.ai/ns/${memoryNamespace(ownerUserId)}/search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: wishText, searchMode: "hybrid", limit: 20, include: { documents: true } }),
      signal: AbortSignal.timeout(SUPERMEMORY_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn("graphRank: supermemory search failed", { status: res.status });
      return null;
    }
    const body = (await res.json()) as { results?: Record<string, unknown>[] };
    const known = new Set(edges.map((e) => e.edgeId));
    const scores = new Map<string, number>();
    for (const hit of body.results ?? []) {
      const edgeId = hitEdgeId(hit, known);
      const sim = typeof hit.similarity === "number" ? hit.similarity : typeof hit.score === "number" ? hit.score : 0;
      // Only edges the owner actually has; another namespace's ids can never map.
      if (edgeId && sim > 0) scores.set(edgeId, Math.max(scores.get(edgeId) ?? 0, sim * 3));
    }
    return scores.size > 0 ? scores : null;
  } catch (err) {
    console.warn("graphRank: supermemory search error", { error: String(err) });
    return null;
  }
}

function keywordScores(wishText: string, edges: RankEdge[]) {
  const words = new Set(tokenize(wishText));
  return new Map(edges.map((e) => [e.edgeId, scoreKeyword(words, e)]));
}

// ---------- data access ----------

async function ownerEdges(ctx: QueryCtx, ownerUserId: Id<"users">) {
  return await ctx.db
    .query("edges")
    .withIndex("by_ownerUserId", (q) => q.eq("ownerUserId", ownerUserId))
    .order("desc")
    .take(EDGE_READ_MAX);
}

/** Owner's edges + names of people who passed a wish to the owner. */
export const graphInput = internalQuery({
  args: { ownerUserId: v.id("users") },
  returns: v.object({
    edges: v.array(
      v.object({
        edgeId: v.string(),
        personName: v.string(),
        tag: v.string(),
        reason: v.union(v.string(), v.null()),
        source: v.union(v.literal("pick"), v.literal("daily")),
        createdAt: v.number(),
      }),
    ),
    senders: v.array(v.string()),
  }),
  handler: async (ctx, { ownerUserId }) => {
    const edges = (await ownerEdges(ctx, ownerUserId)).map((e: Doc<"edges">) => ({
      edgeId: e._id as string,
      personName: e.personName,
      tag: e.tag,
      reason: e.reason ?? null,
      source: e.source,
      createdAt: e._creationTime,
    }));
    const held = await ctx.db
      .query("hops")
      .withIndex("by_holderUserId_and_action", (q) => q.eq("holderUserId", ownerUserId))
      .take(SENDER_HOPS_MAX);
    const owner = await ctx.db.get("users", ownerUserId);
    const self = owner ? personKey(owner.name) : "";
    const senders = new Set<string>();
    for (const hop of held) {
      let name: string | undefined;
      if (hop.parentHopId) name = (await ctx.db.get("hops", hop.parentHopId))?.holderName;
      else {
        const wish = await ctx.db.get("wishes", hop.wishId);
        name = wish ? (await ctx.db.get("users", wish.creatorId))?.name : undefined;
      }
      if (name && personKey(name) && personKey(name) !== self) senders.add(name.trim());
    }
    return { edges, senders: [...senders] };
  },
});

/** Resolves the caller (session, then deviceId) and their edge count; optionally loads a wish they can see. */
export const coachContext = internalQuery({
  args: { deviceId: v.string(), wishId: v.optional(v.id("wishes")) },
  returns: v.object({
    ownerUserId: v.union(v.id("users"), v.null()),
    edgeCount: v.number(),
    wishText: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, { deviceId, wishId }) => {
    const user = await userByDevice(ctx, deviceId);
    let wishText: string | null = null;
    if (wishId) {
      const wish = await ctx.db.get("wishes", wishId);
      if (!wish) throw new Error("Wish not found");
      const holds =
        user &&
        (wish.creatorId === user._id ||
          (await ctx.db
            .query("hops")
            .withIndex("by_wishId_and_holderUserId", (q) => q.eq("wishId", wishId).eq("holderUserId", user._id))
            .first()) !== null);
      if (!holds) throw new Error("Not your wish");
      wishText = wish.text;
    }
    if (!user) return { ownerUserId: null, edgeCount: 0, wishText };
    const edgeCount = (await ownerEdges(ctx, user._id)).length;
    return { ownerUserId: user._id, edgeCount, wishText };
  },
});

export function isCoachReady(edgeCount: number) {
  return edgeCount >= COACH_THRESHOLD;
}

export const rankForWish = internalAction({
  args: { ownerUserId: v.id("users"), wishText: v.string(), limit: v.optional(v.number()) },
  returns: v.array(candidateValidator),
  handler: async (ctx, { ownerUserId, wishText, limit }): Promise<Candidate[]> => {
    const max = Math.min(Math.max(1, Math.floor(limit ?? DEFAULT_LIMIT)), LIMIT_MAX);
    const input: { edges: RankEdge[]; senders: string[] } = await ctx.runQuery(internal.graphRank.graphInput, {
      ownerUserId,
    });
    if (input.edges.length === 0) return [];
    const edgeScores =
      (await supermemoryScores(ownerUserId, wishText, input.edges)) ?? keywordScores(wishText, input.edges);
    return rankGraph({ edges: input.edges, senders: input.senders, edgeScores, limit: max });
  },
});
