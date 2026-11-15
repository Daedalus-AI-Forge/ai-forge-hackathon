/// <reference types="vite/client" />
import rateLimiter from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { tierFor } from "./rewards";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

function setup() {
  const t = convexTest(schema, modules);
  rateLimiter.register(t);
  return t;
}

type T = ReturnType<typeof setup>;

const person = (name: string, extra: { deviceId?: string; stars?: number; wishesLeft?: number } = {}) => ({
  name,
  avatar: "#000",
  city: "SF",
  wishesLeft: extra.wishesLeft ?? 0,
  stars: extra.stars ?? 0,
  deviceId: extra.deviceId,
});

/** Louise's wish with a winning branch Amy -> Ben -> Cara (Cara said "It's me!") and a losing branch Oliver -> Pat. */
async function tree(t: T, opts: { metInPerson?: boolean; caraHasUser?: boolean } = {}) {
  return await t.run(async (ctx) => {
    const louise = await ctx.db.insert("users", person("Louise", { deviceId: "dev_louise" }));
    const amy = await ctx.db.insert("users", person("Amy"));
    const ben = await ctx.db.insert("users", person("Ben", { deviceId: "dev_ben" }));
    const cara = await ctx.db.insert("users", person("Cara"));
    const oliver = await ctx.db.insert("users", person("Oliver"));
    const stranger = await ctx.db.insert("users", person("Sly", { deviceId: "dev_stranger" }));
    const wishId = await ctx.db.insert("wishes", {
      creatorId: louise,
      type: "do_together",
      text: "Someone to jam on drums with",
      status: "traveling",
      expiresAt: Date.now() + 3_600_000,
      metInPerson: opts.metInPerson,
    });
    const base = { wishId, recipientTags: [], viaGroup: false };
    const amyHop = await ctx.db.insert("hops", { ...base, depth: 1, holderName: "Amy", holderUserId: amy, action: "pass" });
    const benHop = await ctx.db.insert("hops", { ...base, depth: 2, parentHopId: amyHop, holderName: "Ben", holderUserId: ben, action: "pass" });
    const caraHop = await ctx.db.insert("hops", {
      ...base,
      depth: 3,
      parentHopId: benHop,
      holderName: "Cara",
      holderUserId: opts.caraHasUser === false ? undefined : cara,
      action: "its_me",
    });
    const oliverHop = await ctx.db.insert("hops", { ...base, depth: 1, holderName: "Oliver", holderUserId: oliver, action: "pass" });
    await ctx.db.insert("hops", { ...base, depth: 2, parentHopId: oliverHop, holderName: "Pat" });
    return { wishId, louise, amy, ben, cara, oliver, stranger, amyHop, benHop, caraHop, oliverHop };
  });
}

async function balances(t: T, ids: Id<"users">[]) {
  return await t.run(async (ctx) => {
    const out: Record<string, { wishes: number; stars: number }> = {};
    for (const id of ids) {
      const u = await ctx.db.get("users", id);
      out[u!.name] = { wishes: u!.wishesLeft, stars: u!.stars };
    }
    return out;
  });
}

describe("tierFor", () => {
  test("1 gold, 2 silver, 3 bronze, 4-6 red", () => {
    expect([1, 2, 3, 4, 5, 6].map(tierFor)).toEqual(["gold", "silver", "bronze", "red", "red", "red"]);
  });
});

describe("grantRewards", () => {
  test("bronze: wisher and match +1 wish, winning-branch helpers +1 star, others nothing; runs once", async () => {
    const t = setup();
    const s = await tree(t);
    await t.run((ctx) => ctx.db.patch("wishes", s.wishId, { status: "granted", winningHopId: s.caraHop }));
    await t.mutation(internal.rewards.apply, { wishId: s.wishId });
    const ids = [s.louise, s.amy, s.ben, s.cara, s.oliver];
    const after = await balances(t, ids);
    expect(after).toEqual({
      Louise: { wishes: 1, stars: 0 },
      Amy: { wishes: 0, stars: 1 },
      Ben: { wishes: 0, stars: 1 },
      Cara: { wishes: 1, stars: 0 },
      Oliver: { wishes: 0, stars: 0 },
    });
    const wish = await t.run((ctx) => ctx.db.get("wishes", s.wishId));
    expect(wish?.tier).toBe("bronze");
    expect(wish?.rewardsAppliedAt).toBeTypeOf("number");
    await t.mutation(internal.rewards.apply, { wishId: s.wishId });
    expect(await balances(t, ids)).toEqual(after);
  });

  test("gold and met in person: everyone on the branch +1 star, wisher and match +1 more", async () => {
    const t = setup();
    const s = await tree(t, { metInPerson: true });
    const winner = await t.run((ctx) =>
      ctx.db.insert("hops", { wishId: s.wishId, depth: 1, holderName: "Cara", holderUserId: s.cara, recipientTags: [], viaGroup: false, action: "its_me" }),
    );
    await t.run((ctx) => ctx.db.patch("wishes", s.wishId, { status: "granted", winningHopId: winner }));
    await t.mutation(internal.rewards.apply, { wishId: s.wishId });
    expect(await balances(t, [s.louise, s.cara, s.amy])).toEqual({
      Louise: { wishes: 1, stars: 2 },
      Cara: { wishes: 1, stars: 2 },
      Amy: { wishes: 0, stars: 0 },
    });
    expect((await t.run((ctx) => ctx.db.get("wishes", s.wishId)))?.tier).toBe("gold");
  });

  test("a found person without a user row still rewards the rest", async () => {
    const t = setup();
    const s = await tree(t, { caraHasUser: false });
    await t.run((ctx) => ctx.db.patch("wishes", s.wishId, { status: "granted", winningHopId: s.caraHop }));
    await t.mutation(internal.rewards.apply, { wishId: s.wishId });
    expect(await balances(t, [s.louise, s.amy, s.ben, s.cara])).toEqual({
      Louise: { wishes: 1, stars: 0 },
      Amy: { wishes: 0, stars: 1 },
      Ben: { wishes: 0, stars: 1 },
      Cara: { wishes: 0, stars: 0 },
    });
  });

  test("no winning hop: nothing happens", async () => {
    const t = setup();
    const s = await tree(t);
    await t.mutation(internal.rewards.apply, { wishId: s.wishId });
    expect(await balances(t, [s.louise, s.amy])).toEqual({ Louise: { wishes: 0, stars: 0 }, Amy: { wishes: 0, stars: 0 } });
    expect((await t.run((ctx) => ctx.db.get("wishes", s.wishId)))?.rewardsAppliedAt).toBeUndefined();
  });
});

describe("rewards.race", () => {
  test("one row per branch, shortest It's me! leads, no hop ids", async () => {
    const t = setup();
    const s = await tree(t);
    const race = await t.query(api.rewards.race, { deviceId: "dev_louise", wishId: s.wishId });
    expect(race?.branches).toEqual([
      { label: "Branch A", depth: 3, people: 3, holding: 0, found: true, won: false, leading: true, tier: "bronze" },
      { label: "Branch B", depth: 2, people: 2, holding: 1, found: false, won: false, leading: false, tier: "silver" },
    ]);
    const json = JSON.stringify(race);
    for (const id of [s.amyHop, s.benHop, s.caraHop, s.oliverHop]) expect(json).not.toContain(id);
    expect(json).not.toContain("Amy");
  });

  test("without a match the furthest branch leads", async () => {
    const t = setup();
    const s = await tree(t);
    await t.run((ctx) => ctx.db.patch("hops", s.caraHop, { action: undefined }));
    await t.run((ctx) =>
      ctx.db.insert("hops", { wishId: s.wishId, depth: 4, parentHopId: s.caraHop, holderName: "Dee", recipientTags: [], viaGroup: false }),
    );
    const race = await t.query(api.rewards.race, { deviceId: "dev_louise", wishId: s.wishId });
    expect(race?.branches.map((b) => [b.depth, b.leading])).toEqual([
      [4, true],
      [2, false],
    ]);
  });

  test("a holder can see the race, a stranger cannot", async () => {
    const t = setup();
    const s = await tree(t);
    expect(await t.query(api.rewards.race, { deviceId: "dev_ben", wishId: s.wishId })).not.toBeNull();
    expect(await t.query(api.rewards.race, { deviceId: "dev_stranger", wishId: s.wishId })).toBeNull();
    await expect(t.query(api.rewards.race, { deviceId: "../", wishId: s.wishId })).rejects.toThrow(/Invalid device id/);
  });
});

describe("stars", () => {
  test("trade 2 stars for 1 wish, refused with fewer than 2", async () => {
    const t = setup();
    await t.run((ctx) => ctx.db.insert("users", person("Mia", { deviceId: "dev_mia", stars: 3, wishesLeft: 0 })));
    expect(await t.mutation(api.stars.tradeForWish, { deviceId: "dev_mia" })).toEqual({ stars: 1, wishesLeft: 1 });
    await expect(t.mutation(api.stars.tradeForWish, { deviceId: "dev_mia" })).rejects.toThrow(/need 2 stars/);
    await expect(t.mutation(api.stars.tradeForWish, { deviceId: "dev_nobody" })).rejects.toThrow(/Unknown device/);
  });

  test("ask the well costs 1 star, refuses at 0 and refunds when it has nothing to suggest", async () => {
    const t = setup();
    const mia = await t.run((ctx) => ctx.db.insert("users", person("Mia", { deviceId: "dev_mia", stars: 1, wishesLeft: 1 })));
    const stars = async () => (await t.run((ctx) => ctx.db.get("users", mia)))!.stars;
    expect(await t.action(api.ai.askTheWell, { deviceId: "dev_mia", text: "drums" })).toBeNull();
    expect(await stars()).toBe(1);
    await t.mutation(api.wishes.toss, {
      deviceId: "dev_mia",
      type: "do_together",
      text: "Someone to jam on drums with",
      name: "Mia",
      city: "SF",
      recipients: [{ name: "Ben", tags: ["drums", "music"] }],
    });
    const answer = await t.action(api.ai.askTheWell, { deviceId: "dev_mia", text: "Someone to jam on drums with" });
    expect(answer?.name).toBe("Ben");
    expect(await stars()).toBe(0);
    await expect(t.action(api.ai.askTheWell, { deviceId: "dev_mia", text: "drums" })).rejects.toThrow(/costs 1 star/);
  });
});

describe("wishes.fade", () => {
  test("no one found in 48 hours gives the wish back once", async () => {
    const t = setup();
    const s = await tree(t);
    await t.run((ctx) => ctx.db.patch("hops", s.caraHop, { action: undefined }));
    await t.mutation(internal.wishes.fade, { wishId: s.wishId });
    await t.mutation(internal.wishes.fade, { wishId: s.wishId });
    expect((await t.run((ctx) => ctx.db.get("wishes", s.wishId)))?.status).toBe("faded");
    expect((await balances(t, [s.louise])).Louise.wishes).toBe(1);
  });

  test("a found wish does not fade or refund", async () => {
    const t = setup();
    const s = await tree(t);
    await t.run((ctx) => ctx.db.patch("wishes", s.wishId, { status: "found" }));
    await t.mutation(internal.wishes.fade, { wishId: s.wishId });
    expect((await t.run((ctx) => ctx.db.get("wishes", s.wishId)))?.status).toBe("found");
    expect((await balances(t, [s.louise])).Louise.wishes).toBe(0);
  });
});
