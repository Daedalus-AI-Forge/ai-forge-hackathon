# Graph + coach API — quick reference for UI

Live on the shared dev deployment (`https://gallant-seal-635.convex.cloud`). Full contract: [`wishwell-graph-api.md`](wishwell-graph-api.md). Examples below are trimmed from a real run of `node scripts/graph-smoke.mjs <convexUrl> --verbose`.

Every call takes `deviceId`; the server resolves the user from the auth session first, then `deviceId`. You only ever see your own edges.

## Demo logins (DEMO_MODE=true on dev)

| Who | demoKey | How to log in | Graph |
|---|---|---|---|
| Mia | `me` | `users.claimDemo({ deviceId })` binds *your* device id to Mia (any id matching `^[A-Za-z0-9_-]{4,64}$`) | 12 people, 23 edges (20 `pick`, 3 `daily`), coach ready |
| Theo ("fresh") | `fresh` | use the fixed device id `dev_demo_fresh` directly (not claimable) | 2 edges, below `COACH_THRESHOLD` (5) |

Reset everything with `npx convex run seed:run` (idempotent; unbinds any claimed device).

## `wishes.mode`

`"serious"`: every recipient needs a one-line `reason` (≤140), else the call throws `"Add one line on why you picked them"`. `"fun"`: reason optional. **`wishes.toss` without `mode` creates a legacy fun wish**, and `hops.passTo` follows the wish's mode, so a wish without `mode` (and every daily wish) is fun. New UI should send `mode` explicitly.

## Functions

| Function | Kind | Args | Returns |
|---|---|---|---|
| `wishes.toss` | mutation | `{ deviceId, type, text, name, city, mode?, recipients: [{ name, reason?, contact?, tags }] }` (1–3) | `{ wishId, hopIds }` |
| `hops.passTo` | mutation | `{ parentHopId, name, reason?, contact?, tags }` | new `hopId` |
| `graph.myNetwork` | query | `{ deviceId }` | `{ me, nodes, links }` or `null` (unknown device) |
| `graph.coachReady` | query | `{ deviceId }` | `{ ready, edgeCount, threshold }` |
| `ai.coach` | action | `{ deviceId, wishId?, wishText?, turns?: [{ role, text }] }` (≤6 turns) | `{ ready: false, edgeCount, threshold }` or `{ ready: true, message, suggestions }` |
| `edges.forgetEdge` | mutation | `{ deviceId, edgeId }` | `null`; throws `"Not your connection"` for others' edges |
| `edges.forget` | mutation | `{ deviceId, personName }` | `null` (drops every edge to that person) |

Each passed recipient becomes one edge row per tag (`source: "pick"`; a pass on the daily wish also adds the day's tag as `source: "daily"`). A reason with no tags becomes tag `"friend"`.

### `graph.myNetwork` (Mia, trimmed)
```json
{
  "me": { "name": "Mia" },
  "nodes": [
    { "personKey": "priya", "name": "Priya", "tags": ["sf", "startups"], "edgeCount": 2 },
    { "personKey": "wei", "name": "Wei", "tags": ["food", "shanghai"], "edgeCount": 2 }
  ],
  "links": [
    {
      "edgeId": "kh79qkj8sd1zmaf9ex0fqy9nxn8j9xvc",
      "personKey": "priya",
      "tag": "sf",
      "reason": "Priya knows every coffee shop in the Mission worth working from",
      "source": "pick",
      "createdAt": 1794776517481.2637
    }
  ]
}
```
Links are newest first. `personKey` is the normalized name (join links to nodes on it). `reason` may be `null` on older or fun-mode edges.

### `graph.coachReady`
```json
{ "ready": true, "edgeCount": 23, "threshold": 5 }   // Mia
{ "ready": false, "edgeCount": 2, "threshold": 5 }   // fresh
```

### `ai.coach` — `{ deviceId, wishText: "someone to jam on drums with" }`
Mia:
```json
{
  "ready": true,
  "message": "Here are a few people from your list who could be good to pass this wish to, ...",
  "suggestions": [
    {
      "name": "Louise",
      "personKey": "louise",
      "why": "Practices drums every night, recently bought a drum kit, and explicitly wants people to jam with ...",
      "evidence": [
        { "tag": "drums", "reason": "Louise practices drums every night but is shy about playing with others" },
        { "tag": "music", "reason": "Louise just bought a drum kit and wants people to jam with" }
      ]
    },
    {
      "name": "Ben",
      "personKey": "ben",
      "why": "Has drummed in a garage band for eight years ...",
      "evidence": [{ "tag": "drums", "reason": "Ben has drummed in a garage band for eight years" }]
    }
  ]
}
```
Fresh: `{ "ready": false, "edgeCount": 2, "threshold": 5 }` — show the "pass a few more wishes first" state.

Every `suggestions[].personKey` is a node in `myNetwork`, and `evidence` is never empty. Pass `wishId` instead of `wishText` for a wish the caller created or holds. For a follow-up, send the prior exchange back as `turns`. When the AI is unavailable or rate-limited the coach still returns `ready: true` with a ranking-only `message`.
