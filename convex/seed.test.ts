/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { api, internal } from "./_generated/api";
import { COACH_THRESHOLD } from "./graphShared";
import schema from "./schema";
import { FRESH_DEVICE_ID } from "./seed";

const modules = import.meta.glob("./**/*.ts");

async function seeded() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.seed.run, {});
  // claimDemo needs DEMO_MODE; binding the device id directly is equivalent here.
  await t.run(async (ctx) => {
    const mia = await ctx.db
      .query("users")
      .withIndex("by_demoKey", (q) => q.eq("demoKey", "me"))
      .unique();
    await ctx.db.patch("users", mia!._id, { deviceId: "dev_seed_mia" });
  });
  return t;
}

describe("seed.run demo graph", () => {
  test("Mia's coach is ready and her ego graph is rich", async () => {
    const t = await seeded();
    const ready = await t.query(api.graph.coachReady, { deviceId: "dev_seed_mia" });
    expect(ready.ready).toBe(true);
    expect(ready.edgeCount).toBeGreaterThanOrEqual(20);
    const net = await t.query(api.graph.myNetwork, { deviceId: "dev_seed_mia" });
    expect(net!.me.name).toBe("Mia");
    expect(net!.nodes).toHaveLength(12);
    expect(net!.links.every((l) => l.reason)).toBe(true);
    expect(net!.links.some((l) => l.source === "daily")).toBe(true);
    for (const tag of ["music", "drums", "tokyo", "food", "climbing", "design", "antarctica"]) {
      expect(net!.links.some((l) => l.tag === tag)).toBe(true);
    }
  });

  test("the fresh demo user is below the coach threshold", async () => {
    const t = await seeded();
    const ready = await t.query(api.graph.coachReady, { deviceId: FRESH_DEVICE_ID });
    expect(ready).toEqual({ ready: false, edgeCount: 2, threshold: COACH_THRESHOLD });
  });

  test("re-running the seed is idempotent", async () => {
    const t = await seeded();
    const count = () =>
      t.run(async (ctx) => ({
        users: (await ctx.db.query("users").collect()).length,
        edges: (await ctx.db.query("edges").collect()).length,
        wishes: (await ctx.db.query("wishes").collect()).length,
        hops: (await ctx.db.query("hops").collect()).length,
      }));
    const first = await count();
    await t.mutation(internal.seed.run, {});
    expect(await count()).toEqual(first);
  });

  test("seeded wishes carry a mode", async () => {
    const t = await seeded();
    const modes = await t.run(async (ctx) =>
      (await ctx.db.query("wishes").collect()).map((w) => [w.text.slice(0, 20), w.mode, !!w.daily] as const),
    );
    expect(modes.every(([, mode]) => mode === "serious" || mode === "fun")).toBe(true);
    expect(modes.filter(([, , daily]) => daily).every(([, mode]) => mode === "fun")).toBe(true);
    expect(modes.find(([text]) => text.startsWith("A local in Tokyo"))?.[1]).toBe("serious");
    expect(modes.find(([text]) => text.startsWith("Someone to jam"))?.[1]).toBe("serious");
  });
});
