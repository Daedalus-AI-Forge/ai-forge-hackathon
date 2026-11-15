/// <reference types="vite/client" />
import rateLimiter from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";

import { api, internal } from "./_generated/api";
import { tierFor, templateStory } from "./endings";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

function setup() {
  const t = convexTest(schema, modules);
  rateLimiter.register(t);
  return t;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

/** Louise (SF) -> Amy (Shanghai) -> Ben "It's me!" (SF), plus Oliver on another branch. */
async function tree(t: ReturnType<typeof setup>) {
  return await t.run(async (ctx) => {
    const creatorId = await ctx.db.insert("users", { name: "Louise", avatar: "#000", city: "San Francisco", wishesLeft: 0, stars: 0, deviceId: "dev_louise" });
    await ctx.db.insert("users", { name: "Mallory", avatar: "#000", city: "SF", wishesLeft: 1, stars: 0, deviceId: "dev_mallory" });
    const wishId = await ctx.db.insert("wishes", {
      creatorId,
      type: "do_together",
      text: "Someone to jam on drums with.",
      status: "traveling",
      expiresAt: Date.now() + 3_600_000,
    });
    const amy = await ctx.db.insert("hops", {
      wishId, depth: 1, holderName: "Amy", city: "Shanghai", holderContact: "amy-wechat",
      recipientTags: [], viaGroup: false, vouchForParent: "Louise is my co-founder.", action: "pass",
    });
    const ben = await ctx.db.insert("hops", {
      wishId, parentHopId: amy, depth: 2, holderName: "Ben", city: "San Francisco", holderContact: "+15550002222",
      recipientTags: [], viaGroup: false, vouchForParent: "Amy is my roommate.", itsMeIntro: "I drum!", action: "its_me",
    });
    const oliver = await ctx.db.insert("hops", {
      wishId, depth: 1, holderName: "Oliver", recipientTags: [], viaGroup: false, itsMeIntro: "Maybe me?", action: "its_me",
    });
    return { wishId, amy, ben, oliver };
  });
}

async function photo(t: ReturnType<typeof setup>, type = "image/jpeg") {
  return await t.run((ctx) => ctx.storage.store(new Blob(["fake-photo"], { type })));
}

describe("tiers and story template", () => {
  test("depth maps to gold, silver, bronze, red", () => {
    expect([1, 2, 3, 4, 6].map(tierFor)).toEqual(["gold", "silver", "bronze", "red", "red"]);
  });
  test("template story names the cities and ripples", () => {
    const story = templateStory({ creatorName: "Louise", matchName: "Ben", metInPerson: true }, [
      { name: "Louise", city: "SF" },
      { name: "Amy", city: "Shanghai" },
      { name: "Ben", city: "SF" },
    ]);
    expect(story).toBe("Tossed in SF, passed through Shanghai, granted 2 ripples later. Louise and Ben finally met in person.");
  });
});

describe("wisher review", () => {
  test("only the wisher sees candidates, with the vouch chain above them", async () => {
    const t = setup();
    const { wishId } = await tree(t);
    expect(await t.query(api.endings.wishDetail, { deviceId: "dev_mallory", wishId })).toBeNull();
    const detail = await t.query(api.endings.wishDetail, { deviceId: "dev_louise", wishId });
    expect(detail!.candidates.map((c) => c.name)).toEqual(["Oliver", "Ben"]);
    const ben = detail!.candidates[1];
    expect(ben).toMatchObject({ city: "San Francisco", intro: "I drum!", tier: "silver" });
    expect(ben.chain).toEqual([expect.objectContaining({ name: "Amy", city: "Shanghai", vouch: "Louise is my co-founder." })]);
    expect(JSON.stringify(detail)).not.toContain("+15550002222");
    expect(JSON.stringify(detail)).not.toContain("amy-wechat");
  });

  test("a stranger can't confirm or reject", async () => {
    const t = setup();
    const { ben } = await tree(t);
    await expect(t.mutation(api.endings.confirmMatch, { deviceId: "dev_mallory", hopId: ben, contact: "x" })).rejects.toThrow(/Only the wisher/);
    await expect(t.mutation(api.endings.rejectCandidate, { deviceId: "dev_mallory", hopId: ben })).rejects.toThrow(/Only the wisher/);
  });

  test("can't confirm someone who didn't say it's them, or without a contact", async () => {
    const t = setup();
    const { amy, ben } = await tree(t);
    await expect(t.mutation(api.endings.confirmMatch, { deviceId: "dev_louise", hopId: amy, contact: "x" })).rejects.toThrow(/haven't said/);
    await expect(t.mutation(api.endings.confirmMatch, { deviceId: "dev_louise", hopId: ben, contact: "   " })).rejects.toThrow(/contact/);
  });

  test("yes, it's you: found, tier from depth, 7-day deadline, contacts swapped one way each", async () => {
    const t = setup();
    const { wishId, ben, amy, oliver } = await tree(t);
    const before = Date.now();
    await t.mutation(api.endings.confirmMatch, { deviceId: "dev_louise", hopId: ben, contact: " @louise ".repeat(30), thankYou: "Thank you!" });
    const wish = await t.run((ctx) => ctx.db.get("wishes", wishId));
    expect(wish).toMatchObject({ status: "found", winningHopId: ben, tier: "silver", thankYou: "Thank you!" });
    expect(wish!.wisherContact!.length).toBeLessThanOrEqual(100);
    expect(wish!.meetDeadline! - before).toBeGreaterThanOrEqual(7 * 24 * 3600 * 1000 - 1000);

    const detail = await t.query(api.endings.wishDetail, { deviceId: "dev_louise", wishId });
    expect(detail!.match).toMatchObject({ name: "Ben", contact: "+15550002222" });
    expect(detail!.candidates).toEqual([]);
    expect(detail!.ending).toBeNull();

    const match = await t.query(api.endings.forHop, { hopId: ben });
    expect(match).toMatchObject({ role: "match", status: "found", ending: null });
    expect(match!.wisherContact).toContain("@louise");
    const helper = await t.query(api.endings.forHop, { hopId: amy });
    expect(helper).toMatchObject({ role: "helper", wisherContact: null, ending: null });
    expect((await t.query(api.endings.forHop, { hopId: oliver }))!.role).toBe("rejected");

    await expect(t.mutation(api.endings.confirmMatch, { deviceId: "dev_louise", hopId: oliver, contact: "x" })).rejects.toThrow(/isn't traveling/);
  });

  test("not quite: candidate is rejected and the wish keeps traveling", async () => {
    const t = setup();
    const { wishId, oliver } = await tree(t);
    await t.mutation(api.endings.rejectCandidate, { deviceId: "dev_louise", hopId: oliver });
    const wish = await t.run((ctx) => ctx.db.get("wishes", wishId));
    expect(wish!.status).toBe("traveling");
    expect((await t.query(api.endings.forHop, { hopId: oliver }))!.role).toBe("rejected");
    const detail = await t.query(api.endings.wishDetail, { deviceId: "dev_louise", wishId });
    expect(detail!.candidates.map((c) => c.name)).toEqual(["Ben"]);
    await expect(t.mutation(api.endings.confirmMatch, { deviceId: "dev_louise", hopId: oliver, contact: "x" })).rejects.toThrow(/haven't said/);
  });
});

describe("photo and granted", () => {
  test("only the wisher or the match can upload, and only once found", async () => {
    const t = setup();
    const { wishId, ben, amy } = await tree(t);
    await expect(t.mutation(api.endings.generateUploadUrl, { wishId, hopId: ben })).rejects.toThrow(/waiting for a photo/);
    await t.mutation(api.endings.confirmMatch, { deviceId: "dev_louise", hopId: ben, contact: "@louise" });
    await expect(t.mutation(api.endings.generateUploadUrl, { wishId, hopId: amy })).rejects.toThrow(/Only the wisher or their match/);
    await expect(t.mutation(api.endings.generateUploadUrl, { wishId, deviceId: "dev_mallory" })).rejects.toThrow(/Only the wisher or their match/);
    expect(await t.mutation(api.endings.generateUploadUrl, { wishId, hopId: ben })).toEqual(expect.any(String));
    const storageId = await photo(t);
    expect(await t.mutation(api.endings.submitPhoto, { wishId, hopId: amy, storageId, metInPerson: true })).toMatch(/Only the wisher or their match/);
    expect(await t.run((ctx) => ctx.db.system.get("_storage", storageId))).toBeNull();
  });

  test("non-image uploads are refused and deleted", async () => {
    const t = setup();
    const { wishId, ben } = await tree(t);
    await t.mutation(api.endings.confirmMatch, { deviceId: "dev_louise", hopId: ben, contact: "@louise" });
    const storageId = await photo(t, "text/html");
    expect(await t.mutation(api.endings.submitPhoto, { wishId, hopId: ben, storageId, metInPerson: false })).toMatch(/photo under/);
    expect(await t.run((ctx) => ctx.db.system.get("_storage", storageId))).toBeNull();
  });

  test("match uploads, wisher confirms: granted, ending revealed to the whole tree, story written once", async () => {
    vi.useFakeTimers();
    const t = setup();
    const { wishId, ben, amy, oliver } = await tree(t);
    await t.mutation(api.endings.confirmMatch, { deviceId: "dev_louise", hopId: ben, contact: "@louise", thankYou: "Thanks Amy and Ben!" });
    const storageId = await photo(t);
    expect(await t.mutation(api.endings.submitPhoto, { wishId, hopId: ben, storageId, metInPerson: true })).toBeNull();

    expect((await t.query(api.endings.forHop, { hopId: amy }))!.ending).toBeNull();
    expect((await t.query(api.endings.forHop, { hopId: ben }))!.photo).toMatchObject({ by: "match", metInPerson: true });
    await expect(t.mutation(api.endings.confirmPhoto, { wishId, hopId: ben })).rejects.toThrow(/other side/);
    await expect(t.mutation(api.endings.confirmPhoto, { wishId, deviceId: "dev_mallory" })).rejects.toThrow(/Only the wisher/);
    await t.mutation(api.endings.confirmPhoto, { wishId, deviceId: "dev_louise" });

    const wish = await t.run((ctx) => ctx.db.get("wishes", wishId));
    expect(wish!.status).toBe("granted");
    expect(wish!.grantedAt).toEqual(expect.any(Number));

    for (const hopId of [amy, oliver, ben]) {
      const view = await t.query(api.endings.forHop, { hopId });
      expect(view!.ending).toMatchObject({ thankYou: "Thanks Amy and Ben!", metInPerson: true, tier: "silver" });
      expect(view!.ending!.photoUrl).toEqual(expect.any(String));
      expect(view!.ending!.chain.map((s) => s.name)).toEqual(["Louise", "Amy", "Ben"]);
      expect(JSON.stringify(view!.ending)).not.toContain("+15550002222");
    }

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const story = (await t.run((ctx) => ctx.db.get("wishes", wishId)))!.story;
    expect(story).toBe("Tossed in San Francisco, passed through Shanghai, granted 2 ripples later. Louise and Ben finally met in person.");
    await t.mutation(internal.endings.setStory, { wishId, story: "Overwritten" });
    expect((await t.run((ctx) => ctx.db.get("wishes", wishId)))!.story).toBe(story);
    expect((await t.run((ctx) => ctx.db.get("wishes", wishId)))!.meetMissed).toBeUndefined();

    const card = await t.query(api.endings.card, { wishId });
    expect(card).toMatchObject({ story, thankYou: null });
  });

  test("the public card is empty until granted", async () => {
    const t = setup();
    const { wishId } = await tree(t);
    expect(await t.query(api.endings.card, { wishId })).toBeNull();
    expect(await t.query(api.endings.card, { wishId: "nope" })).toBeNull();
  });

  test("no photo in 7 days: ending stays locked and is marked missed", async () => {
    vi.useFakeTimers();
    const t = setup();
    const { wishId, ben } = await tree(t);
    await t.mutation(api.endings.confirmMatch, { deviceId: "dev_louise", hopId: ben, contact: "@louise" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const wish = await t.run((ctx) => ctx.db.get("wishes", wishId));
    expect(wish).toMatchObject({ status: "found", meetMissed: true });
    expect((await t.query(api.endings.forHop, { hopId: ben }))).toMatchObject({ meetMissed: true, ending: null });
    await expect(t.mutation(api.endings.generateUploadUrl, { wishId, hopId: ben })).rejects.toThrow(/7 days/);
  });

  test("seeded drums wish renders the full card", async () => {
    const t = setup();
    await t.mutation(internal.seed.run, {});
    const wishId = await t.run(async (ctx) => {
      for await (const w of ctx.db.query("wishes")) if (w.status === "granted") return w._id;
      return null;
    });
    const card = await t.query(api.endings.card, { wishId: wishId! });
    expect(card!.tier).toBe("silver");
    expect(card!.photoUrl).toContain("picsum");
    expect(card!.story).toContain("Shanghai");
    expect(card!.chain.map((s) => s.city)).toEqual(["San Francisco", "Shanghai", "San Francisco"]);
  });
});
