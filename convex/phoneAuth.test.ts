/// <reference types="vite/client" />
import rateLimiter from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { exportPKCS8, generateKeyPair } from "jose";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { checkCode, normalizePhone, sendCode, smsModeFor } from "./sms";

const modules = import.meta.glob("./**/*.ts");

const DEMO = "+15555550100";
const DEMO_2 = "+15555550101";
const REAL = "+16502530000";

let jwtPrivateKey = "";
beforeAll(async () => {
  const { privateKey } = await generateKeyPair("RS256", { extractable: true });
  jwtPrivateKey = await exportPKCS8(privateKey);
});

beforeEach(() => {
  vi.stubEnv("JWT_PRIVATE_KEY", jwtPrivateKey);
  vi.stubEnv("CONVEX_SITE_URL", "https://test.convex.site");
  vi.stubEnv("DEMO_PHONE_NUMBERS", `${DEMO},${DEMO_2}`);
  vi.stubEnv("DEMO_PHONE_CODE", "");
  vi.stubEnv("TWILIO_ACCOUNT_SID", "");
  vi.stubEnv("TWILIO_AUTH_TOKEN", "");
  vi.stubEnv("TWILIO_VERIFY_SERVICE_SID", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function setup() {
  const t = convexTest(schema, modules);
  rateLimiter.register(t);
  return t;
}

async function errorCode(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    if (e instanceof ConvexError) return (e.data as { code: string }).code;
    throw e;
  }
  throw new Error("expected the call to fail");
}

async function phoneSignIn(t: ReturnType<typeof setup>, phone: string, code: string) {
  const res = (await t.action(api.auth.signIn, { provider: "phone", params: { phone, code } })) as {
    tokens: { token: string } | null;
  };
  expect(res.tokens?.token).toBeTruthy();
  const account = await t.run((ctx) =>
    ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) => q.eq("provider", "phone").eq("providerAccountId", normalizePhone(phone)))
      .unique(),
  );
  expect(account).not.toBeNull();
  return account!.userId;
}

async function sessionFor(t: ReturnType<typeof setup>, userId: Id<"users">) {
  const session = await t.run((ctx) =>
    ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .first(),
  );
  return t.withIdentity({ subject: `${userId}|${session!._id}` });
}

describe("normalizePhone", () => {
  test("formats real numbers to E.164", () => {
    expect(normalizePhone("+1 (650) 253-0000")).toBe(REAL);
    expect(normalizePhone(" +44 20 7946 0958 ")).toBe("+442079460958");
  });

  test("rejects junk, missing country code and invalid numbers", () => {
    for (const bad of ["", "12345", "650 253 0000", "+1 123", "+999 1234567", 42, null]) {
      expect(() => normalizePhone(bad)).toThrow(ConvexError);
    }
  });

  test("accepts listed demo numbers even though 555-01xx is not a real NANP number", () => {
    expect(normalizePhone("+1 555-555-0100")).toBe(DEMO);
    vi.stubEnv("DEMO_PHONE_NUMBERS", "");
    expect(() => normalizePhone("+1 555-555-0100")).toThrow(ConvexError);
  });
});

describe("smsModeFor", () => {
  test("demo code defaults to 000000 and honors DEMO_PHONE_CODE", () => {
    expect(smsModeFor(DEMO)).toEqual({ kind: "demo", code: "000000" });
    vi.stubEnv("DEMO_PHONE_CODE", "424242");
    expect(smsModeFor(DEMO)).toEqual({ kind: "demo", code: "424242" });
  });

  test("not configured without demo listing or Twilio", () => {
    expect(() => smsModeFor(REAL)).toThrow("Phone sign-in isn't set up for this number yet");
  });
});

describe("demo phone sign-in", () => {
  test("send + verify creates a session and a user with the phone", async () => {
    const t = setup();
    expect(await t.action(api.phoneAuth.sendCode, { phone: "+1 555 555 0100" })).toEqual({
      phone: DEMO,
      resendAfterMs: 30_000,
    });
    const userId = await phoneSignIn(t, DEMO, "000000");
    const user = await t.run((ctx) => ctx.db.get("users", userId));
    expect(user).toMatchObject({ phone: DEMO, wishesLeft: 1, stars: 0, name: "" });
    expect(user?.phoneVerificationTime).toBeTypeOf("number");
    const asPhone = await sessionFor(t, userId);
    expect(await asPhone.query(api.users.account, {})).toEqual({
      signedIn: true,
      hasAccount: true,
      email: null,
      phone: DEMO,
    });
  });

  test("wrong code is rejected and creates nothing", async () => {
    const t = setup();
    expect(await errorCode(t.action(api.auth.signIn, { provider: "phone", params: { phone: DEMO, code: "123456" } }))).toBe(
      "INVALID_CODE",
    );
    expect(await errorCode(t.action(api.auth.signIn, { provider: "phone", params: { phone: DEMO, code: "abc" } }))).toBe(
      "INVALID_CODE",
    );
    expect(await t.run((ctx) => ctx.db.query("users").collect())).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("authSessions").collect())).toEqual([]);
  });

  test("same phone twice signs in to the same user", async () => {
    const t = setup();
    const first = await phoneSignIn(t, DEMO, "000000");
    const second = await phoneSignIn(t, "+1 (555) 555-0100", "000000");
    expect(second).toBe(first);
    expect(await t.run((ctx) => ctx.db.query("users").collect())).toHaveLength(1);
    const other = await phoneSignIn(t, DEMO_2, "000000");
    expect(other).not.toBe(first);
  });

  test("unconfigured number gets NOT_CONFIGURED on send and verify", async () => {
    const t = setup();
    expect(await errorCode(t.action(api.phoneAuth.sendCode, { phone: REAL }))).toBe("NOT_CONFIGURED");
    expect(await errorCode(t.action(api.auth.signIn, { provider: "phone", params: { phone: REAL, code: "000000" } }))).toBe(
      "NOT_CONFIGURED",
    );
  });
});

describe("rate limits", () => {
  test("sends: 1 per minute per phone, other phones unaffected", async () => {
    const t = setup();
    await t.action(api.phoneAuth.sendCode, { phone: DEMO });
    expect(await errorCode(t.action(api.phoneAuth.sendCode, { phone: DEMO }))).toBe("RATE_LIMITED");
    await t.action(api.phoneAuth.sendCode, { phone: DEMO_2 });
  });

  test("sends: 5 per hour per phone", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const t = setup();
    for (let i = 0; i < 5; i++) {
      await t.action(api.phoneAuth.sendCode, { phone: DEMO });
      vi.setSystemTime(Date.now() + 61_000);
    }
    expect(await errorCode(t.action(api.phoneAuth.sendCode, { phone: DEMO }))).toBe("RATE_LIMITED");
  });

  test("verify: 10 attempts per hour per phone, then even the right code is refused", async () => {
    const t = setup();
    for (let i = 0; i < 10; i++) {
      expect(
        await errorCode(t.action(api.auth.signIn, { provider: "phone", params: { phone: DEMO, code: "111111" } })),
      ).toBe("INVALID_CODE");
    }
    expect(await errorCode(t.action(api.auth.signIn, { provider: "phone", params: { phone: DEMO, code: "000000" } }))).toBe(
      "RATE_LIMITED",
    );
  });
});

describe("anonymous -> phone upgrade (users.linkDevice)", () => {
  test("phone account keeps the device user's wishes and stars", async () => {
    const t = setup();
    const deviceId = "dev_phone";
    const deviceUserId = await t.mutation(api.users.ensure, { deviceId });
    await t.mutation(api.users.updateProfile, { deviceId, name: "Mia", city: "SF" });
    const wishId = await t.run(async (ctx) => {
      await ctx.db.patch("users", deviceUserId, { stars: 4, isAnonymous: true });
      await ctx.db.insert("authAccounts", { userId: deviceUserId, provider: "anonymous", providerAccountId: "anon-1" });
      return await ctx.db.insert("wishes", {
        creatorId: deviceUserId,
        type: "local",
        text: "A local in Tokyo",
        status: "traveling",
        expiresAt: Date.now() + 1000,
      });
    });

    const phoneUserId = await phoneSignIn(t, DEMO, "000000");
    const asPhone = await sessionFor(t, phoneUserId);
    expect(await asPhone.mutation(api.users.linkDevice, { deviceId })).toEqual({ merged: true });

    const state = await t.run(async (ctx) => ({
      phoneUser: await ctx.db.get("users", phoneUserId),
      old: await ctx.db.get("users", deviceUserId),
      wish: await ctx.db.get("wishes", wishId),
    }));
    expect(state.old).toBeNull();
    expect(state.phoneUser).toMatchObject({ name: "Mia", city: "SF", stars: 4, phone: DEMO });
    expect(state.wish?.creatorId).toBe(phoneUserId);
  });

  test("a phone account is never merged into another account", async () => {
    const t = setup();
    const phoneUserId = await phoneSignIn(t, DEMO, "000000");
    await t.run((ctx) => ctx.db.patch("users", phoneUserId, { deviceId: "dev_owned" }));
    const otherUserId = await phoneSignIn(t, DEMO_2, "000000");
    const asOther = await sessionFor(t, otherUserId);
    expect(await asOther.mutation(api.users.linkDevice, { deviceId: "dev_owned" })).toEqual({ merged: false });
    expect(await t.run((ctx) => ctx.db.get("users", phoneUserId))).not.toBeNull();
  });
});

describe("Twilio Verify (mocked fetch; untested against live Twilio)", () => {
  const env = {
    TWILIO_ACCOUNT_SID: "ACtest",
    TWILIO_AUTH_TOKEN: "tok",
    TWILIO_VERIFY_SERVICE_SID: "VAtest",
  };
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  test("send posts To + Channel=sms with Basic auth", async () => {
    const fetchMock = vi.fn(async () => json(201, { status: "pending" }));
    expect(await sendCode(REAL, env, fetchMock as unknown as typeof fetch)).toEqual({ mode: "twilio" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://verify.twilio.com/v2/Services/VAtest/Verifications");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe(`Basic ${btoa("ACtest:tok")}`);
    expect(Object.fromEntries(new URLSearchParams(init.body as string))).toEqual({ To: REAL, Channel: "sms" });
  });

  test("send failure (HTTP error or network) -> SEND_FAILED", async () => {
    const http = vi.fn(async () => json(400, { code: 60200 }));
    expect(await errorCode(sendCode(REAL, env, http as unknown as typeof fetch))).toBe("SEND_FAILED");
    const network = vi.fn(async () => {
      throw new TypeError("network down");
    });
    expect(await errorCode(sendCode(REAL, env, network as unknown as typeof fetch))).toBe("SEND_FAILED");
  });

  test("check: approved -> true, pending/404 -> false, 5xx -> VERIFY_FAILED", async () => {
    const approved = vi.fn(async () => json(200, { status: "approved" }));
    expect(await checkCode(REAL, "123456", env, approved as unknown as typeof fetch)).toBe(true);
    const [url, init] = approved.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://verify.twilio.com/v2/Services/VAtest/VerificationCheck");
    expect(Object.fromEntries(new URLSearchParams(init.body as string))).toEqual({ To: REAL, Code: "123456" });

    const pending = vi.fn(async () => json(200, { status: "pending" }));
    expect(await checkCode(REAL, "000001", env, pending as unknown as typeof fetch)).toBe(false);
    const missing = vi.fn(async () => json(404, { code: 20404 }));
    expect(await checkCode(REAL, "000001", env, missing as unknown as typeof fetch)).toBe(false);
    const down = vi.fn(async () => json(503, {}));
    expect(await errorCode(checkCode(REAL, "000001", env, down as unknown as typeof fetch))).toBe("VERIFY_FAILED");
  });

  test("demo numbers never hit Twilio even when Twilio is configured", async () => {
    const fetchMock = vi.fn(async () => json(201, {}));
    const withDemo = { ...env, DEMO_PHONE_NUMBERS: DEMO };
    expect(await sendCode(DEMO, withDemo, fetchMock as unknown as typeof fetch)).toEqual({ mode: "demo" });
    expect(await checkCode(DEMO, "000000", withDemo, fetchMock as unknown as typeof fetch)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("full send + sign-in through the backend with Twilio env", async () => {
    for (const [k, val] of Object.entries(env)) vi.stubEnv(k, val);
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith("/VerificationCheck") ? json(200, { status: "approved" }) : json(201, { status: "pending" }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const t = setup();
    expect((await t.action(api.phoneAuth.sendCode, { phone: REAL })).phone).toBe(REAL);
    const userId = await phoneSignIn(t, REAL, "123456");
    expect((await t.run((ctx) => ctx.db.get("users", userId)))?.phone).toBe(REAL);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
