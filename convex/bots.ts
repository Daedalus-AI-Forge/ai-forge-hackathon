// Wish bots: seeded global users (`users.isBot`, written by teamSeed.run with `global: true`)
// that keep boats moving during the demo. A cron calls `tick` every 2 minutes; it only runs
// when the Convex env var BOTS_ENABLED is "true" (`npx convex env set BOTS_ENABLED false` stops it).
//
// Each tick looks at up to MAX_PER_TICK unacted hops held by bots on traveling wishes. After a
// per-hop dwell of 2-8 minutes the holder bot either passes the boat to the best-matching bot in
// a different city (same rows a real pass writes: parent patched with action/city/lat/lng, child
// hop with introVouch, edges), or, when its own tags match strongly and depth >= 3, says "It's me".
// Bots never pass to real users, never touch hops held by real users, and never notify anyone.
import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "./_generated/server";
import { REASON_MAX, personKey } from "./graphShared";
import { scoreKeyword, tokenize } from "./graphRank";
import { firstName, wishGist } from "./greetings";
import { LIMITS, MAX_RIPPLES, clampText, cleanTags } from "./lib";

export const MAX_PER_TICK = 5;
const MINUTE = 60 * 1000;
const DWELL_MIN = 2 * MINUTE;
const DWELL_SPAN = 6 * MINUTE;
/** Holder's own keyword score needed to claim "It's me" (one tag match + one persona word). */
export const ITS_ME_SCORE = 3;
const ITS_ME_DEPTH = 3;
const BOT_SCAN = 100;

export function botsEnabled() {
  return process.env.BOTS_ENABLED === "true";
}

/** Deterministic 2-8 minute dwell per hop, so bots don't all move at once. */
export function dwellMs(hopId: string) {
  let h = 2166136261;
  for (const ch of hopId) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return DWELL_MIN + (h % DWELL_SPAN);
}

export async function listBots(ctx: QueryCtx | MutationCtx) {
  return await ctx.db.query("users").withIndex("by_isBot", (q) => q.eq("isBot", true)).take(BOT_SCAN);
}

/** How well a bot fits a wish: keyword score of each tag (with the persona as its reason). */
export function botScore(wishTokens: Set<string>, bot: Pick<Doc<"users">, "botProfile">) {
  const p = bot.botProfile;
  if (!p) return 0;
  let score = scoreKeyword(wishTokens, { tag: "", reason: p.persona });
  for (const tag of p.tags) score += scoreKeyword(wishTokens, { tag, reason: null });
  return score;
}

/** Best bot for a wish among `bots`, or null when nobody scores > 0. Ties break by name. */
export function bestBot(wishText: string, bots: Doc<"users">[]) {
  const tokens = new Set(tokenize(wishText));
  let best: { bot: Doc<"users">; score: number } | null = null;
  for (const bot of bots) {
    const score = botScore(tokens, bot);
    if (score <= 0) continue;
    if (!best || score > best.score || (score === best.score && bot.name < best.bot.name)) best = { bot, score };
  }
  return best;
}

/** FACTS-only template vouch: uses only the bot's own name and persona (no invented facts). */
export function botVouch(to: Doc<"users">) {
  return clampText(`${firstName(to.name)}: ${to.botProfile?.persona ?? to.city}`, LIMITS.vouch);
}

/** The bot whose name matches `name` (case-insensitive), if `ownerUserId` has them in their graph. */
export async function botInNetwork(ctx: MutationCtx, ownerUserId: Id<"users">, name: string) {
  const key = personKey(name);
  if (!key) return null;
  const bot = (await listBots(ctx)).find((b) => personKey(b.name) === key);
  if (!bot) return null;
  const edge = await ctx.db
    .query("edges")
    .withIndex("by_ownerUserId_and_personName", (q) => q.eq("ownerUserId", ownerUserId).eq("personName", bot.name))
    .first();
  if (edge) return bot;
  const network = await ctx.db.query("network").withIndex("by_ownerId", (q) => q.eq("ownerId", ownerUserId)).take(200);
  return network.some((n) => personKey(n.personName) === key) ? bot : null;
}

/** Entry point from wishes.toss / link.pushOne: a hop sent to a bot friend is held by that bot. */
export async function bindBotHolder(ctx: MutationCtx, ownerUserId: Id<"users">, hopId: Id<"hops">, name: string) {
  const bot = await botInNetwork(ctx, ownerUserId, name);
  if (bot) await ctx.db.patch("hops", hopId, { holderUserId: bot._id });
  return bot?._id ?? null;
}

type Moved = { hopId: Id<"hops">; action: "pass" | "its_me"; from: string; to: string | null; toCity: string | null };

/** One bot's move on one hop. Exported for tests. */
export async function actOnHop(ctx: MutationCtx, hop: Doc<"hops">, bots: Doc<"users">[], now: number): Promise<Moved | null> {
  const holder = bots.find((b) => b._id === hop.holderUserId);
  if (!holder?.isBot || hop.action) return null;
  const wish = await ctx.db.get("wishes", hop.wishId);
  if (!wish || wish.status !== "traveling" || wish.expiresAt <= now) return null;

  const tokens = new Set(tokenize(wish.text));
  const here = { city: holder.city, lat: holder.botProfile?.lat, lng: holder.botProfile?.lng };
  const ownScore = botScore(tokens, holder);
  const claim = async () => {
    await ctx.db.patch("hops", hop._id, {
      ...here,
      action: "its_me",
      actedAt: now,
      itsMeIntro: clampText(`That's me! ${holder.botProfile?.persona ?? ""}`.trim(), LIMITS.intro),
      itsMePublic: true,
    });
    return { hopId: hop._id, action: "its_me" as const, from: holder.name, to: null, toCity: holder.city };
  };
  if (hop.depth >= ITS_ME_DEPTH && ownScore >= ITS_ME_SCORE) return await claim();

  // Never revisit someone already on this wish's route, never stay in the same city.
  const route = await ctx.db.query("hops").withIndex("by_wishId", (q) => q.eq("wishId", wish._id)).take(200);
  const visited = new Set(route.map((h) => personKey(h.holderName)));
  const candidates = bots.filter((b) => b.city !== holder.city && !visited.has(personKey(b.name)));
  const next = hop.depth < MAX_RIPPLES ? bestBot(wish.text, candidates) : null;
  if (!next) return hop.depth >= ITS_ME_DEPTH ? await claim() : null;

  const to = next.bot;
  const tags = cleanTags(to.botProfile?.tags ?? []);
  const reason = clampText(`Thought of you for ${wishGist(wish.text)}`, REASON_MAX);
  await ctx.db.patch("hops", hop._id, {
    ...here,
    action: "pass",
    actedAt: now,
    passMessage: clampText(`${firstName(to.name)} in ${to.city} is a great fit`, LIMITS.message),
  });
  const childId = await ctx.db.insert("hops", {
    wishId: wish._id,
    parentHopId: hop._id,
    depth: hop.depth + 1,
    holderName: to.name,
    holderUserId: to._id,
    recipientTags: tags,
    viaGroup: false,
    introVouch: botVouch(to),
  });
  // Plain edge rows (no Supermemory ingest): bot graphs must not cost API calls per tick.
  for (const tag of tags) {
    await ctx.db.insert("edges", {
      ownerUserId: holder._id,
      ownerName: clampText(holder.name, LIMITS.name),
      personName: clampText(to.name, LIMITS.name),
      tag,
      source: "pick",
      wishId: wish._id,
      hopId: childId,
      reason,
    });
  }
  return { hopId: hop._id, action: "pass", from: holder.name, to: to.name, toCity: to.city };
}

const movedValidator = v.object({
  hopId: v.id("hops"),
  action: v.union(v.literal("pass"), v.literal("its_me")),
  from: v.string(),
  to: v.union(v.string(), v.null()),
  toCity: v.union(v.string(), v.null()),
});

export const tick = internalMutation({
  args: {
    // Manual runs (`npx convex run bots:tick '{"ignoreDwell":true}'`) skip the 2-8 min dwell.
    ignoreDwell: v.optional(v.boolean()),
  },
  returns: v.object({ enabled: v.boolean(), moved: v.array(movedValidator) }),
  handler: async (ctx, { ignoreDwell }) => {
    if (!botsEnabled()) return { enabled: false, moved: [] };
    const now = Date.now();
    const bots = await listBots(ctx);
    const moved: Moved[] = [];
    let examined = 0;
    for (const bot of bots) {
      if (examined >= MAX_PER_TICK) break;
      const held = await ctx.db
        .query("hops")
        .withIndex("by_holderUserId_and_action", (q) => q.eq("holderUserId", bot._id).eq("action", undefined))
        .take(MAX_PER_TICK);
      for (const hop of held) {
        if (examined >= MAX_PER_TICK) break;
        if (!ignoreDwell && hop._creationTime + dwellMs(hop._id) > now) continue;
        examined++;
        const m = await actOnHop(ctx, hop, bots, now);
        if (m) moved.push(m);
      }
    }
    console.log(
      JSON.stringify({ event: "bots.tick", bots: bots.length, examined, passes: moved.filter((m) => m.action === "pass").length, claims: moved.filter((m) => m.action === "its_me").length }),
    );
    return { enabled: true, moved };
  },
});
