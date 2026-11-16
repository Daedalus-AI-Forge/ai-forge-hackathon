// Notifications for the link page (docs/superpowers/plans/2026-11-15-link-page.md, T3).
// Twilio Messaging when configured and `to` is an E.164 phone; otherwise a structured log
// (emails are log-only for now). Delivery is best effort: `send` never throws, so a
// scheduled notification can't fail the flow that queued it.
import { v } from "convex/values";

import { internalAction } from "./_generated/server";
import { maskPhone } from "./sms";

const TWILIO_TIMEOUT_MS = 10_000;
const E164 = /^\+[1-9]\d{6,14}$/;

type Env = Record<string, string | undefined>;
type NotifyKind = "landed" | "ending" | "claimConfirmed" | "draftReminder";
export type NotifyResult = { channel: "twilio" | "log"; ok: boolean };

function maskTo(to: string) {
  return E164.test(to) ? maskPhone(to) : `***@${to.split("@")[1] ?? "?"}`;
}

/** Deliver one message. Exported for tests; `send` is the public entry point. */
export async function deliver(
  a: { to: string; kind: NotifyKind; text: string; link?: string },
  env: Env = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<NotifyResult> {
  const sid = env.TWILIO_ACCOUNT_SID;
  const token = env.TWILIO_AUTH_TOKEN;
  const from = env.TWILIO_MESSAGING_FROM;
  const to = maskTo(a.to);
  if (!sid || !token || !from || !E164.test(a.to)) {
    console.log(JSON.stringify({ event: "notify", channel: "log", kind: a.kind, to }));
    return { channel: "log", ok: true };
  }
  const body = a.link ? `${a.text} ${a.link}` : a.text;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TWILIO_TIMEOUT_MS);
  try {
    const res = await fetchImpl(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: a.to, From: from, Body: body }).toString(),
        signal: controller.signal,
      },
    );
    if (!res.ok) {
      console.error(JSON.stringify({ event: "notify_failed", channel: "twilio", kind: a.kind, to, status: res.status }));
      return { channel: "twilio", ok: false };
    }
    console.log(JSON.stringify({ event: "notify", channel: "twilio", kind: a.kind, to }));
    return { channel: "twilio", ok: true };
  } catch (err) {
    const reason = err instanceof Error ? err.name : "unknown";
    console.error(JSON.stringify({ event: "notify_failed", channel: "twilio", kind: a.kind, to, reason }));
    return { channel: "twilio", ok: false };
  } finally {
    clearTimeout(timer);
  }
}

export const send = internalAction({
  args: {
    to: v.string(),
    kind: v.union(v.literal("landed"), v.literal("ending"), v.literal("claimConfirmed"), v.literal("draftReminder")),
    text: v.string(),
    link: v.optional(v.string()),
  },
  handler: async (_ctx, a): Promise<NotifyResult> => await deliver(a),
});
