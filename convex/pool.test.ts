/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";

import { api } from "./_generated/api";
import { BOATS_PER_COIN } from "./lib";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function player(t: ReturnType<typeof convexTest>, deviceId: string, name: string, city: string) {
  await t.mutation(api.users.ensure, { deviceId });
  await t.mutation(api.users.updateProfile, { deviceId, name, city });
}

test("yesterday's daily boat shows up in today's voyage log with who found it", async () => {
  const t = convexTest(schema, modules);
  await player(t, "dev_me", "Louise", "SF");
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const mine = await t.mutation(api.daily.join, { deviceId: "dev_me" });
  await t.mutation(api.hops.act, { hopId: mine, action: "pass", name: "Louise", city: "SF", vouch: "", tags: [] });
  const amy = await t.mutation(api.hops.passTo, { parentHopId: mine, name: "Amy", tags: [] });
  await t.mutation(api.hops.act, { hopId: amy, action: "pass", name: "Amy", city: "New York", vouch: "Roommate.", tags: [] });
  const mia = await t.mutation(api.hops.passTo, { parentHopId: amy, name: "Mia", tags: [] });
  await t.mutation(api.hops.itsMe, { hopId: mia, name: "Mia", city: "Shanghai", intro: "12 oil paintings on my wall.", contact: "", showNameAndCity: true });

  expect(await t.query(api.pool.voyageLog, { deviceId: "dev_me", date: today })).toBeNull();
  const log = await t.query(api.pool.voyageLog, { deviceId: "dev_me", date: tomorrow });
  expect(log).toMatchObject({
    people: 2,
    fromCity: "SF",
    toCity: "Shanghai",
    cities: ["SF", "New York", "Shanghai"],
    found: { name: "Mia", city: "Shanghai", story: "12 oil paintings on my wall." },
    fastest: 3,
  });

  expect(await t.query(api.pool.friendsSay, { deviceId: "dev_me" })).toMatchObject([{ byName: "Amy", text: "Roommate." }]);

  const voyages = await t.query(api.pool.voyages, { deviceId: "dev_me" });
  expect(voyages).toHaveLength(1);
  expect(voyages[0]).toMatchObject({ source: "daily", status: "landed", hops: 2 });
});

test("a finder who hides their name shows up as Someone", async () => {
  const t = convexTest(schema, modules);
  await player(t, "dev_me", "Louise", "SF");
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const mine = await t.mutation(api.daily.join, { deviceId: "dev_me" });
  await t.mutation(api.hops.act, { hopId: mine, action: "pass", name: "Louise", city: "SF", vouch: "", tags: [] });
  const amy = await t.mutation(api.hops.passTo, { parentHopId: mine, name: "Amy", tags: [] });
  await t.mutation(api.hops.itsMe, { hopId: amy, name: "Amy", city: "Paris", intro: "Hi", contact: "", showNameAndCity: false });
  const log = await t.query(api.pool.voyageLog, { deviceId: "dev_me", date: tomorrow });
  expect(log?.found).toEqual({ name: "Someone", city: null, story: "Hi" });
});

test("every five boats pushed earns a coin", async () => {
  const t = convexTest(schema, modules);
  await player(t, "dev_me", "Louise", "SF");
  await player(t, "dev_friend", "Amy", "NYC");
  const before = (await t.query(api.users.me, { deviceId: "dev_me" }))!;
  for (let i = 0; i < BOATS_PER_COIN; i++) {
    await t.mutation(api.users.updateProfile, { deviceId: "dev_friend", name: "Amy", city: "NYC" });
    const { hopIds } = await t.mutation(api.wishes.toss, {
      deviceId: "dev_friend",
      type: "do_together",
      text: `wish ${i}`,
      name: "Amy",
      city: "NYC",
      recipients: [{ name: "Louise", tags: [] }],
    });
    await t.mutation(api.hops.claim, { hopId: hopIds[0], deviceId: "dev_me" });
    await t.mutation(api.hops.act, { hopId: hopIds[0], action: "pass", name: "Louise", city: "SF", vouch: "Amy is great", tags: [] });
    const me = (await t.query(api.users.me, { deviceId: "dev_me" }))!;
    expect(me.boatProgress).toBe((i + 1) % BOATS_PER_COIN);
    // Amy needs a fresh credit for her next wish.
    await t.run(async (ctx) => {
      const amy = (await ctx.db.query("users").withIndex("by_deviceId", (q) => q.eq("deviceId", "dev_friend")).unique())!;
      await ctx.db.patch("users", amy._id, { wishesLeft: 1 });
    });
  }
  const after = (await t.query(api.users.me, { deviceId: "dev_me" }))!;
  expect(after.wishesLeft).toBe(before.wishesLeft + 1);
});

test("setShowInLogs stores the privacy choice", async () => {
  const t = convexTest(schema, modules);
  await player(t, "dev_me", "Louise", "SF");
  await t.mutation(api.pool.setShowInLogs, { deviceId: "dev_me", value: false });
  expect((await t.query(api.users.me, { deviceId: "dev_me" }))?.showInLogs).toBe(false);
});
