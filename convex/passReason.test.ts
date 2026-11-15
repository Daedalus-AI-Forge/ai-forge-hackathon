/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";

import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { CONTACT_MAX, REASON_MAX } from "./graphShared";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const REASON_REQUIRED = "Add one line on why you picked them";

async function mia(t: ReturnType<typeof convexTest>) {
  await t.mutation(api.users.ensure, { deviceId: "dev_mia" });
  await t.mutation(api.users.updateProfile, { deviceId: "dev_mia", name: "Mia", city: "SF" });
}

const base = { deviceId: "dev_mia", type: "local" as const, text: "A local in Tokyo", name: "Mia", city: "SF" };

async function edges(t: ReturnType<typeof convexTest>) {
  return await t.run((ctx) => ctx.db.query("edges").collect());
}

async function ingestJobs(t: ReturnType<typeof convexTest>) {
  const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  return jobs.filter((j) => j.name.includes("memory") && j.name.includes("ingest"));
}

async function passable(t: ReturnType<typeof convexTest>, hopId: Id<"hops">) {
  await t.mutation(api.hops.act, { hopId, action: "pass", name: "Sam", city: "", vouch: "Mia rocks", tags: [] });
}

test("serious toss rejects a recipient without a reason and writes nothing", async () => {
  const t = convexTest(schema, modules);
  await mia(t);
  await expect(
    t.mutation(api.wishes.toss, {
      ...base, mode: "serious",
      recipients: [
        { name: "Ken", reason: "Grew up in Shibuya", tags: ["tokyo"] },
        { name: "Amy", reason: "   ", tags: [] },
      ],
    }),
  ).rejects.toThrow(REASON_REQUIRED);
  await expect(
    t.mutation(api.wishes.toss, { ...base, mode: "serious", recipients: [{ name: "Ken", tags: [] }] }),
  ).rejects.toThrow(REASON_REQUIRED);
  expect(await edges(t)).toEqual([]);
  expect(await t.run((ctx) => ctx.db.query("wishes").collect())).toEqual([]);
});

test("fun toss without a reason is ok and stores mode", async () => {
  const t = convexTest(schema, modules);
  await mia(t);
  const { wishId } = await t.mutation(api.wishes.toss, {
    ...base,
    mode: "fun",
    recipients: [{ name: "Ken", tags: ["tokyo"] }],
  });
  const wish = await t.run((ctx) => ctx.db.get("wishes", wishId));
  expect(wish?.mode).toBe("fun");
  const [edge] = await edges(t);
  expect(edge.reason).toBeUndefined();
  expect(edge.contact).toBeUndefined();
});

test("serious toss stores mode, clamps reason/contact onto edges and schedules ingest per edge", async () => {
  const t = convexTest(schema, modules);
  await mia(t);
  const { wishId, hopIds } = await t.mutation(api.wishes.toss, {
    ...base, mode: "serious",
    recipients: [
      { name: "Ken", reason: ` ${"r".repeat(500)} `, contact: "c".repeat(500), tags: ["tokyo", "food"] },
    ],
  });
  expect((await t.run((ctx) => ctx.db.get("wishes", wishId)))?.mode).toBe("serious");
  const rows = await edges(t);
  expect(rows).toHaveLength(2);
  for (const e of rows) {
    expect(e.reason).toBe("r".repeat(REASON_MAX));
    expect(e.contact).toBe("c".repeat(CONTACT_MAX));
    expect(e.hopId).toBe(hopIds[0]);
  }
  const jobs = await ingestJobs(t);
  expect(jobs.map((j) => j.args[0].edgeId).sort()).toEqual(rows.map((e) => e._id).sort());
  const page = await t.query(api.hops.page, { hopId: hopIds[0] });
  expect(page?.wish.mode).toBe("serious");
});

test("passTo on a serious wish requires a reason; with one it lands on the edge", async () => {
  const t = convexTest(schema, modules);
  await mia(t);
  const { hopIds } = await t.mutation(api.wishes.toss, {
    ...base, mode: "serious",
    recipients: [{ name: "Sam", reason: "Lived in Tokyo", tags: [] }],
  });
  await passable(t, hopIds[0]);
  await expect(t.mutation(api.hops.passTo, { parentHopId: hopIds[0], name: "Ken", tags: ["tokyo"] })).rejects.toThrow(
    REASON_REQUIRED,
  );
  const before = (await edges(t)).length;
  const childId = await t.mutation(api.hops.passTo, {
    parentHopId: hopIds[0],
    name: "Ken",
    reason: "x".repeat(300),
    contact: " @ken ",
    tags: ["tokyo"],
  });
  const added = (await edges(t)).filter((e) => e.hopId === childId);
  expect((await edges(t)).length).toBe(before + 1);
  expect(added[0]).toMatchObject({ personName: "Ken", tag: "tokyo", source: "pick", contact: "@ken" });
  expect(added[0].reason).toHaveLength(REASON_MAX);
  expect((await ingestJobs(t)).some((j) => j.args[0].edgeId === added[0]._id)).toBe(true);
});

test("passTo on a fun wish is ok without a reason", async () => {
  const t = convexTest(schema, modules);
  await mia(t);
  const { hopIds } = await t.mutation(api.wishes.toss, { ...base, mode: "fun", recipients: [{ name: "Sam", tags: [] }] });
  await passable(t, hopIds[0]);
  const childId = await t.mutation(api.hops.passTo, { parentHopId: hopIds[0], name: "Ken", tags: ["tokyo"] });
  const added = (await edges(t)).filter((e) => e.hopId === childId);
  expect(added).toHaveLength(1);
  expect(added[0].reason).toBeUndefined();
});

test("daily wishes count as fun: passTo needs no reason and the page reports mode fun", async () => {
  const t = convexTest(schema, modules);
  await mia(t);
  const hopId = await t.mutation(api.daily.join, { deviceId: "dev_mia" });
  await t.mutation(api.hops.act, { hopId, action: "pass", name: "Mia", city: "SF", vouch: "", tags: [] });
  await t.mutation(api.hops.passTo, { parentHopId: hopId, name: "Amy", tags: [] });
  expect((await t.query(api.hops.page, { hopId }))?.wish.mode).toBe("fun");
  expect((await edges(t)).length).toBeGreaterThan(0);
});


test("legacy wish without mode (old rows / current UI) passes without a reason", async () => {
  const t = convexTest(schema, modules);
  await mia(t);
  const { wishId, hopIds } = await t.mutation(api.wishes.toss, { ...base, recipients: [{ name: "Sam", tags: [] }] });
  expect((await t.run((ctx) => ctx.db.get("wishes", wishId)))?.mode).toBe("fun");
  await t.run((ctx) => ctx.db.patch("wishes", wishId, { mode: undefined }));
  await passable(t, hopIds[0]);
  await expect(t.mutation(api.hops.passTo, { parentHopId: hopIds[0], name: "Ken", tags: [] })).resolves.toBeTruthy();
});

test("a pick with a reason but no tags still writes a 'friend' edge", async () => {
  const t = convexTest(schema, modules);
  await mia(t);
  await t.mutation(api.wishes.toss, { ...base, mode: "serious", recipients: [{ name: "Lia", reason: "Runs the climbing group", tags: [] }] });
  const lia = (await edges(t)).filter((e) => e.personName === "Lia");
  expect(lia).toHaveLength(1);
  expect(lia[0]).toMatchObject({ tag: "friend", source: "pick", reason: "Runs the climbing group" });
});
