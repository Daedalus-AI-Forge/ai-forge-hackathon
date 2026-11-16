// Link page funnel + OG preview data (T4, docs/superpowers/plans/2026-11-15-link-page.md).
import { v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import { internalQuery, mutation, query } from "./_generated/server";
import { requireDeviceId, userByDevice } from "./lib";
import { senderDisplayName, vouchForHolder } from "./link";

const linkEventValidator = v.union(
  v.literal("open"), v.literal("wish_written"), v.literal("skip_wish"), v.literal("claim"),
  v.literal("push"), v.literal("contact"), v.literal("download_click"),
);

/** Per-event read cap for the funnel query (bounded reads). */
export const METRICS_TAKE = 5000;

export const track = mutation({
  args: {
    hopId: v.optional(v.id("hops")),
    deviceId: v.string(),
    event: linkEventValidator,
    wroteWish: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    requireDeviceId(args.deviceId);
    const user = await userByDevice(ctx, args.deviceId);
    await ctx.db.insert("linkEvents", {
      hopId: args.hopId,
      userId: user?._id,
      event: args.event,
      wroteWish: args.wroteWish,
      at: Date.now(),
    });
    return null;
  },
});

export type LinkMetrics = {
  opened: number;
  wroteWish: number;
  skipped: number;
  completed: number;
  leftContact: number;
  downloadClicks: number;
  completionRate: number;
  completionRateWish: number;
  completionRateSkip: number;
};

function rate(num: number, den: number) {
  return den > 0 ? num / den : 0;
}

/** Pure funnel math over event rows; completed = claim + push. */
export function funnel(events: Pick<Doc<"linkEvents">, "event" | "wroteWish">[]): LinkMetrics {
  const count = (e: Doc<"linkEvents">["event"]) => events.filter((x) => x.event === e).length;
  const done = events.filter((x) => x.event === "claim" || x.event === "push");
  const opened = count("open");
  const wroteWish = count("wish_written");
  const skipped = count("skip_wish");
  const completed = done.length;
  return {
    opened,
    wroteWish,
    skipped,
    completed,
    leftContact: count("contact"),
    downloadClicks: count("download_click"),
    completionRate: rate(completed, opened),
    completionRateWish: rate(done.filter((x) => x.wroteWish === true).length, wroteWish),
    completionRateSkip: rate(done.filter((x) => x.wroteWish === false).length, skipped),
  };
}

const EVENTS = ["open", "wish_written", "skip_wish", "claim", "push", "contact", "download_click"] as const;

export const metrics = query({
  args: {},
  handler: async (ctx): Promise<LinkMetrics> => {
    const rows: Doc<"linkEvents">[] = [];
    for (const event of EVENTS) {
      const batch = await ctx.db
        .query("linkEvents")
        .withIndex("by_event", (q) => q.eq("event", event))
        .take(METRICS_TAKE);
      rows.push(...batch);
    }
    return funnel(rows);
  },
});

// ===== OG preview (used by convex/http.ts GET /og/w/:hopId) =====

export type OgHop = { hopId: string; senderName: string; introVouch: string | null; wishText: string };

export const ogHop = internalQuery({
  args: { hopId: v.string() },
  handler: async (ctx, args): Promise<OgHop | null> => {
    const hopId = ctx.db.normalizeId("hops", args.hopId);
    if (!hopId) return null;
    const hop = await ctx.db.get("hops", hopId);
    if (!hop) return null;
    const wish = await ctx.db.get("wishes", hop.wishId);
    if (!wish) return null;
    let senderName: string | undefined;
    const introVouch = await vouchForHolder(ctx, hop, wish);
    if (hop.parentHopId) {
      const parent = await ctx.db.get("hops", hop.parentHopId);
      senderName = parent?.holderName;
    } else {
      const creator = await ctx.db.get("users", wish.creatorId);
      senderName = creator?.name;
    }
    return {
      hopId,
      senderName: senderDisplayName(senderName),
      introVouch,
      wishText: wish.text,
    };
  },
});

export function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function trimSlash(url: string | undefined) {
  return (url ?? "").trim().replace(/\/+$/, "");
}

const OG_VOUCH_MAX = 50;

function clip(text: string, max: number) {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** The share-preview page: OG/Twitter tags + an instant redirect to the web link page. */
export function ogHtml(hop: OgHop, appWebUrl: string | undefined) {
  const base = trimSlash(appWebUrl);
  // Short, specific, no brand (Apple TN3156); see docs/superpowers/specs/2026-11-15-ai-greetings-design.md #4.
  const vouch = hop.introVouch ? clip(hop.introVouch, OG_VOUCH_MAX) : null;
  const title = vouch ? `${hop.senderName}: ${vouch}` : `${hop.senderName} thought of you for a wish`;
  const description = `…and sent you a free wish 🪙 — ${hop.wishText}`;
  const target = `${base}/l/${encodeURIComponent(hop.hopId)}`;
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  const u = escapeHtml(target);
  const image = base ? escapeHtml(`${base}/og-cover.jpg`) : "";
  const imageTags = image
    ? `<meta property="og:image" content="${image}">\n<meta name="twitter:image" content="${image}">\n`
    : "";
  return `<!doctype html>
<html><head>
<meta charset="utf-8">
<title>${t}</title>
<meta property="og:type" content="website">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${u}">
${imageTags}<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta http-equiv="refresh" content="0; url=${u}">
</head><body>
<p><a href="${u}">${t}</a></p>
</body></html>`;
}

export function ogNotFoundHtml() {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Boat not found</title></head>
<body><p>This paper boat could not be found.</p></body></html>`;
}
