// Rehearse the team demo chain Darren -> Louise -> Katie -> Dazi against a deployment.
// Usage:
//   node scripts/team-chain.mjs https://<deployment>.convex.cloud --rehearse          # members already seeded with bindDevices
//   node scripts/team-chain.mjs https://<deployment>.convex.cloud --rehearse --fake   # seed +1555 test members, rehearse, delete them
// Each member acts through the public API with the device id teamSeed.run binds when
// `bindDevices: true` (dev_team_<key>), exactly as their device would. No phone numbers here.
// Cleanup runs `npx convex run teamSeed:removeRehearsalWish` (the CLI must be linked to the same
// deployment); the seed graph itself is kept (with --fake the test members are deleted too).
import { execFileSync } from "node:child_process";

import { ConvexHttpClient } from "convex/browser";
import { anyApi as api } from "convex/server";

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith("--"));
const fake = args.includes("--fake");
if (!url || !args.includes("--rehearse")) {
  console.error("Usage: node scripts/team-chain.mjs <convexUrl> --rehearse [--fake]");
  process.exit(2);
}

const WISH = "someone to jam on drums with in the Bay Area";
const KEYS = ["darren", "louise", "katie", "dazi"];
const device = (key) => `dev_team_${key}`;
const FAKE_MEMBERS = KEYS.map((key, i) => ({ key, name: key[0].toUpperCase() + key.slice(1), phone: `+155500000${String(i + 1).padStart(2, "0")}` }));

const convexRun = (fn, value) =>
  execFileSync("npx", ["convex", "run", fn, JSON.stringify(value)], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
let failures = 0;
const check = (label, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}${detail ? ` (${detail})` : ""}`);
  if (!ok) failures++;
};
const client = new ConvexHttpClient(url);

async function coachTop(key, wishId) {
  const r = await client.action(api.ai.coach, { deviceId: device(key), wishText: WISH, ...(wishId ? { wishId } : {}) });
  if (!r.ready) return { name: null, detail: `coach not ready: ${r.edgeCount}/${r.threshold} edges` };
  const s = r.suggestions[0];
  return { name: s?.name ?? null, detail: s ? `top: ${s.name} — ${s.why}` : "no suggestions" };
}

let wishId = null;
try {
  if (fake) {
    const seeded = JSON.parse(convexRun("teamSeed:status", {}));
    if (seeded.some((m) => !m.testNumber)) {
      throw new Error("Real team members are seeded on this deployment; --fake would replace their seed. Rehearse without --fake.");
    }
    console.log("Seeding +1555 test members (bindDevices)…");
    convexRun("teamSeed:run", { members: FAKE_MEMBERS, bindDevices: true });
    // Give async Supermemory ingest a moment; ranking falls back to keywords when it has no hits.
    await new Promise((r) => setTimeout(r, 45000));
  }
  const members = {};
  for (const key of KEYS) {
    const user = await client.query(api.users.me, { deviceId: device(key) });
    if (!user) throw new Error(`No user bound to ${device(key)}: run teamSeed:run with "bindDevices": true first`);
    members[key] = user;
    console.log(`member ${key}: ${user.name} (${user.city})`);
  }
  const name = (k) => members[k].name;

  // 1. Darren tosses, after asking the coach.
  let top = await coachTop("darren");
  check(`coach(Darren) suggests ${name("louise")} first`, top.name === name("louise"), top.detail);
  const tossed = await client.mutation(api.wishes.toss, {
    deviceId: device("darren"),
    type: "do_together",
    mode: "serious",
    text: WISH,
    name: name("darren"),
    city: members.darren.city,
    recipients: [{ name: name("louise"), reason: "Plays bass in a Mission garage band — knows every musician in SF", tags: ["music", "band"] }],
  });
  wishId = tossed.wishId;
  const louiseHop = tossed.hopIds[0];
  console.log(`step 1 Darren -> ${name("louise")}: /w/${louiseHop}`);

  // 2. Louise opens the link in the app (claim), asks the coach, vouches, passes to Katie.
  await client.mutation(api.hops.claim, { hopId: louiseHop, deviceId: device("louise") });
  top = await coachTop("louise", wishId);
  check(`coach(Louise) suggests ${name("katie")} first`, top.name === name("katie"), top.detail);
  await client.mutation(api.hops.act, { hopId: louiseHop, action: "pass", name: name("louise"), city: members.louise.city, vouch: `${name("darren")} is my teammate, super reliable`, tags: [] });
  const katieHop = await client.mutation(api.hops.passTo, { parentHopId: louiseHop, name: name("katie"), reason: "Took drum lessons with her; she knows every drummer in the East Bay", tags: ["drums"] });
  console.log(`step 2 ${name("louise")} -> ${name("katie")}: /w/${katieHop}`);

  // 3. Katie: same, passes to Dazi.
  await client.mutation(api.hops.claim, { hopId: katieHop, deviceId: device("katie") });
  top = await coachTop("katie", wishId);
  check(`coach(Katie) suggests ${name("dazi")} first`, top.name === name("dazi"), top.detail);
  await client.mutation(api.hops.act, { hopId: katieHop, action: "pass", name: name("katie"), city: members.katie.city, vouch: `${name("louise")} is my drum-lesson buddy, super fun`, tags: [] });
  const daziHop = await client.mutation(api.hops.passTo, { parentHopId: katieHop, name: name("dazi"), reason: "Drummer in a Berkeley jam collective — plays every week", tags: ["drums"] });
  console.log(`step 3 ${name("katie")} -> ${name("dazi")}: /w/${daziHop}`);

  // 4. Dazi taps "It's me".
  await client.mutation(api.hops.claim, { hopId: daziHop, deviceId: device("dazi") });
  await client.mutation(api.hops.itsMe, { hopId: daziHop, name: name("dazi"), city: members.dazi.city, intro: "I drum every week in Berkeley — let's jam!", contact: "@dazi" });
  const page = await client.query(api.hops.page, { hopId: daziHop });
  check(`${name("dazi")}'s hop is its_me at depth 3`, page?.hop.action === "its_me" && page.hop.depth === 3, `chain: ${page?.chain.map((c) => c.name).join(" -> ")}`);
  console.log(`step 4 ${name("dazi")} tapped It's me: /w/${daziHop}`);
} catch (e) {
  failures++;
  console.log(`FAIL ${String(e?.data ?? e?.message ?? e)}`);
} finally {
  try {
    if (wishId) {
      convexRun("teamSeed:removeRehearsalWish", { wishId });
      console.log(`cleanup: removed rehearsal wish ${wishId}`);
    }
    if (fake) {
      convexRun("teamSeed:clear", { deleteTestUsers: true });
      console.log("cleanup: removed +1555 test members and their seed data");
    }
  } catch (e) {
    failures++;
    console.log(`FAIL cleanup: ${String(e?.message ?? e)}`);
  }
}
console.log(failures === 0 ? "ALL PASS" : `${failures} FAILED`);
process.exitCode = failures === 0 ? 0 : 1;
