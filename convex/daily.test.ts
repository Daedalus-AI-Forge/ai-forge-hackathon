/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";

import { api } from "./_generated/api";
import { PROBES, dateKey } from "./daily";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function player(t: ReturnType<typeof convexTest>, deviceId: string, name: string) {
  await t.mutation(api.users.ensure, { deviceId });
  await t.mutation(api.users.updateProfile, { deviceId, name, city: "SF" });
}

test("passing the daily wish tags the friend in the owner's network, and they can forget it", async () => {
  const t = convexTest(schema, modules);
  await player(t, "dev_mia", "Mia");
  const date = dateKey(Date.now());

  const preview = await t.query(api.daily.today, { deviceId: "dev_mia", date });
  expect(PROBES.map((p) => p.tag)).toContain(preview.tag);
  expect(preview.hopId).toBeNull();

  const hopId = await t.mutation(api.daily.join, { deviceId: "dev_mia" });
  expect(await t.mutation(api.daily.join, { deviceId: "dev_mia" })).toBe(hopId);
  const page = await t.query(api.hops.page, { hopId });
  expect(page?.wish.daily?.tag).toBe(preview.tag);
  expect(page?.wish.text).toBe(preview.title);

  // First hop comes from the well, so no vouch is needed.
  await t.mutation(api.hops.act, { hopId, action: "pass", name: "Mia", city: "SF", vouch: "", tags: [] });
  await t.mutation(api.hops.passTo, { parentHopId: hopId, name: "Amy", tags: ["music"] });

  const map = await t.query(api.edges.mine, { deviceId: "dev_mia" });
  expect(map).toHaveLength(1);
  expect(map[0].name).toBe("Amy");
  expect(map[0].tags).toEqual(
    expect.arrayContaining([
      { tag: preview.tag, source: "daily" },
      { tag: "music", source: "pick" },
    ]),
  );
  expect((await t.query(api.daily.today, { deviceId: "dev_mia", date })).passedTo).toBe(1);
  expect(await t.query(api.edges.mine, { deviceId: "dev_other" })).toEqual([]);

  await t.mutation(api.edges.forget, { deviceId: "dev_mia", personName: "amy" });
  expect(await t.query(api.edges.mine, { deviceId: "dev_mia" })).toEqual([]);
});

test("a normal wish still needs a vouch, and the next daily wish targets the least mapped tag", async () => {
  const t = convexTest(schema, modules);
  await player(t, "dev_mia", "Mia");
  const { hopIds } = await t.mutation(api.wishes.toss, {
    deviceId: "dev_mia",
    type: "local",
    text: "A local in Tokyo",
    name: "Mia",
    city: "SF",
    recipients: [{ name: "Sam", tags: ["food"] }],
  });
  await expect(
    t.mutation(api.hops.act, { hopId: hopIds[0], action: "pass", name: "Sam", city: "NYC", vouch: "", tags: [] }),
  ).rejects.toThrow("Vouch");
  expect((await t.query(api.edges.mine, { deviceId: "dev_mia" }))[0].tags).toEqual([{ tag: "food", source: "pick" }]);

  const date = dateKey(Date.now());
  const first = await t.query(api.daily.today, { deviceId: "dev_mia", date });
  await t.run(async (ctx) => {
    const wish = (await ctx.db.query("wishes").first())!;
    await ctx.db.insert("edges", {
      ownerName: "Mia",
      personName: "Amy",
      tag: first.tag,
      source: "daily",
      wishId: wish._id,
      hopId: hopIds[0],
    });
  });
  expect((await t.query(api.daily.today, { deviceId: "dev_mia", date })).tag).not.toBe(first.tag);
});

test("stats count real hops", async () => {
  const t = convexTest(schema, modules);
  expect(await t.query(api.stats.summary, {})).toMatchObject({ people: 0, passes: 0, granted: 0, avgRipples: null });
  await player(t, "dev_mia", "Mia");
  await t.mutation(api.wishes.toss, {
    deviceId: "dev_mia",
    type: "local",
    text: "A local in Tokyo",
    name: "Mia",
    city: "SF",
    recipients: [
      { name: "Sam", tags: [] },
      { name: "Wei", tags: [] },
    ],
  });
  expect(await t.query(api.stats.summary, {})).toMatchObject({ people: 2, passes: 2, vouches: 0 });
});
