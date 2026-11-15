import { parsePhoneNumberFromString } from "libphonenumber-js";
import { ConvexError } from "convex/values";

/**
 * Phone OTP sender/verifier. One module, two backends:
 *
 * - Demo: numbers in DEMO_PHONE_NUMBERS (comma-separated E.164) accept the
 *   fixed code DEMO_PHONE_CODE (default "000000"). No SMS is ever sent.
 * - Twilio Verify: when TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and
 *   TWILIO_VERIFY_SERVICE_SID are set. Twilio generates, sends and stores the
 *   code; we store nothing secret.
 *
 * Demo numbers always win over Twilio, so demos never send real SMS.
 */

type Env = Record<string, string | undefined>;

/** Error codes in `ConvexError.data.code` (stable, part of the API contract). */
export type PhoneAuthErrorCode =
  | "INVALID_PHONE"
  | "INVALID_CODE"
  | "NOT_CONFIGURED"
  | "RATE_LIMITED"
  | "SEND_FAILED"
  | "VERIFY_FAILED";

export type PhoneAuthErrorData = {
  code: PhoneAuthErrorCode;
  message: string;
  retryAfterMs?: number;
};

export function phoneAuthError(code: PhoneAuthErrorCode, message: string, retryAfterMs?: number) {
  const data: PhoneAuthErrorData = { code, message };
  if (retryAfterMs !== undefined) data.retryAfterMs = Math.ceil(retryAfterMs);
  return new ConvexError(data);
}

export const DEFAULT_DEMO_CODE = "000000";
const TWILIO_TIMEOUT_MS = 10_000;
const TWILIO_BASE = "https://verify.twilio.com/v2/Services";

function demoNumbers(env: Env): Set<string> {
  return new Set(
    String(env.DEMO_PHONE_NUMBERS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

/**
 * Normalize user input to E.164 ("+15555550100"). Input must carry a country
 * code ("+1 555 555 0100", "+44 20 7946 0958"). Rejects numbers that are not
 * valid for their country, except numbers listed in DEMO_PHONE_NUMBERS (the
 * 555-01xx demo range is not a real NANP number).
 */
export function normalizePhone(input: unknown, env: Env = process.env): string {
  if (typeof input !== "string" || input.trim().length === 0 || input.length > 32) {
    throw phoneAuthError("INVALID_PHONE", "Enter a phone number with its country code.");
  }
  const parsed = parsePhoneNumberFromString(input.trim());
  if (!parsed) {
    throw phoneAuthError("INVALID_PHONE", "Enter a phone number with its country code.");
  }
  const e164 = parsed.number;
  if (demoNumbers(env).has(e164)) return e164;
  if (!parsed.isValid()) {
    throw phoneAuthError("INVALID_PHONE", "That phone number doesn't look right.");
  }
  return e164;
}

export type SmsMode =
  | { kind: "demo"; code: string }
  | { kind: "twilio"; accountSid: string; authToken: string; serviceSid: string };

/** Which backend handles this (already normalized) number. Throws NOT_CONFIGURED. */
export function smsModeFor(phone: string, env: Env = process.env): SmsMode {
  if (demoNumbers(env).has(phone)) {
    return { kind: "demo", code: (env.DEMO_PHONE_CODE ?? "").trim() || DEFAULT_DEMO_CODE };
  }
  const accountSid = env.TWILIO_ACCOUNT_SID;
  const authToken = env.TWILIO_AUTH_TOKEN;
  const serviceSid = env.TWILIO_VERIFY_SERVICE_SID;
  if (accountSid && authToken && serviceSid) {
    return { kind: "twilio", accountSid, authToken, serviceSid };
  }
  throw phoneAuthError("NOT_CONFIGURED", "Phone sign-in isn't set up for this number yet");
}

/** Last 4 digits only, for logs. */
export function maskPhone(phone: string) {
  return `***${phone.slice(-4)}`;
}

type Fetch = typeof fetch;

async function twilioPost(
  mode: Extract<SmsMode, { kind: "twilio" }>,
  path: "Verifications" | "VerificationCheck",
  form: Record<string, string>,
  fetchImpl: Fetch,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TWILIO_TIMEOUT_MS);
  try {
    return await fetchImpl(`${TWILIO_BASE}/${encodeURIComponent(mode.serviceSid)}/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${mode.accountSid}:${mode.authToken}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(form).toString(),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Send a code to `phone` (E.164). Demo numbers: no-op.
 * Twilio: one POST, 10s timeout, not retried here (the per-phone rate limit
 * already caps resends). Failure -> SEND_FAILED.
 */
export async function sendCode(
  phone: string,
  env: Env = process.env,
  fetchImpl: Fetch = fetch,
): Promise<{ mode: SmsMode["kind"] }> {
  const mode = smsModeFor(phone, env);
  if (mode.kind === "demo") return { mode: "demo" };
  let res: Response;
  try {
    res = await twilioPost(mode, "Verifications", { To: phone, Channel: "sms" }, fetchImpl);
  } catch (e) {
    console.error(JSON.stringify({ event: "phone_auth.twilio_send_error", phone: maskPhone(phone), error: String(e) }));
    throw phoneAuthError("SEND_FAILED", "Couldn't send the code. Try again in a minute.");
  }
  if (!res.ok) {
    let twilioCode: number | undefined;
    let twilioMessage: string | undefined;
    try {
      const body = (await res.json()) as { code?: number; message?: string };
      twilioCode = body.code;
      twilioMessage = body.message?.replace(/\+?\d{7,}/g, "***");
    } catch {
      // non-JSON error body
    }
    console.error(
      JSON.stringify({ event: "phone_auth.twilio_send_error", phone: maskPhone(phone), status: res.status, twilioCode, twilioMessage }),
    );
    // Trial accounts can only text verified numbers (Twilio 21608 / 60410-ish 403s).
    if (res.status === 403 || twilioCode === 21608) {
      throw phoneAuthError(
        "SEND_FAILED",
        "We can't text this number yet (it isn't on our test list). Use the demo number +1 555 555 0100 · code 000000.",
      );
    }
    throw phoneAuthError("SEND_FAILED", "Couldn't send the code. Try again in a minute.");
  }
  return { mode: "twilio" };
}

/**
 * Check `code` for `phone` (E.164). Returns false for a wrong/expired code;
 * throws VERIFY_FAILED when the verifier itself can't answer (network,
 * Twilio 5xx/429, auth errors).
 */
export async function checkCode(
  phone: string,
  code: string,
  env: Env = process.env,
  fetchImpl: Fetch = fetch,
): Promise<boolean> {
  const mode = smsModeFor(phone, env);
  if (mode.kind === "demo") return code === mode.code;
  let res: Response;
  try {
    res = await twilioPost(mode, "VerificationCheck", { To: phone, Code: code }, fetchImpl);
  } catch (e) {
    console.error(JSON.stringify({ event: "phone_auth.twilio_check_error", phone: maskPhone(phone), error: String(e) }));
    throw phoneAuthError("VERIFY_FAILED", "Couldn't check the code. Try again.");
  }
  // 404: no pending verification (expired, already used, or too many tries).
  if (res.status === 404) return false;
  if (!res.ok) {
    console.error(JSON.stringify({ event: "phone_auth.twilio_check_error", phone: maskPhone(phone), status: res.status }));
    throw phoneAuthError("VERIFY_FAILED", "Couldn't check the code. Try again.");
  }
  const body = (await res.json().catch(() => null)) as { status?: unknown } | null;
  return body?.status === "approved";
}
