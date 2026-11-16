/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { DRAFT_REMINDER_MS, DRAFT_REMINDER_TEXT } from "./link";
import { deliver } from "./notify";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const TWILIO = { TWILIO_ACCOUNT_SID: "AC123", TWILIO_AUTH_TOKEN: "tok", TWILIO_MESSAGING_FROM: "+15550001111" };

type Sent = { To: string; From: string; Body: string };

function mockTwilio() {
  const sent: Sent[] = [];
  const fetchMock = vi.fn(async (_url: string | URL, init?: RequestInit) => {
    const form = new URLSearchParams(String(init?.body));
    sent.push({ To: form.get("To")!, From: form.get("From")!, Body: form.get("Body")! });
    return Response.json({ sid: "SM1" }, { status: 201 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, sent };
}

beforeEach(() => {
  for (const [k, val] of Object.entries(TWILIO)) vi.stubEnv(k, val);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("notify.deliver", () => {
  test("posts to the Twilio Messages API when configured", async () => {
    const { fetchMock, sent } = mockTwilio();
    const r = await deliver({ to: "+14155550123", kind: "landed", text: "hi", link: "https://x.y/l/1" }, TWILIO);
    expect(r).toEqual({ channel: "twilio", ok: true });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json");
    expect((init.headers as Record<string, string>).Authorization).toBe(`Basic ${btoa("AC123:tok")}`);
    expect(sent[0]).toEqual({ To: "+14155550123", From: "+15550001111", Body: "hi https://x.y/l/1" });
  });

  test("logs instead of sending for emails or when Twilio is not configured", async () => {
    const { fetchMock } = mockTwilio();
    expect(await deliver({ to: "a@b.co", kind: "ending", text: "x" }, TWILIO)).toEqual({ channel: "log", ok: true });
    expect(await deliver({ to: "+14155550123", kind: "ending", text: "x" }, {})).toEqual({ channel: "log", ok: true });
    expect(fetchMock).not.toHaveBeenCalled();
    const logged = (console.log as unknown as { mock: { calls: string[][] } }).mock.calls.map((c) => c[0]).join("\n");
    expect(logged).toContain("***0123");
    expect(logged).not.toContain("+14155550123");
  });

  test("never throws on network errors or Twilio failures", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("boom"); }));
    expect(await deliver({ to: "+14155550123", kind: "landed", text: "x" }, TWILIO)).toEqual({ channel: "twilio", ok: false });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("bad", { status: 400 })));
    expect(await deliver({ to: "+14155550123", kind: "landed", text: "x" }, TWILIO)).toEqual({ channel: "twilio", ok: false });
  });
});

async function setup(t: TestConvex<typeof schema>) {
  await t.mutation(api.users.ensure, { deviceId: "dev_mia" });
  await t.mutation(api.users.updateProfile, { deviceId: "dev_mia", name: "Mia", city: "SF" });
  await t.mutation(api.users.ensure, { deviceId: "dev_bob" });
  return await t.run(async (ctx) => {
    const mia = (await ctx.db.query("users").withIndex("by_deviceId", (q) => q.eq("deviceId", "dev_mia")).unique())!;
    const bob = (await ctx.db.query("users").withIndex("by_deviceId", (q) => q.eq("deviceId", "dev_bob")).unique())!;
    await ctx.db.patch("users", mia._id, { phone: "+14155550100" });
    const wishId = await ctx.db.insert("wishes", {
      creatorId: mia._id, type: "do_together", text: "find my hiking buddy", status: "traveling",
      expiresAt: Date.now() + 1e8,
    });
    const hopId = await ctx.db.insert("hops", {
      wishId, depth: 1, holderName: "Bob", holderUserId: bob._id, recipientTags: [], viaGroup: false,
      action: "its_me", claimPhone: "+14155550199", claimVerified: true,
    });
    return { miaId: mia._id, bobId: bob._id, wishId, hopId };
  });
}

describe("link.confirmClaim", () => {
  test("only the wish creator can confirm", async () => {
    const t = convexTest(schema, modules);
    const { hopId } = await setup(t);
    await expect(t.mutation(api.link.confirmClaim, { hopId, deviceId: "dev_bob" })).rejects.toThrow(
      "Only the wisher can confirm this claim",
    );
  });

  test("requires a verified its_me claim", async () => {
    const t = convexTest(schema, modules);
    const { hopId } = await setup(t);
    await t.run(async (ctx) => ctx.db.patch("hops", hopId, { claimVerified: false }));
    await expect(t.mutation(api.link.confirmClaim, { hopId, deviceId: "dev_mia" })).rejects.toThrow(
      "This claim isn't verified yet",
    );
  });

  test("marks the wish found, returns the claimer's phone to the creator, and texts no numbers", async () => {
    vi.useFakeTimers();
    const { sent } = mockTwilio();
    const t = convexTest(schema, modules);
    const { hopId, wishId } = await setup(t);
    const r = await t.mutation(api.link.confirmClaim, { hopId, deviceId: "dev_mia" });
    expect(r).toEqual({ claimerName: "Bob", claimerPhone: "+14155550199" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const wish = await t.run(async (ctx) => ctx.db.get("wishes", wishId));
    expect(wish).toMatchObject({ status: "found", winningHopId: hopId });

    const toBob = sent.find((s) => s.To === "+14155550199")!;
    expect(toBob.Body).toContain("Mia confirmed — it's you!");
    for (const s of sent) {
      expect(s.Body).not.toContain("+14155550100");
      expect(s.Body).not.toContain("+14155550199");
      expect(s.Body).not.toMatch(/number/i);
    }

    const again = await t.mutation(api.link.confirmClaim, { hopId, deviceId: "dev_mia" });
    expect(again.claimerPhone).toBe("+14155550199");
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(sent).toHaveLength(2);
  });

  test("a stranger device is rejected and gets no phone", async () => {
    const t = convexTest(schema, modules);
    const { hopId } = await setup(t);
    await t.mutation(api.users.ensure, { deviceId: "dev_eve" });
    await expect(t.mutation(api.link.confirmClaim, { hopId, deviceId: "dev_eve" })).rejects.toThrow(
      "Only the wisher can confirm this claim",
    );
    await expect(t.mutation(api.link.confirmClaim, { hopId, deviceId: "dev_unknown" })).rejects.toThrow(
      "Only the wisher can confirm this claim",
    );
  });
});

describe("link.pendingClaims", () => {
  test("lists only the caller's verified claims and never includes a phone", async () => {
    const t = convexTest(schema, modules);
    const { hopId, wishId, bobId } = await setup(t);
    await t.run(async (ctx) => {
      await ctx.db.patch("hops", hopId, { itsMeIntro: "I hike every weekend", claimAnswers: ["Mt Tam"], actedAt: 5 });
      // Unverified claim on the same wish: not listed.
      await ctx.db.insert("hops", {
        wishId, depth: 1, holderName: "Zed", recipientTags: [], viaGroup: false, action: "its_me", claimPhone: "+14155550111",
      });
      // Bob's own wish with a verified claim: not Mia's.
      const other = await ctx.db.insert("wishes", {
        creatorId: bobId, type: "do_together", text: "bob's wish", status: "traveling", expiresAt: Date.now() + 1e8,
      });
      await ctx.db.insert("hops", {
        wishId: other, depth: 1, holderName: "Kay", recipientTags: [], viaGroup: false,
        action: "its_me", claimPhone: "+14155550122", claimVerified: true,
      });
    });
    const mia = await t.query(api.link.pendingClaims, { deviceId: "dev_mia" });
    expect(mia).toEqual([
      { hopId, wishId, wishText: "find my hiking buddy", claimerName: "Bob", intro: "I hike every weekend", answers: ["Mt Tam"], claimedAt: 5 },
    ]);
    expect(JSON.stringify(mia)).not.toMatch(/\+1415/);
    const bob = await t.query(api.link.pendingClaims, { deviceId: "dev_bob" });
    expect(bob.map((c) => c.claimerName)).toEqual(["Kay"]);
    expect(JSON.stringify(bob)).not.toMatch(/\+1415/);
    expect(await t.query(api.link.pendingClaims, { deviceId: "dev_nobody" })).toEqual([]);

    await t.mutation(api.link.confirmClaim, { hopId, deviceId: "dev_mia" });
    expect(await t.query(api.link.pendingClaims, { deviceId: "dev_mia" })).toEqual([]);
  });
});

describe("link.saveDraft reminder", () => {
  test("reminds once after 24h when the visitor still has no free wish", async () => {
    vi.useFakeTimers();
    const { sent } = mockTwilio();
    const t = convexTest(schema, modules);
    await t.mutation(api.users.ensure, { deviceId: "dev_ann" });
    await t.mutation(api.link.saveDraft, { deviceId: "dev_ann", contact: "+1 415 555 0177", wishText: "a coffee" });
    await t.mutation(api.link.saveDraft, { deviceId: "dev_ann", contact: "+14155550177", wishText: "a coffee chat" });
    const rows = await t.run(async (ctx) => ctx.db.query("linkVisitors").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ contactKey: "+14155550177", contactKind: "phone", draftText: "a coffee chat" });

    vi.advanceTimersByTime(DRAFT_REMINDER_MS - 1000);
    await t.finishInProgressScheduledFunctions();
    expect(sent).toHaveLength(0);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(sent).toEqual([{ To: "+14155550177", From: "+15550001111", Body: DRAFT_REMINDER_TEXT }]);
  });

  test("no reminder when the visitor finished in between", async () => {
    vi.useFakeTimers();
    const { sent } = mockTwilio();
    const t = convexTest(schema, modules);
    const { wishId } = await setup(t);
    await t.mutation(api.users.ensure, { deviceId: "dev_ann" });
    await t.mutation(api.link.saveDraft, { deviceId: "dev_ann", contact: "Ann@Example.com", wishText: "a coffee" });
    await t.run(async (ctx) => {
      const row = (await ctx.db.query("linkVisitors").withIndex("by_contactKey", (q) => q.eq("contactKey", "ann@example.com")).unique())!;
      await ctx.db.patch("linkVisitors", row._id, { freeWishId: wishId as Id<"wishes"> });
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(sent).toHaveLength(0);
  });

  test("without a contact and no visitor row it is a no-op", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.users.ensure, { deviceId: "dev_ann" });
    await t.mutation(api.link.saveDraft, { deviceId: "dev_ann", wishText: "a coffee" });
    expect(await t.run(async (ctx) => ctx.db.query("linkVisitors").collect())).toHaveLength(0);
  });
});

describe("link.notifyLanded", () => {
  test("a verified claim from the link page texts the pusher", async () => {
    vi.useFakeTimers();
    vi.stubEnv("DEMO_PHONE_NUMBERS", "+15555550100");
    vi.stubEnv("DEMO_PHONE_CODE", "");
    const { sent } = mockTwilio();
    const t = convexTest(schema, modules);
    const { hopId } = await setup(t);
    await t.run(async (ctx) => ctx.db.patch("hops", hopId, { action: undefined, claimPhone: undefined, claimVerified: undefined }));
    await t.mutation(api.link.claim, {
      hopId, deviceId: "dev_bob", intro: "It's me", answers: ["yes"], phone: "+15555550100", code: "000000",
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(sent.map((m) => m.To)).toEqual(["+14155550100"]);
    expect(sent[0].Body).toContain("landed");
  });

  test("texts the pusher (wish creator at depth 1)", async () => {
    vi.useFakeTimers();
    const { sent } = mockTwilio();
    const t = convexTest(schema, modules);
    const { hopId } = await setup(t);
    await t.mutation(internal.link.notifyLanded, { hopId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(sent).toHaveLength(1);
    expect(sent[0].To).toBe("+14155550100");
    expect(sent[0].Body).toContain("Bob");
  });
});
