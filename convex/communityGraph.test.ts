/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

function addUser(ctx: MutationCtx, name: string, extra: Pick<Doc<"users">, "deviceId" | "showInLogs" | "demoKey"> = {}) {
  return ctx.db.insert("users", { name, avatar: "#000", city: "SF", wishesLeft: 1, stars: 0, ...extra });
}

function addWish(ctx: MutationCtx, creatorId: Id<"users">) {
  return ctx.db.insert("wishes", {
    creatorId,
    type: "do_together",
    text: "Someone to jam with.",
    status: "traveling",
    expiresAt: Date.now() + 3_600_000,
  });
}

function addHop(
  ctx: MutationCtx,
  wishId: Id<"wishes">,
  holderName: string,
  details: Partial<Pick<Doc<"hops">, "depth" | "holderUserId" | "parentHopId" | "itsMePublic">> = {},
) {
  return ctx.db.insert("hops", {
    wishId,
    depth: 1,
    holderName,
    recipientTags: ["Private hop tag"],
    holderContact: "private-hop-contact@example.com",
    viaGroup: false,
    ...details,
  });
}

function addEdge(
  ctx: MutationCtx,
  ownerUserId: Id<"users">,
  wishId: Id<"wishes">,
  hopId: Id<"hops">,
  personName: string,
) {
  return ctx.db.insert("edges", {
    ownerUserId,
    ownerName: "Private owner name",
    personName,
    tag: "Private edge tag",
    reason: "Private edge reason",
    contact: "private-edge-contact@example.com",
    source: "pick",
    wishId,
    hopId,
  });
}

function userKey(id: Id<"users">) {
  return `user:${id}`;
}

function pair(left: string, right: string) {
  return [left, right].sort();
}

describe("graph.communityNetwork", () => {
  test("returns null for an unknown device and prefers the signed-in viewer", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.graph.communityNetwork, { deviceId: "unknown_device" })).toBeNull();

    const { anon, signedIn, sessionId } = await t.run(async (ctx) => {
      const anon = await addUser(ctx, "Device user", { deviceId: "device_user" });
      const signedIn = await addUser(ctx, "Signed in user");
      const sessionId = await ctx.db.insert("authSessions", { userId: signedIn, expirationTime: Date.now() + 60_000 });
      const wish = await addWish(ctx, anon);
      const hop = await addHop(ctx, wish, "Device user's private contact");
      await addEdge(ctx, anon, wish, hop, "Device user's private contact");
      return { anon, signedIn, sessionId };
    });
    const anonNetwork = await t.query(api.graph.communityNetwork, { deviceId: "device_user" });
    expect(anonNetwork?.meKey).toEqual(userKey(anon));
    expect(anonNetwork?.links).toHaveLength(1);

    const network = await t.withIdentity({ subject: `${signedIn}|${sessionId}` })
      .query(api.graph.communityNetwork, { deviceId: "device_user" });
    expect(network?.meKey).toEqual(userKey(signedIn));
    expect(network?.nodes).toHaveLength(2);
    expect(network?.links).toEqual([]);
  });

  test("excludes the daily well service account and includes disconnected people", async () => {
    const t = convexTest(schema, modules);
    const { viewer, person } = await t.run(async (ctx) => {
      const viewer = await addUser(ctx, "Viewer", { deviceId: "viewer_device" });
      const person = await addUser(ctx, "The well");
      await addUser(ctx, "The well", { demoKey: "well", deviceId: "service_device" });
      return { viewer, person };
    });

    const graph = await t.query(api.graph.communityNetwork, { deviceId: "viewer_device" });
    expect(graph?.nodes.map(({ key }) => key)).toEqual([userKey(viewer), userKey(person)]);
    expect(graph?.links).toEqual([]);
    expect(await t.query(api.graph.communityNetwork, { deviceId: "service_device" })).toBeNull();
  });

  test("preserves multiple real hop distances, same-name accounts, and disconnected users", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const viewer = await addUser(ctx, "Viewer", { deviceId: "viewer_device" });
      const alex1 = await addUser(ctx, "Alex");
      const alex2 = await addUser(ctx, "Alex");
      const tail = await addUser(ctx, "Tail");
      const isolated = await addUser(ctx, "Isolated");
      const remote1 = await addUser(ctx, "Remote One");
      const remote2 = await addUser(ctx, "Remote Two");
      const wish = await addWish(ctx, viewer);
      const origin = await addHop(ctx, wish, "Historic sender name", { holderUserId: viewer });
      const one = await addHop(ctx, wish, "Historic recipient name", { holderUserId: alex1, parentHopId: origin, depth: 2 });
      const two = await addHop(ctx, wish, "Alex", { holderUserId: alex2, parentHopId: one, depth: 3 });
      await addHop(ctx, wish, "Tail", { holderUserId: tail, parentHopId: two, depth: 4 });
      await addHop(ctx, wish, "Alex", { holderUserId: alex1, parentHopId: two, depth: 4 });
      await addHop(ctx, wish, "Viewer", { holderUserId: viewer, parentHopId: origin, depth: 2 });
      const remoteWish = await addWish(ctx, remote1);
      const remoteParent = await addHop(ctx, remoteWish, "Remote One", { holderUserId: remote1 });
      await addHop(ctx, remoteWish, "Remote Two", { holderUserId: remote2, parentHopId: remoteParent, depth: 2 });
      return { viewer, alex1, alex2, tail, isolated, remote1, remote2 };
    });

    const network = await t.query(api.graph.communityNetwork, { deviceId: "viewer_device" });
    expect(network?.truncated).toBe(false);
    expect(network?.nodes.map((node) => node.key)).toEqual(expect.arrayContaining(Object.values(ids).map(userKey)));
    expect(network?.nodes).toHaveLength(7);
    expect(network?.nodes.filter(({ name }) => name === "Alex")).toHaveLength(2);
    expect(network?.nodes.every(({ personKeys, edgeIds, kind }) =>
      personKeys.length === 0 && edgeIds.length === 0 && kind === "user",
    )).toBe(true);
    const expectedPairs = [
      pair(userKey(ids.viewer), userKey(ids.alex1)),
      pair(userKey(ids.alex1), userKey(ids.alex2)),
      pair(userKey(ids.alex2), userKey(ids.tail)),
      pair(userKey(ids.remote1), userKey(ids.remote2)),
    ];
    expect(network?.links).toHaveLength(expectedPairs.length);
    expect(network?.links.map(({ source, target }) => pair(source, target)))
      .toEqual(expect.arrayContaining(expectedPairs));
    expect(new Set(network?.links.map(({ key }) => key)).size).toBe(expectedPairs.length);
  });

  test("connects a claimed first recipient to the wish creator and follows later hops", async () => {
    const t = convexTest(schema, modules);
    const { sender, first, next } = await t.run(async (ctx) => {
      const sender = await addUser(ctx, "Sender");
      const first = await addUser(ctx, "First", { deviceId: "first_device" });
      const next = await addUser(ctx, "Next");
      const observer = await addUser(ctx, "Observer", { deviceId: "observer_device" });
      const hidden = await addUser(ctx, "Hidden sender", { showInLogs: false });
      const wish = await addWish(ctx, sender);
      const root = await addHop(ctx, wish, "First", { holderUserId: first });
      await addHop(ctx, wish, "Next", { holderUserId: next, parentHopId: root, depth: 2 });
      await addHop(ctx, wish, "Private observer", { holderUserId: observer, itsMePublic: false });
      await addHop(ctx, wish, "Not a first recipient", { holderUserId: observer, depth: 2 });
      const hiddenWish = await addWish(ctx, hidden);
      await addHop(ctx, hiddenWish, "Next", { holderUserId: next });
      const missingWish = await addWish(ctx, sender);
      await addHop(ctx, missingWish, "Observer", { holderUserId: observer });
      await ctx.db.delete("wishes", missingWish);
      const dailyWish = await addWish(ctx, sender);
      await ctx.db.patch("wishes", dailyWish, { daily: { date: "2026-11-15", steps: [], reasoning: "Daily" } });
      await addHop(ctx, dailyWish, "Observer", { holderUserId: observer });
      return { sender, first, next };
    });

    const expectedPairs = [pair(userKey(sender), userKey(first)), pair(userKey(first), userKey(next))];
    for (const deviceId of ["first_device", "observer_device"]) {
      const network = await t.query(api.graph.communityNetwork, { deviceId });
      expect(network?.links).toHaveLength(expectedPairs.length);
      expect(network?.links.map(({ source, target }) => pair(source, target)))
        .toEqual(expect.arrayContaining(expectedPairs));
    }
  });

  test("omits opted-out identities and either private hop endpoint while keeping private saves with their owner", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const viewer = await addUser(ctx, "Viewer", { deviceId: "viewer_device", showInLogs: false });
      const observer = await addUser(ctx, "Observer", { deviceId: "observer_device" });
      const hidden = await addUser(ctx, "Hidden account name", { showInLogs: false });
      const privateChild = await addUser(ctx, "Private child profile");
      const publicChild = await addUser(ctx, "Public child profile");
      const wish = await addWish(ctx, viewer);
      const parent = await addHop(ctx, wish, "Viewer", { holderUserId: viewer });
      const hiddenHop = await addHop(ctx, wish, "Hidden holder name", { holderUserId: hidden, parentHopId: parent });
      const privateHop = await addHop(ctx, wish, "Private holder name", {
        holderUserId: privateChild, parentHopId: parent, itsMePublic: false,
      });
      const publicHop = await addHop(ctx, wish, "Public holder name", { holderUserId: publicChild, parentHopId: privateHop });
      await addHop(ctx, wish, "Observer", { holderUserId: observer, parentHopId: parent });
      await addEdge(ctx, viewer, wish, hiddenHop, "My alias for hidden contact");
      await addEdge(ctx, viewer, wish, privateHop, "My private child alias");
      await addEdge(ctx, viewer, wish, publicHop, "My public child alias");
      return { viewer, observer, hidden, privateChild, publicChild };
    });

    const own = await t.query(api.graph.communityNetwork, { deviceId: "viewer_device" });
    const ownContacts = ["My alias for hidden contact", "My private child alias", "My public child alias"];
    expect(own?.nodes).toEqual(expect.arrayContaining(ownContacts.map((name) => expect.objectContaining({
      key: `contact:${name.toLowerCase()}`, name, personKeys: [name.toLowerCase()], kind: "contact",
    }))));
    expect(own?.nodes.some(({ key }) => key === userKey(ids.hidden))).toBe(false);
    expect(own?.links.map(({ source, target }) => pair(source, target))).toEqual(expect.arrayContaining([
      pair(userKey(ids.viewer), userKey(ids.observer)),
      ...ownContacts.map((name) => pair(userKey(ids.viewer), `contact:${name.toLowerCase()}`)),
    ]));
    expect(own?.links).toHaveLength(4);
    expect(JSON.stringify(own)).not.toMatch(/Hidden account name|Private holder name|Private hop tag|Private edge|private-.*@example/);

    const other = await t.query(api.graph.communityNetwork, { deviceId: "observer_device" });
    expect(other?.links).toEqual([]);
    expect(other?.nodes.map(({ key }) => key)).toEqual(expect.arrayContaining([
      userKey(ids.observer), userKey(ids.privateChild), userKey(ids.publicChild),
    ]));
    expect(other?.nodes).toHaveLength(3);
    expect(other?.nodes.every(({ personKeys, edgeIds }) => personKeys.length === 0 && edgeIds.length === 0)).toBe(true);
  });

  test("keeps every distinct own alias on one verified user and preserves unresolved names", async () => {
    const t = convexTest(schema, modules);
    const { viewer, recipient, observer } = await t.run(async (ctx) => {
      const viewer = await addUser(ctx, "Viewer", { deviceId: "viewer_device" });
      const recipient = await addUser(ctx, "Same name");
      const observer = await addUser(ctx, "Observer", { deviceId: "observer_device" });
      const wish = await addWish(ctx, viewer);
      const parent = await addHop(ctx, wish, "Viewer", { holderUserId: viewer });
      const verified = await addHop(ctx, wish, "Unrelated hop spelling", { holderUserId: recipient, parentHopId: parent });
      const unverified = await addHop(ctx, wish, "Same name", { parentHopId: parent });
      await addEdge(ctx, viewer, wish, verified, "Old alias");
      await addEdge(ctx, viewer, wish, unverified, "Same NAME");
      await addEdge(ctx, viewer, wish, verified, "Latest alias");
      await addEdge(ctx, viewer, wish, verified, "  LATEST   ALIAS  ");
      await addEdge(ctx, viewer, wish, unverified, "   SAME   name   ");
      await addEdge(ctx, viewer, wish, parent, "My own alias");
      const observerWish = await addWish(ctx, observer);
      const observerHop = await addHop(ctx, observerWish, "Same name", { holderUserId: recipient });
      await addEdge(ctx, observer, observerWish, observerHop, "Observer private alias");
      return { viewer, recipient, observer };
    });

    const net = await t.query(api.graph.communityNetwork, { deviceId: "viewer_device" });
    expect(net?.nodes).toEqual(expect.arrayContaining([
      { key: userKey(viewer), name: "Viewer", personKeys: [], kind: "user" },
      { key: userKey(recipient), name: "Same name", personKeys: ["latest alias", "old alias"], kind: "user" },
      { key: "contact:same name", name: "SAME   name", personKeys: ["same name"], kind: "contact" },
    ].map((node) => expect.objectContaining(node))));
    expect(net?.nodes).toHaveLength(4);
    expect(net?.links.map(({ source, target }) => pair(source, target))).toEqual(expect.arrayContaining([
      pair(userKey(viewer), userKey(recipient)),
      pair(userKey(viewer), "contact:same name"),
      pair(userKey(observer), userKey(recipient)),
    ]));
    expect(net?.links).toHaveLength(3);

    const other = await t.query(api.graph.communityNetwork, { deviceId: "observer_device" });
    expect(other?.nodes.find(({ key }) => key === userKey(recipient)))
      .toMatchObject({ personKeys: ["observer private alias"] });
    expect(other?.nodes.some(({ key }) => key === "contact:same name")).toBe(false);
  });

  test("associates only the viewer's exact evidence with each verified same-name user and contact", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const viewer = await addUser(ctx, "Viewer", { deviceId: "viewer_device" });
      const observer = await addUser(ctx, "Observer", { deviceId: "observer_device" });
      const alex1 = await addUser(ctx, "Alex");
      const alex2 = await addUser(ctx, "Alex");
      const wish = await addWish(ctx, viewer);
      const first = await addHop(ctx, wish, "Alex", { holderUserId: alex1 });
      const second = await addHop(ctx, wish, "Alex", { holderUserId: alex2 });
      const unresolved = await addHop(ctx, wish, "Alex");
      const firstEdge = await addEdge(ctx, viewer, wish, first, "Alex");
      const secondEdge = await addEdge(ctx, viewer, wish, second, "Alex");
      const unresolvedEdge = await addEdge(ctx, viewer, wish, unresolved, "Alex");
      const observerWish = await addWish(ctx, observer);
      const observerHop = await addHop(ctx, observerWish, "Alex", { holderUserId: alex1 });
      const observerEdge = await addEdge(ctx, observer, observerWish, observerHop, "Alex");
      return { alex1, alex2, firstEdge, secondEdge, unresolvedEdge, observerEdge };
    });

    const graph = await t.query(api.graph.communityNetwork, { deviceId: "viewer_device" });
    expect(graph?.nodes.find(({ key }) => key === userKey(ids.alex1)))
      .toMatchObject({ personKeys: ["alex"], edgeIds: [ids.firstEdge] });
    expect(graph?.nodes.find(({ key }) => key === userKey(ids.alex2)))
      .toMatchObject({ personKeys: ["alex"], edgeIds: [ids.secondEdge] });
    expect(graph?.nodes.find(({ key }) => key === "contact:alex"))
      .toMatchObject({ personKeys: ["alex"], edgeIds: [ids.unresolvedEdge] });

    const other = await t.query(api.graph.communityNetwork, { deviceId: "observer_device" });
    expect(other?.nodes.flatMap(({ edgeIds }) => edgeIds)).toEqual([ids.observerEdge]);
  });

  test("skips broken or unresolved public links and retains the viewer's saved name for a deleted hop", async () => {
    const t = convexTest(schema, modules);
    const viewer = await t.run(async (ctx) => {
      const viewer = await addUser(ctx, "Viewer", { deviceId: "viewer_device" });
      const recipient = await addUser(ctx, "Recipient");
      const deletedUser = await addUser(ctx, "Deleted holder");
      const wish = await addWish(ctx, viewer);
      const gone = await addHop(ctx, wish, "Viewer", { holderUserId: viewer });
      const unverified = await addHop(ctx, wish, "Viewer");
      const wrongWish = await addWish(ctx, viewer);
      const unrelated = await addHop(ctx, wrongWish, "Viewer", { holderUserId: viewer });
      const deletedHolder = await addHop(ctx, wish, "Deleted holder", { holderUserId: deletedUser });
      for (const parentHopId of [gone, unverified, unrelated, deletedHolder]) {
        await addHop(ctx, wish, "Recipient", { holderUserId: recipient, parentHopId });
      }
      await addEdge(ctx, viewer, wish, gone, "Old contact");
      await ctx.db.delete("hops", gone);
      await ctx.db.delete("users", deletedUser);
      return viewer;
    });

    const network = await t.query(api.graph.communityNetwork, { deviceId: "viewer_device" });
    expect(network?.truncated).toBe(false);
    expect(network?.nodes).toHaveLength(3);
    expect(network?.links.map(({ source, target }) => pair(source, target)))
      .toEqual([pair(userKey(viewer), "contact:old contact")]);
  });

  test("keeps the viewer beyond the user cap and leaves users beyond it unresolved", async () => {
    const t = convexTest(schema, modules);
    const { viewer, oldEndpoint } = await t.run(async (ctx) => {
      const viewer = await addUser(ctx, "Viewer", { deviceId: "viewer_device" });
      const oldEndpoint = await addUser(ctx, "Older account");
      for (let i = 0; i < 300; i++) await addUser(ctx, `User ${i}`);
      const wish = await addWish(ctx, viewer);
      const parent = await addHop(ctx, wish, "Viewer", { holderUserId: viewer });
      const child = await addHop(ctx, wish, "Older account", { holderUserId: oldEndpoint, parentHopId: parent });
      await addEdge(ctx, viewer, wish, child, "Older friend");
      return { viewer, oldEndpoint };
    });

    const network = await t.query(api.graph.communityNetwork, { deviceId: "viewer_device" });
    expect(network?.truncated).toBe(true);
    expect(network?.meKey).toBe(userKey(viewer));
    expect(network?.nodes.filter(({ kind }) => kind === "user")).toHaveLength(301);
    expect(network?.nodes.some(({ key }) => key === userKey(oldEndpoint))).toBe(false);
    expect(network?.links.map(({ source, target }) => pair(source, target)))
      .toEqual([pair(userKey(viewer), "contact:older friend")]);
  });

  test("reports the recent hop cap and can still resolve a retained child's older parent", async () => {
    const t = convexTest(schema, modules);
    const { viewer, recent } = await t.run(async (ctx) => {
      const viewer = await addUser(ctx, "Viewer", { deviceId: "viewer_device" });
      const older = await addUser(ctx, "Older");
      const recent = await addUser(ctx, "Recent");
      const wish = await addWish(ctx, viewer);
      const parent = await addHop(ctx, wish, "Viewer", { holderUserId: viewer });
      await addHop(ctx, wish, "Older", { holderUserId: older, parentHopId: parent });
      for (let i = 0; i < 1499; i++) await addHop(ctx, wish, "Unassigned");
      await addHop(ctx, wish, "Recent", { holderUserId: recent, parentHopId: parent });
      return { viewer, recent };
    });

    const network = await t.query(api.graph.communityNetwork, { deviceId: "viewer_device" });
    expect(network?.truncated).toBe(true);
    expect(network?.nodes).toHaveLength(3);
    expect(network?.links.map(({ source, target }) => pair(source, target)))
      .toEqual([pair(userKey(viewer), userKey(recent))]);
  });

  test("reports the owned edge cap only once exceeded and uses the newest edges", async () => {
    const t = convexTest(schema, modules);
    const { viewer, wish, hop } = await t.run(async (ctx) => {
      const viewer = await addUser(ctx, "Viewer", { deviceId: "viewer_device" });
      const wish = await addWish(ctx, viewer);
      const hop = await addHop(ctx, wish, "Unassigned");
      await addEdge(ctx, viewer, wish, hop, "Oldest");
      for (let i = 0; i < 499; i++) await addEdge(ctx, viewer, wish, hop, "Included");
      return { viewer, wish, hop };
    });

    const atCap = await t.query(api.graph.communityNetwork, { deviceId: "viewer_device" });
    expect(atCap?.truncated).toBe(false);
    expect(atCap?.nodes.map(({ name }) => name)).toEqual(["Viewer", "Included", "Oldest"]);

    await t.run((ctx) => addEdge(ctx, viewer, wish, hop, "Newest"));
    const exceeded = await t.query(api.graph.communityNetwork, { deviceId: "viewer_device" });
    expect(exceeded?.truncated).toBe(true);
    expect(exceeded?.nodes.map(({ name }) => name)).toEqual(["Viewer", "Newest", "Included"]);
    expect(exceeded?.links).toHaveLength(2);
  });
});
