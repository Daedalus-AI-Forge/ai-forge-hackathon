// Photorealistic gallery scenes of FICTIONAL people, generated server-side with the OpenAI Images
// API (never photos of real users). Operator-only: `npx convex run galleryAi:generatePhotos`.
import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";

const MAX_IMAGES = 10;
const PARALLEL = 3;
const TIMEOUT_MS = 120_000;
const STYLE =
  "Candid smartphone photo, natural light, photorealistic. Fictional diverse adults, faces natural and relaxed, " +
  "hands natural. No text, no signs with writing, no logos, no watermarks.";

// gpt-image-1 first; later models only when an earlier one is unavailable to this key.
const MODELS = ["gpt-image-1", "gpt-image-1.5", "gpt-image-1-mini", "dall-e-3"] as const;
type Model = (typeof MODELS)[number];

async function generate(apiKey: string, prompt: string, model: Model) {
  const body: Record<string, unknown> = { model, prompt: `${prompt}. ${STYLE}`, size: "1024x1024", n: 1 };
  if (model !== "dall-e-3") body.quality = "medium";
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const json = (await res.json()) as { data?: { b64_json?: string }[]; error?: { message?: string; code?: string } };
  const b64 = json.data?.[0]?.b64_json;
  if (!res.ok || !b64) return { error: `${res.status} ${json.error?.code ?? ""} ${json.error?.message ?? "no image"}`.trim() };
  return { b64 };
}

/**
 * Generate one image per prompt (at most 10, 3 at a time), store each PNG in file storage, and
 * return the storage ids in prompt order (null where a prompt failed, with the error). Falls back
 * to dall-e-3 when gpt-image-1 is unavailable. Nothing is attached; see gallery:usePhotoreal.
 */
export const generatePhotos = internalAction({
  args: { prompts: v.array(v.string()) },
  returns: v.array(v.object({ prompt: v.string(), storageId: v.union(v.id("_storage"), v.null()), model: v.string(), error: v.optional(v.string()) })),
  handler: async (ctx, { prompts }) => {
    if (prompts.length === 0 || prompts.length > MAX_IMAGES) throw new Error(`Pass 1-${MAX_IMAGES} prompts`);
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
    const one = async (prompt: string) => {
      let model: Model = MODELS[0];
      let r: { b64?: string; error?: string } = {};
      const errors: string[] = [];
      for (model of MODELS) {
        r = await generate(apiKey, prompt, model);
        if (r.b64) break;
        errors.push(`${model}: ${r.error}`);
        // Only an unavailable model moves on; a content or quota error would fail the same way.
        if (!/model|does not exist|not found|verif|access/i.test(r.error ?? "")) break;
      }
      if (!r.b64) r.error = errors.join(" | ");
      if (!r.b64) {
        console.error(JSON.stringify({ event: "galleryAi.fail", model, error: r.error }));
        return { prompt, storageId: null, model, error: r.error };
      }
      const bytes = Uint8Array.from(atob(r.b64), (c) => c.charCodeAt(0));
      const storageId: Id<"_storage"> = await ctx.storage.store(new Blob([bytes], { type: "image/png" }));
      console.log(JSON.stringify({ event: "galleryAi.stored", model, storageId }));
      return { prompt, storageId, model };
    };
    const out = [];
    for (let i = 0; i < prompts.length; i += PARALLEL) out.push(...(await Promise.all(prompts.slice(i, i + PARALLEL).map(one))));
    return out;
  },
});
