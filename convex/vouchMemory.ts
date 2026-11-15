import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, type QueryCtx } from "./_generated/server";
import { respond } from "./ai";
import { aiAllowed } from "./aiLimits";
import { clampText } from "./lib";

const TAG_MAX = 5;
const NETWORK_TAG_MAX = 10;
const SUMMARY_VOUCHES_MAX = 50;

export const TRAITS = [
  "reliable",
  "fun",
  "kind",
  "adventurous",
  "funny",
  "generous",
  "smart",
  "patient",
  "creative",
  "fearless",
  "thoughtful",
];

const KEYWORDS: [string, RegExp][] = [
  ...TRAITS.map((t): [string, RegExp] => [t, new RegExp(`\\b${t}\\b`, "i")]),
  ["drums", /\bdrum/i],
  ["music", /\b(music|musician|band|bandmates?|concerts?|gigs?|dj|jam|sings?|guitar|piano)\b/i],
  ["climbing", /\b(climb|boulder)/i],
  ["food", /\b(food|foodie|ramen|cooks?|chef|restaurants?|izakayas?|dumplings?)\b/i],
  ["coffee", /\b(coffee|barista|espresso)\b/i],
  ["travel", /\b(travel|trips?|backpack)/i],
  ["design", /\bdesign/i],
  ["startups", /\b(startups?|founders?|co-?founders?)\b/i],
  ["photography", /\b(photo|camera|film)/i],
  ["outdoors", /\b(hikes?|hiking|camping|ski|surf)/i],
  ["tech", /\b(engineer|coding|developer|tech)\b/i],
  ["art", /\b(art|artist|painter|painting)\b/i],
  ["sports", /\b(soccer|football|basketball|tennis|marathons?)\b/i],
  ["Iceland", /\biceland/i],
  ["Tokyo", /\btokyo\b/i],
  ["Japan", /\bjapan/i],
  ["Shanghai", /\bshanghai\b/i],
  ["London", /\blondon\b/i],
  ["New York", /\b(new york|nyc)\b/i],
  ["SF", /\b(sf|san francisco)\b/i],
  ["Antarctica", /\bantarctic/i],
];

function mergeTags(lists: string[][], max: number) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of lists.flat()) {
    const t = clampText(tag.replace(/^#/, ""), 30);
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
    if (out.length === max) break;
  }
  return out;
}

/** Template tags: keyword match against a small list, merged after the tags the voucher tapped. */
export function keywordTags(text: string, existing: string[] = []) {
  return mergeTags([existing, KEYWORDS.filter(([, re]) => re.test(text)).map(([tag]) => tag)], TAG_MAX);
}

/** Defensive parse of the model's tag list: a JSON array, or failing that a comma list. */
export function parseTags(raw: string) {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  let items: unknown[] = [];
  if (start >= 0 && end > start) {
    try {
      const parsed: unknown = JSON.parse(raw.slice(start, end + 1));
      if (Array.isArray(parsed)) items = parsed;
    } catch {
      items = [];
    }
  }
  if (items.length === 0) items = raw.split(/[,\n]/);
  const tags = items
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.replace(/["'`.]/g, "").trim())
    .filter((t) => t.length > 0 && t.length <= 30 && t.split(/\s+/).length <= 3);
  return mergeTags([tags], TAG_MAX);
}

export async function visibleVouchesAbout(ctx: QueryCtx, userId: Id<"users">) {
  const vouches = await ctx.db
    .query("vouches")
    .withIndex("by_aboutUserId", (q) => q.eq("aboutUserId", userId))
    .order("desc")
    .take(200);
  return vouches.filter((x) => !x.hidden).slice(0, SUMMARY_VOUCHES_MAX);
}

export function summaryBasis(vouches: Doc<"vouches">[]) {
  return vouches
    .map((x) => x._id)
    .sort()
    .join(",");
}

function listOf(items: string[]) {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/** "3 friends say you're reliable, fun, and know everyone in music", built from tag counts. */
export function summaryFallback(vouches: Pick<Doc<"vouches">, "byName" | "tags">[]) {
  if (vouches.length === 0) return null;
  const friends = new Set(vouches.map((x) => x.byName.trim().toLowerCase())).size;
  const counts = new Map<string, { tag: string; count: number }>();
  for (const x of vouches) {
    for (const tag of x.tags) {
      const key = tag.toLowerCase();
      const seen = counts.get(key);
      counts.set(key, { tag: seen?.tag ?? tag, count: (seen?.count ?? 0) + 1 });
    }
  }
  const isPlace = (tag: string) => tag !== tag.toLowerCase();
  const ranked = [...counts.values()]
    .sort((a, b) => b.count - a.count || Number(isPlace(a.tag)) - Number(isPlace(b.tag)))
    .map((c) => c.tag);
  const traits = ranked.filter((t) => TRAITS.includes(t.toLowerCase())).map((t) => t.toLowerCase()).slice(0, 3);
  const interest = ranked.find((t) => !TRAITS.includes(t.toLowerCase()));
  const who = friends === 1 ? "1 friend says" : `${friends} friends say`;
  const know = interest ? `know everyone in ${interest}` : null;
  if (traits.length === 0) return know ? `${who} you ${know}.` : `${who} good things about you.`;
  if (!know) return `${who} you're ${listOf(traits)}.`;
  return traits.length === 1
    ? `${who} you're ${traits[0]} and ${know}.`
    : `${who} you're ${traits.join(", ")}, and ${know}.`;
}

export const vouchForTagging = internalQuery({
  args: { vouchId: v.id("vouches") },
  handler: async (ctx, { vouchId }) => {
    const vouch = await ctx.db.get("vouches", vouchId);
    return vouch ? { text: vouch.text, tags: vouch.tags, hopId: vouch.hopId } : null;
  },
});

/** Store a vouch's tags and enrich the voucher's network row about that person, then refresh their summary. */
export const saveVouchTags = internalMutation({
  args: { vouchId: v.id("vouches"), tags: v.array(v.string()) },
  handler: async (ctx, { vouchId, tags }) => {
    const vouch = await ctx.db.get("vouches", vouchId);
    if (!vouch) return null;
    const merged = mergeTags([vouch.tags, tags], TAG_MAX);
    await ctx.db.patch("vouches", vouchId, { tags: merged });
    const hop = await ctx.db.get("hops", vouch.hopId);
    if (hop?.holderUserId) {
      const ownerId = hop.holderUserId;
      const rows = await ctx.db
        .query("network")
        .withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId))
        .take(200);
      const row = rows.find((r) => r.personName.trim().toLowerCase() === vouch.aboutName.trim().toLowerCase());
      if (row) await ctx.db.patch("network", row._id, { tags: mergeTags([row.tags, merged], NETWORK_TAG_MAX) });
    }
    if (vouch.aboutUserId) {
      await ctx.scheduler.runAfter(0, internal.vouchMemory.refreshSummary, { userId: vouch.aboutUserId });
    }
    return null;
  },
});

/** Vouch memory: pull 1-5 short tags out of a new vouch (OpenAI, keyword fallback). */
export const tagVouch = internalAction({
  args: { vouchId: v.id("vouches") },
  handler: async (ctx, { vouchId }) => {
    const vouch: { text: string; tags: string[]; hopId: Id<"hops"> } | null = await ctx.runQuery(
      internal.vouchMemory.vouchForTagging,
      { vouchId },
    );
    if (!vouch) return null;
    const fallback = keywordTags(vouch.text, vouch.tags);
    let tags = fallback;
    if (process.env.OPENAI_API_KEY && (await aiAllowed(ctx, `hop:${vouch.hopId}`))) {
      const raw = await respond(
        `Vouch: "${vouch.text}"\nList 1 to 5 short tags (1-2 words each) for the person this vouch is about: ` +
          `their traits, interests and places (e.g. reliable, music, climbing, Iceland). Lowercase except place names. ` +
          `Reply with a JSON array of strings only.`,
        "",
        { instructions: "You extract tags. Output strict JSON only, no prose.", maxOutputTokens: 120 },
      );
      const parsed = raw ? parseTags(raw) : [];
      if (parsed.length > 0) tags = mergeTags([vouch.tags, parsed], TAG_MAX);
    }
    await ctx.runMutation(internal.vouchMemory.saveVouchTags, { vouchId, tags });
    return null;
  },
});

export const summaryContext = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get("users", userId);
    if (!user) return null;
    const vouches = await visibleVouchesAbout(ctx, userId);
    return {
      name: user.name,
      basis: summaryBasis(vouches),
      vouches: vouches.map((x) => ({ byName: x.byName, text: x.text, tags: x.tags })),
    };
  },
});

export const saveSummary = internalMutation({
  args: { userId: v.id("users"), text: v.union(v.string(), v.null()), basis: v.string() },
  handler: async (ctx, { userId, text, basis }) => {
    const user = await ctx.db.get("users", userId);
    if (!user) return null;
    await ctx.db.patch("users", userId, {
      friendsSummary: text ? { text: clampText(text, 300), basis, updatedAt: Date.now() } : undefined,
    });
    return null;
  },
});

/** "How friends see you": rebuild the cached summary from the vouches I haven't hidden. */
export const refreshSummary = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const context: {
      name: string;
      basis: string;
      vouches: { byName: string; text: string; tags: string[] }[];
    } | null = await ctx.runQuery(internal.vouchMemory.summaryContext, { userId });
    if (!context) return null;
    const fallback = summaryFallback(context.vouches);
    let text = fallback;
    if (fallback && process.env.OPENAI_API_KEY && (await aiAllowed(ctx, `user:${userId}`))) {
      const friends = new Set(context.vouches.map((x) => x.byName.trim().toLowerCase())).size;
      text = await respond(
        `Friends wrote these vouches about ${context.name || "this person"}:\n` +
          context.vouches.map((x) => `- ${x.byName}: "${x.text}" (tags: ${x.tags.join(", ")})`).join("\n") +
          `\nWrite ONE short line (under 22 words) to them, starting with "${friends === 1 ? "1 friend says" : `${friends} friends say`} you're", ` +
          `naming 2-3 traits and what they're known for. Use only what the vouches say.`,
        fallback,
        { maxOutputTokens: 120 },
      );
    }
    await ctx.runMutation(internal.vouchMemory.saveSummary, { userId, text, basis: context.basis });
    return null;
  },
});
