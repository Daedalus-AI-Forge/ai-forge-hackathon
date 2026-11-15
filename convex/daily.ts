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
import { MAX_RIPPLES, requireUser, userByDevice, wishHops } from "./lib";

const DAY_MS = 24 * 60 * 60 * 1000;
/** A daily wish passes through six people, so the well plans one clue per pass. */
const STEPS = MAX_RIPPLES - 1;

/**
 * What the well wants to learn: for each player, which friend is their link
 * to this kind of person. Keep these to interests and habits. Nothing a
 * person would mind being tagged with (no health, money, beliefs, dating).
 * `trait` and `hint` are the fallback copy when the LLM is unavailable.
 */
export const PROBES = [
  {
    tag: "art scene",
    learns: "who your way into the art world is",
    trait: "can explain why one red sock is art",
    hint: "Think of whoever drags you to gallery openings.",
  },
  {
    tag: "night owl",
    learns: "which of your friends is up when everyone else is asleep",
    trait: "is wide awake at 3am with a snack recommendation",
    hint: "Who replies to your texts at 3am?",
  },
  {
    tag: "new in town",
    learns: "who you know that just moved cities",
    trait: "still needs a map to find their own apartment",
    hint: "Who just moved somewhere new?",
  },
  {
    tag: "career leap",
    learns: "who you know that made a big life turn",
    trait: "quit a sensible job for one their parents can't describe",
    hint: "Who made a leap you still talk about?",
  },
  {
    tag: "knows everyone",
    learns: "who the connector in your circle is",
    trait: "can't cross a street without bumping into someone they know",
    hint: "Who do you call when you need to find anyone?",
  },
  {
    tag: "food scout",
    learns: "who always knows where to eat",
    trait: "has strong feelings about a dumpling place nobody has heard of",
    hint: "Who picks the restaurant every time?",
  },
  {
    tag: "outdoors",
    learns: "who your outdoorsy friend is",
    trait: "owns more tents than chairs",
    hint: "Who is always halfway up a mountain?",
  },
  {
    tag: "music",
    learns: "who your way into the music scene is",
    trait: "cried at a concert this year and will admit it",
    hint: "Who always has a spare ticket?",
  },
] as const;

type Step = { tag: string; learns: string; hint: string };
type DailyCopy = { title: string; steps: Step[]; reasoning: string };

export function dateKey(now: number) {
  return new Date(now).toISOString().slice(0, 10);
}

/** The clue for the pass a holder at this depth makes. */
export function stepAt(daily: { steps: Step[] }, depth: number) {
  return daily.steps[Math.min(depth, daily.steps.length) - 1];
}

async function wishFor(ctx: QueryCtx, date: string) {
  return await ctx.db
    .query("wishes")
    .withIndex("by_daily_date", (q) => q.eq("daily.date", date))
    .first();
}

/**
 * Step 1 of the design: line up the circles the map knows least about, one per
 * pass. The least mapped goes first because the first ripple has the most
 * players. Ties rotate by day. The fallback portrait is the person at the end.
 */
async function planChain(ctx: QueryCtx, date: string) {
  const day = Math.floor(Date.parse(date) / DAY_MS);
  const ranked = [];
  for (const [i, probe] of PROBES.entries()) {
    const count = (
      await ctx.db
        .query("edges")
        .withIndex("by_tag", (q) => q.eq("tag", probe.tag))
        .take(200)
    ).length;
    ranked.push({ probe, count, turn: (((i - day) % PROBES.length) + PROBES.length) % PROBES.length });
  }
  const chain = ranked.sort((a, b) => a.count - b.count || a.turn - b.turn).slice(0, STEPS);
  const copy: DailyCopy = {
    title: `Someone who ${chain[STEPS - 2].probe.trait} and ${chain[STEPS - 1].probe.trait}.`,
    steps: chain.map(({ probe }) => ({ tag: probe.tag, learns: probe.learns, hint: probe.hint })),
    reasoning:
      `The well lined up the ${STEPS} circles it knows least about: ${chain.map((c) => c.probe.tag).join(", ")}. ` +
      `Each pass follows one clue, so six people later the wish lands on one very specific person, ` +
      `and each pass tells the well who that link is for the person passing.`,
  };
  return { copy, tags: chain.map((c) => `${c.probe.tag} (${c.count} mapped)`) };
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
    daily: { date, steps: copy.steps, reasoning: copy.reasoning },
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
      const { copy } = await planChain(ctx, date);
      return { title: copy.title, ...copy.steps[0], reasoning: copy.reasoning, players: 0, hopId: null, passedTo: 0, open: true };
    }
    const hops = await wishHops(ctx, wish._id);
    const user = await userByDevice(ctx, deviceId);
    const hop = user ? await myHop(ctx, user, wish) : null;
    return {
      title: wish.text,
      ...wish.daily.steps[0],
      reasoning: wish.daily.reasoning,
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
      wish = await insertWish(ctx, date, (await planChain(ctx, date)).copy);
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
    return { exists: !!(await wishFor(ctx, date)), ...(await planChain(ctx, date)) };
  },
});

export const insert = internalMutation({
  args: {
    date: v.string(),
    copy: v.object({
      title: v.string(),
      steps: v.array(v.object({ tag: v.string(), learns: v.string(), hint: v.string() })),
      reasoning: v.string(),
    }),
  },
  handler: async (ctx, { date, copy }) => {
    if (!(await wishFor(ctx, date))) await insertWish(ctx, date, copy);
    return null;
  },
});

const DESIGNER =
  "You design the daily wish for Wishwell, an app where a wish travels friend to friend through six people. " +
  "You work backwards: you are given an ordered chain of kinds of friend the app wants to learn about, one per pass. " +
  "Write (1) the wish: an absurd, specific portrait of the ONE person at the end of the chain, a TYPE of person, " +
  "one sentence under 25 words starting with 'Someone'; (2) one clue per pass, in order, each under 12 words, " +
  "nudging the holder to pass it to that kind of friend without naming the tag, so the clues read as a trail " +
  "narrowing toward the portrait. Funny and warm, never mean. Harmless to be tagged with: nothing about health, " +
  "money, beliefs, appearance, dating or anything private. Never a named or famous person. " +
  'Reply with JSON only: {"title": string, "hints": string[], "reasoning": string}. ' +
  "reasoning: 1-2 plain sentences shown to players on why following the clues reaches that person.";

/** Step 2 of the design: write the portrait and the trail of clues for the planned chain. Run by the daily cron. */
export const generate = internalAction({
  args: {},
  handler: async (ctx) => {
    const date = dateKey(Date.now());
    const { exists, copy: fallback, tags } = await ctx.runQuery(internal.daily.plan, { date });
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
            input: `Chain, in pass order: ${tags.join(" -> ")}. Example of the tone: "${fallback.title}"`,
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
          const parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as {
            title?: string;
            hints?: string[];
            reasoning?: string;
          };
          const hints = parsed.hints ?? [];
          if (
            parsed.title?.trim() &&
            parsed.reasoning?.trim() &&
            hints.length === fallback.steps.length &&
            hints.every((h) => typeof h === "string" && h.trim())
          ) {
            copy = {
              title: parsed.title.trim(),
              steps: fallback.steps.map((s, i) => ({ ...s, hint: hints[i].trim() })),
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
