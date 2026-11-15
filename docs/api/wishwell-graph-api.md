# Wishwell graph + AI coach — API contract (v0, 2026-11-15 13:00 PT)

Frozen for UI work. Build against `src/lib/graphApi.types.ts` + the mock data at the bottom; the real Convex functions land on branch `capy/wishwell-graph-api` (target 15:00). Spec: `docs/superpowers/specs/2026-11-15-wishwell-agent-graph-design.md`.

Conventions (same as today): every app call passes `deviceId` (from `src/lib/device.ts`); the server resolves the user from the auth session first, then deviceId. Pass-on page calls stay login-free and keyed by `hopId`. Errors are thrown as `Error(message)` with a user-readable message; show it inline.

## 1. `wishes.mode` (new field)
- `wishes.toss` gains `mode?: "serious" | "fun"` (default `"serious"`). Daily wish = `"fun"`.
- Every wish/hop page payload gains `wish.mode`.
- **Rule:** serious → each recipient needs a `reason`; fun → `reason` optional.

## 2. Passing with a reason

### `wishes.toss` (mutation, extended)
```ts
args: {
  deviceId: string; type: WishType; text: string; name: string; city: string;
  mode?: WishMode;                                  // new, default "serious"
  recipients: PassRecipient[];                      // 1..3
}
returns: { wishId: Id<"wishes">; hopIds: Id<"hops">[] }
```

### `hops.passTo` (mutation, extended — pass-on page, no login)
```ts
args: {
  parentHopId: Id<"hops">;
  name: string;            // recipient name (≤60)
  reason?: string;         // new: one line, ≤140; REQUIRED when wish.mode === "serious"
  contact?: string;        // new, optional (≤80)
  tags: string[];          // ≤5 tags × ≤30 chars
}
returns: Id<"hops">        // the new hop (unchanged)
```
`PassRecipient = { name: string; reason?: string; contact?: string; tags: string[] }`.
Error when missing on serious: `"Add one line on why you picked them"`.
Side effect: writes an `edges` row (`source: "pick"`, `reason`, `tags`) for the passer if they are a known user, and indexes it for the coach (async; never blocks the UI).

## 3. Ego graph (Me tab)

### `graph.myNetwork` (query, reactive)
```ts
args: { deviceId: string }
returns: MyNetwork | null   // null while the user row doesn't exist yet
```
```ts
type MyNetwork = {
  me: { name: string };
  nodes: { personKey: string; name: string; tags: string[]; edgeCount: number }[];
  links: { edgeId: Id<"edges">; personKey: string; tag: string; reason: string | null;
           source: "pick" | "daily"; createdAt: number }[];
};
```
Only the caller's own direct connections. `personKey` is stable for a person (normalized name or contact) — use it as the node id; `links[].personKey` points at `nodes[].personKey`.

### `graph.coachReady` (query, reactive)
```ts
args: { deviceId: string }
returns: { ready: boolean; edgeCount: number; threshold: number }  // threshold = 5
```

### Forget (transparency)
- `edges.forget({ deviceId, personName })` (exists, PR #9) — forgets a whole person.
- **New** `edges.forgetEdge({ deviceId, edgeId })` → `null` — forgets one tag/reason. Both also remove it from Supermemory.

## 4. AI coach

### `ai.coach` (action)
```ts
args: {
  deviceId: string;
  wishId?: Id<"wishes">;   // one of wishId / wishText
  wishText?: string;       // ≤300
  turns?: { role: "user" | "coach"; text: string }[];  // previous turns, ≤6, each ≤300
}
returns:
  | { ready: false; edgeCount: number; threshold: number }
  | { ready: true; message: string;                     // one guiding message/question
      suggestions: { name: string; personKey: string; why: string;
                     evidence: { tag: string; reason: string | null }[] }[] }  // ≤3
```
- Never sends or forwards anything; the user still picks and writes the reason.
- `why` is grounded only in the user's own tags/reasons (`evidence`).
- Rate-limited per device; when limited it returns a plain fallback message (no throw).
- `ai.askTheWell({deviceId, text})` keeps its current shape (`{name, reason} | null`) and now uses the same ranking.

## 5. Mock data for UI work
```ts
export const mockNetwork: MyNetwork = {
  me: { name: "Darren" },
  nodes: [
    { personKey: "amy", name: "Amy", tags: ["music", "drums"], edgeCount: 2 },
    { personKey: "ken", name: "Ken", tags: ["tokyo", "food"], edgeCount: 2 },
    { personKey: "lia", name: "Lia", tags: ["climbing"], edgeCount: 1 },
  ],
  links: [
    { edgeId: "e1" as any, personKey: "amy", tag: "music", reason: "Plays in a band every weekend", source: "pick", createdAt: 1763230000000 },
    { edgeId: "e2" as any, personKey: "amy", tag: "drums", reason: null, source: "daily", createdAt: 1763231000000 },
    { edgeId: "e3" as any, personKey: "ken", tag: "tokyo", reason: "Grew up in Shibuya", source: "pick", createdAt: 1763232000000 },
    { edgeId: "e4" as any, personKey: "ken", tag: "food", reason: "Knows every izakaya", source: "pick", createdAt: 1763233000000 },
    { edgeId: "e5" as any, personKey: "lia", tag: "climbing", reason: "Runs the Mission bouldering group", source: "pick", createdAt: 1763234000000 },
  ],
};
export const mockCoach = {
  ready: true as const,
  message: "You've told the well that Amy plays in a band. Want to start with her?",
  suggestions: [{ name: "Amy", personKey: "amy", why: "You tagged her music and drums.",
                  evidence: [{ tag: "music", reason: "Plays in a band every weekend" }] }],
};
```
