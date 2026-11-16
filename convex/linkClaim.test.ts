/// <reference types="vite/client" />
import rateLimiter from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { api, internal } from "./_generated/api";
import schema from "./schema";
import { PROPHECY_FALLBACK } from "./linkAi";

const modules = import.meta.glob("./**/*.ts");
const DEMO = "+15555550100";
const REAL = "+16502530000";

function setup() {
  const t = convexTest(schema, modules);
  rateLimiter.register(t);
  return t;
}

beforeEach(() => {
  vi.stubEnv("SUPERMEMORY_API_KEY", "");
  vi.stubEnv("OPENAI_API_KEY", "");
  vi.stubEnv("DEMO_PHONE_NUMBERS", DEMO);
  vi.stubEnv("DEMO_PHONE_CODE", "");
  vi.stubEnv("TWILIO_ACCOUNT_SID", "AC1");
  vi.stubEnv("TWILIO_AUTH_TOKEN", "tok");
  vi.stubEnv("TWILIO_VERIFY_SERVICE_SID", "VA1");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function seed(t: ReturnType<typeof setup>, opts: { daily?: boolean; holder?: boolean } = {}) {
  return await t.run(async (ctx) => {
    const creator = await ctx.db.insert("users", { name: "Darren", avatar: "#000", city: "SF", wishesLeft: 1, stars: 0, deviceId: "dev_owner" });
    const visitor = await ctx.db.insert("users", { name: "Vee", avatar: "#000", city: "SF", wishesLeft: 1, stars: 0, deviceId: "dev_visitor" });
    const wishId = await ctx.db.insert("wishes", {
      creatorId: creator,
      type: "do_together",
      mode: "serious",
      text: "Someone to jam on drums with in a band",
      status: "traveling",
      expiresAt: Date.now() + 3_600_000,
      ...(opts.daily ? { daily: { date: "2026-11-15", steps: [], reasoning: "" } } : {}),
    });
    const hopId = await ctx.db.insert("hops", {
      wishId,
      depth: 1,
      holderName: "Vee",
      holderUserId: opts.holder === false ? undefined : visitor,
      recipientTags: [],
      viaGroup: false,
    });
    return { hopId, wishId };
  });
}

function openAiReply(text: string) {
  return new Response(JSON.stringify({ output: [{ content: [{ type: "output_text", text }] }] }), { status: 200 });
}

describe("link.claim", () => {
  test("daily boat: intro + proof + showNameAndCity → its_me, awaiting confirmation", async () => {
    const t = setup();
    const { hopId } = await seed(t, { daily: true });
    const proofStorageId = await t.run((ctx) => ctx.storage.store(new Blob(["img"])));
    const res = await t.mutation(api.link.claim, {
      hopId, deviceId: "dev_visitor", intro: "  I drum every Sunday  ", showNameAndCity: false, proofStorageId,
    });
    expect(res).toEqual({ status: "awaiting_confirmation" });
    const hop = await t.run((ctx) => ctx.db.get("hops", hopId));
    expect(hop).toMatchObject({ action: "its_me", itsMeIntro: "I drum every Sunday", itsMePublic: false, proofStorageId });
    expect(hop?.actedAt).toBeTypeOf("number");
  });

  test("daily boat needs an intro", async () => {
    const t = setup();
    const { hopId } = await seed(t, { daily: true });
    await expect(t.mutation(api.link.claim, { hopId, deviceId: "dev_visitor", intro: "  " })).rejects.toThrow("Write a one-line intro");
  });

  test("real wish without a verified code throws", async () => {
    const t = setup();
    const { hopId } = await seed(t);
    const base = { hopId, deviceId: "dev_visitor", intro: "I drum", answers: ["Ten years of jazz"] };
    await expect(t.mutation(api.link.claim, base)).rejects.toThrow("Verify your phone first");
    await expect(t.mutation(api.link.claim, { ...base, phone: DEMO, code: "123456" })).rejects.toThrow("Verify your phone first");
    // Twilio number never verified via verifyClaimCode.
    await expect(t.mutation(api.link.claim, { ...base, phone: REAL, code: "000000" })).rejects.toThrow("Verify your phone first");
    const hop = await t.run((ctx) => ctx.db.get("hops", hopId));
    expect(hop?.action).toBeUndefined();
  });

  test("real wish needs at least one answer", async () => {
    const t = setup();
    const { hopId } = await seed(t);
    await expect(
      t.mutation(api.link.claim, { hopId, deviceId: "dev_visitor", intro: "I drum", answers: [" "], phone: DEMO, code: "000000" }),
    ).rejects.toThrow("Answer the question first");
  });

  test("real wish with demo number + code passes and stores the claim", async () => {
    const t = setup();
    const { hopId } = await seed(t);
    const res = await t.mutation(api.link.claim, {
      hopId, deviceId: "dev_visitor", intro: "I drum", answers: ["Ten years of jazz", ""], phone: "+1 555 555 0100", code: "000000",
    });
    expect(res).toEqual({ status: "awaiting_confirmation" });
    const hop = await t.run((ctx) => ctx.db.get("hops", hopId));
    expect(hop).toMatchObject({ action: "its_me", claimPhone: DEMO, claimVerified: true, claimAnswers: ["Ten years of jazz"], itsMeIntro: "I drum" });
  });

  test("real wish with a Twilio number: verifyClaimCode then claim", async () => {
    const t = setup();
    const { hopId } = await seed(t);
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ status: "approved" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await t.action(api.linkAi.verifyClaimCode, { hopId, phone: REAL, code: "424242" })).toEqual({ verified: true });
    await t.mutation(api.link.claim, { hopId, deviceId: "dev_visitor", intro: "I drum", answers: ["Jazz"], phone: REAL, code: "424242" });
    const hop = await t.run((ctx) => ctx.db.get("hops", hopId));
    expect(hop).toMatchObject({ action: "its_me", claimPhone: REAL, claimVerified: true });
  });

  test("second claim is rejected", async () => {
    const t = setup();
    const { hopId } = await seed(t, { daily: true });
    await t.mutation(api.link.claim, { hopId, deviceId: "dev_visitor", intro: "Me" });
    await expect(t.mutation(api.link.claim, { hopId, deviceId: "dev_visitor", intro: "Me again" })).rejects.toThrow(
      "This boat already found its person",
    );
  });

  test("a hop bound to another device can't be claimed", async () => {
    const t = setup();
    const { hopId } = await seed(t, { daily: true });
    await expect(t.mutation(api.link.claim, { hopId, deviceId: "dev_owner", intro: "Me" })).rejects.toThrow("This boat is with someone else");
  });
});

describe("linkAi.sendClaimCode", () => {
  test("demo number: no SMS, returns resend delay; second send within a minute is rate limited", async () => {
    const t = setup();
    const { hopId } = await seed(t);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await t.action(api.linkAi.sendClaimCode, { hopId, phone: DEMO })).toEqual({ resendAfterMs: 60_000 });
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(t.action(api.linkAi.sendClaimCode, { hopId, phone: DEMO })).rejects.toThrow(/Too many tries|RATE_LIMITED/);
  });
});

describe("linkAi fallbacks", () => {
  test("no OpenAI key → templates grounded in the inputs", async () => {
    const t = setup();
    const { hopId } = await seed(t);
    const qs = await t.action(api.linkAi.claimQuestions, { hopId });
    expect(qs.length).toBeGreaterThanOrEqual(1);
    expect(qs.length).toBeLessThanOrEqual(2);
    expect(qs[0]).toContain("drums");
    expect(await t.action(api.linkAi.vouchFor, { hopId, name: "Amy", relation: "coworker", reason: "plays drums" })).toBe(
      "Amy is my coworker — plays drums",
    );
    expect(await t.action(api.linkAi.memoryPrompt, { hopId })).toContain("drums");
    expect(await t.action(api.linkAi.prophecy, { wishText: "drums" })).toBe(PROPHECY_FALLBACK);
  });

  test("OpenAI error or throw → fallback, never throws", async () => {
    const t = setup();
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    const { hopId } = await seed(t);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 500 })));
    expect(await t.action(api.linkAi.prophecy, { wishText: "drums" })).toBe(PROPHECY_FALLBACK);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network"); }));
    expect(await t.action(api.linkAi.vouchFor, { hopId, name: "Amy", relation: "friend", reason: "drums" })).toBe("Amy is my friend — drums");
  });

  test("slow OpenAI is cut off at the 3s budget", async () => {
    const t = setup();
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      })),
    );
    const started = Date.now();
    expect(await t.action(api.linkAi.prophecy, { wishText: "drums" })).toBe(PROPHECY_FALLBACK);
    expect(Date.now() - started).toBeLessThan(5000);
  }, 10_000);

  test("OpenAI reply is used; questions parsed to at most 2", async () => {
    const t = setup();
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    const { hopId } = await seed(t);
    vi.stubGlobal("fetch", vi.fn(async () => openAiReply("1. What kit do you play?\n2. Which band genres?\n3. Extra?")));
    expect(await t.action(api.linkAi.claimQuestions, { hopId })).toEqual(["What kit do you play?", "Which band genres?"]);
    vi.stubGlobal("fetch", vi.fn(async () => openAiReply("\"Amy keeps perfect time.\"")));
    expect(await t.action(api.linkAi.vouchFor, { hopId, name: "Amy", relation: "friend", reason: "drums" })).toBe("Amy keeps perfect time.");
  });

  test("rate limited per link via aiAllowed", async () => {
    const t = setup();
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    const { hopId } = await seed(t);
    const fetchMock = vi.fn(async () => openAiReply("A warm line."));
    vi.stubGlobal("fetch", fetchMock);
    const results: string[] = [];
    for (let i = 0; i < 22; i++) {
      results.push(await t.action(api.linkAi.vouchFor, { hopId, name: "Amy", relation: "friend", reason: "drums" }));
    }
    expect(fetchMock).toHaveBeenCalledTimes(20);
    expect(results.at(-1)).toBe("Amy is my friend — drums");
  });
});

describe("linkAi.introMessage", () => {
  test("falls back to a template naming claimer, maker and wish when AI is off", async () => {
    const t = setup();
    const { hopId } = await seed(t);
    const text = await t.action(api.linkAi.introMessage, { hopId });
    expect(text).toBe(`Hi Vee, it's Darren! Thanks for saying you're the one about "someone to jam on drums with in a band". Want to set something up?`);
  });

  async function chainSeed(t: ReturnType<typeof setup>) {
    const { hopId, wishId } = await seed(t);
    return await t.run(async (ctx) => {
      const katie = await ctx.db.insert("hops", {
        wishId, parentHopId: hopId, depth: 2, holderName: "Katie", recipientTags: [], viaGroup: false,
      });
      const dazi = await ctx.db.insert("hops", {
        wishId, parentHopId: katie, depth: 3, holderName: "Dazi Lee", recipientTags: ["privateTagQ"], viaGroup: false,
        introVouch: "you drum with a Berkeley collective every week", itsMeIntro: "I play drums every Tuesday",
      });
      return dazi;
    });
  }

  test("AI draft uses FACTS (chain, vouch, you_said) and passes the check", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    const t = setup();
    const dazi = await chainSeed(t);
    const reply = "Hi Dazi, it's Darren! Vee and Katie got my boat to you. Katie says you drum with a Berkeley collective. Up for a jam sometime?";
    const fetchMock = vi.fn(async () => openAiReply(reply));
    vi.stubGlobal("fetch", fetchMock);
    expect(await t.action(api.linkAi.introMessage, { hopId: dazi })).toBe(reply);
    const body = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string;
    expect(body).toContain("chain=Darren → Vee → Katie → Dazi");
    expect(body).toContain('you_said=\\"I play drums every Tuesday\\"');
    expect(body).not.toContain("privateTagQ");
  });

  test("an invented fact falls back to the template naming the chain", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    const t = setup();
    const dazi = await chainSeed(t);
    vi.stubGlobal("fetch", vi.fn(async () => openAiReply("Hi Dazi! Meet me at Blue Bottle on Friday at 5?")));
    expect(await t.action(api.linkAi.introMessage, { hopId: dazi })).toBe(
      `Hi Dazi, it's Darren! Vee and Katie connected us about "someone to jam on drums with in a band". Want to set something up?`,
    );
  });
});

describe("journey copy", () => {
  test("a claimed daily boat ends as found with the claimer's story and photo", async () => {
    const t = setup();
    const { hopId, wishId } = await seed(t, { daily: true });
    const before = await t.query(api.link.ending, { wishId });
    expect(before?.status).toBe("traveling");
    expect(before?.story).toContain("still out there");
    const proofStorageId = await t.run((ctx) => ctx.storage.store(new Blob(["img"])));
    await t.mutation(api.link.claim, { hopId, deviceId: "dev_visitor", intro: "I drum every Sunday", proofStorageId });
    const after = await t.query(api.link.ending, { wishId });
    expect(after?.status).toBe("found");
    expect(after?.story).not.toContain("still out there");
    expect(after?.story).toContain('In their words: "I drum every Sunday"');
    expect(after?.photoUrl).toBeTypeOf("string");
  });

  test("first hop shows the toss reason as vouchForMe (link page + OG), never tags", async () => {
    const t = setup();
    const { hopId, wishId } = await seed(t);
    await t.run(async (ctx) => {
      const wish = (await ctx.db.get("wishes", wishId))!;
      await ctx.db.insert("edges", { ownerUserId: wish.creatorId, ownerName: "Darren", personName: "Vee", tag: "secret-tag",
        source: "pick", wishId, hopId, reason: "you drum with a Berkeley collective" });
    });
    const screen = await t.query(api.link.firstScreen, { hopId });
    expect(screen?.vouchForMe).toBe("you drum with a Berkeley collective");
    expect(JSON.stringify(screen)).not.toContain("secret-tag");
    const og = await t.query(internal.linkMetrics.ogHop, { hopId });
    expect(og?.introVouch).toBe("you drum with a Berkeley collective");
  });

  test("a sender with no name (or the daily placeholder 'You') shows as 'A friend'", async () => {
    const t = setup();
    const { hopId, wishId } = await seed(t);
    await t.run(async (ctx) => {
      const wish = (await ctx.db.get("wishes", wishId))!;
      await ctx.db.patch("users", wish.creatorId, { name: "" });
    });
    expect((await t.query(api.link.firstScreen, { hopId }))?.senderName).toBe("A friend");
    expect((await t.query(internal.linkMetrics.ogHop, { hopId }))?.senderName).toBe("A friend");
    const child = await t.run((ctx) => ctx.db.insert("hops", {
      wishId, parentHopId: hopId, depth: 2, holderName: "Amy", recipientTags: [], viaGroup: false }));
    await t.run((ctx) => ctx.db.patch("hops", hopId, { holderName: "You" }));
    expect((await t.query(api.link.firstScreen, { hopId: child }))?.senderName).toBe("A friend");
    expect((await t.query(internal.linkMetrics.ogHop, { hopId: child }))?.senderName).toBe("A friend");
  });
});
