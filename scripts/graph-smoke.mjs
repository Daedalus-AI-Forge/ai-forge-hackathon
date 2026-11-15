// Live ego graph + coach round-trip against a Convex deployment (demo mode).
// Usage: node scripts/graph-smoke.mjs https://<deployment>.convex.cloud
// Needs DEMO_MODE=true (users.claimDemo) and the seed (`npx convex run seed:run`).
// Logs in as Mia via claimDemo and as the "fresh" demo user via its fixed device id.
// Writes one wish + edges as Mia, then resets everything with `npx convex run seed:run`
// (needs the CLI to be linked to the same deployment). Pass --verbose to dump responses.
import { execFileSync } from "node:child_process";

import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith("--"));
const verbose = args.includes("--verbose");
if (!url) throw new Error("Pass the deployment URL");
const api = anyApi;
const FRESH = "dev_demo_fresh";
const check = (label, ok) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
  if (!ok) process.exitCode = 1;
};
const dump = (label, value) => verbose && console.log(`--- ${label}\n${JSON.stringify(value, null, 2)}`);
const errorMessage = async (p) => {
  try {
    await p;
    return "no error";
  } catch (e) {
    return String(e?.data ?? e?.message ?? e);
  }
};

const client = new ConvexHttpClient(url);
const mia = "graphsmoke_" + Math.random().toString(16).slice(2, 10);

try {
  await client.mutation(api.users.claimDemo, { deviceId: mia });

  // (a) Mia's ego graph.
  const net = await client.query(api.graph.myNetwork, { deviceId: mia });
  dump("graph.myNetwork (Mia)", net);
  const keys = new Set(net?.nodes.map((n) => n.personKey));
  check(`(a) myNetwork for Mia: ${net?.nodes.length} nodes, ${net?.links.length} links (>= 10 nodes)`, net?.me.name === "Mia" && net.nodes.length >= 10);
  const freshNet = await client.query(api.graph.myNetwork, { deviceId: FRESH });
  const freshEdgeIds = new Set(freshNet?.links.map((l) => l.edgeId));
  check(
    "(a) myNetwork returns only Mia's edges (no fresh-user edges, every link's person is a node)",
    net.links.every((l) => keys.has(l.personKey) && !freshEdgeIds.has(l.edgeId)) && !keys.has("nora") && !keys.has("diego"),
  );

  // (b) coachReady both states.
  const readyMia = await client.query(api.graph.coachReady, { deviceId: mia });
  const readyFresh = await client.query(api.graph.coachReady, { deviceId: FRESH });
  dump("graph.coachReady (Mia, fresh)", { readyMia, readyFresh });
  check(`(b) coachReady Mia ready (${readyMia.edgeCount}/${readyMia.threshold})`, readyMia.ready === true);
  check(`(b) coachReady fresh not ready (${readyFresh.edgeCount}/${readyFresh.threshold})`, readyFresh.ready === false);

  // (c) serious toss needs a reason per recipient.
  const toss = (reason) =>
    client.mutation(api.wishes.toss, {
      deviceId: mia,
      type: "do_together",
      text: "Graph smoke: someone to play board games with on Thursdays.",
      name: "Mia",
      city: "San Francisco",
      mode: "serious",
      recipients: [{ name: "Smoke Tester", tags: ["boardgames"], ...(reason ? { reason } : {}) }],
    });
  const rejected = await errorMessage(toss());
  const REASON_REQUIRED = "Add one line on why you picked them";
  check(`(c) serious toss without a reason is rejected ("${REASON_REQUIRED}")`, rejected.includes(REASON_REQUIRED));
  const reason = "Smoke Tester hosts a board game night every Thursday";
  const tossed = await toss(reason);
  const after = await client.query(api.graph.myNetwork, { deviceId: mia });
  const newLinks = after.links.filter((l) => l.personKey === "smoke tester");
  dump("new links after toss", newLinks);
  check("(c) serious toss with a reason is accepted", !!tossed?.wishId);
  check("(c) myNetwork shows the new edge with that reason", newLinks.length > 0 && newLinks.every((l) => l.reason === reason));

  // (d) grounded coach for Mia.
  const coach = await client.action(api.ai.coach, { deviceId: mia, wishText: "someone to jam on drums with" });
  dump("ai.coach (Mia)", coach);
  const nodeKeys = new Set(after.nodes.map((n) => n.personKey));
  check(`(d) ai.coach Mia ready with ${coach.suggestions?.length ?? 0} suggestion(s)`, coach.ready === true && coach.suggestions.length > 0);
  check(
    `(d) every suggestion is in myNetwork with evidence (${coach.suggestions?.map((s) => s.personKey).join(", ")})`,
    coach.ready === true && coach.suggestions.every((s) => nodeKeys.has(s.personKey) && s.evidence.length > 0),
  );

  // (e) fresh user is not ready.
  const coachFresh = await client.action(api.ai.coach, { deviceId: FRESH, wishText: "someone to jam on drums with" });
  dump("ai.coach (fresh)", coachFresh);
  check("(e) ai.coach fresh returns ready:false", coachFresh.ready === false);

  // (f) forget one of the new edges.
  const target = newLinks[0]?.edgeId;
  await client.mutation(api.edges.forgetEdge, { deviceId: mia, edgeId: target });
  const afterForget = await client.query(api.graph.myNetwork, { deviceId: mia });
  check("(f) edges.forgetEdge removes the edge from myNetwork", !!target && !afterForget.links.some((l) => l.edgeId === target));
} catch (e) {
  console.log(`FAIL unexpected error: ${e?.message ?? e}`);
  process.exitCode = 1;
} finally {
  execFileSync("npx", ["convex", "run", "seed:run"], { stdio: "ignore" });
  console.log("reset demo data (seed:run)");
}
