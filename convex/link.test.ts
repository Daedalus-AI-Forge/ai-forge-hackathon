/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { BOATS_PER_COIN } from "./lib";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

beforeEach(() => {
  vi.stubEnv("SUPERMEMORY_API_KEY", "");
  vi.stubEnv("OPENAI_API_KEY", "");
});

const makeT = () => convexTest(schema, modules);
type T = ReturnType<typeof makeT>;

async function player(t: T, deviceId: string, name: string, city: string) {
  await t.mutation(api.users.ensure, { deviceId });
  await t.mutation(api.users.updateProfile, { deviceId, name, city });
}

/** Louise wishes -> Amy (depth 1, in the app) -> Ben (depth 2, the link visitor's hop). */
async function boatToBen(t: T) {
  await player(t, "dev_louise", "Louise", "SF");
  await player(t, "dev_amy", "Amy", "New York");
  const { wishId, hopIds } = await t.mutation(api.wishes.toss, {
    deviceId: "dev_louise",
    type: "do_together",
    text: "Meet someone who went from pre-med to design",
    name: "Louise",
    city: "SF",
    mode: "serious",
    recipients: [{ name: "Amy", reason: "Knows designers", tags: [] }],
  });
  const amyHop = hopIds[0];
  await t.run(async (ctx) => {
    const amy = await ctx.db.query("users").withIndex("by_deviceId", (q) => q.eq("deviceId", "dev_amy")).unique();
    await ctx.db.patch("hops", amyHop, { holderUserId: amy!._id });
  });
  await t.mutation(api.hops.act, { hopId: amyHop, action: "pass", name: "Amy", city: "New York", vouch: "Louise is lovely.", tags: [] });
  const benHop = await t.mutation(api.hops.passTo, { parentHopId: amyHop, name: "Ben", reason: "Lots of design friends", tags: [] });
  await t.run(async (ctx) => ctx.db.patch("hops", benHop, { introVouch: "Ben knows every designer in town." }));
  return { wishId, amyHop, benHop };
}

const push = { name: "Cara", relation: "coworker", reason: "Switched to design", vouch: "Cara made the jump herself." };

describe("firstScreen", () => {
  test("open state shows sender, vouch, boat and chain", async () => {
    const t = convexTest(schema, modules);
    const { benHop, wishId } = await boatToBen(t);
    const s = await t.query(api.link.firstScreen, { hopId: benHop, deviceId: "dev_ben" });
    expect(s).toMatchObject({
      state: "open",
      hopId: benHop,
      wishId,
      senderName: "Amy",
      vouchForMe: "Ben knows every designer in town.",
      holderName: "Ben",
      boat: { kind: "real", creatorName: "Louise", mode: "serious" },
      chain: [{ name: "Amy", city: "New York", vouch: "Louise is lovely." }],
      ripples: 2,
      freeWishAvailable: true,
      handled: null,
    });
  });

  test("missing for a bad or unknown id", async () => {
    const t = convexTest(schema, modules);
    const s = await t.query(api.link.firstScreen, { hopId: "nope" });
    expect(s?.state).toBe("missing");
  });

  test("forwarded when the hop is bound to another device", async () => {
    const t = convexTest(schema, modules);
    const { benHop } = await boatToBen(t);
    await t.mutation(api.link.open, { hopId: benHop, deviceId: "dev_ben" });
    await t.mutation(api.link.open, { hopId: benHop, deviceId: "dev_other" }); // does not rebind
    expect((await t.query(api.link.firstScreen, { hopId: benHop, deviceId: "dev_other" }))?.state).toBe("forwarded");
    expect((await t.query(api.link.firstScreen, { hopId: benHop, deviceId: "dev_ben" }))?.state).toBe("open");
  });

  test("expired after 48h", async () => {
    const t = convexTest(schema, modules);
    const { benHop, wishId } = await boatToBen(t);
    await t.run(async (ctx) => ctx.db.patch("wishes", wishId, { expiresAt: Date.now() - 1 }));
    expect((await t.query(api.link.firstScreen, { hopId: benHop, deviceId: "dev_ben" }))?.state).toBe("expired");
  });

  test("claimed when someone else already found it", async () => {
    const t = convexTest(schema, modules);
    const { benHop, wishId } = await boatToBen(t);
    await t.run(async (ctx) => ctx.db.patch("wishes", wishId, { status: "found" }));
    expect((await t.query(api.link.firstScreen, { hopId: benHop, deviceId: "dev_ben" }))?.state).toBe("claimed");
  });

  test("handled after this visitor pushed it; shows where it is now", async () => {
    const t = convexTest(schema, modules);
    const { benHop } = await boatToBen(t);
    await t.mutation(api.link.open, { hopId: benHop, deviceId: "dev_ben" });
    await t.mutation(api.link.pushOne, { hopId: benHop, deviceId: "dev_ben", ...push });
    const s = await t.query(api.link.firstScreen, { hopId: benHop, deviceId: "dev_ben" });
    expect(s).toMatchObject({ state: "handled", handled: { action: "push", nowRipples: 3, lastCity: "New York" } });
  });

  test("handled push lets the pusher resend: child hop, recipient name and vouch, only to that device", async () => {
    const t = convexTest(schema, modules);
    const { benHop } = await boatToBen(t);
    await t.mutation(api.link.open, { hopId: benHop, deviceId: "dev_ben" });
    const { childHopId } = await t.mutation(api.link.pushOne, { hopId: benHop, deviceId: "dev_ben", ...push });
    const mine = await t.query(api.link.firstScreen, { hopId: benHop, deviceId: "dev_ben" });
    expect(mine?.handled).toMatchObject({ action: "push", childHopId, childName: "Cara", vouch: push.vouch });
    const other = await t.query(api.link.firstScreen, { hopId: benHop, deviceId: "dev_stranger" });
    expect(other?.state).toBe("forwarded");
    expect(other?.handled).toBeNull();
    const anon = await t.query(api.link.firstScreen, { hopId: benHop });
    expect(anon?.handled).toBeNull();
  });
});

describe("pushOne", () => {
  test("writes one child hop with vouch/relation, marks the parent, counts progress, records the edge", async () => {
    const t = convexTest(schema, modules);
    const { benHop } = await boatToBen(t);
    const { childHopId } = await t.mutation(api.link.pushOne, { hopId: benHop, deviceId: "dev_ben", ...push, contact: "+1 555 555 0100" });
    const data = await t.run(async (ctx) => {
      const child = await ctx.db.get("hops", childHopId as Id<"hops">);
      const parent = await ctx.db.get("hops", benHop);
      const ben = await ctx.db.query("users").withIndex("by_deviceId", (q) => q.eq("deviceId", "dev_ben")).unique();
      const edges = await ctx.db.query("edges").withIndex("by_ownerUserId", (q) => q.eq("ownerUserId", ben!._id)).collect();
      return { child, parent, ben, edges };
    });
    expect(data.child).toMatchObject({ parentHopId: benHop, depth: 3, holderName: "Cara", introVouch: push.vouch, relation: "coworker" });
    expect(data.parent).toMatchObject({ action: "pass", holderUserId: data.ben!._id });
    expect(data.parent?.actedAt).toBeTypeOf("number");
    expect(data.ben?.boatProgress).toBe(1);
    expect(data.edges).toMatchObject([{ personName: "Cara", reason: "Switched to design", ownerName: "Ben" }]);
  });

  test("rejects a second push on the same link", async () => {
    const t = convexTest(schema, modules);
    const { benHop } = await boatToBen(t);
    await t.mutation(api.link.pushOne, { hopId: benHop, deviceId: "dev_ben", ...push });
    await expect(t.mutation(api.link.pushOne, { hopId: benHop, deviceId: "dev_ben", ...push, name: "Dan" })).rejects.toThrow();
    const kids = await t.run(async (ctx) => ctx.db.query("hops").withIndex("by_parentHopId", (q) => q.eq("parentHopId", benHop)).collect());
    expect(kids).toHaveLength(1);
  });

  test.each(["ben", "  AMY ", "louise"])("rejects self/upstream name %j", async (name) => {
    const t = convexTest(schema, modules);
    const { benHop } = await boatToBen(t);
    await expect(t.mutation(api.link.pushOne, { hopId: benHop, deviceId: "dev_ben", ...push, name })).rejects.toThrow(
      "Pick someone else — this boat already passed through them",
    );
  });

  test("another device cannot push a link bound to someone else", async () => {
    const t = convexTest(schema, modules);
    const { benHop } = await boatToBen(t);
    await t.mutation(api.link.open, { hopId: benHop, deviceId: "dev_ben" });
    await expect(t.mutation(api.link.pushOne, { hopId: benHop, deviceId: "dev_other", ...push })).rejects.toThrow();
  });

  test("the fifth boat earns a coin", async () => {
    const t = convexTest(schema, modules);
    const { benHop } = await boatToBen(t);
    await t.mutation(api.link.open, { hopId: benHop, deviceId: "dev_ben" });
    await t.run(async (ctx) => {
      const ben = await ctx.db.query("users").withIndex("by_deviceId", (q) => q.eq("deviceId", "dev_ben")).unique();
      await ctx.db.patch("users", ben!._id, { boatProgress: BOATS_PER_COIN - 1, wishesLeft: 0 });
    });
    await t.mutation(api.link.pushOne, { hopId: benHop, deviceId: "dev_ben", ...push });
    const r = await t.mutation(api.link.finish, { hopId: benHop, deviceId: "dev_ben", contact: "ben@example.com" });
    expect(r).toMatchObject({ boatProgress: 0, boatsPerCoin: BOATS_PER_COIN, wishesLeft: 1 });
  });
});

describe("finish", () => {
  test("requires a contact", async () => {
    const t = convexTest(schema, modules);
    const { benHop } = await boatToBen(t);
    await expect(t.mutation(api.link.finish, { hopId: benHop, deviceId: "dev_ben", contact: "  " })).rejects.toThrow(
      "Leave a phone number or email",
    );
  });

  test("creates exactly one free wish per contact, sailing to the sender", async () => {
    const t = convexTest(schema, modules);
    const { benHop } = await boatToBen(t);
    await t.mutation(api.link.open, { hopId: benHop, deviceId: "dev_ben" });
    await t.mutation(api.link.pushOne, { hopId: benHop, deviceId: "dev_ben", ...push });
    const first = await t.mutation(api.link.finish, { hopId: benHop, deviceId: "dev_ben", contact: "Ben@Example.com", wishText: "Find a climbing buddy" });
    expect(first).toMatchObject({ freeWishUsed: false, boatProgress: 1, boatsPerCoin: BOATS_PER_COIN });
    expect(first.wishId).toBeTruthy();
    const hops = await t.run(async (ctx) => ({
      wish: await ctx.db.get("wishes", first.wishId as Id<"wishes">),
      hops: await ctx.db.query("hops").withIndex("by_wishId", (q) => q.eq("wishId", first.wishId as Id<"wishes">)).collect(),
      amy: await ctx.db.query("users").withIndex("by_deviceId", (q) => q.eq("deviceId", "dev_amy")).unique(),
    }));
    expect(hops.wish).toMatchObject({ text: "Find a climbing buddy", mode: "serious", status: "traveling" });
    expect(hops.hops).toMatchObject([{ depth: 1, holderName: "Amy", holderUserId: hops.amy!._id }]);

    // Refresh / other device, same contact in a different case -> no second wish.
    const again = await t.mutation(api.link.finish, { hopId: benHop, deviceId: "dev_ben2", contact: "  ben@EXAMPLE.com ", wishText: "Another" });
    expect(again).toMatchObject({ freeWishUsed: true, wishId: null });
    const count = await t.run(async (ctx) => (await ctx.db.query("wishes").collect()).length);
    expect(count).toBe(2);
    const visitors = await t.run(async (ctx) => ctx.db.query("linkVisitors").collect());
    expect(visitors).toMatchObject([{ contactKey: "ben@example.com", contactKind: "email" }]);
    expect((await t.query(api.link.firstScreen, { hopId: benHop, deviceId: "dev_ben" }))?.freeWishAvailable).toBe(false);
  });

  test("normalizes phones so spaces don't defeat dedupe", async () => {
    vi.stubEnv("DEMO_PHONE_NUMBERS", "+15555550100");
    const t = convexTest(schema, modules);
    const { benHop } = await boatToBen(t);
    const a = await t.mutation(api.link.finish, { hopId: benHop, deviceId: "dev_ben", contact: "+1 555 555 0100", wishText: "One" });
    const b = await t.mutation(api.link.finish, { hopId: benHop, deviceId: "dev_x", contact: "+15555550100", wishText: "Two" });
    expect(a.freeWishUsed).toBe(false);
    expect(b).toMatchObject({ freeWishUsed: true, wishId: null });
    const visitors = await t.run(async (ctx) => ctx.db.query("linkVisitors").collect());
    expect(visitors).toMatchObject([{ contactKey: "+15555550100", contactKind: "phone" }]);
  });

  test("a first-hop visitor's free wish goes to the wish creator", async () => {
    const t = convexTest(schema, modules);
    const { amyHop } = await boatToBen(t);
    const r = await t.mutation(api.link.finish, { hopId: amyHop, deviceId: "dev_z", contact: "z@example.com", wishText: "Hi" });
    const hops = await t.run(async (ctx) => ctx.db.query("hops").withIndex("by_wishId", (q) => q.eq("wishId", r.wishId as Id<"wishes">)).collect());
    expect(hops).toMatchObject([{ holderName: "Louise" }]);
  });

  test("skipping the wish saves the contact without creating a wish", async () => {
    const t = convexTest(schema, modules);
    const { benHop } = await boatToBen(t);
    const r = await t.mutation(api.link.finish, { hopId: benHop, deviceId: "dev_ben", contact: "ben@example.com" });
    expect(r).toMatchObject({ freeWishUsed: false, wishId: null });
    expect((await t.query(api.link.firstScreen, { hopId: benHop, deviceId: "dev_ben" }))?.freeWishAvailable).toBe(true);
  });
});
