import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
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
      body: JSON.stringify({ model: "gpt-5-mini", instructions: STYLE, input: prompt }),
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
  args: { type: wishType, text: v.string() },
  returns: v.string(),
  handler: async (_ctx, { type, text }): Promise<string> => {
    return await respond(
      `Rewrite this wish in at most 2 short sentences: [type of person] + [what to do] + a short warm why, so friends want to help. ` +
        `It asks for ${TYPE_HINT[type]}, never a specific named person. Keep the wisher's voice (first person). Wish: "${text}"`,
      text.trim(),
    );
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
    const about = context?.senderName ?? "my friend";
    const fallback = `${about} is my ${args.how}, known them ${args.howLong}, super ${args.word}.`;
    return await respond(
      `Write one short line (under 20 words) where ${args.name || "I"} vouches for ${about}. ` +
        `Facts: ${about} is my ${args.how}; known them ${args.howLong}; one word: ${args.word}. ` +
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
    if (!context) return "A wish just landed with you. Know anyone?";
    const hoursLeft = Math.max(0, Math.round((context.expiresAt - Date.now()) / 3600000));
    const rippleText = context.depth === 1 ? "1st ripple" : `${context.depth} ripples in`;
    const fallback =
      `A wish just landed with you, ${context.holderName}: ${context.wisherName} wants ${context.wishText.replace(/\.$/, "")}. ` +
      `Know anyone? It's ${rippleText}, ${hoursLeft}h left.`;
    const message = await respond(
      `Write a playful 1-2 sentence message from ${context.senderName} passing a wish to ${context.holderName}` +
        (context.tags.length ? ` (they're into: ${context.tags.join(", ")})` : "") +
        `. Wish by ${context.wisherName}: "${context.wishText}". Mention it's ${rippleText} and ${hoursLeft}h left, and ask if they know anyone (or if it's them). ` +
        `Example: "A wish just landed with you: Louise wants someone to jam on drums with. Know anyone? It's 2 ripples in, 31h left."`,
      fallback,
    );
    await ctx.runMutation(internal.hops.setPassMessage, { hopId, message });
    return message;
  },
});
