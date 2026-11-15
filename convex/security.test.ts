/// <reference types="vite/client" />
import rateLimiter from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

function setup() {
  const t = convexTest(schema, modules);
  rateLimiter.register(t);
  return t;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function seededTree(t: ReturnType<typeof setup>) {
  return await t.run(async (ctx) => {
    const creatorId = await ctx.db.insert("users", { name: "Louise", avatar: "#000", city: "SF", wishesLeft: 0, stars: 0 });
    const wishId = await ctx.db.insert("wishes", {
      creatorId,
      type: "do_together",
      text: "Someone to jam on drums with.",
      status: "traveling",
      expiresAt: Date.now() + 3_600_000,
    });
    const amy = await ctx.db.insert("hops", {
      wishId,
      depth: 1,
      holderName: "Amy",
      holderContact: "+15550001111",
      recipientTags: [],
      viaGroup: false,
      vouchForParent: "Louise is great",
      action: "pass",
    });
    const ben = await ctx.db.insert("hops", { wishId, parentHopId: amy, depth: 2, holderName: "Ben", recipientTags: [], viaGroup: false });
    const other = await ctx.db.insert("hops", { wishId, depth: 1, holderName: "Oliver", recipientTags: [], viaGroup: false });
    return { creatorId, wishId, amy, ben, other };
  });
}

describe("claimDemo", () => {
  async function seedDemo(t: ReturnType<typeof setup>) {
    return await t.run((ctx) =>
      ctx.db.insert("users", { name: "Mia", avatar: "#000", city: "SF", wishesLeft: 1, stars: 0, demoKey: "me" }),
    );
  }

  test("is refused unless DEMO_MODE is on", async () => {
    const t = setup();
    await seedDemo(t);
    await expect(t.mutation(api.users.claimDemo, { deviceId: "dev_attacker" })).rejects.toThrow(/Demo mode is off/);
    expect(await t.query(api.users.demoEnabled, {})).toBe(false);
  });

  test("refuses a demo row upgraded to a real account", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    const t = setup();
    const demoId = await seedDemo(t);
    await t.run((ctx) =>
      ctx.db.insert("authAccounts", { userId: demoId, provider: "google", providerAccountId: "g-1" }),
    );
    await expect(t.mutation(api.users.claimDemo, { deviceId: "dev_attacker" })).rejects.toThrow(/linked to an account/);
  });

  test("unbinds every other row holding the device id", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    const t = setup();
    const demoId = await seedDemo(t);
    const mine = await t.mutation(api.users.ensure, { deviceId: "dev_mine" });
    await t.mutation(api.users.claimDemo, { deviceId: "dev_mine" });
    const rows = await t.run((ctx) =>
      ctx.db.query("users").withIndex("by_deviceId", (q) => q.eq("deviceId", "dev_mine")).collect(),
    );
    expect(rows.map((r) => r._id)).toEqual([demoId]);
    expect((await t.run((ctx) => ctx.db.get("users", mine)))?.deviceId).toBeUndefined();
    expect((await t.query(api.users.me, { deviceId: "dev_mine" }))?._id).toBe(demoId);
  });
});

describe("hop links", () => {
  test("the page exposes no other hop ids or contacts", async () => {
    const t = setup();
    const { ben, amy, other } = await seededTree(t);
    const page = await t.query(api.hops.page, { hopId: ben });
    const json = JSON.stringify(page);
    expect(json).not.toContain(amy);
    expect(json).not.toContain(other);
    expect(json).not.toContain("+15550001111");
    expect(page?.chain).toEqual([expect.objectContaining({ name: "Amy", vouch: "Louise is great" })]);
  });

  test("the creator's pool holders carry no hop ids", async () => {
    const t = setup();
    const { creatorId, amy } = await seededTree(t);
    await t.run((ctx) => ctx.db.patch("users", creatorId, { deviceId: "dev_louise" }));
    const home = await t.query(api.wishes.home, { deviceId: "dev_louise" });
    expect(home?.activeWish?.holders).toHaveLength(3);
    expect(JSON.stringify(home?.activeWish)).not.toContain(amy);
  });

  test("act and itsMe refuse a hop that already acted", async () => {
    const t = setup();
    const { amy } = await seededTree(t);
    await expect(
      t.mutation(api.hops.act, { hopId: amy, action: "pass", name: "X", city: "Y", vouch: "hijack", tags: [] }),
    ).rejects.toThrow(/already acted/);
    await expect(
      t.mutation(api.hops.itsMe, { hopId: amy, name: "X", city: "Y", intro: "me", contact: "x" }),
    ).rejects.toThrow(/already acted/);
  });

  test("saveContact needs a traveling wish and caps length", async () => {
    const t = setup();
    const { ben, wishId } = await seededTree(t);
    await t.mutation(api.hops.saveContact, { hopId: ben, contact: "x".repeat(500) });
    expect((await t.run((ctx) => ctx.db.get("hops", ben)))?.holderContact).toHaveLength(100);
    await t.run((ctx) => ctx.db.patch("wishes", wishId, { status: "faded" }));
    await expect(t.mutation(api.hops.saveContact, { hopId: ben, contact: "@ben" })).rejects.toThrow(/isn't traveling/);
  });

  test("opening a link in the app claims it once for the friends list", async () => {
    const t = setup();
    const { ben } = await seededTree(t);
    await t.mutation(api.users.ensure, { deviceId: "dev_ben" });
    await t.mutation(api.users.ensure, { deviceId: "dev_eve" });
    await t.mutation(api.hops.claim, { hopId: ben, deviceId: "dev_ben" });
    await t.mutation(api.hops.claim, { hopId: ben, deviceId: "dev_eve" });
    const home = await t.query(api.wishes.home, { deviceId: "dev_ben" });
    expect(home?.helpCards.map((c) => c.hopId)).toEqual([ben]);
    expect((await t.query(api.wishes.home, { deviceId: "dev_eve" }))?.helpCards).toEqual([]);
  });
});

describe("input limits", () => {
  test("toss clamps text, names and tags and dedupes the network", async () => {
    const t = setup();
    await t.mutation(api.users.ensure, { deviceId: "dev_mia" });
    await t.run(async (ctx) => {
      const u = await ctx.db.query("users").withIndex("by_deviceId", (q) => q.eq("deviceId", "dev_mia")).unique();
      await ctx.db.patch("users", u!._id, { wishesLeft: 2 });
    });
    const tags = Array.from({ length: 9 }, (_, i) => `tag${i}`.padEnd(50, "x"));
    const { hopIds } = await t.mutation(api.wishes.toss, {
      deviceId: "dev_mia",
      mode: "fun",
      type: "local",
      text: "w".repeat(5000),
      name: "Mia",
      city: "SF",
      recipients: [{ name: "Sam".padEnd(300, "!"), tags }],
    });
    await t.mutation(api.wishes.toss, {
      deviceId: "dev_mia",
      mode: "fun",
      type: "local",
      text: "again",
      name: "Mia",
      city: "SF",
      recipients: [{ name: "Sam".padEnd(300, "!"), tags: [] }],
    });
    const hop = await t.run((ctx) => ctx.db.get("hops", hopIds[0] as Id<"hops">));
    const wish = await t.run((ctx) => ctx.db.get("wishes", hop!.wishId));
    expect(wish?.text).toHaveLength(500);
    expect(hop?.holderName).toHaveLength(60);
    expect(hop?.recipientTags).toHaveLength(5);
    expect(hop?.recipientTags.every((x) => x.length <= 30)).toBe(true);
    const network = await t.run((ctx) => ctx.db.query("network").collect());
    expect(network).toHaveLength(1);
  });

  test("malformed device ids are rejected", async () => {
    const t = setup();
    await expect(t.mutation(api.users.ensure, { deviceId: "x".repeat(200) })).rejects.toThrow(/Invalid device id/);
    await expect(t.query(api.users.me, { deviceId: "../../" })).rejects.toThrow(/Invalid device id/);
  });
});

describe("AI actions", () => {
  test("refuse closed wishes and fall back without spending once rate limited", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ output: [{ content: [{ type: "output_text", text: "AI line" }] }] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const t = setup();
    const { ben, wishId } = await seededTree(t);
    const args = { hopId: ben, name: "Ben", how: "friend", howLong: "1–5 years", word: "fun" };
    for (let i = 0; i < 25; i++) await t.action(api.ai.draftVouch, args);
    expect(fetchMock).toHaveBeenCalledTimes(20);
    expect(await t.action(api.ai.draftVouch, args)).toBe("Amy is my friend, known them 1–5 years, super fun.");
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.max_output_tokens).toBe(400);

    await t.run((ctx) => ctx.db.patch("wishes", wishId, { status: "faded" }));
    await expect(t.action(api.ai.draftPassMessage, { hopId: ben })).rejects.toThrow(/isn't traveling/);
  });

  test("draftPassMessage is generated once per hop", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ output: [{ content: [{ type: "output_text", text: "Hey Ben!" }] }] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const t = setup();
    const { ben } = await seededTree(t);
    expect(await t.action(api.ai.draftPassMessage, { hopId: ben })).toBe("Hey Ben!");
    expect(await t.action(api.ai.draftPassMessage, { hopId: ben })).toBe("Hey Ben!");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("seed", () => {
  test("clears auth sessions and accounts", async () => {
    const t = setup();
    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { name: "x", avatar: "#000", city: "", wishesLeft: 1, stars: 0 });
      await ctx.db.insert("authAccounts", { userId, provider: "google", providerAccountId: "g" });
      await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 1000 });
    });
    await t.mutation(internal.seed.run, {});
    expect(await t.run((ctx) => ctx.db.query("authAccounts").collect())).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("authSessions").collect())).toEqual([]);
  });
});

describe("daily-wish API hardening", () => {
  async function mia(t: ReturnType<typeof setup>) {
    await t.mutation(api.users.ensure, { deviceId: "dev_mia" });
    await t.mutation(api.users.updateProfile, { deviceId: "dev_mia", name: "Mia", city: "SF" });
  }

  test("edges written on toss and passTo clamp the name and tags", async () => {
    const t = setup();
    await mia(t);
    const longName = "A".repeat(200);
    const tags = Array.from({ length: 8 }, (_, i) => `${i}${"t".repeat(50)}`);
    const { hopIds } = await t.mutation(api.wishes.toss, {
      deviceId: "dev_mia",
      mode: "fun",
      type: "local",
      text: "A local in Tokyo",
      name: "Mia",
      city: "SF",
      recipients: [{ name: longName, tags }],
    });
    await t.mutation(api.hops.act, { hopId: hopIds[0], action: "pass", name: "Sam", city: "", vouch: "Mia rocks", tags: [] });
    await t.mutation(api.hops.passTo, { parentHopId: hopIds[0], name: ` ${longName} `, tags });
    const edges = await t.run((ctx) => ctx.db.query("edges").collect());
    expect(edges.length).toBe(10);
    for (const e of edges) {
      expect(e.personName.length).toBe(60);
      expect(e.tag.length).toBeLessThanOrEqual(30);
    }
  });

  test("edges.forget is owner-scoped and rejects a blank name", async () => {
    const t = setup();
    await mia(t);
    await t.mutation(api.wishes.toss, {
      deviceId: "dev_mia",
      mode: "fun",
      type: "local",
      text: "A local in Tokyo",
      name: "Mia",
      city: "SF",
      recipients: [{ name: "Sam", tags: ["food"] }],
    });
    await t.mutation(api.users.ensure, { deviceId: "dev_eve" });
    await t.mutation(api.edges.forget, { deviceId: "dev_eve", personName: "Sam" });
    expect(await t.query(api.edges.mine, { deviceId: "dev_mia" })).toHaveLength(1);
    await expect(t.mutation(api.edges.forget, { deviceId: "dev_mia", personName: "   " })).rejects.toThrow(/forget/);
    await expect(t.mutation(api.edges.forget, { deviceId: "../", personName: "Sam" })).rejects.toThrow(
      /Invalid device id/,
    );
  });

  test("daily.today and daily.join validate their inputs", async () => {
    const t = setup();
    await expect(t.query(api.daily.today, { deviceId: "dev_mia", date: "x".repeat(500) })).rejects.toThrow(/date/);
    await expect(t.query(api.daily.today, { deviceId: "../", date: "2026-11-15" })).rejects.toThrow(/Invalid device id/);
    await expect(t.mutation(api.daily.join, { deviceId: "../" })).rejects.toThrow(/Invalid device id/);
  });

  test("askTheWell validates, caps the prompt and stops calling OpenAI once rate limited", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ output: [{ content: [{ type: "output_text", text: "Sam | Sam knows food" }] }] }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const t = setup();
    await mia(t);
    await t.mutation(api.wishes.toss, {
      deviceId: "dev_mia",
      mode: "fun",
      type: "local",
      text: "A local in Tokyo",
      name: "Mia",
      city: "SF",
      recipients: [{ name: "Sam", tags: ["food"] }],
    });
    await expect(t.action(api.ai.askTheWell, { deviceId: "../", text: "food" })).rejects.toThrow(/Invalid device id/);
    expect(await t.action(api.ai.askTheWell, { deviceId: "dev_mia", text: "   " })).toBeNull();
    const args = { deviceId: "dev_mia", text: "food ".repeat(1000) };
    for (let i = 0; i < 25; i++) await t.action(api.ai.askTheWell, args);
    expect(fetchMock).toHaveBeenCalledTimes(20);
    expect(await t.action(api.ai.askTheWell, args)).toEqual({
      name: "Sam",
      reason: "In your wish network Sam is tagged food.",
    });
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.max_output_tokens).toBe(400);
    expect(body.input.length).toBeLessThan(1000);
  });
});
