/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { MEETING_PHOTO_MAX_BYTES, MEET_WINDOW_MS } from "./meetings";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const SITE = "https://test.convex.site";
const CREATOR = "device_creator";
const MATCH = "device_match";
const HELPER = "device_helper";
const OUTSIDER = "device_outsider";
const DEMO_PHONE = "+15555550100";
const setup = () => convexTest(schema, modules);
type T = ReturnType<typeof setup>;

beforeEach(() => {
  vi.stubEnv("CONVEX_SITE_URL", SITE);
  vi.stubEnv("OPENAI_API_KEY", "");
  vi.stubEnv("TWILIO_ACCOUNT_SID", "");
  vi.stubEnv("TWILIO_AUTH_TOKEN", "");
  vi.stubEnv("TWILIO_MESSAGING_FROM", "");
  vi.stubEnv("DEMO_PHONE_NUMBERS", DEMO_PHONE);
  vi.stubEnv("DEMO_PHONE_CODE", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function seed(t: T, opts: { traveling?: boolean; depth?: 1 | 2 | 3; unbound?: boolean } = {}) {
  return await t.run(async ctx => {
    const creator = await ctx.db.insert("users", { name: "Louise", avatar: "#000", city: "SF", wishesLeft: 0, stars: 10, deviceId: CREATOR });
    const match = await ctx.db.insert("users", { name: "Ben", avatar: "#000", city: "London", wishesLeft: 2, stars: 3, deviceId: MATCH });
    const helper = await ctx.db.insert("users", { name: "Amy", avatar: "#000", city: "Paris", wishesLeft: 1, stars: 0, deviceId: HELPER });
    const outsider = await ctx.db.insert("users", { name: "Tess", avatar: "#000", city: "Tokyo", wishesLeft: 1, stars: 0, deviceId: OUTSIDER });
    const now = Date.now();
    const wishId = await ctx.db.insert("wishes", {
      creatorId: creator, type: "do_together", text: "Play drums together", status: opts.traveling ? "traveling" : "found",
      expiresAt: now + 60_000,
      meetDeadline: opts.traveling ? undefined : now + MEET_WINDOW_MS,
    });
    const depth = opts.depth ?? 2;
    const basicHop = { wishId, recipientTags: [], viaGroup: false };
    let parentHopId;
    for (let step = 1; step < depth; step++) {
      parentHopId = await ctx.db.insert("hops", {
        ...basicHop, parentHopId, depth: step, holderName: "Amy", holderUserId: helper, city: "Paris", action: "pass", actedAt: now,
      });
    }
    const winner = await ctx.db.insert("hops", {
      ...basicHop, depth, parentHopId, holderName: "Ben", holderUserId: opts.unbound ? undefined : match,
      city: "London", action: opts.traveling ? undefined : "its_me", actedAt: opts.traveling ? undefined : now,
    });
    await ctx.db.insert("hops", { ...basicHop, depth: 6, holderName: "Tess", holderUserId: outsider, city: "Tokyo", action: "pass" });
    if (!opts.traveling) await ctx.db.patch("wishes", wishId, { winningHopId: winner });
    return { wishId, winner, creator, match, helper, outsider };
  });
}

async function makeUpload(t: T, wishId: Id<"wishes">, deviceId: string) {
  const url = await t.mutation(api.meetings.uploadUrl, { wishId, deviceId });
  expect(url).toMatch(/^https:\/\/test\.convex\.site\/meeting-photo\//);
  const path = new URL(url).pathname;
  return { url, path, send: (type = "image/png", body: BodyInit = "fake image bytes in in-memory storage") =>
    t.fetch(path, { method: "POST", headers: { "Content-Type": type }, body }) };
}

async function photo(t: T, wishId: Id<"wishes">, deviceId: string): Promise<Id<"_storage">> {
  const upload = await makeUpload(t, wishId, deviceId);
  const response = await upload.send();
  expect(response.status, response.ok ? undefined : await response.clone().text()).toBe(200);
  const result = await response.json() as { storageId: Id<"_storage"> };
  return result.storageId;
}

async function balances(t: T, userIds: Id<"users">[]) {
  return await t.run(async ctx => Promise.all(userIds.map(async id => {
    const user = await ctx.db.get("users", id);
    return { wishes: user?.wishesLeft, stars: user?.stars };
  })));
}

test("legacy boat calls keep their arguments and remain separate from verified confirmation", async () => {
  const t = setup();
  const { wishId, winner } = await seed(t, { traveling: true });
  await t.mutation(api.hops.saveContact, { hopId: winner, contact: "@ben" });
  expect(await t.query(api.hops.page, { hopId: winner })).toMatchObject({ hop: { holderContact: "@ben" } });
  await t.mutation(api.hops.itsMe, { hopId: winner, name: "Ben", city: "London", intro: "I love jazz", contact: "" });
  expect(await t.query(api.hops.page, { hopId: winner })).toMatchObject({ hop: { action: "its_me" } });
  expect(await t.query(api.link.pendingClaims, { deviceId: CREATOR })).toEqual([]);
  await expect(t.mutation(api.link.confirmClaim, { hopId: winner, deviceId: CREATOR })).rejects.toThrow("This claim isn't verified yet");
  expect(await t.query(api.meetings.get, { wishId, deviceId: MATCH })).toBeNull();
});

test("a verified link claim binds the holder and starts one seven-day window", async () => {
  vi.useFakeTimers();
  const t = setup();
  const { wishId, winner, match } = await seed(t, { traveling: true, unbound: true });
  await t.mutation(api.link.claim, { hopId: winner, deviceId: MATCH, intro: "I play", answers: ["Jazz"], phone: DEMO_PHONE, code: "000000" });
  expect((await t.run(ctx => ctx.db.get("hops", winner)))?.holderUserId).toBe(match);
  const confirm = { hopId: winner, deviceId: CREATOR };
  const confirmStarted = Date.now();
  const reply = { claimerName: "Ben", claimerPhone: DEMO_PHONE };
  expect(await t.mutation(api.link.confirmClaim, confirm)).toEqual(reply);
  const matchArgs = { wishId, deviceId: MATCH };
  const deadline = (await t.query(api.meetings.get, matchArgs))!.meetDeadline;
  expect(deadline).toBeGreaterThanOrEqual(confirmStarted + MEET_WINDOW_MS);
  expect(deadline).toBeLessThanOrEqual(Date.now() + MEET_WINDOW_MS + 10);
  vi.advanceTimersByTime(1000);
  expect(await t.mutation(api.link.confirmClaim, confirm)).toEqual(reply);
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await t.query(api.meetings.get, matchArgs)).toMatchObject({ role: "match", stage: "upload", meetDeadline: deadline, matchContact: null, matchPhone: null });
  expect(await t.query(api.meetings.get, { wishId, deviceId: CREATOR })).toMatchObject({ matchContact: DEMO_PHONE, matchPhone: DEMO_PHONE });
});

test("a pending creator photo and note stay private until the other participant grants it once", async () => {
  vi.useFakeTimers();
  const t = setup();
  const { wishId, creator, match, helper, outsider } = await seed(t);
  const storageId = await photo(t, wishId, CREATOR);
  const args = { wishId, deviceId: CREATOR, storageId, metInPerson: true, thankYou: "  Thank you for keeping the beat!  " };
  await t.mutation(api.meetings.submitPhoto, args);
  await t.mutation(api.meetings.submitPhoto, args);
  expect(await t.query(api.meetings.get, { wishId, deviceId: CREATOR })).toMatchObject({ stage: "waiting", photoStorageId: storageId });
  expect(await t.query(api.meetings.get, { wishId, deviceId: MATCH })).toMatchObject({ stage: "review", thankYou: "Thank you for keeping the beat!" });
  expect(await t.query(api.meetings.get, { wishId, deviceId: HELPER })).toBeNull();
  expect(await t.query(api.meetings.list, { deviceId: OUTSIDER })).toEqual([]);
  const asOutsider = t.withIdentity({ subject: `${outsider}|session` });
  expect(await asOutsider.query(api.meetings.get, { wishId, deviceId: CREATOR })).toBeNull();
  await expect(t.mutation(api.meetings.uploadUrl, { wishId, deviceId: OUTSIDER })).rejects.toThrow("Only the wisher and confirmed match");
  await expect(t.mutation(api.meetings.confirmPhoto, { wishId, storageId, deviceId: CREATOR })).rejects.toThrow("Only the other participant");
  await expect(t.mutation(api.meetings.rejectPhoto, { wishId, storageId, deviceId: CREATOR })).rejects.toThrow("Only the other participant");
  await expect(t.mutation(api.meetings.confirmPhoto, { wishId, storageId, deviceId: OUTSIDER })).rejects.toThrow("Only the wisher and confirmed match");
  expect(await t.query(api.link.ending, { wishId })).toMatchObject({ locked: true, story: "The ending unlocks after the participants meet and confirm their photo.", photoUrl: null, thankYou: "", route: [], tier: null });
  const winningVoyages = { deviceId: HELPER };
  const otherVoyages = { deviceId: OUTSIDER };
  expect(await t.query(api.pool.voyages, winningVoyages)).toMatchObject([{ wishId, status: "landed", found: expect.objectContaining({ name: "Ben" }) }]);
  expect(await t.query(api.pool.voyages, otherVoyages)).toMatchObject([{ wishId, status: "landed", found: null }]);
  expect(JSON.stringify(await t.query(api.pool.voyages, winningVoyages))).not.toContain(args.thankYou.trim());
  const confirm = { wishId, storageId, deviceId: MATCH };
  await Promise.all([t.mutation(api.meetings.confirmPhoto, confirm), t.mutation(api.meetings.confirmPhoto, confirm)]);
  expect(await balances(t, [creator, match, helper, outsider])).toEqual([
    { wishes: 1, stars: 11 }, { wishes: 3, stars: 4 }, { wishes: 1, stars: 1 }, { wishes: 1, stars: 0 },
  ]);
  expect(await t.query(api.pool.voyages, winningVoyages)).toMatchObject([{ wishId, status: "granted", found: expect.objectContaining({ name: "Ben" }) }]);
  expect(await t.query(api.pool.voyages, otherVoyages)).toMatchObject([{ wishId, status: "granted", found: null }]);
  const ending = await t.query(api.link.ending, { wishId });
  expect(ending).toMatchObject({ holders: [{ name: "Louise", depth: 0 }, { name: "Amy", depth: 1 }, { name: "Ben", depth: 2 }],
    locked: false, status: "granted", thankYou: "Thank you for keeping the beat!", tier: "silver", metInPerson: true,
    photoUrl: expect.any(String), route: ["SF", "Paris", "London"], ripples: 2 });
  expect(ending?.story).toMatch(/met in person/);
  await t.run(ctx => ctx.db.patch("users", match, { showInLogs: false }));
  const privateMatch = await t.query(api.link.ending, { wishId });
  expect(privateMatch).toMatchObject({ holders: [{ name: "Louise" }, { name: "Amy" }, { name: "Someone", city: null }], route: ["SF", "Paris"] });
  expect(JSON.stringify(privateMatch)).not.toContain("London");
  expect(await t.query(api.meetings.list, { deviceId: MATCH })).toMatchObject([{ wishId, stage: "granted", tier: "silver" }]);
  await t.finishAllScheduledFunctions(vi.runAllTimers);
});

test("a match can upload, replace or receive a rejection; stale versions and tickets never confirm", async () => {
  vi.useFakeTimers();
  const t = setup();
  const { wishId, creator, match } = await seed(t, { depth: 1 });
  const abandoned = await photo(t, wishId, MATCH);
  const first = await photo(t, wishId, MATCH);
  const submit = (storageId: Id<"_storage">, deviceId = MATCH) => t.mutation(api.meetings.submitPhoto, { wishId, storageId, deviceId, metInPerson: false, thankYou: "" });
  await submit(first);
  expect(await t.query(api.meetings.get, { wishId, deviceId: CREATOR })).toMatchObject({ stage: "review", metInPerson: false });
  await expect(t.mutation(api.meetings.uploadUrl, { wishId, deviceId: CREATOR })).rejects.toThrow("Review the current photo");
  const second = await photo(t, wishId, MATCH);
  await submit(second);
  await expect(t.mutation(api.meetings.confirmPhoto, { wishId, storageId: first, deviceId: CREATOR })).rejects.toThrow("This photo changed");
  await expect(t.mutation(api.meetings.rejectPhoto, { wishId, storageId: first, deviceId: CREATOR })).rejects.toThrow("This photo changed");
  await t.mutation(api.meetings.rejectPhoto, { wishId, storageId: second, deviceId: CREATOR });
  expect(await t.query(api.meetings.get, { wishId, deviceId: MATCH })).toMatchObject({ stage: "upload", photoUrl: null, thankYou: "" });
  await expect(submit(second)).rejects.toThrow("Choose a new meeting photo");
  await expect(submit(abandoned)).rejects.toThrow("Choose a new meeting photo");
  const third = await photo(t, wishId, MATCH);
  await submit(third);
  await t.mutation(api.meetings.confirmPhoto, { wishId, storageId: third, deviceId: CREATOR });
  expect(await balances(t, [creator, match])).toEqual([{ wishes: 1, stars: 11 }, { wishes: 3, stars: 4 }]);
  expect(await t.query(api.link.ending, { wishId })).toMatchObject({ tier: "gold", metInPerson: false, story: expect.stringContaining("on a call") });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
});

test("meeting upload validates file type, emptiness, size and ownership; daily proof preserves its own upload", async () => {
  const t = setup();
  const { wishId, creator } = await seed(t);
  const upload = await makeUpload(t, wishId, CREATOR);
  expect((await t.fetch(upload.path, { method: "OPTIONS" })).headers.get("Access-Control-Allow-Origin")).toBe("*");
  expect((await upload.send("image/svg+xml")).status).toBe(415);
  expect((await upload.send("image/png", "")).status).toBe(413);
  expect((await upload.send("image/png", new Blob([new ArrayBuffer(MEETING_PHOTO_MAX_BYTES + 1)]))).status).toBe(413);
  const token = upload.path.split("/").at(-1)!;
  await t.run(async ctx => {
    const ticket = (await ctx.db.query("meetingUploads").withIndex("by_token", q => q.eq("token", token)).unique())!;
    await ctx.db.patch("meetingUploads", ticket._id, { expiresAt: Date.now() - 1 });
  });
  expect((await upload.send()).status).toBe(403);
  const storageId = await photo(t, wishId, CREATOR);
  const genericId = await t.run(ctx => ctx.storage.store(new Blob(["daily PNG"], { type: "image/png" })));
  const info = { wishId, metInPerson: true, thankYou: "" };
  await expect(t.mutation(api.meetings.submitPhoto, { ...info, storageId: genericId, deviceId: CREATOR })).rejects.toThrow("Choose a new meeting photo");
  await expect(t.mutation(api.meetings.submitPhoto, { ...info, storageId, deviceId: MATCH })).rejects.toThrow("Choose a new meeting photo");
  const daily = await t.run(async ctx => {
    const dailyId = await ctx.db.insert("wishes", { creatorId: creator, type: "local", text: "Daily", status: "traveling", expiresAt: Date.now() + 60_000,
      daily: { date: "2026-11-15", steps: [], reasoning: "" } });
    const hopId = await ctx.db.insert("hops", { wishId: dailyId, holderName: "Ben", depth: 1, recipientTags: [], viaGroup: false });
    return { dailyId, hopId };
  });
  const claim = { hopId: daily.hopId, deviceId: MATCH, intro: "Me" };
  await expect(t.mutation(api.link.claim, { ...claim, proofStorageId: storageId })).rejects.toThrow("Choose a separate photo");
  await t.mutation(api.link.claim, { ...claim, proofStorageId: genericId });
  expect(await t.query(api.link.ending, { wishId: daily.dailyId })).toMatchObject({ locked: false, photoUrl: expect.any(String) });
  expect(await t.query(api.meetings.get, { wishId: daily.dailyId, deviceId: MATCH })).toBeNull();
});

test("expired meetings fail server-side regardless of the query clock and award nothing", async () => {
  vi.useFakeTimers();
  const t = setup();
  const { wishId, creator, match } = await seed(t);
  const storageId = await photo(t, wishId, CREATOR);
  await t.mutation(api.meetings.submitPhoto, { wishId, storageId, deviceId: CREATOR, metInPerson: true, thankYou: "Private" });
  vi.setSystemTime(Date.now() + MEET_WINDOW_MS);
  expect(await t.query(api.meetings.get, { wishId, deviceId: MATCH, now: Date.now() })).toMatchObject({ stage: "expired", photoUrl: null, thankYou: "" });
  expect(await t.query(api.meetings.get, { wishId, deviceId: MATCH, now: Date.now() - 1 })).toMatchObject({ stage: "review" });
  await expect(t.mutation(api.meetings.uploadUrl, { wishId, deviceId: CREATOR })).rejects.toThrow("deadline has passed");
  await expect(t.mutation(api.meetings.confirmPhoto, { wishId, deviceId: MATCH, storageId })).rejects.toThrow("deadline has passed");
  await expect(t.mutation(api.meetings.rejectPhoto, { wishId, deviceId: MATCH, storageId })).rejects.toThrow("deadline has passed");
  expect(await balances(t, [creator, match])).toEqual([{ wishes: 0, stars: 10 }, { wishes: 2, stars: 3 }]);
  expect(await t.query(api.link.ending, { wishId })).toMatchObject({ locked: true, photoUrl: null, thankYou: "" });
});
