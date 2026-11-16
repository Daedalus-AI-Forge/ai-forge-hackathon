// Stock meet-up photos for demo success stories (scripts/seed-gallery.mjs). The pool holds only
// generic scene images uploaded by an operator, never user uploads. Seeded and bot-made success
// stories draw from it so no "Wishes that came true" polaroid or ending is left blank.
import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "./_generated/server";
import { chainsFor } from "./chains";
import { TEAM_KEYS } from "./teamSeed";

const POOL_LIMIT = 50;
const SCAN_LIMIT = 500;

type PoolRow = { storageId: Id<"_storage">; photoreal?: boolean; tags?: string[] };

/** The preferred pool: photoreal scenes when any exist, else every row (illustration fallback). */
async function poolRows(ctx: QueryCtx): Promise<PoolRow[]> {
  const rows = await ctx.db.query("galleryPool").take(POOL_LIMIT);
  const real = rows.filter((r) => r.photoreal);
  return real.length ? real : rows;
}

async function pool(ctx: QueryCtx) {
  return (await poolRows(ctx)).map((p) => p.storageId);
}

/** The photo whose tags best fit `text`; ties and no match fall back to a stable hash pick. */
export function matchPhoto(rows: PoolRow[], text: string, key: string) {
  const t = text.toLowerCase();
  let best: PoolRow[] = [];
  let bestScore = 0;
  for (const r of rows) {
    const score = (r.tags ?? []).filter((tag) => t.includes(tag)).length;
    if (score > bestScore) [best, bestScore] = [[r], score];
    else if (score === bestScore && score > 0) best.push(r);
  }
  const ids = (best.length ? best : rows).map((r) => r.storageId);
  return pick(ids, key);
}

function pick(ids: Id<"_storage">[], key: string) {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return ids[h % ids.length];
}

/** A stable pool photo for `key` (a wish or hop id), or undefined when the pool is empty. */
export async function poolPhoto(ctx: QueryCtx, key: string, text = "") {
  const rows = await poolRows(ctx);
  return rows.length ? matchPhoto(rows, text, key) : undefined;
}

/** Add files to the pool (deduplicated). */
export async function addToPool(ctx: MutationCtx, storageIds: Id<"_storage">[]) {
  const have = new Set<string>(await pool(ctx));
  for (const storageId of storageIds) {
    if (!(await ctx.db.system.get("_storage", storageId))) throw new Error(`No stored file ${storageId}`);
    if (!have.has(storageId)) await ctx.db.insert("galleryPool", { storageId });
    have.add(storageId);
  }
}

/**
 * Give every success story that would render without a photo one from the pool, writing the
 * field the lists read (chains.chainPhotoUrl, link.ending): a granted wish gets a confirmed
 * meetingPhoto; a found wish's finder and a daily boat's finders get proofStorageId.
 * Idempotent: rows that already show a photo are left alone.
 */
export async function fillMissingPhotos(ctx: MutationCtx) {
  const rows = await poolRows(ctx);
  const ids = rows.map((r) => r.storageId);
  let filled = 0;
  if (ids.length === 0) return filled;
  const granted = await ctx.db.query("wishes").withIndex("by_status", (q) => q.eq("status", "granted")).take(SCAN_LIMIT);
  for (const w of granted) {
    if (w.daily || w.meetingPhoto || w.photoUrl?.startsWith("asset:")) continue;
    await ctx.db.patch("wishes", w._id, {
      meetingPhotoRevision: (w.meetingPhotoRevision ?? 0) + 1,
      meetingPhoto: { storageId: matchPhoto(rows, w.text, w._id), uploaderRole: "match", metInPerson: w.metInPerson ?? true, thankYou: "" },
    });
    filled++;
  }
  const found = await ctx.db.query("wishes").withIndex("by_status", (q) => q.eq("status", "found")).take(SCAN_LIMIT);
  const daily = await ctx.db.query("wishes").withIndex("by_daily_date", (q) => q.gte("daily.date", "")).take(SCAN_LIMIT);
  for (const w of [...found, ...daily]) filled += await fillFinders(ctx, w, rows);
  return filled;
}

async function fillFinders(ctx: MutationCtx, wish: Doc<"wishes">, rows: PoolRow[]) {
  if (wish.status !== "found" && !wish.daily) return 0;
  if (wish.daily && wish.photoUrl) return 0;
  const hops = await ctx.db.query("hops").withIndex("by_wishId", (q) => q.eq("wishId", wish._id)).take(SCAN_LIMIT);
  let filled = 0;
  for (const h of hops) {
    if (h.action !== "its_me" || h.proofStorageId) continue;
    await ctx.db.patch("hops", h._id, { proofStorageId: matchPhoto(rows, wish.text, h._id) });
    filled++;
  }
  return filled;
}

/** Add `storageIds` to the pool, then fill every blank success story. */
export const addAndFill = internalMutation({
  args: { storageIds: v.array(v.id("_storage")) },
  returns: v.object({ pool: v.number(), filled: v.number() }),
  handler: async (ctx, { storageIds }) => {
    await addToPool(ctx, storageIds);
    const filled = await fillMissingPhotos(ctx);
    const size = (await pool(ctx)).length;
    console.log(JSON.stringify({ event: "gallery.fill", pool: size, filled }));
    return { pool: size, filled };
  },
});

/** Exactly what each seeded member's World tab "Wishes that came true" shows (chains.mine). */
export const audit = internalQuery({
  args: {},
  returns: v.array(v.object({ key: v.string(), stories: v.number(), withPhoto: v.number(), without: v.array(v.string()) })),
  handler: async (ctx) => {
    const users: Doc<"users">[] = [];
    for (const key of TEAM_KEYS) users.push(...(await ctx.db.query("users").withIndex("by_teamKey", (q) => q.eq("teamKey", key)).take(10)));
    users.push(...(await ctx.db.query("users").withIndex("by_demoKey", (q) => q.gt("demoKey", "")).take(50)));
    const out = [];
    for (const u of users) {
      const chains = await chainsFor(ctx, u);
      out.push({
        key: u.teamKey ?? `demo:${u.demoKey}`,
        stories: chains.length,
        withPhoto: chains.filter((c) => c.photoUrl).length,
        without: chains.filter((c) => !c.photoUrl).map((c) => c.wishId),
      });
    }
    return out;
  },
});

/**
 * Swap the whole pool for `storageIds`: every row showing an old pool photo is re-pointed to a
 * new one, the old pool files are deleted, then blanks are filled. Idempotent for the same ids.
 */
export const replacePool = internalMutation({
  args: { storageIds: v.array(v.id("_storage")) },
  returns: v.object({ pool: v.number(), repointed: v.number(), filled: v.number() }),
  handler: async (ctx, { storageIds }) => {
    if (storageIds.length === 0) throw new Error("Pass at least one storageId");
    const keep = new Set<string>(storageIds);
    const oldRows = await ctx.db.query("galleryPool").take(POOL_LIMIT);
    const old = new Set<string>(oldRows.filter((r) => !keep.has(r.storageId)).map((r) => r.storageId));
    for (const r of oldRows) await ctx.db.delete("galleryPool", r._id);
    for (const id of storageIds) await ctx.db.insert("galleryPool", { storageId: id });
    let repointed = 0;
    const granted = await ctx.db.query("wishes").withIndex("by_status", (q) => q.eq("status", "granted")).take(SCAN_LIMIT);
    for (const w of granted) {
      if (!w.meetingPhoto || !old.has(w.meetingPhoto.storageId)) continue;
      await ctx.db.patch("wishes", w._id, { meetingPhoto: { ...w.meetingPhoto, storageId: pick(storageIds, w._id) } });
      repointed++;
    }
    const found = await ctx.db.query("wishes").withIndex("by_status", (q) => q.eq("status", "found")).take(SCAN_LIMIT);
    const daily = await ctx.db.query("wishes").withIndex("by_daily_date", (q) => q.gte("daily.date", "")).take(SCAN_LIMIT);
    for (const w of [...found, ...daily, ...granted]) {
      for (const h of await ctx.db.query("hops").withIndex("by_wishId", (q) => q.eq("wishId", w._id)).take(SCAN_LIMIT)) {
        if (!h.proofStorageId || !old.has(h.proofStorageId)) continue;
        await ctx.db.patch("hops", h._id, { proofStorageId: pick(storageIds, h._id) });
        repointed++;
      }
    }
    for (const id of old) await ctx.storage.delete(id as Id<"_storage">);
    const filled = await fillMissingPhotos(ctx);
    console.log(JSON.stringify({ event: "gallery.replace", pool: storageIds.length, repointed, filled, deleted: old.size }));
    return { pool: storageIds.length, repointed, filled };
  },
});

/**
 * Mark `photos` as photoreal pool scenes (inserting them if new), then re-point every success
 * story that shows a non-photoreal pool photo (the illustrations) to its best-matching photoreal
 * scene and fill blanks. Illustrations stay in the pool and storage as the fallback.
 * Idempotent: a second run with the same photos re-points nothing.
 */
export const usePhotoreal = internalMutation({
  args: { photos: v.array(v.object({ storageId: v.id("_storage"), tags: v.array(v.string()) })) },
  returns: v.object({ photoreal: v.number(), repointed: v.number(), filled: v.number() }),
  handler: async (ctx, { photos }) => {
    if (photos.length === 0) throw new Error("Pass at least one photo");
    for (const p of photos) {
      if (!(await ctx.db.system.get("_storage", p.storageId))) throw new Error(`No stored file ${p.storageId}`);
      const tags = p.tags.map((t) => t.toLowerCase());
      const row = await ctx.db.query("galleryPool").withIndex("by_storageId", (q) => q.eq("storageId", p.storageId)).first();
      if (row) await ctx.db.patch("galleryPool", row._id, { photoreal: true, tags });
      else await ctx.db.insert("galleryPool", { storageId: p.storageId, photoreal: true, tags });
    }
    const all = await ctx.db.query("galleryPool").take(POOL_LIMIT);
    const rows = all.filter((r) => r.photoreal);
    const old = new Set<string>(all.filter((r) => !r.photoreal).map((r) => r.storageId));
    let repointed = 0;
    const granted = await ctx.db.query("wishes").withIndex("by_status", (q) => q.eq("status", "granted")).take(SCAN_LIMIT);
    for (const w of granted) {
      if (!w.meetingPhoto || !old.has(w.meetingPhoto.storageId)) continue;
      await ctx.db.patch("wishes", w._id, {
        meetingPhotoRevision: (w.meetingPhotoRevision ?? 0) + 1,
        meetingPhoto: { ...w.meetingPhoto, storageId: matchPhoto(rows, w.text, w._id) },
      });
      repointed++;
    }
    const found = await ctx.db.query("wishes").withIndex("by_status", (q) => q.eq("status", "found")).take(SCAN_LIMIT);
    const daily = await ctx.db.query("wishes").withIndex("by_daily_date", (q) => q.gte("daily.date", "")).take(SCAN_LIMIT);
    for (const w of [...found, ...daily, ...granted]) {
      for (const h of await ctx.db.query("hops").withIndex("by_wishId", (q) => q.eq("wishId", w._id)).take(SCAN_LIMIT)) {
        if (!h.proofStorageId || !old.has(h.proofStorageId)) continue;
        await ctx.db.patch("hops", h._id, { proofStorageId: matchPhoto(rows, w.text, h._id) });
        repointed++;
      }
    }
    const filled = await fillMissingPhotos(ctx);
    console.log(JSON.stringify({ event: "gallery.photoreal", photoreal: rows.length, repointed, filled }));
    return { photoreal: rows.length, repointed, filled };
  },
});

/** Which photo each success story shows now (for operator checks). */
export const mapping = internalQuery({
  args: {},
  returns: v.array(v.object({ wishId: v.id("wishes"), text: v.string(), storageId: v.union(v.id("_storage"), v.null()), photoreal: v.boolean() })),
  handler: async (ctx) => {
    const real = new Set<string>((await ctx.db.query("galleryPool").take(POOL_LIMIT)).filter((r) => r.photoreal).map((r) => r.storageId));
    const granted = await ctx.db.query("wishes").withIndex("by_status", (q) => q.eq("status", "granted")).take(SCAN_LIMIT);
    return granted.filter((w) => !w.daily).map((w) => {
      const id = w.meetingPhoto?.storageId ?? null;
      return { wishId: w._id, text: w.text, storageId: id, photoreal: id !== null && real.has(id) };
    });
  },
});

/** Signed URLs for `storageIds` (operator review of generated photos). */
export const urls = internalQuery({
  args: { storageIds: v.array(v.id("_storage")) },
  returns: v.array(v.union(v.string(), v.null())),
  handler: async (ctx, { storageIds }) => Promise.all(storageIds.map((id) => ctx.storage.getUrl(id))),
});
