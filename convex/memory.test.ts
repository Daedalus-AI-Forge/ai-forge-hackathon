/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

type T = ReturnType<typeof convexTest>;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function seed(t: T, deviceId: string, edges: { personName: string; tag: string; reason?: string }[]) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { name: deviceId, avatar: "#000", city: "SF", wishesLeft: 1, stars: 0, deviceId });
    const wishId = await ctx.db.insert("wishes", {
      creatorId: userId,
      type: "do_together",
      text: "Someone to jam with.",
      status: "traveling",
      expiresAt: Date.now() + 3_600_000,
    });
    const hopId = await ctx.db.insert("hops", { wishId, depth: 1, holderName: "x", recipientTags: [], viaGroup: false });
    const edgeIds: Id<"edges">[] = [];
    for (const e of edges) {
      edgeIds.push(
        await ctx.db.insert("edges", { ownerUserId: userId, ownerName: deviceId, source: "pick", wishId, hopId, ...e }),
      );
    }
    return { userId, edgeIds };
  });
}

async function scheduled(t: T) {
  return await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
}

function okFetch() {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "x", status: "queued" }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("memory.ingest", () => {
  test("no key: no fetch", async () => {
    const t = convexTest(schema, modules);
    vi.stubEnv("SUPERMEMORY_API_KEY", "");
    const fetchMock = okFetch();
    const { edgeIds } = await seed(t, "dev_alice", [{ personName: "Amy", tag: "music", reason: "Plays drums" }]);
    expect(await t.action(internal.memory.ingest, { edgeId: edgeIds[0] })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("with key: posts to the owner's namespace with bearer auth and the edge body", async () => {
    const t = convexTest(schema, modules);
    vi.stubEnv("SUPERMEMORY_API_KEY", "sm_test_key");
    const fetchMock = okFetch();
    const { userId, edgeIds } = await seed(t, "dev_alice", [{ personName: " Amy  Lee", tag: "music", reason: "Plays drums" }]);
    await t.action(internal.memory.ingest, { edgeId: edgeIds[0] });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://api.supermemory.ai/ns/ww_net_${userId}/document`);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sm_test_key");
    expect(JSON.parse(init.body as string)).toEqual({
      id: edgeIds[0],
      content: " Amy  Lee: Plays drums [music]",
      metadata: { personKey: "amy lee", tag: "music", source: "pick" },
    });
  });

  test("with key: fetch failure is swallowed", async () => {
    const t = convexTest(schema, modules);
    vi.stubEnv("SUPERMEMORY_API_KEY", "sm_test_key");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { edgeIds } = await seed(t, "dev_alice", [{ personName: "Amy", tag: "music" }]);
    await expect(t.action(internal.memory.ingest, { edgeId: edgeIds[0] })).resolves.toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("memory.forget", () => {
  test("with key: deletes by id in the owner's namespace", async () => {
    const t = convexTest(schema, modules);
    vi.stubEnv("SUPERMEMORY_API_KEY", "sm_test_key");
    const fetchMock = okFetch();
    const { userId } = await seed(t, "dev_alice", []);
    await t.action(internal.memory.forget, { edgeId: "edge_123", ownerUserId: userId });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://api.supermemory.ai/ns/ww_net_${userId}/document`);
    expect(init.method).toBe("DELETE");
    expect(JSON.parse(init.body as string)).toEqual({ ids: ["edge_123"] });
  });

  test("no key or no owner: no fetch", async () => {
    const t = convexTest(schema, modules);
    const fetchMock = okFetch();
    vi.stubEnv("SUPERMEMORY_API_KEY", "sm_test_key");
    await t.action(internal.memory.forget, { edgeId: "edge_123" });
    vi.stubEnv("SUPERMEMORY_API_KEY", "");
    const { userId } = await seed(t, "dev_alice", []);
    await t.action(internal.memory.forget, { edgeId: "edge_123", ownerUserId: userId });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("memory.backfill", () => {
  test("schedules ingest for every edge of the owner", async () => {
    vi.useFakeTimers();
    try {
      const t = convexTest(schema, modules);
      vi.stubEnv("SUPERMEMORY_API_KEY", "sm_test_key");
      const fetchMock = okFetch();
      const { userId } = await seed(t, "dev_alice", [
        { personName: "Amy", tag: "music" },
        { personName: "Ken", tag: "tokyo" },
      ]);
      await seed(t, "dev_bob", [{ personName: "Zed", tag: "x" }]);
      await t.action(internal.memory.backfill, { ownerUserId: userId });
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      const urls = fetchMock.mock.calls.map((c) => (c as unknown as [string])[0]);
      expect(urls).toHaveLength(2);
      expect(urls.every((u) => u.includes(`ww_net_${userId}`))).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("edges.forget / forgetEdge", () => {
  test("forget by person deletes the edges and schedules memory.forget for each", async () => {
    const t = convexTest(schema, modules);
    const { userId, edgeIds } = await seed(t, "dev_alice", [
      { personName: "Amy", tag: "music" },
      { personName: "amy", tag: "drums" },
      { personName: "Ken", tag: "tokyo" },
    ]);
    await t.mutation(api.edges.forget, { deviceId: "dev_alice", personName: "Amy" });
    const left = await t.run((ctx) => ctx.db.query("edges").collect());
    expect(left.map((e) => e.personName)).toEqual(["Ken"]);
    const jobs = (await scheduled(t)).filter((j) => j.name === "memory:forget");
    expect(jobs.map((j) => j.args[0])).toEqual([
      { edgeId: edgeIds[0], ownerUserId: userId },
      { edgeId: edgeIds[1], ownerUserId: userId },
    ]);
  });

  test("forgetEdge deletes the owner's edge and schedules memory.forget", async () => {
    const t = convexTest(schema, modules);
    const { userId, edgeIds } = await seed(t, "dev_alice", [{ personName: "Amy", tag: "music" }]);
    expect(await t.mutation(api.edges.forgetEdge, { deviceId: "dev_alice", edgeId: edgeIds[0] })).toBeNull();
    expect(await t.run((ctx) => ctx.db.get("edges", edgeIds[0]))).toBeNull();
    const jobs = (await scheduled(t)).filter((j) => j.name === "memory:forget");
    expect(jobs.map((j) => j.args[0])).toEqual([{ edgeId: edgeIds[0], ownerUserId: userId }]);
  });

  test("forgetEdge rejects a non-owner and keeps the edge", async () => {
    const t = convexTest(schema, modules);
    const { edgeIds } = await seed(t, "dev_alice", [{ personName: "Amy", tag: "music" }]);
    await seed(t, "dev_bob", []);
    await expect(t.mutation(api.edges.forgetEdge, { deviceId: "dev_bob", edgeId: edgeIds[0] })).rejects.toThrow(
      /Not your connection/,
    );
    expect(await t.run((ctx) => ctx.db.get("edges", edgeIds[0]))).not.toBeNull();
    expect((await scheduled(t)).filter((j) => j.name === "memory:forget")).toHaveLength(0);
  });
});
