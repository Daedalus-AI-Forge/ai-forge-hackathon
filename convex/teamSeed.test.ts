/// <reference types="vite/client" />
import rateLimiter from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { api, internal } from "./_generated/api";
import schema from "./schema";
import { DEMO_WISH_TEXT, TEAM_KEYS, generateFriends, teamDeviceId } from "./teamSeed";

const modules = import.meta.glob("./**/*.ts");

const MEMBERS = [
  { key: "darren" as const, name: "Darren", phone: "+15550000001" },
  { key: "louise" as const, name: "Louise", phone: "+15550000002" },
  { key: "katie" as const, name: "Katie", phone: "+15550000003" },
  { key: "dazi" as const, name: "Dazi", phone: "+15550000004" },
];

function setup() {
  const t = convexTest(schema, modules);
  rateLimiter.register(t);
  return t;
}

beforeEach(() => {
  vi.stubEnv("SUPERMEMORY_API_KEY", "");
  vi.stubEnv("OPENAI_API_KEY", "");
});
afterEach(() => vi.unstubAllEnvs());

async function counts(t: ReturnType<typeof setup>) {
  return await t.run(async (ctx) => ({
    users: (await ctx.db.query("users").collect()).length,
    accounts: (await ctx.db.query("authAccounts").collect()).length,
    wishes: (await ctx.db.query("wishes").collect()).length,
    hops: (await ctx.db.query("hops").collect()).length,
    edges: (await ctx.db.query("edges").collect()).length,
  }));
}

describe("teamSeed.run", () => {
  test("friends are deterministic, 20 per member, with job/habits/city tags", () => {
    for (const key of TEAM_KEYS) {
      const a = generateFriends(key);
      expect(a).toEqual(generateFriends(key));
      expect(a).toHaveLength(20);
      expect(new Set(a.map((f) => f.name)).size).toBe(20);
      for (const f of a) {
        expect(f.age).toBeGreaterThanOrEqual(22);
        expect(f.age).toBeLessThanOrEqual(45);
        expect(f.tags.length).toBeGreaterThanOrEqual(4);
        expect(f.tags.length).toBeLessThanOrEqual(5);
      }
    }
  });

  test("idempotent, reuses an existing phone account, keeps seed:run data", async () => {
    const t = setup();
    await t.mutation(internal.seed.run, {});
    // Darren already signed in by phone: his user + account exist.
    const darrenId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("users", {
        name: "",
        avatar: "#000",
        city: "",
        wishesLeft: 1,
        stars: 4,
        phone: "+15550000001",
      });
      await ctx.db.insert("authAccounts", { userId: id, provider: "phone", providerAccountId: "+15550000001" });
      return id;
    });
    const before = await counts(t);
    const first = await t.mutation(internal.teamSeed.run, { members: MEMBERS, bindDevices: true });
    expect(first.find((r) => r.key === "darren")).toMatchObject({ userId: darrenId, created: false });
    expect(first.filter((r) => r.created)).toHaveLength(3);
    const once = await counts(t);
    await t.mutation(internal.teamSeed.run, { members: MEMBERS, bindDevices: true });
    expect(await counts(t)).toEqual(once);
    expect(once.users).toBe(before.users + 3);
    expect(once.accounts).toBe(before.accounts + 3);
    expect(once.wishes).toBe(before.wishes + 4);

    await t.run(async (ctx) => {
      // One phone account per member, each pointing at that member (what phone sign-in looks up).
      for (const m of MEMBERS) {
        const accounts = await ctx.db
          .query("authAccounts")
          .withIndex("providerAndAccountId", (q) => q.eq("provider", "phone").eq("providerAccountId", m.phone))
          .collect();
        expect(accounts).toHaveLength(1);
        const user = await ctx.db.get("users", accounts[0].userId);
        expect(user).toMatchObject({ name: m.name, teamKey: m.key, phone: m.phone, deviceId: teamDeviceId(m.key) });
        expect(user!.wishesLeft).toBeGreaterThanOrEqual(3);
      }
      const darren = await ctx.db.get("users", darrenId);
      expect(darren!.stars).toBe(4);
      // seed:run demo users are untouched.
      expect(await ctx.db.query("users").withIndex("by_demoKey", (q) => q.eq("demoKey", "me")).unique()).not.toBeNull();
    });

    for (const m of MEMBERS) {
      const ready = await t.query(api.graph.coachReady, { deviceId: teamDeviceId(m.key) });
      expect(ready.ready).toBe(true);
      expect(ready.edgeCount).toBeGreaterThanOrEqual(80);
    }

    const cleared = await t.mutation(internal.teamSeed.clear, { deleteTestUsers: true });
    expect(cleared.deletedUsers).toBe(4);
    // Darren's pre-existing row was a +1555 test number too, so the restore target is the pre-seed count minus him.
    expect(await counts(t)).toMatchObject({ users: before.users - 1, wishes: before.wishes, hops: before.hops, edges: before.edges });
  });

  test("the coach ranks the chain Darren -> Louise -> Katie -> Dazi first, through a real toss", async () => {
    const t = setup();
    const seeded = await t.mutation(internal.teamSeed.run, { members: MEMBERS, bindDevices: true });
    const id = (key: string) => seeded.find((r) => r.key === key)!.userId;
    const top = async (key: string) =>
      (await t.action(internal.graphRank.rankForWish, { ownerUserId: id(key), wishText: DEMO_WISH_TEXT, useMemory: false }))[0]
        ?.name;
    expect(await top("darren")).toBe("Louise");
    expect(await top("louise")).toBe("Katie");
    expect(await top("katie")).toBe("Dazi");

    // Same path as scripts/team-chain.mjs.
    const coachTop = async (key: string, wishId?: string) => {
      const r = await t.action(api.ai.coach, {
        deviceId: teamDeviceId(key as "darren"),
        wishText: DEMO_WISH_TEXT,
        ...(wishId ? { wishId: wishId as never } : {}),
      });
      return r.ready ? r.suggestions[0]?.name : null;
    };
    expect(await coachTop("darren")).toBe("Louise");
    const { wishId, hopIds } = await t.mutation(api.wishes.toss, {
      deviceId: teamDeviceId("darren"),
      type: "do_together",
      mode: "serious",
      text: DEMO_WISH_TEXT,
      name: "Darren",
      city: "San Francisco",
      recipients: [{ name: "Louise", reason: "Plays bass in a Mission garage band", tags: ["music"] }],
    });
    await t.mutation(api.hops.claim, { hopId: hopIds[0], deviceId: teamDeviceId("louise") });
    expect(await coachTop("louise", wishId)).toBe("Katie");
    await t.mutation(api.hops.act, { hopId: hopIds[0], action: "pass", name: "Louise", city: "San Francisco", vouch: "Darren is my teammate", tags: [] });
    const katieHop = await t.mutation(api.hops.passTo, { parentHopId: hopIds[0], name: "Katie", reason: "She knows every drummer", tags: ["drums"] });
    await t.mutation(api.hops.claim, { hopId: katieHop, deviceId: teamDeviceId("katie") });
    expect(await coachTop("katie", wishId)).toBe("Dazi");

    const before = await counts(t);
    await t.mutation(internal.teamSeed.removeRehearsalWish, { wishId });
    const after = await counts(t);
    expect(after.wishes).toBe(before.wishes - 1);
    expect(after.hops).toBe(before.hops - 2);
    // The seed graph is intact after removing the rehearsal.
    expect(await top("darren")).toBe("Louise");
    await expect(
      t.run(async (ctx) => (await ctx.db.query("wishes").filter((q) => q.eq(q.field("teamKey"), "darren")).first())!._id),
    ).resolves.toBeTruthy();
  });
});
