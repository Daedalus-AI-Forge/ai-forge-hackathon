// Live anonymous sign-in round-trip against a Convex deployment.
// Usage: node scripts/auth-smoke.mjs https://<deployment>.convex.cloud
// Prints user ids only (never tokens). Created users are listed at the end
// so they can be removed with `npx convex run authAdmin:deleteUser`.
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

const url = process.argv[2];
if (!url) throw new Error("Pass the deployment URL");
const api = anyApi;
const rand = () => Math.random().toString(16).slice(2, 10);
const check = (label, ok) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
  if (!ok) process.exitCode = 1;
};

async function signInAnon(deviceId) {
  const client = new ConvexHttpClient(url);
  const res = await client.action(api.auth.signIn, { provider: "anonymous", params: { deviceId } });
  if (!res?.tokens?.token) throw new Error("signIn returned no token");
  client.setAuth(res.tokens.token);
  return client;
}

const created = [];

// 1. Fresh device: anonymous sign-in creates a user bound to the device.
const d1 = "smoke_" + rand();
const c1 = await signInAnon(d1);
const u1 = await c1.query(api.users.me, { deviceId: "unrelated" });
created.push(u1?._id);
check("anonymous signIn returns a JWT and the session resolves to a user", !!u1);
check("new anonymous user is bound to the device and flagged anonymous", u1?.deviceId === d1 && u1?.isAnonymous === true);
const acct = await c1.query(api.users.account, {});
check("users.account: signedIn=true, hasAccount=false", acct.signedIn === true && acct.hasAccount === false);
check("linkDevice on own device is a no-op", (await c1.mutation(api.users.linkDevice, { deviceId: d1 })).merged === false);

// 2. Existing device user (today's no-login demo): anonymous sign-in adopts it.
const d2 = "smoke_" + rand();
const anon = new ConvexHttpClient(url);
const legacyId = await anon.mutation(api.users.ensure, { deviceId: d2 });
created.push(legacyId);
await anon.mutation(api.users.updateProfile, { deviceId: d2, name: "Smoke Test", city: "SF" });
const c2 = await signInAnon(d2);
const u2 = await c2.query(api.users.me, { deviceId: "unrelated" });
check("anonymous signIn adopts the existing device user (same _id, data kept)", u2?._id === legacyId && u2?.name === "Smoke Test");

// 3. Unauthenticated device path still works.
const u3 = await anon.query(api.users.me, { deviceId: d2 });
check("deviceId path without a session still resolves the user", u3?._id === legacyId);

console.log("CREATED " + JSON.stringify(created.filter(Boolean)));
