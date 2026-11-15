/// <reference types="vite/client" />
import rateLimiter from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

function setup() {
  const t = convexTest(schema, modules);
  rateLimiter.register(t);
  return t;
}

beforeEach(() => {
  vi.stubEnv("SUPERMEMORY_API_KEY", "");
  vi.stubEnv("OPENAI_API_KEY", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const PEOPLE: [string, string, string | undefined][] = [
  ["Amy", "music", "Plays drums in a band every weekend"],
  ["Amy", "drums", undefined],
  ["Ken", "tokyo", "Grew up in Shibuya"],
  ["Ken", "food", "Knows every izakaya"],
  ["Lia", "climbing", "Runs the Mission bouldering group"],
  ["Raj", "band", "Manages a jazz band"],
];

async function seed(t: ReturnType<typeof setup>, edgeCount: number) {
  return await t.run(async (ctx) => {
    const owner = await ctx.db.insert("users", {
      name: "Darren",
      avatar: "#000",
      city: "SF",
      wishesLeft: 1,
      stars: 5,
      deviceId: "dev_owner",
    });
    const stranger = await ctx.db.insert("users", {
      name: "Olga",
      avatar: "#000",
      city: "SF",
      wishesLeft: 1,
      stars: 0,
      deviceId: "dev_stranger",
    });
    const wishId = await ctx.db.insert("wishes", {
      creatorId: owner,
      type: "do_together",
      text: "Someone to jam on drums with in a band",
      status: "traveling",
      expiresAt: Date.now() + 3_600_000,
    });
    const hopId = await ctx.db.insert("hops", { wishId, depth: 1, holderName: "Amy", recipientTags: [], viaGroup: false });
    for (const [personName, tag, reason] of PEOPLE.slice(0, edgeCount)) {
      await ctx.db.insert("edges", { ownerUserId: owner, ownerName: "Darren", personName, tag, source: "pick", wishId, hopId, reason });
    }
    // The stranger's drummer must never be suggested to the owner.
    await ctx.db.insert("edges", {
      ownerUserId: stranger,
      ownerName: "Olga",
      personName: "Secret Sam",
      tag: "drums",
      source: "pick",
      wishId,
      hopId,
    });
    return { owner, stranger, wishId: wishId as Id<"wishes"> };
  });
}

function mockOpenAI(text: string) {
  const fetchMock = vi.fn(async () => Response.json({ output: [{ content: [{ type: "output_text", text }] }] }));
  vi.stubEnv("OPENAI_API_KEY", "sk_test");
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("ai.coach", () => {
  test("below threshold → ready:false with counts", async () => {
    const t = setup();
    await seed(t, 4);
    expect(await t.action(api.ai.coach, { deviceId: "dev_owner", wishText: "drums" })).toEqual({
      ready: false,
      edgeCount: 4,
      threshold: 5,
    });
  });

  test("OpenAI reply: suggestions are a subset of candidates, invented people dropped", async () => {
    const t = setup();
    await seed(t, 6);
    const fetchMock = mockOpenAI(
      JSON.stringify({
        message: "Amy plays drums. Want to start with her?",
        suggestions: [
          { personKey: "amy", why: "You said she plays drums in a band." },
          { personKey: "secret sam", why: "Best drummer in town." },
          { personKey: "bob", why: "Invented." },
        ],
      }),
    );
    const res = await t.action(api.ai.coach, {
      deviceId: "dev_owner",
      wishText: "Someone to jam on drums with",
      turns: [{ role: "user", text: "Ideally this week" }],
    });
    expect(res.ready).toBe(true);
    if (!res.ready) return;
    expect(res.message).toContain("Amy");
    expect(res.suggestions.map((s) => s.personKey)).toEqual(["amy"]);
    expect(res.suggestions[0].evidence.every((e) => ["music", "drums"].includes(e.tag))).toBe(true);
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.max_output_tokens).toBe(300);
    expect(body.input).not.toContain("Secret Sam");
    expect(body.input).toContain("Ideally this week");
  });

  test("malformed AI JSON → template fallback grounded in evidence", async () => {
    const t = setup();
    await seed(t, 6);
    mockOpenAI("Sure! I'd suggest Amy {not json");
    const res = await t.action(api.ai.coach, { deviceId: "dev_owner", wishText: "Someone to jam on drums with" });
    expect(res.ready).toBe(true);
    if (!res.ready) return;
    expect(res.suggestions.length).toBeGreaterThan(0);
    expect(res.suggestions[0].name).toBe("Amy");
    expect(res.suggestions[0].why).toContain("music");
    expect(JSON.stringify(res)).not.toContain("Secret Sam");
  });

  test("OpenAI HTTP error → fallback, never throws", async () => {
    const t = setup();
    await seed(t, 6);
    vi.stubEnv("OPENAI_API_KEY", "sk_test");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    const res = await t.action(api.ai.coach, { deviceId: "dev_owner", wishText: "band drums" });
    expect(res.ready && res.suggestions.map((s) => s.name)).toEqual(["Amy", "Raj"]);
  });

  test("wishId: creator can coach on it, a stranger gets Not your wish", async () => {
    const t = setup();
    const { wishId } = await seed(t, 6);
    const res = await t.action(api.ai.coach, { deviceId: "dev_owner", wishId });
    expect(res.ready && res.suggestions[0].name).toBe("Amy");
    await expect(t.action(api.ai.coach, { deviceId: "dev_stranger", wishId })).rejects.toThrow(/Not your wish/);
  });

  test("askTheWell keeps its shape and uses the ranking", async () => {
    const t = setup();
    await seed(t, 6);
    const res = await t.action(api.ai.askTheWell, { deviceId: "dev_owner", text: "Someone who knows Tokyo food" });
    expect(res?.name).toBe("Ken");
    expect(typeof res?.reason).toBe("string");
    expect(await t.action(api.ai.askTheWell, { deviceId: "dev_nobody", text: "anything" })).toBeNull();
  });
});

describe("ai.coach review follow-ups", () => {
  test("rate-limited: no paid Supermemory/OpenAI call, still ready with grounded fallback", async () => {
    const t = setup();
    await seed(t, 6);
    vi.stubEnv("SUPERMEMORY_API_KEY", "sm_test");
    vi.stubEnv("OPENAI_API_KEY", "sk_test");
    const fetchMock = vi.fn(async (url: string | URL) =>
      String(url).includes("supermemory")
        ? new Response(JSON.stringify({ results: [] }), { status: 200 })
        : new Response(JSON.stringify({ output: [{ content: [{ type: "output_text", text: "{}" }] }] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    for (let i = 0; i < 20; i++) await t.action(api.ai.coach, { deviceId: "dev_owner", wishText: "drums" });
    const before = fetchMock.mock.calls.length;
    const res = await t.action(api.ai.coach, { deviceId: "dev_owner", wishText: "drums" });
    expect(fetchMock.mock.calls.length).toBe(before);
    expect(res.ready).toBe(true);
    if (res.ready) expect(res.suggestions.length).toBeGreaterThan(0);
  });

  test("a hop holder (not the creator) may coach on the wish by id", async () => {
    const t = setup();
    const { wishId, stranger } = await seed(t, 6);
    await t.run((ctx) => ctx.db.insert("hops", { wishId, depth: 2, holderName: "Olga", holderUserId: stranger, recipientTags: [], viaGroup: false }));
    const res = await t.action(api.ai.coach, { deviceId: "dev_stranger", wishId });
    expect(res.ready).toBe(false); // Olga has < threshold edges, but access is allowed (no throw)
  });

  test("turns are capped to the last COACH_TURNS_MAX before reaching the model", async () => {
    const t = setup();
    await seed(t, 6);
    const fetchMock = mockOpenAI(JSON.stringify({ message: "ok?", suggestions: [] }));
    const turns = Array.from({ length: 10 }, (_, i) => ({ role: "user" as const, text: `turn-${i}` }));
    await t.action(api.ai.coach, { deviceId: "dev_owner", wishText: "drums", turns });
    const body = String((fetchMock.mock.calls.at(-1) as unknown[])[1] && ((fetchMock.mock.calls.at(-1) as any)[1].body));
    expect(body).toContain("turn-9");
    expect(body).toContain("turn-4");
    expect(body).not.toContain("turn-3");
  });
});
