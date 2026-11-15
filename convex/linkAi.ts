// Link page AI (T2): short OpenAI copy with a 3s budget and a template fallback.
// Every AI action here returns its template on any failure (no key, rate limited,
// slow, bad response, thrown error) and never throws.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, type ActionCtx } from "./_generated/server";
import { aiAllowed } from "./aiLimits";
import { LIMITS, clampText } from "./lib";
import { limitSend, limitVerify } from "./phoneLimits";
import { checkCode, maskPhone, normalizePhone, sendCode } from "./sms";

export const AI_BUDGET_MS = 3000;
const RESEND_AFTER_MS = 60_000;
const QUESTION_MAX = 160;
const LINE_MAX = 200;

const STYLE =
  "You write copy for Wishwell, where a wish sails friend to friend as a paper boat until it reaches the right person. " +
  "Warm, light, friendly, never needy. Sentence case. No hashtags, no quotes around the answer, at most one emoji. Reply with the text only.";

/** One OpenAI call within AI_BUDGET_MS; `fallback` on any failure. */
export async function respondFast(prompt: string, fallback: string, maxOutputTokens = 200): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallback;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_BUDGET_MS);
  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-5-mini",
        instructions: STYLE,
        input: prompt,
        reasoning: { effort: "minimal" },
        max_output_tokens: maxOutputTokens,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(JSON.stringify({ event: "link_ai.http_error", status: res.status }));
      return fallback;
    }
    const body = (await res.json()) as { output?: { content?: { type?: string; text?: string }[] }[] };
    const text = (body.output ?? [])
      .flatMap((item) => item.content ?? [])
      .filter((c) => c.type === "output_text")
      .map((c) => c.text ?? "")
      .join("")
      .trim();
    return text || fallback;
  } catch (e) {
    console.warn(JSON.stringify({ event: "link_ai.fallback", error: String(e) }));
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}

function short(text: string, max = 80) {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function stripQuotes(s: string) {
  return s.trim().replace(/^["'“”]+|["'“”]+$/g, "").trim();
}

async function wishTextFor(ctx: ActionCtx, hopId: Id<"hops">): Promise<string> {
  const c = await ctx.runQuery(internal.hops.aiContext, { hopId });
  return clampText(c?.wishText ?? "", LIMITS.wish);
}

/** Runs `fn`; any throw (including rate-limiter/db errors) becomes `fallback`. */
async function safe<T>(fallback: T, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.warn(JSON.stringify({ event: "link_ai.error", error: String(e) }));
    return fallback;
  }
}

export function claimQuestionFallback(wishText: string): string[] {
  if (!wishText) return ["What makes you a fit for this wish?"];
  return [`What makes you the person for "${short(wishText, 60)}"?`, "When could you make it happen?"];
}

export const claimQuestions = action({
  args: { hopId: v.id("hops") },
  returns: v.array(v.string()),
  handler: async (ctx, { hopId }): Promise<string[]> => {
    const generic = claimQuestionFallback("");
    return await safe(generic, async () => {
      const wishText = await wishTextFor(ctx, hopId);
      const fallback = claimQuestionFallback(wishText);
      if (!wishText || !(await aiAllowed(ctx, `link:${hopId}`))) return fallback;
      const raw = await respondFast(
        `Someone says they are the person this wish is looking for. Wish: "${wishText}". ` +
          `Write 1 or 2 short questions (under 15 words each) that help the wisher tell if they really fit. ` +
          `Ground them in the wish; no yes/no questions. One question per line, no numbering.`,
        "",
      );
      const qs = raw
        .split("\n")
        .map((l) => clampText(stripQuotes(l.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, "")), QUESTION_MAX))
        .filter((l) => l.length > 3)
        .slice(0, 2);
      return qs.length > 0 ? qs : fallback;
    });
  },
});

export const vouchFor = action({
  args: { hopId: v.id("hops"), name: v.string(), relation: v.string(), reason: v.string() },
  returns: v.string(),
  handler: async (ctx, a): Promise<string> => {
    const name = clampText(a.name, LIMITS.name);
    const relation = clampText(a.relation, 30) || "friend";
    const reason = clampText(a.reason, LIMITS.vouch);
    const fallback = clampText(reason ? `${name} is my ${relation} — ${reason}` : `${name} is my ${relation}.`, LIMITS.vouch);
    return await safe(fallback, async () => {
      if (!name || !(await aiAllowed(ctx, `link:${a.hopId}`))) return fallback;
      const out = await respondFast(
        `Write one warm line (under 25 words) vouching for ${name}, the sender's ${relation}, to the person receiving this paper boat. ` +
          `Why them: "${reason || "(no reason given)"}". Use only these facts; do not invent anything.`,
        fallback,
      );
      return clampText(stripQuotes(out), LIMITS.vouch) || fallback;
    });
  },
});

export const memoryPrompt = action({
  args: { hopId: v.id("hops") },
  returns: v.string(),
  handler: async (ctx, { hopId }): Promise<string> => {
    const generic = "Who do you know who might fit?";
    return await safe(generic, async () => {
      const wishText = await wishTextFor(ctx, hopId);
      if (!wishText) return generic;
      const fallback = `Who's the first person you'd ask about "${short(wishText, 60)}"?`;
      if (!(await aiAllowed(ctx, `link:${hopId}`))) return fallback;
      const out = await respondFast(
        `Wish: "${wishText}". Write ONE short question (under 18 words) that helps someone recall a specific friend, ` +
          `coworker, classmate, family member or neighbor who fits this wish. Ask about a concrete memory or moment.`,
        fallback,
      );
      return clampText(stripQuotes(out), LINE_MAX) || fallback;
    });
  },
});

export const PROPHECY_FALLBACK = "Someone two friends away is already closer than you think.";

function keyHash(text: string) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h.toString(36);
}

export const prophecy = action({
  args: { wishText: v.string() },
  returns: v.string(),
  handler: async (ctx, a): Promise<string> => {
    return await safe(PROPHECY_FALLBACK, async () => {
      const wishText = clampText(a.wishText, LIMITS.wish);
      if (!wishText || !(await aiAllowed(ctx, `link:prophecy:${keyHash(wishText)}`))) return PROPHECY_FALLBACK;
      const out = await respondFast(
        `A wish just set sail: "${wishText}". Write one short hopeful line (under 15 words) about it finding its person. ` +
          `No promises, no dates.`,
        PROPHECY_FALLBACK,
      );
      return clampText(stripQuotes(out), LINE_MAX) || PROPHECY_FALLBACK;
    });
  },
});

/**
 * Send a verification code to the claimer's phone. Per-phone send limits apply
 * (RATE_LIMITED); INVALID_PHONE / NOT_CONFIGURED / SEND_FAILED pass through as
 * ConvexError codes from convex/sms.ts.
 */
export const sendClaimCode = action({
  args: { hopId: v.id("hops"), phone: v.string() },
  returns: v.object({ resendAfterMs: v.number() }),
  handler: async (ctx, { hopId, phone: raw }): Promise<{ resendAfterMs: number }> => {
    const hop = await ctx.runQuery(internal.hops.aiContext, { hopId });
    if (!hop) throw new Error("This link doesn't exist");
    const phone = normalizePhone(raw);
    await limitSend(ctx, phone);
    const { mode } = await sendCode(phone);
    console.log(JSON.stringify({ event: "link.claim_code_sent", hopId, phone: maskPhone(phone), mode }));
    return { resendAfterMs: RESEND_AFTER_MS };
  },
});

/**
 * Check the code with Twilio (or the demo code) and mark the hop verified for
 * this phone; `link.claim` then accepts that phone. Wrong code → `{verified:false}`.
 */
export const verifyClaimCode = action({
  args: { hopId: v.id("hops"), phone: v.string(), code: v.string() },
  returns: v.object({ verified: v.boolean() }),
  handler: async (ctx, a): Promise<{ verified: boolean }> => {
    const phone = normalizePhone(a.phone);
    await limitVerify(ctx, phone);
    const ok = await checkCode(phone, clampText(a.code, 12));
    if (!ok) return { verified: false };
    await ctx.runMutation(internal.link.markClaimVerified, { hopId: a.hopId, phone });
    return { verified: true };
  },
});

const INTRO_MAX = 320;

export function introFallback(claimerName: string, makerName: string, wishText: string): string {
  const hi = claimerName ? `Hi ${claimerName}` : "Hi";
  const wish = wishText ? ` for my wish "${short(wishText, 60)}"` : "";
  return `${hi}, it's ${makerName || "me"} from Wishwell — you're the one${wish}. Want to grab a coffee or hop on a call this week?`;
}

/**
 * Draft the first text the wisher sends the confirmed claimer from their OWN phone.
 * Returns a draft only — the app opens Messages and the wisher taps Send.
 */
export const introMessage = action({
  args: { hopId: v.id("hops") },
  returns: v.string(),
  handler: async (ctx, { hopId }): Promise<string> => {
    const generic = introFallback("", "", "");
    return await safe(generic, async () => {
      const c = await ctx.runQuery(internal.hops.aiContext, { hopId });
      if (!c) return generic;
      const claimer = clampText(c.holderName, LIMITS.name);
      const maker = clampText(c.wisherName, LIMITS.name);
      const wishText = clampText(c.wishText, LIMITS.wish);
      const fallback = introFallback(claimer, maker, wishText);
      if (!(await aiAllowed(ctx, `link:${hopId}`))) return fallback;
      const out = await respondFast(
        `Write a 1–2 sentence text message from ${maker || "the wisher"} to ${claimer || "the person"}, who said they are the one ` +
          `for this wish: "${wishText}". Start with "Hi ${claimer || "there"}, it's ${maker || "me"} from Wishwell". ` +
          `Say they're the one for the wish and suggest meeting up or a quick call. Use only these facts.`,
        fallback,
      );
      return clampText(stripQuotes(out), INTRO_MAX) || fallback;
    });
  },
});
