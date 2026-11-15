import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalAction, type ActionCtx } from "./_generated/server";
import { aiAllowed } from "./aiLimits";
import { STORY_MAX } from "./endings";
import { COACH_THRESHOLD, COACH_TURNS_MAX, WISH_TEXT_MAX, type Candidate } from "./graphShared";
import { isCoachReady } from "./graphRank";
import { LIMITS, clampText, requireDeviceId } from "./lib";
import { wishType } from "./schema";

const STYLE =
  "You write copy for Wishwell, a playful app where a wish travels friend to friend until it reaches the right person. " +
  "Warm, light, friendly, never needy. Sentence case. No hashtags, no quotes around the answer, at most one emoji. Reply with the text only.";

async function respond(
  prompt: string,
  fallback: string,
  opts: { instructions?: string; maxOutputTokens?: number } = {},
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallback;
  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        instructions: opts.instructions ?? STYLE,
        input: prompt,
        reasoning: { effort: "minimal" },
        max_output_tokens: opts.maxOutputTokens ?? 400,
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return fallback;
    const body = (await res.json()) as {
      output?: { content?: { type?: string; text?: string }[] }[];
    };
    const text = (body.output ?? [])
      .flatMap((item) => item.content ?? [])
      .filter((c) => c.type === "output_text")
      .map((c) => c.text ?? "")
      .join("")
      .trim();
    return text || fallback;
  } catch {
    return fallback;
  }
}

const TYPE_HINT = {
  do_together: "someone to do something with",
  local: "a local who can show them around",
  been_there: "someone who has been somewhere or done something",
  same_boat: "someone in the same situation",
} as const;

export const polishWish = action({
  args: { deviceId: v.string(), type: wishType, text: v.string() },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    requireDeviceId(args.deviceId);
    const text = clampText(args.text, LIMITS.wish);
    if (!text || !(await aiAllowed(ctx, `device:${args.deviceId}`))) return text;
    return await respond(
      `Rewrite this wish in at most 2 short sentences: [type of person] + [what to do] + a short warm why, so friends want to help. ` +
        `It asks for ${TYPE_HINT[args.type]}, never a specific named person. Keep the wisher's voice (first person). Wish: "${text}"`,
      text,
    );
  },
});

const ASK_MAX_PEOPLE = 40;
const ASK_MAX_TAGS = 8;

/** Ask the well: from the people in my wish network, who should get this wish first? */
export const askTheWell = action({
  args: { deviceId: v.string(), text: v.string() },
  returns: v.union(v.null(), v.object({ name: v.string(), reason: v.string() })),
  handler: async (ctx, args): Promise<{ name: string; reason: string } | null> => {
    requireDeviceId(args.deviceId);
    const text = clampText(args.text, LIMITS.wish);
    if (!text) return null;
    // Same ranking as the coach: top-1 grounded candidate from the caller's own edges.
    const owner = await ctx.runQuery(internal.graphRank.coachContext, { deviceId: args.deviceId });
    if (owner.ownerUserId && owner.edgeCount > 0) {
      const allowed = await aiAllowed(ctx, `device:${args.deviceId}`);
      const [top]: Candidate[] = await ctx.runAction(internal.graphRank.rankForWish, {
        ownerUserId: owner.ownerUserId,
        wishText: text,
        limit: 1,
        useMemory: allowed,
      });
      if (top) {
        // Same wording as the pre-ranking fallback (existing clients/tests rely on it).
        const fallback = `In your wish network ${top.name} is tagged ${[...new Set(top.evidence.map((e) => e.tag))].join(", ")}.`;
        const reason = !allowed
          ? fallback
          : await respond(
              `A user is about to send this wish: "${text}". The well picked ${top.name} from their network. ` +
                `What the user told the well about ${top.name}:\n${evidenceLines(top)}\n` +
                `Write one short reason to the user (under 18 words) why ${top.name} is a good first pass. ` +
                `Use only the facts above; do not invent anything.`,
              fallback,
            );
        return { name: top.name, reason: clampText(reason, 200) || fallback };
      }
    }
    return await askByTags(ctx, args.deviceId, text);
  },
});

/** Pre-ranking fallback when nothing in the network matches: the most-tagged person. */
async function askByTags(ctx: ActionCtx, deviceId: string, text: string) {
  const network: { name: string; tags: { tag: string }[] }[] = await ctx.runQuery(internal.edges.forAsk, {
    deviceId,
  });
  // forAsk sorts by tag count; cap what goes into the prompt.
  const people = network.slice(0, ASK_MAX_PEOPLE).map((p) => ({ ...p, tags: p.tags.slice(0, ASK_MAX_TAGS) }));
  if (people.length === 0) return null;
  const best = people[0];
  const fallback = `${best.name} | In your wish network ${best.name} is tagged ${best.tags.map((t) => t.tag).join(", ")}.`;
  const allowed = await aiAllowed(ctx, `device:${deviceId}`);
  const answer = !allowed
    ? fallback
    : await respond(
        `A user is about to send this wish: "${text}". People they have passed wishes to before, with the tags they carry:\n` +
          people.map((p) => `- ${p.name}: ${p.tags.map((t) => t.tag).join(", ")}`).join("\n") +
          `\nPick the ONE person most likely to know someone who fits. Use only the tags above; do not invent facts. ` +
          `Reply exactly as: Name | one short reason written to the user (under 18 words).`,
        fallback,
      );
  const [rawName, ...rest] = answer.split("|");
  const match = people.find((p) => p.name.toLowerCase() === rawName.trim().toLowerCase());
  const reason = rest.join("|").trim();
  if (!match || !reason) {
    const [name, why] = fallback.split(" | ");
    return { name, reason: why };
  }
  return { name: match.name, reason };
}

// ---------- AI coach (docs/api/wishwell-graph-api.md §4) ----------

const COACH_SUGGESTIONS_MAX = 3;
const COACH_TURN_TEXT_MAX = 300;
const COACH_MESSAGE_MAX = 400;
const COACH_WHY_MAX = 200;

const COACH_INSTRUCTIONS =
  "You are the Wishwell coach. You help a user decide which people in their OWN network to pass a wish to. " +
  "Rules: suggest at most 3 people, ONLY from the candidate list you are given, identified by their personKey. " +
  "Each `why` must be grounded only in that candidate's listed evidence (tags and reasons the user wrote); never invent facts. " +
  "End the message with exactly one short guiding question. Never offer to send, forward or message anyone; the user does that. " +
  'Output strict JSON only, no prose, no code fences: {"message": string, "suggestions": [{"personKey": string, "why": string}]}';

const coachTurn = v.object({ role: v.union(v.literal("user"), v.literal("coach")), text: v.string() });
const coachEvidence = v.object({ tag: v.string(), reason: v.union(v.string(), v.null()) });

type CoachSuggestion = { name: string; personKey: string; why: string; evidence: Candidate["evidence"] };
type CoachResult =
  | { ready: false; edgeCount: number; threshold: number }
  | { ready: true; message: string; suggestions: CoachSuggestion[] };

function evidenceLines(c: Candidate) {
  return c.evidence.map((e) => `  - tag "${e.tag}"${e.reason ? `: "${e.reason}"` : ""}`).join("\n");
}

function templateWhy(c: Candidate) {
  const tags = [...new Set(c.evidence.map((e) => e.tag))];
  const reason = c.evidence.find((e) => e.reason)?.reason;
  return `You tagged ${c.name} ${tags.join(", ")}${reason ? ` and said "${reason}"` : ""}.`;
}

/** Template answer used whenever OpenAI is unavailable, rate limited, or returns something unusable. */
export function coachFallback(candidates: Candidate[]): { message: string; suggestions: CoachSuggestion[] } {
  const top = candidates.slice(0, COACH_SUGGESTIONS_MAX);
  if (top.length === 0) {
    return {
      message: "Nothing you've told the well matches this wish yet. Who do you know that has done something like it?",
      suggestions: [],
    };
  }
  const names = top.map((c) => c.name);
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
  return {
    message: `From what you've told the well, ${list} could be a good first pass. Who feels closest to this wish?`,
    suggestions: top.map((c) => ({ name: c.name, personKey: c.personKey, why: templateWhy(c), evidence: c.evidence })),
  };
}

/** Defensive parse of the model's JSON; drops anything not in the candidate list. Null = unusable. */
export function parseCoachReply(raw: string, candidates: Candidate[]) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let body: unknown;
  try {
    body = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!body || typeof body !== "object") return null;
  const { message, suggestions } = body as { message?: unknown; suggestions?: unknown };
  if (typeof message !== "string" || !message.trim() || !Array.isArray(suggestions)) return null;
  const byKey = new Map(candidates.map((c) => [c.personKey, c]));
  const seen = new Set<string>();
  const out: CoachSuggestion[] = [];
  for (const s of suggestions) {
    if (!s || typeof s !== "object") continue;
    const { personKey, why } = s as { personKey?: unknown; why?: unknown };
    if (typeof personKey !== "string" || typeof why !== "string" || !why.trim()) continue;
    const c = byKey.get(personKey);
    if (!c || seen.has(c.personKey)) continue;
    seen.add(c.personKey);
    out.push({ name: c.name, personKey: c.personKey, why: clampText(why, COACH_WHY_MAX), evidence: c.evidence });
    if (out.length === COACH_SUGGESTIONS_MAX) break;
  }
  if (out.length === 0 && candidates.length > 0) return null;
  return { message: clampText(message, COACH_MESSAGE_MAX), suggestions: out };
}

/** AI coach: who in my own network should get this wish? Suggests only; never sends anything. */
export const coach = action({
  args: {
    deviceId: v.string(),
    wishId: v.optional(v.id("wishes")),
    wishText: v.optional(v.string()),
    turns: v.optional(v.array(coachTurn)),
  },
  returns: v.union(
    v.object({ ready: v.literal(false), edgeCount: v.number(), threshold: v.number() }),
    v.object({
      ready: v.literal(true),
      message: v.string(),
      suggestions: v.array(
        v.object({ name: v.string(), personKey: v.string(), why: v.string(), evidence: v.array(coachEvidence) }),
      ),
    }),
  ),
  handler: async (ctx, args): Promise<CoachResult> => {
    requireDeviceId(args.deviceId);
    const context = await ctx.runQuery(internal.graphRank.coachContext, {
      deviceId: args.deviceId,
      wishId: args.wishId,
    });
    const wishText = clampText(context.wishText ?? args.wishText ?? "", WISH_TEXT_MAX);
    if (!wishText) throw new Error("Tell the coach what the wish is");
    if (!context.ownerUserId || !isCoachReady(context.edgeCount)) {
      return { ready: false, edgeCount: context.edgeCount, threshold: COACH_THRESHOLD };
    }
    const turns = (args.turns ?? [])
      .slice(-COACH_TURNS_MAX)
      .map((t) => ({ role: t.role, text: clampText(t.text, COACH_TURN_TEXT_MAX) }))
      .filter((t) => t.text);
    // Rate-limit before any paid call (Supermemory search or OpenAI).
    const allowed = await aiAllowed(ctx, `device:${args.deviceId}`);
    const candidates: Candidate[] = await ctx.runAction(internal.graphRank.rankForWish, {
      ownerUserId: context.ownerUserId,
      wishText,
      limit: 5,
      useMemory: allowed,
    });
    const fallback = coachFallback(candidates);
    if (candidates.length === 0 || !allowed) {
      return { ready: true, ...fallback };
    }
    const prompt =
      `Wish: "${wishText}"\n` +
      `Candidates (the only people you may suggest):\n` +
      candidates.map((c) => `- personKey "${c.personKey}", name "${c.name}"\n${evidenceLines(c)}`).join("\n") +
      (turns.length
        ? `\nConversation so far:\n${turns.map((t) => `${t.role}: ${t.text}`).join("\n")}`
        : "");
    const raw = await respond(prompt, "", { instructions: COACH_INSTRUCTIONS, maxOutputTokens: 300 });
    const parsed = raw ? parseCoachReply(raw, candidates) : null;
    if (!parsed) console.warn("ai.coach: using fallback", { reason: raw ? "unparseable" : "no_ai_reply" });
    return { ready: true, ...(parsed ?? fallback) };
  },
});

export const draftVouch = action({
  args: {
    hopId: v.id("hops"),
    name: v.string(),
    how: v.string(),
    howLong: v.string(),
    word: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const context = await ctx.runQuery(internal.hops.aiContext, { hopId: args.hopId });
    if (!context || context.status !== "traveling" || context.expiresAt < Date.now()) {
      throw new Error("This wish isn't traveling anymore");
    }
    const about = context.senderName;
    const how = clampText(args.how, 30);
    const howLong = clampText(args.howLong, 30);
    const word = clampText(args.word, 30);
    const name = clampText(args.name, LIMITS.name);
    const fallback = `${about} is my ${how}, known them ${howLong}, super ${word}.`;
    if (!(await aiAllowed(ctx, `hop:${args.hopId}`))) return fallback;
    return await respond(
      `Write one short line (under 20 words) where ${name || "I"} vouches for ${about}. ` +
        `Facts: ${about} is my ${how}; known them ${howLong}; one word: ${word}. ` +
        `Write it in first person about ${about}, like: "Amy is my college roommate, known her 10 years, super reliable."`,
      fallback,
    );
  },
});

export const draftPassMessage = action({
  args: { hopId: v.id("hops") },
  returns: v.string(),
  handler: async (ctx, { hopId }): Promise<string> => {
    const context = await ctx.runQuery(internal.hops.aiContext, { hopId });
    if (!context || context.status !== "traveling" || context.expiresAt < Date.now()) {
      throw new Error("This wish isn't traveling anymore");
    }
    if (context.passMessage) return context.passMessage;
    const hoursLeft = Math.max(0, Math.round((context.expiresAt - Date.now()) / 3600000));
    const wishGist = context.wishText.split(/(?<=[.!?])\s/)[0].replace(/[.!?]$/, "");
    const gist = wishGist.charAt(0).toLowerCase() + wishGist.slice(1);
    const rippleText = context.depth === 1 ? "1st ripple" : `${context.depth} ripples in`;
    const fallback =
      `A wish just landed with you, ${context.holderName}: ${context.wisherName} wants ${gist}. ` +
      `Know anyone? It's ${rippleText}, ${hoursLeft}h left.`;
    const message = (await aiAllowed(ctx, `hop:${hopId}`))
      ? await respond(
          `Write a playful 1-2 sentence message from ${context.senderName} passing a wish to ${context.holderName}` +
            (context.tags.length ? ` (they're into: ${context.tags.join(", ")})` : "") +
            `. Wish by ${context.wisherName}: "${context.wishText}". Mention it's ${rippleText} and ${hoursLeft}h left, and ask if they know anyone (or if it's them). ` +
            `Example: "A wish just landed with you: Louise wants someone to jam on drums with. Know anyone? It's 2 ripples in, 31h left."`,
          fallback,
        )
      : fallback;
    await ctx.runMutation(internal.hops.setPassMessage, { hopId, message });
    return message;
  },
});

/** Wish Granted card: a 2-sentence story, written once per wish (scheduled by endings.markGranted). */
export const writeGrantedStory = internalAction({
  args: { wishId: v.id("wishes") },
  returns: v.null(),
  handler: async (ctx, { wishId }): Promise<null> => {
    const context = await ctx.runQuery(internal.endings.storyContext, { wishId });
    if (!context || context.story) return null;
    const story = (await aiAllowed(ctx, `wish:${wishId}`))
      ? await respond(
          `Write exactly 2 short sentences (under 40 words total) for a "Wish granted" polaroid card. ` +
            `The wish: "${context.wishText}". It traveled friend to friend: ` +
            context.chain.map((s) => (s.city ? `${s.name} (${s.city})` : s.name)).join(" -> ") +
            `. The first person is the wisher, the last is the person found${context.metInPerson ? "; they met in person" : ""}. ` +
            `Mention where it was tossed, where it passed through and how many ripples later it was granted, like: ` +
            `"Tossed in SF, passed through Shanghai, granted 2 ripples later. Louise and Ben have been jamming every Sunday since." ` +
            `Use only these facts; do not invent places or events.`,
          context.fallback,
        )
      : context.fallback;
    await ctx.runMutation(internal.endings.setStory, { wishId, story: clampText(story, STORY_MAX) || context.fallback });
    return null;
  },
});
