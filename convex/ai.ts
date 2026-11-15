import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { aiAllowed } from "./aiLimits";
import { LIMITS, clampText, requireDeviceId } from "./lib";
import { wishType } from "./schema";

const STYLE =
  "You write copy for Wishwell, a playful app where a wish travels friend to friend until it reaches the right person. " +
  "Warm, light, friendly, never needy. Sentence case. No hashtags, no quotes around the answer, at most one emoji. Reply with the text only.";

async function respond(prompt: string, fallback: string) {
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
        instructions: STYLE,
        input: prompt,
        reasoning: { effort: "minimal" },
        max_output_tokens: 400,
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

/** Ask the well: from the people in my wish network, who should get this wish first? */
export const askTheWell = action({
  args: { deviceId: v.string(), text: v.string() },
  returns: v.union(v.null(), v.object({ name: v.string(), reason: v.string() })),
  handler: async (ctx, { deviceId, text }): Promise<{ name: string; reason: string } | null> => {
    const people: { name: string; tags: { tag: string }[] }[] = await ctx.runQuery(internal.edges.forAsk, { deviceId });
    if (people.length === 0) return null;
    const words = new Set(text.toLowerCase().match(/[a-z]{4,}/g) ?? []);
    const overlap = (p: (typeof people)[number]) =>
      p.tags.filter(({ tag }) => tag.toLowerCase().split(/\W+/).some((w) => words.has(w))).length;
    const best = [...people].sort((a, b) => overlap(b) - overlap(a))[0];
    const fallback = `${best.name} | In your wish network ${best.name} is tagged ${best.tags.map((t) => t.tag).join(", ")}.`;
    const answer = await respond(
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
