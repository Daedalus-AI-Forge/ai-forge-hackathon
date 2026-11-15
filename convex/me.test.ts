/// <reference types="vite/client" />
import rateLimiter from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";

import { api, internal } from "./_generated/api";
import schema from "./schema";
import { wishBadges } from "./me";
import { keywordTags, parseTags, summaryFallback } from "./vouchMemory";

const modules = import.meta.glob("./**/*.ts");

function setup() {
  const t = convexTest(schema, modules);
  rateLimiter.register(t);
  return t;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function seededMia() {
  vi.useFakeTimers();
  const t = setup();
  await t.mutation(internal.seed.run, {});
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  await t.run(async (ctx) => {
    const mia = await ctx.db
      .query("users")
      .withIndex("by_demoKey", (q) => q.eq("demoKey", "me"))
      .unique();
    await ctx.db.patch("users", mia!._id, { deviceId: "dev_seed_mia" });
  });
  return t;
}

describe("vouch memory helpers", () => {
  test("keyword fallback keeps tapped tags first and finds interests and places", () => {
    expect(keywordTags("Amy is my bandmate, we went climbing in Iceland, super reliable", ["kind"])).toEqual([
      "kind",
      "reliable",
      "music",
      "climbing",
      "Iceland",
    ]);
    expect(keywordTags("Funny guy")).toEqual(["funny"]);
  });

  test("parses a JSON array defensively", () => {
    expect(parseTags('Sure! ["music", "Iceland", 3, "climbing"]')).toEqual(["music", "Iceland", "climbing"]);
    expect(parseTags("music, drums, a very long tag that is clearly a sentence")).toEqual(["music", "drums"]);
    expect(parseTags("[not json")).toEqual(["[not json"]);
  });

  test("summary template is built from tag counts", () => {
    expect(
      summaryFallback([
        { byName: "Sam", tags: ["reliable", "music"] },
        { byName: "Wei", tags: ["fun", "music"] },
        { byName: "Priya", tags: ["reliable"] },
      ]),
    ).toBe("3 friends say you're reliable, fun, and know everyone in music.");
    expect(summaryFallback([{ byName: "Sam", tags: ["kind"] }])).toBe("1 friend says you're kind.");
    expect(summaryFallback([{ byName: "Oliver", tags: ["Iceland", "food", "Reliable"] }])).toBe(
      "1 friend says you're reliable and know everyone in food.",
    );
    expect(summaryFallback([])).toBeNull();
  });
});

describe("badges", () => {
  test("boomerang needs to leave town and come back", () => {
    expect(wishBadges("San Francisco", [{ city: "Shanghai" }, { city: "SF", lat: 37.77, lng: -122.48 }])).toContain(
      "boomerang",
    );
    expect(wishBadges("San Francisco", [{ city: "San Francisco", lat: 37.7858, lng: -122.4064 }])).toEqual([
      "next_door",
    ]);
    expect(wishBadges("Tokyo", [{ city: "San Francisco" }, { city: "London" }])).toEqual(["around_the_world"]);
  });
});

describe("hops.act vouch memory", () => {
  async function tree(t: ReturnType<typeof setup>) {
    return await t.run(async (ctx) => {
      const louise = await ctx.db.insert("users", {
        name: "Louise",
        avatar: "#000",
        city: "SF",
        wishesLeft: 0,
        stars: 0,
        deviceId: "dev_louise",
      });
      const amyUser = await ctx.db.insert("users", { name: "Amy", avatar: "#000", city: "Shanghai", wishesLeft: 0, stars: 0 });
      await ctx.db.insert("network", { ownerId: amyUser, personName: "louise", tags: ["old"] });
      const wishId = await ctx.db.insert("wishes", {
        creatorId: louise,
        type: "do_together",
        text: "Someone to jam on drums with.",
        status: "traveling",
        expiresAt: Date.now() + 3_600_000,
      });
      const hopId = await ctx.db.insert("hops", {
        wishId,
        depth: 1,
        holderName: "Amy",
        holderUserId: amyUser,
        recipientTags: [],
        viaGroup: false,
      });
      return { louise, amyUser, wishId, hopId };
    });
  }

  test("tags the vouch, enriches the voucher's network row, fills lat/lng and caches the summary", async () => {
    vi.useFakeTimers();
    const t = setup();
    const { louise, amyUser, hopId } = await tree(t);
    await t.mutation(api.hops.act, {
      hopId,
      action: "pass",
      name: "Amy",
      city: "Shanghai",
      vouch: "Louise is my co-founder, the most fun person I know and she loves music.",
      tags: ["fun"],
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const state = await t.run(async (ctx) => ({
      vouch: (await ctx.db.query("vouches").collect())[0],
      hop: await ctx.db.get("hops", hopId),
      row: (await ctx.db.query("network").withIndex("by_ownerId", (q) => q.eq("ownerId", amyUser)).collect())[0],
      louise: await ctx.db.get("users", louise),
    }));
    expect(state.vouch.tags).toEqual(["fun", "music", "startups"]);
    expect(state.row.tags).toEqual(["old", "fun", "music", "startups"]);
    expect(state.hop).toMatchObject({ lat: 31.2304, lng: 121.4737 });
    expect(state.louise?.friendsSummary?.text).toBe("1 friend says you're fun and know everyone in music.");
    const profile = await t.query(api.me.profile, { deviceId: "dev_louise" });
    expect(profile?.summary).toEqual({ text: "1 friend says you're fun and know everyone in music.", friends: 1 });
    expect(profile?.reputation.vouches).toBe(1);
  });

  test("uses the OpenAI tags when the model answers", async () => {
    vi.useFakeTimers();
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ output: [{ content: [{ type: "output_text", text: '["drums", "Iceland"]' }] }] })),
      ),
    );
    const t = setup();
    const { hopId } = await tree(t);
    await t.mutation(api.hops.act, { hopId, action: "pass", name: "Amy", city: "Mars", vouch: "Louise rocks.", tags: [] });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const [vouch, hop] = await t.run(async (ctx) => [
      (await ctx.db.query("vouches").collect())[0],
      await ctx.db.get("hops", hopId),
    ] as const);
    expect(vouch.tags).toEqual(["drums", "Iceland"]);
    expect(hop?.lat).toBeUndefined();
  });
});

describe("Me tab on seeded Mia", () => {
  test("cards, badges, reputation and summary", async () => {
    const t = await seededMia();
    const p = (await t.query(api.me.profile, { deviceId: "dev_seed_mia" }))!;
    expect(p.cards.map((c) => [c.tier, c.role]).sort()).toEqual([
      ["gold", "wished"],
      ["silver", "helped"],
    ]);
    const earned = Object.fromEntries(p.badges.map((b) => [b.key, b.earned]));
    expect(earned).toEqual({ boomerang: false, around_the_world: true, next_door: true });
    expect(p.reputation).toEqual({ vouches: 4, helped: 2 });
    expect(p.vouches).toHaveLength(4);
    expect(p.summary?.text).toBe("4 friends say you're adventurous, reliable, fun, and know everyone in music.");
  });

  test("only I can hide a vouch about me; hidden vouches leave counts, summary and chains", async () => {
    const t = await seededMia();
    const before = (await t.query(api.me.profile, { deviceId: "dev_seed_mia" }))!;
    const sam = before.vouches.find((x) => x.byName === "Sam")!;
    await t.mutation(api.users.ensure, { deviceId: "dev_stranger" });
    await expect(
      t.mutation(api.me.setVouchHidden, { deviceId: "dev_stranger", vouchId: sam._id, hidden: true }),
    ).rejects.toThrow(/only hide vouches about you/);

    await t.mutation(api.me.setVouchHidden, { deviceId: "dev_seed_mia", vouchId: sam._id, hidden: true });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const after = (await t.query(api.me.profile, { deviceId: "dev_seed_mia" }))!;
    expect(after.reputation.vouches).toBe(3);
    expect(after.vouches.find((x) => x._id === sam._id)?.hidden).toBe(true);
    expect(after.summary?.text).toMatch(/^3 friends say/);

    const kenjiHop = await t.run(async (ctx) => {
      const vouch = await ctx.db.get("vouches", sam._id);
      const hops = await ctx.db.query("hops").withIndex("by_parentHopId", (q) => q.eq("parentHopId", vouch!.hopId)).collect();
      return hops.find((h) => h.holderName === "Kenji")!._id;
    });
    const page = await t.query(api.hops.page, { hopId: kenjiHop });
    expect(page?.chain.find((c) => c.name === "Sam")?.vouch).toBeNull();

    await t.mutation(api.me.setVouchHidden, { deviceId: "dev_seed_mia", vouchId: sam._id, hidden: false });
    const restored = await t.query(api.hops.page, { hopId: kenjiHop });
    expect(restored?.chain.find((c) => c.name === "Sam")?.vouch).toMatch(/Mia is my college friend/);
  });

  test("network lists direct neighbours, deduped, with contacts and relations", async () => {
    const t = await seededMia();
    const net = await t.query(api.me.network, { deviceId: "dev_seed_mia" });
    const by = (name: string) => net.filter((n) => n.name.toLowerCase() === name.toLowerCase());
    expect(by("Sam")).toHaveLength(1);
    expect(by("Priya")[0]).toMatchObject({ contact: "+14155550123" });
    expect(by("Priya")[0].relations).toEqual(expect.arrayContaining(["passed_to", "met"]));
    expect(by("Oliver")[0].relations).toContain("passed_to");
    expect(by("Hannah")[0].relations).toEqual(expect.arrayContaining(["passed_me"]));
    expect(by("Kenji")[0].relations).toEqual(expect.arrayContaining(["passed_me"]));
    expect(by("Sam")[0].tags).toEqual(expect.arrayContaining(["food", "adventurous"]));
    expect(by("Mia")).toHaveLength(0);
    expect(by("Lin")).toEqual(by("Lin").filter((n) => !n.relations.includes("passed_me")));
  });

  test("a stranger's device sees an empty profile, not Mia's", async () => {
    const t = await seededMia();
    await t.mutation(api.users.ensure, { deviceId: "dev_stranger" });
    const p = await t.query(api.me.profile, { deviceId: "dev_stranger" });
    expect(p?.vouches).toEqual([]);
    expect(await t.query(api.me.network, { deviceId: "dev_stranger" })).toEqual([]);
  });
});
