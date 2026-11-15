import { v } from "convex/values";
import { internalAction } from "./_generated/server";

// Smoke test: `npx convex run openai:ping` confirms OPENAI_API_KEY works from Convex.
export const ping = internalAction({
  args: {},
  returns: v.object({ ok: v.boolean(), status: v.number(), reply: v.string() }),
  handler: async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { ok: false, status: 0, reply: "OPENAI_API_KEY is not set" };
    }
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "gpt-5-mini", input: "Reply with exactly: pong" }),
    });
    const body = (await res.json()) as {
      output?: { content?: { type?: string; text?: string }[] }[];
      error?: { message?: string };
    };
    const text = (body.output ?? [])
      .flatMap((item) => item.content ?? [])
      .filter((c) => c.type === "output_text")
      .map((c) => c.text ?? "")
      .join("");
    return {
      ok: res.ok,
      status: res.status,
      reply: res.ok ? text || "(empty reply)" : (body.error?.message ?? "unknown error"),
    };
  },
});
