/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { COACH_THRESHOLD } from "./graphShared";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

type T = ReturnType<typeof convexTest>;

async function seedUser(t: T, name: string, deviceId: string) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { name, avatar: "#000", city: "SF", wishesLeft: 1, stars: 0, deviceId });
    const wishId = await ctx.db.insert("wishes", {
      creatorId: userId,
      type: "do_together",
      text: "Someone to jam with.",
      status: "traveling",
      expiresAt: Date.now() + 3_600_000,
    });
    const hopId = await ctx.db.insert("hops", { wishId, depth: 1, holderName: name, recipientTags: [], viaGroup: false });
    return { userId, wishId, hopId };
  });
}

async function addEdge(
  t: T,
  owner: { userId: Id<"users">; wishId: Id<"wishes">; hopId: Id<"hops"> },
  personName: string,
  tag: string,
  extra: { reason?: string; source?: "pick" | "daily" } = {},
) {
  return await t.run((ctx) =>
    ctx.db.insert("edges", {
      ownerUserId: owner.userId,
      ownerName: "owner",
      personName,
      tag,
      source: extra.source ?? "pick",
      reason: extra.reason,
      wishId: owner.wishId,
      hopId: owner.hopId,
    }),
  );
}

describe("graph.myNetwork", () => {
  test("returns null for an unknown device", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.graph.myNetwork, { deviceId: "dev_nobody" })).toBeNull();
  });

  test("user B never sees user A's edges", async () => {
    const t = convexTest(schema, modules);
    const a = await seedUser(t, "Alice", "dev_alice");
    await seedUser(t, "Bob", "dev_bob");
    await addEdge(t, a, "Amy", "music", { reason: "Plays drums" });

    const bob = await t.query(api.graph.myNetwork, { deviceId: "dev_bob" });
    expect(bob).toEqual({ me: { name: "Bob" }, nodes: [], links: [] });
    const alice = await t.query(api.graph.myNetwork, { deviceId: "dev_alice" });
    expect(alice?.links).toHaveLength(1);
  });

  test("aggregates edges per personKey with latest spelling, unique tags, counts", async () => {
    const t = convexTest(schema, modules);
    const a = await seedUser(t, "Alice", "dev_alice");
    const e1 = await addEdge(t, a, "amy", "music", { reason: "Plays in a band" });
    await addEdge(t, a, "Amy ", "music", { source: "daily" });
    const e3 = await addEdge(t, a, "  AMY", "drums");
    await addEdge(t, a, "Ken", "tokyo", { reason: "Grew up in Shibuya" });

    const net = await t.query(api.graph.myNetwork, { deviceId: "dev_alice" });
    expect(net).not.toBeNull();
    const amy = net!.nodes.find((n) => n.personKey === "amy");
    expect(amy).toEqual({ personKey: "amy", name: "AMY", tags: ["drums", "music"], edgeCount: 3 });
    expect(net!.nodes.find((n) => n.personKey === "ken")).toEqual({
      personKey: "ken",
      name: "Ken",
      tags: ["tokyo"],
      edgeCount: 1,
    });
    expect(net!.links).toHaveLength(4);
    // Newest first.
    expect(net!.links[0].personKey).toBe("ken");
    expect(net!.links.at(-1)).toMatchObject({ edgeId: e1, personKey: "amy", tag: "music", reason: "Plays in a band", source: "pick" });
    const l3 = net!.links.find((l) => l.edgeId === e3)!;
    expect(l3.reason).toBeNull();
    expect(typeof l3.createdAt).toBe("number");
  });
});

describe("graph.coachReady", () => {
  test("unknown device is not ready", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.graph.coachReady, { deviceId: "dev_nobody" })).toEqual({
      ready: false,
      edgeCount: 0,
      threshold: COACH_THRESHOLD,
    });
  });

  test("threshold boundary: 4 edges not ready, 5 ready; other users' edges don't count", async () => {
    const t = convexTest(schema, modules);
    const a = await seedUser(t, "Alice", "dev_alice");
    const b = await seedUser(t, "Bob", "dev_bob");
    for (let i = 0; i < 10; i++) await addEdge(t, b, `P${i}`, "x");
    for (let i = 0; i < 4; i++) await addEdge(t, a, `P${i}`, "x");
    expect(await t.query(api.graph.coachReady, { deviceId: "dev_alice" })).toEqual({ ready: false, edgeCount: 4, threshold: 5 });
    await addEdge(t, a, "P4", "x");
    expect(await t.query(api.graph.coachReady, { deviceId: "dev_alice" })).toEqual({ ready: true, edgeCount: 5, threshold: 5 });
  });
});

test("edges.forget removes every spelling that myNetwork merges into one node", async () => {
  const t = convexTest(schema, modules);
  const a = await seedUser(t, "Darren", "dev_forget_a");
  await addEdge(t, a, "Amy Lee", "music");
  await addEdge(t, a, "amy   lee", "drums");
  await addEdge(t, a, "Ken", "tokyo");
  await t.mutation(api.edges.forget, { deviceId: "dev_forget_a", personName: "AMY LEE" });
  const net = await t.query(api.graph.myNetwork, { deviceId: "dev_forget_a" });
  expect(net?.nodes.map((n) => n.personKey)).toEqual(["ken"]);
});
