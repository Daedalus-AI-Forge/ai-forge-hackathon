/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { createOrUpdateUser } from "./authUsers";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

function setup() {
  return convexTest(schema, modules);
}

/** Convex Auth puts `<userId>|<sessionId>` in the JWT subject. */
async function signedInAs(t: ReturnType<typeof setup>, userId: Id<"users">, provider: string) {
  const sessionId = await t.run(async (ctx) => {
    await ctx.db.insert("authAccounts", { userId, provider, providerAccountId: `${provider}-${userId}` });
    return await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 60_000 });
  });
  return t.withIdentity({ subject: `${userId}|${sessionId}` });
}

async function deviceUserWithData(t: ReturnType<typeof setup>, deviceId: string) {
  const userId = await t.mutation(api.users.ensure, { deviceId });
  await t.mutation(api.users.updateProfile, { deviceId, name: "Mia", city: "SF" });
  return await t.run(async (ctx) => {
    await ctx.db.patch("users", userId, { stars: 3, wishesLeft: 0 });
    const wishId = await ctx.db.insert("wishes", {
      creatorId: userId,
      type: "local",
      text: "A local in Tokyo",
      status: "traveling",
      expiresAt: Date.now() + 1000,
    });
    const hopId = await ctx.db.insert("hops", {
      wishId,
      depth: 1,
      holderName: "Mia",
      holderUserId: userId,
      recipientTags: [],
      viaGroup: false,
    });
    await ctx.db.insert("vouches", { aboutName: "Mia", aboutUserId: userId, byName: "Ben", text: "great", tags: [], wishId, hopId });
    await ctx.db.insert("network", { ownerId: userId, personName: "Ben", tags: [] });
    return { userId, wishId, hopId };
  });
}

describe("anonymous sign-in (createOrUpdateUser)", () => {
  test("adopts the existing device row so device data is kept", async () => {
    const t = setup();
    const { userId } = await deviceUserWithData(t, "dev_a");
    const adopted = await t.run((ctx) =>
      createOrUpdateUser(ctx as unknown as MutationCtx, {
        existingUserId: null,
        provider: { id: "anonymous" },
        profile: { deviceId: "dev_a", isAnonymous: true },
      }),
    );
    expect(adopted).toBe(userId);
    const row = await t.run((ctx) => ctx.db.get("users", userId));
    expect(row?.isAnonymous).toBe(true);
    expect(row?.stars).toBe(3);
  });

  test("creates a fresh anonymous row bound to a new device", async () => {
    const t = setup();
    const id = await t.run((ctx) =>
      createOrUpdateUser(ctx as unknown as MutationCtx, {
        existingUserId: null,
        provider: { id: "anonymous" },
        profile: { deviceId: "dev_new", isAnonymous: true },
      }),
    );
    const row = await t.run((ctx) => ctx.db.get("users", id));
    expect(row).toMatchObject({ deviceId: "dev_new", isAnonymous: true, wishesLeft: 1, stars: 0 });
  });

  test("never hands a Google-linked row to an anonymous sign-in", async () => {
    const t = setup();
    const userId = await t.mutation(api.users.ensure, { deviceId: "dev_g" });
    await signedInAs(t, userId, "google");
    const id = await t.run((ctx) =>
      createOrUpdateUser(ctx as unknown as MutationCtx, {
        existingUserId: null,
        provider: { id: "anonymous" },
        profile: { deviceId: "dev_g", isAnonymous: true },
      }),
    );
    expect(id).not.toBe(userId);
    const row = await t.run((ctx) => ctx.db.get("users", id));
    expect(row?.deviceId).toBeUndefined();
  });
});

describe("Google/Apple sign-in (createOrUpdateUser)", () => {
  test("creates a full app user from the provider profile", async () => {
    const t = setup();
    const id = await t.run((ctx) =>
      createOrUpdateUser(ctx as unknown as MutationCtx, {
        existingUserId: null,
        provider: { id: "google" },
        profile: { email: "mia@example.com", name: "Mia Chen", image: "https://x/y.png" },
      }),
    );
    const row = await t.run((ctx) => ctx.db.get("users", id));
    expect(row).toMatchObject({ name: "Mia Chen", email: "mia@example.com", city: "", wishesLeft: 1, stars: 0 });
    expect(row?.deviceId).toBeUndefined();
  });

  test("returning sign-in keeps the stored name (Apple sends it only once)", async () => {
    const t = setup();
    const id = await t.run((ctx) =>
      createOrUpdateUser(ctx as unknown as MutationCtx, {
        existingUserId: null,
        provider: { id: "apple" },
        profile: { name: "Mia" },
      }),
    );
    const again = await t.run((ctx) =>
      createOrUpdateUser(ctx as unknown as MutationCtx, {
        existingUserId: id,
        provider: { id: "apple" },
        profile: {},
      }),
    );
    expect(again).toBe(id);
    expect((await t.run((ctx) => ctx.db.get("users", id)))?.name).toBe("Mia");
  });
});

describe("users.linkDevice (anonymous -> account upgrade)", () => {
  test("moves wishes, hops, vouches, network, stars and wishes left onto the account", async () => {
    const t = setup();
    const { userId: deviceUserId, wishId, hopId } = await deviceUserWithData(t, "dev_up");
    const accountId = await t.run((ctx) =>
      ctx.db.insert("users", { name: "", avatar: "#000", city: "", wishesLeft: 1, stars: 2, email: "m@x.com" }),
    );
    const asAccount = await signedInAs(t, accountId, "google");

    expect(await asAccount.mutation(api.users.linkDevice, { deviceId: "dev_up" })).toEqual({ merged: true });

    const state = await t.run(async (ctx) => ({
      account: await ctx.db.get("users", accountId),
      old: await ctx.db.get("users", deviceUserId),
      wish: await ctx.db.get("wishes", wishId),
      hop: await ctx.db.get("hops", hopId),
      vouches: await ctx.db.query("vouches").collect(),
      network: await ctx.db.query("network").collect(),
    }));
    expect(state.old).toBeNull();
    expect(state.account).toMatchObject({ name: "Mia", city: "SF", stars: 5, wishesLeft: 1 });
    expect(state.wish?.creatorId).toBe(accountId);
    expect(state.hop?.holderUserId).toBe(accountId);
    expect(state.vouches.map((x) => x.aboutUserId)).toEqual([accountId]);
    expect(state.network.map((x) => x.ownerId)).toEqual([accountId]);

    // The deviceId-based API now resolves to the account while signed in.
    const home = await asAccount.query(api.wishes.home, { deviceId: "dev_up" });
    expect(home?.user._id).toBe(accountId);
    expect(home?.activeWish?._id).toBe(wishId);
    // Signed out, the old device id no longer reaches the account's data.
    expect(await t.query(api.users.me, { deviceId: "dev_up" })).toBeNull();
  });

  test("is a no-op when the device row is the signed-in user", async () => {
    const t = setup();
    const userId = await t.mutation(api.users.ensure, { deviceId: "dev_same" });
    const asAnon = await signedInAs(t, userId, "anonymous");
    expect(await asAnon.mutation(api.users.linkDevice, { deviceId: "dev_same" })).toEqual({ merged: false });
    expect(await t.run((ctx) => ctx.db.get("users", userId))).not.toBeNull();
  });

  test("never merges another real account", async () => {
    const t = setup();
    const other = await t.mutation(api.users.ensure, { deviceId: "dev_other" });
    await signedInAs(t, other, "apple");
    const mine = await t.run((ctx) =>
      ctx.db.insert("users", { name: "", avatar: "#000", city: "", wishesLeft: 1, stars: 0 }),
    );
    const asMine = await signedInAs(t, mine, "google");
    expect(await asMine.mutation(api.users.linkDevice, { deviceId: "dev_other" })).toEqual({ merged: false });
    expect(await t.run((ctx) => ctx.db.get("users", other))).not.toBeNull();
  });

  test("requires a session", async () => {
    const t = setup();
    await expect(t.mutation(api.users.linkDevice, { deviceId: "x" })).rejects.toThrow(/Sign in/);
  });
});

describe("device identity without auth (flag off)", () => {
  test("ensure + me keep working with no session", async () => {
    const t = setup();
    const id = await t.mutation(api.users.ensure, { deviceId: "dev_plain" });
    expect((await t.query(api.users.me, { deviceId: "dev_plain" }))?._id).toBe(id);
    expect(await t.query(api.users.account, {})).toEqual({ signedIn: false });
  });
});
