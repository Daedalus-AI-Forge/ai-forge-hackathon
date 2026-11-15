import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireUser, userByDevice, wishHops } from "./lib";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * What the well wants to learn: for each player, which friend is their link
 * to this kind of person. Keep these to interests and habits. Nothing a
 * person would mind being tagged with (no health, money, beliefs, dating).
 * `title` and `hint` are the fallback copy when the LLM is unavailable.
 */
export const PROBES = [
  {
    tag: "art scene",
    learns: "who your way into the art world is",
    title: "Someone who owns exactly one red sock and can explain why it is art.",
    hint: "Think of whoever drags you to gallery openings.",
  },
  {
    tag: "night owl",
    learns: "which of your friends is up when everyone else is asleep",
    title: "Someone who is awake at 3am right now and has a snack recommendation.",
    hint: "Who replies to your texts at 3am?",
  },
  {
    tag: "new in town",
    learns: "who you know that just moved cities",
    title: "Someone who still needs a map to find their own apartment.",
    hint: "Who just moved somewhere new?",
  },
  {
    tag: "career leap",
    learns: "who you know that made a big life turn",
    title: "Someone who quit a sensible job for one their parents can't describe.",
    hint: "Who made a leap you still talk about?",
  },
  {
    tag: "knows everyone",
    learns: "who the connector in your circle is",
    title: "Someone who can't cross a street without bumping into a person they know.",
    hint: "Who do you call when you need to find anyone?",
  },
  {
    tag: "food scout",
    learns: "who always knows where to eat",
    title: "Someone with strong feelings about a dumpling place nobody else has heard of.",
    hint: "Who picks the restaurant every time?",
  },
  {
    tag: "outdoors",
    learns: "who your outdoorsy friend is",
    title: "Someone who owns more tents than chairs.",
    hint: "Who is always halfway up a mountain?",
  },
  {
    tag: "music",
    learns: "who your way into the music scene is",
    title: "Someone who cried at a concert this year and will admit it.",
    hint: "Who always has a spare ticket?",
  },
] as const;

type DailyCopy = { tag: string; learns: string; title: string; hint: string; reasoning: string };

export function dateKey(now: number) {
  return new Date(now).toISOString().slice(0, 10);
}

async function wishFor(ctx: QueryCtx, date: string) {
  return await ctx.db
    .query("wishes")
    .withIndex("by_daily_date", (q) => q.eq("daily.date", date))
    .first();
}

/** Step 1 of the design: pick the tag the map knows least about (ties rotate by day). */
async function leastMapped(ctx: QueryCtx, date: string) {
  const day = Math.floor(Date.parse(date) / DAY_MS);
  let best: { probe: (typeof PROBES)[number]; count: number; turn: number } | null = null;
  for (const [i, probe] of PROBES.entries()) {
    const count = (
      await ctx.db
        .query("edges")
        .withIndex("by_tag", (q) => q.eq("tag", probe.tag))
        .take(200)
    ).length;
    const turn = (((i - day) % PROBES.length) + PROBES.length) % PROBES.length;
    if (!best || count < best.count || (count === best.count && turn < best.turn)) {
      best = { probe, count, turn };
    }
  }
  return best!;
}

function fallbackCopy(probe: (typeof PROBES)[number], count: number): DailyCopy {
  return {
    tag: probe.tag,
    learns: probe.learns,
    title: probe.title,
    hint: probe.hint,
    reasoning:
      `The well has mapped ${count === 0 ? "no" : `only ${count}`} "${probe.tag}" link${count === 1 ? "" : "s"} so far, so today's wish is one only that kind of friend would answer. ` +
      `Whoever you pass it to tells the well ${probe.learns}.`,
  };
}

async function insertWish(ctx: MutationCtx, date: string, copy: DailyCopy) {
  const well =
    (await ctx.db
      .query("users")
      .withIndex("by_demoKey", (q) => q.eq("demoKey", "well"))
      .unique()) ??
    (await ctx.db.get(
      "users",
      await ctx.db.insert("users", {
        name: "The well",
        avatar: "#E63946",
        city: "",
        wishesLeft: 0,
        stars: 0,
        demoKey: "well",
      }),
    ))!;
  const wishId = await ctx.db.insert("wishes", {
    creatorId: well._id,
    type: "same_boat",
    text: copy.title,
    status: "traveling",
    expiresAt: Date.now() + DAY_MS,
    daily: { date, tag: copy.tag, learns: copy.learns, hint: copy.hint, reasoning: copy.reasoning },
  });
  await ctx.scheduler.runAfter(DAY_MS, internal.wishes.fade, { wishId });
  return (await ctx.db.get("wishes", wishId))!;
}

async function myHop(ctx: QueryCtx, user: Doc<"users">, wish: Doc<"wishes">) {
  const mine = await ctx.db
    .query("hops")
    .withIndex("by_holderUserId_and_action", (q) => q.eq("holderUserId", user._id))
    .take(200);
  return mine.find((h) => h.wishId === wish._id && h.depth === 1) ?? null;
}

/** Today's daily wish for the home screen. `date` is the client's UTC date (YYYY-MM-DD). */
export const today = query({
  args: { deviceId: v.string(), date: v.string() },
  handler: async (ctx, { deviceId, date }) => {
    const wish = await wishFor(ctx, date);
    if (!wish?.daily) {
      const { probe, count } = await leastMapped(ctx, date);
      const copy = fallbackCopy(probe, count);
      return { ...copy, players: 0, hopId: null, passedTo: 0, open: true };
    }
    const hops = await wishHops(ctx, wish._id);
    const user = await userByDevice(ctx, deviceId);
    const hop = user ? await myHop(ctx, user, wish) : null;
    return {
      ...wish.daily,
      title: wish.text,
      players: hops.filter((h) => h.depth === 1).length,
      hopId: hop?._id ?? null,
      passedTo: hop ? hops.filter((h) => h.parentHopId === hop._id).length : 0,
      open: wish.status === "traveling",
    };
  },
});

/** Take today's wish from the well: returns this player's own pass-on link. */
export const join = mutation({
  args: { deviceId: v.string() },
  handler: async (ctx, { deviceId }) => {
    const user = await requireUser(ctx, deviceId);
    const date = dateKey(Date.now());
    let wish = await wishFor(ctx, date);
    if (!wish) {
      const { probe, count } = await leastMapped(ctx, date);
      wish = await insertWish(ctx, date, fallbackCopy(probe, count));
    }
    const existing = await myHop(ctx, user, wish);
    if (existing) return existing._id;
    return await ctx.db.insert("hops", {
      wishId: wish._id,
      depth: 1,
      holderName: user.name || "You",
      holderUserId: user._id,
      recipientTags: [],
      viaGroup: false,
    });
  },
});

export const plan = internalQuery({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    const { probe, count } = await leastMapped(ctx, date);
    return { exists: !!(await wishFor(ctx, date)), fallback: fallbackCopy(probe, count), count };
  },
});

export const insert = internalMutation({
  args: {
    date: v.string(),
    copy: v.object({
      tag: v.string(),
      learns: v.string(),
      title: v.string(),
      hint: v.string(),
      reasoning: v.string(),
    }),
  },
  handler: async (ctx, { date, copy }) => {
    if (!(await wishFor(ctx, date))) await insertWish(ctx, date, copy);
    return null;
  },
});

const DESIGNER =
  "You design the daily wish for Wishwell, an app where a wish travels friend to friend. " +
  "You work backwards: you are given the kind of friend the app wants to learn about, and you write an absurd, " +
  "specific wish for a TYPE of person, so that players forward it to exactly that kind of friend. " +
  "Rules: one sentence, under 20 words, starts with 'Someone'. Funny and warm, never mean. Harmless to be tagged with: " +
  "nothing about health, money, beliefs, appearance, dating or anything private. Never a named or famous person. " +
  'Reply with JSON only: {"title": string, "hint": string, "reasoning": string}. ' +
  "hint: under 12 words nudging who to pass it to, without naming the tag. " +
  "reasoning: 1-2 plain sentences shown to players, explaining why answering this wish tells the app who that friend is.";

/** Step 2 of the design: write the absurd wish for the chosen tag. Run by the daily cron. */
export const generate = internalAction({
  args: {},
  handler: async (ctx) => {
    const date = dateKey(Date.now());
    const { exists, fallback, count } = await ctx.runQuery(internal.daily.plan, { date });
    if (exists) return null;
    let copy = fallback;
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      try {
        const res = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gpt-5-mini",
            instructions: DESIGNER,
            input:
              `Kind of friend to learn about: "${fallback.tag}" (${fallback.learns}). ` +
              `Links of this kind mapped so far: ${count}. Example of the tone: "${fallback.title}"`,
          }),
          signal: AbortSignal.timeout(30000),
        });
        if (res.ok) {
          const body = (await res.json()) as { output?: { content?: { type?: string; text?: string }[] }[] };
          const text = (body.output ?? [])
            .flatMap((item) => item.content ?? [])
            .filter((c) => c.type === "output_text")
            .map((c) => c.text ?? "")
            .join("");
          const parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as Partial<DailyCopy>;
          if (parsed.title?.trim() && parsed.hint?.trim() && parsed.reasoning?.trim()) {
            copy = {
              ...fallback,
              title: parsed.title.trim(),
              hint: parsed.hint.trim(),
              reasoning: parsed.reasoning.trim(),
            };
          }
        }
      } catch {
        // Keep the fallback copy.
      }
    }
    await ctx.runMutation(internal.daily.insert, { date, copy });
    return null;
  },
});
