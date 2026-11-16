/// <reference types="vite/client" />
import rateLimiter from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { MAX_PER_TICK } from "./bots";
import schema from "./schema";
import { BOT_WISHES, botFriends } from "./teamSeed";

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
  vi.stubEnv("BOTS_ENABLED", "true");
});
afterEach(() => vi.unstubAllEnvs());

async function seeded() {
  const t = setup();
  await t.mutation(internal.teamSeed.run, { members: MEMBERS, global: true });
  return t;
}

async function botHops(t: ReturnType<typeof setup>) {
  return await t.run(async (ctx) => {
    const bots = await ctx.db.query("users").withIndex("by_isBot", (q) => q.eq("isBot", true)).collect();
    const ids = new Set(bots.map((b) => b._id));
    const hops = (await ctx.db.query("hops").collect()).filter((h) => h.holderUserId && ids.has(h.holderUserId));
    return { bots, hops };
  });
}

describe("bot users", () => {
  test("global seed creates ~20 bots with no phone or device, re-runs replace them", async () => {
    const t = await seeded();
    const { bots } = await botHops(t);
    expect(bots.length).toBeGreaterThanOrEqual(15);
    expect(bots.length).toBeLessThanOrEqual(20);
    for (const b of bots) {
      expect(b.phone).toBeUndefined();
      expect(b.deviceId).toBeUndefined();
      expect(b.botProfile?.lat).toBeTypeOf("number");
      expect(b.teamKey?.startsWith("bot:")).toBe(true);
    }
    expect(bots.map((b) => b.name)).toContain(botFriends("darren", MEMBERS.map((m) => m.name))[0].name);
    await t.mutation(internal.teamSeed.run, { members: MEMBERS, global: true });
    const again = await botHops(t);
    expect(again.bots.map((b) => b._id).sort()).toEqual(bots.map((b) => b._id).sort());
    // Fresh bot-held wishes (one unacted hop each) replaced, not duplicated.
    expect(again.hops.filter((h) => !h.action)).toHaveLength(BOT_WISHES.length);
  });
});

describe("bots.tick", () => {
  test("passes a bot-held hop to a bot in a different city with the rows a pass writes", async () => {
    const t = await seeded();
    const before = await botHops(t);
    const res = await t.mutation(internal.bots.tick, { ignoreDwell: true });
    expect(res.enabled).toBe(true);
    const pass = res.moved.find((m) => m.action === "pass");
    expect(pass).toBeDefined();
    await t.run(async (ctx) => {
      const parent = (await ctx.db.get("hops", pass!.hopId))!;
      const holder = (await ctx.db.get("users", parent.holderUserId!))!;
      expect(parent.action).toBe("pass");
      expect(parent.city).toBe(holder.city);
      expect(parent.lat).toBe(holder.botProfile!.lat);
      const [child] = await ctx.db.query("hops").withIndex("by_parentHopId", (q) => q.eq("parentHopId", parent._id)).collect();
      const to = (await ctx.db.get("users", child.holderUserId!))!;
      expect(to.isBot).toBe(true);
      expect(to.city).not.toBe(holder.city);
      expect(child.depth).toBe(parent.depth + 1);
      expect(child.introVouch).toContain(to.name.split(" ")[0]);
      const edges = await ctx.db.query("edges").withIndex("by_ownerUserId", (q) => q.eq("ownerUserId", holder._id)).collect();
      expect(edges.some((e) => e.hopId === child._id)).toBe(true);
    });
    expect(before.hops.length).toBeGreaterThan(0);
  });

  test("kill switch: nothing moves unless BOTS_ENABLED is true", async () => {
    const t = await seeded();
    vi.stubEnv("BOTS_ENABLED", "false");
    const res = await t.mutation(internal.bots.tick, { ignoreDwell: true });
    expect(res).toEqual({ enabled: false, moved: [] });
    const { hops } = await botHops(t);
    expect(hops.filter((h) => h.action && h.depth > 1)).toHaveLength(0);
  });

  test("respects dwell: freshly held hops wait 2-8 minutes", async () => {
    const t = await seeded();
    const res = await t.mutation(internal.bots.tick, {});
    expect(res.moved).toHaveLength(0);
  });

  test("never touches real-user hops and never sends anything", async () => {
    const t = await seeded();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const realHeld = await t.run(async (ctx) =>
      (await ctx.db.query("hops").collect()).filter((h) => !h.action && !h.holderUserId).map((h) => h._id),
    );
    const snapshot = await t.run(async (ctx) => Promise.all(realHeld.map((id) => ctx.db.get("hops", id))));
    for (let i = 0; i < 4; i++) await t.mutation(internal.bots.tick, { ignoreDwell: true });
    const after = await t.run(async (ctx) => Promise.all(realHeld.map((id) => ctx.db.get("hops", id))));
    expect(after).toEqual(snapshot);
    // Every hop a bot created is held by a bot, never a real user.
    await t.run(async (ctx) => {
      const hops = await ctx.db.query("hops").collect();
      for (const h of hops.filter((x) => x.introVouch && x.holderUserId)) {
        const u = await ctx.db.get("users", h.holderUserId!);
        if (u?.teamKey?.startsWith("bot:")) expect(u.isBot).toBe(true);
      }
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  test("bounded: at most MAX_PER_TICK hops per tick", async () => {
    const t = await seeded();
    // 8 more bot-held hops on one traveling wish.
    await t.run(async (ctx) => {
      const bots = await ctx.db.query("users").withIndex("by_isBot", (q) => q.eq("isBot", true)).collect();
      const creator = (await ctx.db.query("users").withIndex("by_teamKey", (q) => q.eq("teamKey", "darren")).first())!;
      const wishId = await ctx.db.insert("wishes", {
        creatorId: creator._id,
        type: "do_together",
        text: "A climbing and hiking friend",
        status: "traveling",
        expiresAt: Date.now() + 3600_000,
      });
      for (let i = 0; i < 8; i++) {
        await ctx.db.insert("hops", {
          wishId,
          depth: 1,
          holderName: bots[i].name,
          holderUserId: bots[i]._id,
          recipientTags: [],
          viaGroup: false,
        });
      }
    });
    const res = await t.mutation(internal.bots.tick, { ignoreDwell: true });
    expect(res.moved.length).toBeLessThanOrEqual(MAX_PER_TICK);
  });

  test("claims It's me at depth >= 3 when its own tags match strongly", async () => {
    const t = await seeded();
    const { wishId, hopId } = await t.run(async (ctx) => {
      const bot = (await ctx.db.query("users").withIndex("by_isBot", (q) => q.eq("isBot", true)).first())!;
      const creator = (await ctx.db.query("users").withIndex("by_teamKey", (q) => q.eq("teamKey", "darren")).first())!;
      const wishId = await ctx.db.insert("wishes", {
        creatorId: creator._id,
        type: "do_together",
        text: `${bot.botProfile!.tags.join(" ")} ${bot.botProfile!.persona}`,
        status: "traveling",
        expiresAt: Date.now() + 3600_000,
      });
      const hopId = await ctx.db.insert("hops", {
        wishId,
        depth: 3,
        holderName: bot.name,
        holderUserId: bot._id,
        recipientTags: [],
        viaGroup: false,
      });
      return { wishId, hopId };
    });
    await t.mutation(internal.bots.tick, { ignoreDwell: true });
    await t.run(async (ctx) => {
      const hop = (await ctx.db.get("hops", hopId))!;
      expect(hop.action).toBe("its_me");
      expect(hop.itsMeIntro).toBeTruthy();
      expect((await ctx.db.get("wishes", wishId))!.status).toBe("traveling");
    });
  });
});

describe("entry points", () => {
  test("tossing to a bot friend by name binds the hop to that bot", async () => {
    const t = await seeded();
    await t.mutation(internal.teamSeed.run, { members: MEMBERS, global: true, bindDevices: true });
    const bot = await t.run(async (ctx) => (await ctx.db.query("users").withIndex("by_teamKey", (q) => q.eq("teamKey", "bot:darren")).first())!);
    const { hopIds } = await t.mutation(api.wishes.toss, {
      deviceId: "dev_team_darren",
      type: "do_together",
      text: "Someone to go climbing with",
      name: "Darren",
      city: "San Francisco",
      mode: "fun",
      recipients: [
        { name: bot.name.toUpperCase(), tags: ["climbing"] },
        { name: "Someone Real", tags: ["climbing"] },
      ],
    });
    const holders = await t.run(async (ctx) => Promise.all(hopIds.map(async (id: Id<"hops">) => (await ctx.db.get("hops", id))!.holderUserId ?? null)));
    expect(holders[0]).toBe(bot._id);
    expect(holders[1]).toBeNull();
  });
});
