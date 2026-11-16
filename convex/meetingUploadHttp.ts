import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { MEETING_PHOTO_MAX_BYTES, meetingImageType } from "./meetings";

export const MEETING_UPLOAD_PATH = "/meeting-photo/";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

export const meetingUploadOptions = httpAction(async () => new Response(null, { status: 204, headers: cors }));

async function imageBody(req: Request, type: string) {
  const contentLength = Number(req.headers.get("Content-Length"));
  if (contentLength > MEETING_PHOTO_MAX_BYTES || !req.body) return null;
  const reader = req.body.getReader();
  const parts: Uint8Array<ArrayBuffer>[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return length > 0 ? new Blob(parts, { type }) : null;
      length += value.byteLength;
      if (length > MEETING_PHOTO_MAX_BYTES) {
        await reader.cancel();
        return null;
      }
      parts.push(value.slice());
    }
  } finally {
    reader.releaseLock();
  }
}

export const meetingUpload = httpAction(async (ctx, req) => {
  const token = new URL(req.url).pathname.slice(MEETING_UPLOAD_PATH.length);
  if (!/^[0-9a-f-]{36}$/.test(token) || !(await ctx.runQuery(internal.meetings.canUpload, { token, now: Date.now() }))) {
    return new Response("This upload link expired. Choose the photo again.", { status: 403, headers: cors });
  }
  const type = meetingImageType(req.headers.get("Content-Type"));
  if (!type) return new Response("Choose a JPEG, PNG, WebP, or HEIC image", { status: 415, headers: cors });
  const body = await imageBody(req, type);
  if (!body) return new Response("Choose an image up to 10 MB", { status: 413, headers: cors });
  const storageId = await ctx.storage.store(body);
  const registered = await ctx.runMutation(internal.meetings.registerUpload, { token, storageId });
  if (!registered) {
    await ctx.storage.delete(storageId);
    return new Response("This upload link expired. Choose the photo again.", { status: 409, headers: cors });
  }
  return Response.json({ storageId }, { headers: cors });
});
