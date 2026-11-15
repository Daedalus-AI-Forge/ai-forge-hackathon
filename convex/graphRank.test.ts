/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { rankGraph, scoreKeyword, tokenize, type RankEdge } from "./graphRank";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

beforeEach(() => {
  vi.stubEnv("SUPERMEMORY_API_KEY", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const edge = (id: string, personName: string, tag: string, reason: string | null, createdAt = 1): RankEdge => ({
  edgeId: id,
  personName,
  tag,
  reason,
  source: "pick",
  createdAt,
});

describe("pure helpers", () => {
  test("tokenize lowercases, drops stopwords and short words, stems plurals", () => {
    expect(tokenize("Someone to jam on DRUMS with in Tokyo!")).toEqual(["jam", "drum", "tokyo"]);
  });

  test("scoreKeyword: tag match +2, reason words +1 each", () => {
    const words = tokenize("drummer for a jazz band");
    expect(scoreKeyword(words, { tag: "band", reason: null })).toBe(2);
    expect(scoreKeyword(words, { tag: "music", reason: "Plays jazz in a band" })).toBe(2);
    expect(scoreKeyword(words, { tag: "food", reason: "Knows every izakaya" })).toBe(0);
  });

  test("rankGraph ranks the matching person first, evidence = matching edges only, unmatched dropped", () => {
    const edges = [
      edge("e1", "Amy", "music", "Plays in a band every weekend"),
      edge("e2", "Amy", "food", null),
      edge("e3", "Ken", "tokyo", "Grew up in Shibuya"),
      edge("e4", "Lia", "climbing", null),
    ];
    const words = tokenize("Someone to play drums with in my band");
    const scores = new Map(edges.map((e) => [e.edgeId, scoreKeyword(words, e)]));
    const ranked = rankGraph({ edges, senders: [], edgeScores: scores, limit: 5 });
    expect(ranked.map((c) => c.personKey)).toEqual(["amy"]);
    expect(ranked[0].evidence).toEqual([{ tag: "music", reason: "Plays in a band every weekend" }]);
  });

  test("recency breaks score ties; senders get a boost but never appear without evidence", () => {
    const edges = [edge("e1", "Amy", "tokyo", null, 10), edge("e2", "Ken", "tokyo", null, 20)];
    const scores = new Map([
      ["e1", 2],
      ["e2", 2],
    ]);
    expect(rankGraph({ edges, senders: [], edgeScores: scores, limit: 5 }).map((c) => c.name)).toEqual(["Ken", "Amy"]);
    const withSenders = rankGraph({ edges, senders: ["amy", "Zed"], edgeScores: scores, limit: 5 });
    expect(withSenders.map((c) => c.name)).toEqual(["Amy", "Ken"]);
    expect(withSenders.find((c) => c.personKey === "zed")).toBeUndefined();
  });
});

async function seed(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const mk = (name: string, deviceId: string) =>
      ctx.db.insert("users", { name, avatar: "#000", city: "SF", wishesLeft: 1, stars: 0, deviceId });
    const owner = await mk("Darren", "dev_owner");
    const other = await mk("Olga", "dev_other");
    const wishId = await ctx.db.insert("wishes", {
      creatorId: other,
      type: "do_together",
      text: "Drums",
      status: "traveling",
      expiresAt: Date.now() + 3_600_000,
    });
    const hopId = await ctx.db.insert("hops", {
      wishId,
      depth: 1,
      holderName: "Darren",
      holderUserId: owner,
      recipientTags: [],
      viaGroup: false,
    });
    const put = (ownerUserId: Id<"users">, personName: string, tag: string, reason?: string) =>
      ctx.db.insert("edges", { ownerUserId, ownerName: "x", personName, tag, source: "pick", wishId, hopId, reason });
    await put(owner, "Amy", "music", "Plays drums in a band");
    await put(owner, "Ken", "tokyo", "Grew up in Shibuya");
    // Another user's edge about a drummer must never leak into the owner's ranking.
    await put(other, "Secret Sam", "drums", "Best drummer in the city");
    return { owner, other, wishId };
  });
}

describe("rankForWish", () => {
  test("keyword path (no key): ranks from the owner's edges only", async () => {
    const t = convexTest(schema, modules);
    const { owner } = await seed(t);
    const ranked = await t.action(internal.graphRank.rankForWish, { ownerUserId: owner, wishText: "jam on drums" });
    expect(ranked.map((c) => c.name)).toEqual(["Amy"]);
    expect(ranked[0].evidence).toEqual([{ tag: "music", reason: "Plays drums in a band" }]);
    expect(JSON.stringify(ranked)).not.toContain("Sam");
  });

  test("senders: the wish creator who passed to me is a 2nd-hop source", async () => {
    const t = convexTest(schema, modules);
    const { owner } = await seed(t);
    const input = await t.query(internal.graphRank.graphInput, { ownerUserId: owner });
    expect(input.senders).toEqual(["Olga"]);
    expect(input.edges).toHaveLength(2);
  });

  test("supermemory path maps hits back to the owner's edge ids only", async () => {
    const t = convexTest(schema, modules);
    const { owner } = await seed(t);
    const edges = await t.run((ctx) => ctx.db.query("edges").collect());
    const ken = edges.find((e) => e.personName === "Ken")!;
    const sam = edges.find((e) => e.personName === "Secret Sam")!;
    vi.stubEnv("SUPERMEMORY_API_KEY", "sm_test");
    const fetchMock = vi.fn(async () =>
      Response.json({
        results: [
          { id: "mem_1", similarity: 0.9, metadata: { edgeId: ken._id } },
          { id: "mem_2", similarity: 0.95, metadata: { edgeId: sam._id } },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const ranked = await t.action(internal.graphRank.rankForWish, { ownerUserId: owner, wishText: "ramen spots" });
    expect(ranked.map((c) => c.name)).toEqual(["Ken"]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://api.supermemory.ai/ns/ww_net_${owner}/search`);
    expect(JSON.parse(init.body as string)).toMatchObject({ query: "ramen spots", searchMode: "hybrid", limit: 20 });
  });

  test("supermemory error falls back to keyword scoring", async () => {
    const t = convexTest(schema, modules);
    const { owner } = await seed(t);
    vi.stubEnv("SUPERMEMORY_API_KEY", "sm_test");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 500 })));
    const ranked = await t.action(internal.graphRank.rankForWish, { ownerUserId: owner, wishText: "drums" });
    expect(ranked.map((c) => c.name)).toEqual(["Amy"]);
  });
});
