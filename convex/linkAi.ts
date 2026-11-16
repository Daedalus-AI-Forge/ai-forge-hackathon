// Link page AI (T2): short OpenAI copy with a 3s budget and a template fallback.
// Every AI action here returns its template on any failure (no key, rate limited,
// slow, bad response, thrown error) and never throws.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, type ActionCtx } from "./_generated/server";
import { aiAllowed } from "./aiLimits";
import { FACTS_RULES, checkDraft, firstName, wishGist } from "./greetings";
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
export async function respondFast(
  prompt: string,
  fallback: string,
  maxOutputTokens = 200,
  instructions = STYLE,
): Promise<string> {
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
        instructions,
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
        `FACTS: name=${name}; relation=${relation}; reason="${reason}". ` +
          `Write one warm line vouching for ${name}, the sender's ${relation}, to the person receiving this paper boat. ` +
          `Keep the reason's concrete detail (instrument, place, group). First person from the sender. Max ${VOUCH_MAX} chars. ` +
          `Don't add praise words (amazing, best, legend). If reason is empty, stay generic.`,
        "",
        200,
        `${STYLE} ${FACTS_RULES}`,
      );
      return checkDraft(out, [name, relation, reason], VOUCH_MAX) ?? fallback;
    });
  },
});

/**
 * Deterministic copy for wish topics we can ground without a model call: the wish text or the
 * holder's city names the place. Used first so the link page never waits on OpenAI for these.
 */
const TOPICS: { match: RegExp; question: string; reasons: string[] }[] = [
  {
    match: /\b(tea ceremony|chanoyu|sado|japan|japanese|kyoto|osaka|tokyo|ikebana|kimono|calligraphy)\b/i,
    question: "Who do you know in Japan's traditional arts?",
    reasons: ["Makes ceramics in Kyoto", "Studies a Japanese art", "Grew up in Japan"],
  },
];

export function topicHint(wishText: string, holderCity = ""): { question: string; reasons: string[] } | null {
  const facts = `${wishText} ${holderCity}`;
  const t = TOPICS.find((x) => x.match.test(facts));
  return t ? { question: t.question, reasons: t.reasons } : null;
}

async function holderCityFor(ctx: ActionCtx, hopId: Id<"hops">): Promise<string> {
  return clampText((await ctx.runQuery(internal.link.holderCity, { hopId })) ?? "", LIMITS.city);
}

export const memoryPrompt = action({
  args: { hopId: v.id("hops") },
  returns: v.string(),
  handler: async (ctx, { hopId }): Promise<string> => {
    const generic = "Who do you know who might fit?";
    return await safe(generic, async () => {
      const wishText = await wishTextFor(ctx, hopId);
      if (!wishText) return generic;
      const topic = topicHint(wishText, await holderCityFor(ctx, hopId));
      if (topic) return topic.question;
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

export const PASS_REASON_FALLBACK = ["Is into this kind of thing", "Knows a lot of people", "Would love to help"];
const REASON_MAX = 40;

/**
 * Three short, tappable reasons for "why them" on the link page's pass-on card, grounded in the wish.
 * They double as the vouch the next person sees, so they stay friendly and never touch private matters.
 */
export const passReasons = action({
  args: { hopId: v.id("hops") },
  returns: v.array(v.string()),
  handler: async (ctx, { hopId }): Promise<string[]> => {
    return await safe(PASS_REASON_FALLBACK, async () => {
      const wishText = await wishTextFor(ctx, hopId);
      const topic = wishText ? topicHint(wishText, await holderCityFor(ctx, hopId)) : null;
      if (topic) return topic.reasons;
      if (!wishText || !(await aiAllowed(ctx, `link:${hopId}`))) return PASS_REASON_FALLBACK;
      const raw = await respondFast(
        `Wish: "${wishText}". Someone is about to pass this wish to one friend who fits it or who knows who does. ` +
          `Write 3 different short reasons (2 to 6 words each) they could tap to say why that friend. ` +
          `Each starts with a verb describing the friend, like "Plays in a band" or "Knows the local scene". ` +
          `Ground them in the wish. Never mention health, money, romance, religion or politics. ` +
          `One per line, no numbering, no period, no emoji.`,
        "",
      );
      const reasons = raw
        .split("\n")
        .map((l) => clampText(stripQuotes(l.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, "")).replace(/[.!]+$/, ""), REASON_MAX))
        .filter((l) => l.length > 3);
      const unique = [...new Set(reasons)].slice(0, 3);
      return unique.length === 3 ? unique : PASS_REASON_FALLBACK;
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
    const { mode } = await limitSend(ctx, phone, () => sendCode(phone));
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

const INTRO_MAX = 220;
const VOUCH_MAX = 120;

/** "Louise and Katie" from the middle of a chain (wisher and claimer excluded). */
function joinNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

export function introFallback(claimerName: string, makerName: string, wishText: string, chainMiddle: string[] = []): string {
  const hi = claimerName ? `Hi ${claimerName}` : "Hi";
  const me = makerName ? `, it's ${makerName}!` : "!";
  const gist = wishText ? ` about "${wishGist(wishText, 60)}"` : "";
  const via = chainMiddle.length
    ? ` ${joinNames(chainMiddle)} connected us${gist}.`
    : ` Thanks for saying you're the one${gist}.`;
  return `${hi}${me}${via} Want to set something up?`;
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
      const claimer = firstName(clampText(c.holderName, LIMITS.name));
      const maker = firstName(clampText(c.wisherName, LIMITS.name));
      const wishText = clampText(c.wishText, LIMITS.wish);
      const chain = c.chain.map((n) => clampText(n, LIMITS.name));
      const vouch = clampText(c.introVouch ?? "", LIMITS.vouch);
      const youSaid = clampText(c.itsMeIntro ?? "", LIMITS.intro);
      const fallback = introFallback(claimer, maker, wishText, chain.slice(1, -1));
      if (!(await aiAllowed(ctx, `link:${hopId}`))) return fallback;
      const out = await respondFast(
        `FACTS: me=${maker}; you=${claimer}; wish="${wishText}"; chain=${chain.join(" → ")}; ` +
          `vouch="${vouch}"; you_said="${youSaid}". Write a first text from me to you, max ${INTRO_MAX} chars. ` +
          `Thank them by name for the chain (who connected us), mention one fact from vouch or you_said, ` +
          `and propose one easy next step as a question. End with a question mark. No dates unless in FACTS.`,
        "",
        200,
        `${STYLE} ${FACTS_RULES}`,
      );
      const ok = checkDraft(out, [maker, claimer, wishText, vouch, youSaid, ...chain], INTRO_MAX);
      if (!ok && out) console.warn(JSON.stringify({ event: "link_ai.intro_rejected" }));
      return ok ?? fallback;
    });
  },
});
