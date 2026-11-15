// Live phone OTP sign-in round-trip against a Convex deployment (demo mode).
// Usage: node scripts/phone-smoke.mjs https://<deployment>.convex.cloud [+15555550100] [000000]
// The number must be in the deployment's DEMO_PHONE_NUMBERS. Prints user ids
// only (never tokens), then deletes the phone user via `npx convex run
// authAdmin:deleteUser` (needs the CLI to be linked to the same deployment).
// Sends are limited to 1/min per number, so wait a minute between runs.
import { execFileSync } from "node:child_process";

import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

const [url, phoneArg = "+15555550100", code = "000000"] = process.argv.slice(2);
if (!url) throw new Error("Pass the deployment URL");
const api = anyApi;
const check = (label, ok) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
  if (!ok) process.exitCode = 1;
};
const errorCode = async (p) => {
  try {
    await p;
    return "no error";
  } catch (e) {
    return e?.data?.code ?? String(e?.message ?? e);
  }
};

const created = new Set();
const client = new ConvexHttpClient(url);

try {
  // A device user with data, like today's no-login app.
  const deviceId = "phonesmoke_" + Math.random().toString(16).slice(2, 10);
  const deviceUserId = await client.mutation(api.users.ensure, { deviceId });
  created.add(deviceUserId);
  await client.mutation(api.users.updateProfile, { deviceId, name: "Phone Smoke", city: "SF" });

  // 1. Send a code (demo: no SMS).
  const sent = await client.action(api.phoneAuth.sendCode, { phone: phoneArg.replace(/^\+1/, "+1 ") });
  check(`phoneAuth.sendCode normalizes to E.164 (${sent.phone}) and returns resendAfterMs=30000`, sent.phone === phoneArg && sent.resendAfterMs === 30000);
  check("second send within a minute is RATE_LIMITED", (await errorCode(client.action(api.phoneAuth.sendCode, { phone: phoneArg }))) === "RATE_LIMITED");

  // 2. Wrong code.
  check(
    "signIn('phone') with a wrong code is INVALID_CODE",
    (await errorCode(client.action(api.auth.signIn, { provider: "phone", params: { phone: phoneArg, code: "999999" } }))) === "INVALID_CODE",
  );

  // 3. Right code -> session.
  const res = await client.action(api.auth.signIn, { provider: "phone", params: { phone: phoneArg, code } });
  check("signIn('phone', { phone, code }) returns a JWT", typeof res?.tokens?.token === "string");
  client.setAuth(res.tokens.token);
  const acct = await client.query(api.users.account, {});
  check("users.account: signedIn, hasAccount, phone set", acct.signedIn && acct.hasAccount && acct.phone === phoneArg);
  const me = await client.query(api.users.me, { deviceId: "unrelated" });
  created.add(me?._id);
  console.log(`phone user ${me?._id}`);

  // 4. Anonymous/device -> phone upgrade.
  const link = await client.mutation(api.users.linkDevice, { deviceId });
  check("users.linkDevice merges the device user into the phone user", link.merged === true);
  created.delete(deviceUserId);
  const after = await client.query(api.users.me, { deviceId: "unrelated" });
  check("phone user kept the device profile", after?.name === "Phone Smoke" && after?.phone === phoneArg);

  // 5. Same number again -> same user.
  const again = new ConvexHttpClient(url);
  const res2 = await again.action(api.auth.signIn, { provider: "phone", params: { phone: phoneArg, code } });
  again.setAuth(res2.tokens.token);
  const me2 = await again.query(api.users.me, { deviceId: "unrelated" });
  check("signing in with the same number again returns the same user", me2?._id === me?._id);
} finally {
  for (const userId of [...created].filter(Boolean)) {
    execFileSync("npx", ["convex", "run", "authAdmin:deleteUser", JSON.stringify({ userId })], { stdio: "ignore" });
    console.log(`deleted test user ${userId}`);
  }
}
