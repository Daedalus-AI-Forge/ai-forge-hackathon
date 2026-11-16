/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

function addUser(ctx: MutationCtx, name: string, extra: Partial<Doc<"users">> = {}) {
  return ctx.db.insert("users", { name, avatar: "#000", city: `${name}ville`, wishesLeft: 1, stars: 0, deviceId: `dev_${name}`, ...extra });
}

function addHop(
  ctx: MutationCtx,
  wishId: Id<"wishes">,
  holder: { id: Id<"users">; name: string },
  details: Partial<Doc<"hops">> = {},
) {
  return ctx.db.insert("hops", {
    wishId,
    depth: 1,
    holderName: holder.name,
    holderUserId: holder.id,
    recipientTags: [],
    viaGroup: false,
    city: `${holder.name}ville`,
    ...details,
  });
}

/** Ann wishes; Bo passes to Cy and Di; Cy passes to Ed, who says it's me. Di's branch goes nowhere. */
async function world(t: ReturnType<typeof convexTest>, wish: Partial<Doc<"wishes">> = {}, finder: Partial<Doc<"hops">> = {}) {
  return await t.run(async (ctx) => {
    const ids = {
      ann: await addUser(ctx, "Ann"),
      bo: await addUser(ctx, "Bo"),
      cy: await addUser(ctx, "Cy"),
      di: await addUser(ctx, "Di"),
      ed: await addUser(ctx, "Ed"),
      stranger: await addUser(ctx, "Stranger"),
    };
    const wishId = await ctx.db.insert("wishes", {
      creatorId: ids.ann,
      type: "do_together",
      text: "Someone to jam with.",
      status: "found",
      expiresAt: Date.now() + 3_600_000,
      ...wish,
    });
    const bo = await addHop(ctx, wishId, { id: ids.bo, name: "Bo" }, { action: "pass", actedAt: 1 });
    const cy = await addHop(ctx, wishId, { id: ids.cy, name: "Cy" }, { parentHopId: bo, depth: 2, action: "pass", actedAt: 2 });
    await addHop(ctx, wishId, { id: ids.di, name: "Di" }, { parentHopId: bo, depth: 2, action: "pass", actedAt: 2 });
    const ed = await addHop(ctx, wishId, { id: ids.ed, name: "Ed" }, {
      parentHopId: cy, depth: 3, action: "its_me", actedAt: 3, itsMeIntro: "I drum!", ...finder,
    });
    if (wish.status !== "traveling") await ctx.db.patch("wishes", wishId, { winningHopId: ed });
    return { ids, wishId, ed };
  });
}

describe("chains.mine", () => {
  test("everyone on the winning branch sees the chain, from wisher to finder, with their role", async () => {
    const t = convexTest(schema, modules);
    const { ids, wishId } = await world(t);
    const roles: Record<string, string> = {};
    for (const name of ["Ann", "Bo", "Cy", "Ed"]) {
      const chains = await t.query(api.chains.mine, { deviceId: `dev_${name}` });
      expect(chains).toHaveLength(1);
      expect(chains[0]!.wishId).toBe(wishId);
      expect(chains[0]!.people.map((p) => p.name)).toEqual(["Ann", "Bo", "Cy", "Ed"]);
      expect(chains[0]!.people.filter((p) => p.me).map((p) => p.name)).toEqual([name]);
      roles[name] = chains[0]!.role;
    }
    expect(roles).toEqual({ Ann: "wisher", Bo: "passer", Cy: "passer", Ed: "finder" });
    const [chain] = await t.query(api.chains.mine, { deviceId: "dev_Bo" });
    expect(chain!.people.map((p) => p.userKey)).toEqual([ids.ann, ids.bo, ids.cy, ids.ed].map((id) => `user:${id}`));
    expect(chain!.story).toBe("I drum!");
  });

  test("a branch that didn't find the person, strangers and unknown devices get nothing", async () => {
    const t = convexTest(schema, modules);
    await world(t);
    expect(await t.query(api.chains.mine, { deviceId: "dev_Di" })).toEqual([]);
    expect(await t.query(api.chains.mine, { deviceId: "dev_Stranger" })).toEqual([]);
    expect(await t.query(api.chains.mine, { deviceId: "dev_nobody" })).toEqual([]);
  });

  test("an unconfirmed claim is not a chain that came true yet", async () => {
    const t = convexTest(schema, modules);
    await world(t, { status: "traveling" });
    for (const name of ["Ann", "Bo", "Ed"]) expect(await t.query(api.chains.mine, { deviceId: `dev_${name}` })).toEqual([]);
  });

  test("a finder who hid their name stays 'Someone' to others but sees themselves", async () => {
    const t = convexTest(schema, modules);
    await world(t, {}, { itsMePublic: false });
    const [forAnn] = await t.query(api.chains.mine, { deviceId: "dev_Ann" });
    expect(forAnn!.people.at(-1)).toEqual({ name: "Someone", city: null, userKey: null, me: false });
    const [forEd] = await t.query(api.chains.mine, { deviceId: "dev_Ed" });
    expect(forEd!.people.at(-1)).toMatchObject({ name: "Ed", me: true });
  });

  test("users hidden from the network keep their name in the chain but no map key", async () => {
    const t = convexTest(schema, modules);
    const { ids } = await world(t);
    await t.run((ctx) => ctx.db.patch("users", ids.cy, { showInLogs: false }));
    const [chain] = await t.query(api.chains.mine, { deviceId: "dev_Ann" });
    expect(chain!.people[2]).toMatchObject({ name: "Cy", userKey: null });
  });

  test("a real wish shows its meet-up photo only once both people confirmed it", async () => {
    const t = convexTest(schema, modules);
    const [proofStorageId, meetStorageId] = await t.run(async (ctx) => [
      await ctx.storage.store(new Blob(["proof"], { type: "image/jpeg" })),
      await ctx.storage.store(new Blob(["us"], { type: "image/jpeg" })),
    ]);
    const { wishId } = await world(t, { status: "found" }, { proofStorageId });
    const meetingPhoto = { storageId: meetStorageId, uploaderRole: "creator" as const, metInPerson: true, thankYou: "Thank you!" };
    // Found, photo uploaded but not yet confirmed by the other person: still developing for everyone.
    await t.run((ctx) => ctx.db.patch("wishes", wishId, { meetingPhoto }));
    const [pending] = await t.query(api.chains.mine, { deviceId: "dev_Bo" });
    expect(pending).toMatchObject({ status: "found", photoUrl: null });
    // Granted: the confirmed meet-up photo, never the claim's proof photo.
    await t.run((ctx) => ctx.db.patch("wishes", wishId, { status: "granted" }));
    const [granted] = await t.query(api.chains.mine, { deviceId: "dev_Bo" });
    const meetUrl = await t.run((ctx) => ctx.storage.getUrl(meetStorageId));
    expect(granted).toMatchObject({ status: "granted", photoUrl: meetUrl });
    // Older granted rows without a meeting photo fall back to the wish's own photo.
    await t.run((ctx) => ctx.db.patch("wishes", wishId, { meetingPhoto: undefined, photoUrl: "https://example.com/us.jpg" }));
    const [legacy] = await t.query(api.chains.mine, { deviceId: "dev_Bo" });
    expect(legacy!.photoUrl).toBe("https://example.com/us.jpg");
  });

  test("a daily boat's ending photo is the finder's proof photo", async () => {
    const t = convexTest(schema, modules);
    const proofUrl = await t.run(async (ctx) => {
      const well = await addUser(ctx, "Well", { demoKey: "well", deviceId: undefined });
      const a = await addUser(ctx, "Al");
      const b = await addUser(ctx, "Bea");
      const proofStorageId = await ctx.storage.store(new Blob(["proof"], { type: "image/jpeg" }));
      const wishId = await ctx.db.insert("wishes", {
        creatorId: well, type: "same_boat", text: "Daily", status: "traveling", expiresAt: Date.now() + 1000,
        daily: { date: "2026-11-15", steps: [], reasoning: "" },
      });
      const al = await addHop(ctx, wishId, { id: a, name: "Al" }, { action: "pass" });
      await addHop(ctx, wishId, { id: b, name: "Bea" }, { parentHopId: al, depth: 2, action: "its_me", actedAt: 5, proofStorageId });
      return await ctx.storage.getUrl(proofStorageId);
    });
    const [chain] = await t.query(api.chains.mine, { deviceId: "dev_Al" });
    expect(chain!.photoUrl).toBe(proofUrl);
  });

  test("daily boats count the first landing below my own hop", async () => {
    const t = convexTest(schema, modules);
    const deviceIds = await t.run(async (ctx) => {
      const well = await addUser(ctx, "Well", { demoKey: "well", deviceId: undefined });
      const a = await addUser(ctx, "Al");
      const b = await addUser(ctx, "Bea");
      const c = await addUser(ctx, "Cal");
      const wishId = await ctx.db.insert("wishes", {
        creatorId: well, type: "same_boat", text: "Daily", status: "traveling", expiresAt: Date.now() + 1000,
        daily: { date: "2026-11-15", steps: [], reasoning: "" },
      });
      const al = await addHop(ctx, wishId, { id: a, name: "Al" }, { action: "pass" });
      await addHop(ctx, wishId, { id: b, name: "Bea" }, { parentHopId: al, depth: 2, action: "its_me", actedAt: 5 });
      await addHop(ctx, wishId, { id: c, name: "Cal" }, { action: "pass" });
      return ["dev_Al", "dev_Bea", "dev_Cal"];
    });
    const [al, bea, cal] = await Promise.all(deviceIds.map((deviceId) => t.query(api.chains.mine, { deviceId })));
    expect(al!.map((c) => c.people.map((p) => p.name))).toEqual([["Al", "Bea"]]);
    expect(al![0]!.daily).toBe(true);
    expect(bea).toHaveLength(1);
    expect(cal).toEqual([]);
  });

  test("the demo profile has a seeded chain that came true through her", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.seed.run, {});
    await t.run(async (ctx) => {
      const mia = await ctx.db.query("users").withIndex("by_demoKey", (q) => q.eq("demoKey", "me")).unique();
      await ctx.db.patch("users", mia!._id, { deviceId: "dev_seed_mia" });
    });
    const chains = await t.query(api.chains.mine, { deviceId: "dev_seed_mia" });
    expect(chains.map((c) => [c.role, c.people.map((p) => p.name)])).toEqual([["passer", ["Yui", "Kenji", "Mia", "Priya"]]]);
    expect(chains[0]!.photoUrl).toBe("asset:drum-meet");
  });
});
