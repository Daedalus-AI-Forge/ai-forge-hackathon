# Wishwell — relation graph + AI coach design

Date: 2026-11-15 (YC Consumer Mobile Hackathon; submit by 6:00 PM PT, sponsor pages say 6:30 — confirm).
Owner: Darren. Approved in chat with Hackthon-Discord session. Implementation: Hackthon-Project-Manager (local subagent-driven), **API (Convex) first**, UI after team review.
Builds on PR #6 / #9 (`capy/wishwell-step1`, `capy/wishwell-daily-wish`): reuse `edges`, `network`, `vouches`, `hops.passTo`, `edges.mine` / `edges.forget`, `ai.askTheWell`. Do not duplicate them.

## Intent (why)
A wish travels through real friends. The hard part (Dodds 2003: 384 of ~98k chains completed, ~37% continue per hop) is "who do I pass to?". Wishwell's answer: people pick, people explain why, and the app remembers those reasons as a relation graph. Once the graph is rich, AI coaches you through the choice in conversation. The graph is the long-term moat (retention theme) and is shown to the user transparently.

Research note to reuse in pitch: in Dodds 2003, "similar profession" was the reason in 37.4% of successful vs 8.0% of failed forwards; "lots of friends" 1.6% vs 8.2% → rank by tag/interest similarity, not by connectedness.

## Decisions (Darren)
1. **People choose, with a reason.** For a serious wish the user picks who to pass to (up to 3) and writes a one-line **reason** per recipient ("Amy curates at a gallery, may know someone"). Every holder downstream does the same. BFS = the first fan-out of 3; DFS = the chain continuing along whichever branch people push deeper. The AI never picks or sends on its own.
2. **Reasons become the graph.** Each pass writes a tagged edge `owner → person` with the reason (and short tags). Fun wishes use the same flow; the reason can be casual.
3. **AI coach only when the graph is rich.** When the user already has enough tagged people (threshold, default ≥ 5 edges), the AI talks them through it: surfaces relevant people + the evidence (their own past tags/reasons), asks a guiding question. User still decides and writes the reason. Below threshold, no AI suggestions.
4. **Transparent graph.** Me tab shows the user's ego graph only: me + direct connections + tags. Each tag deletable (Forget), which also deletes from Supermemory.
5. **Stack.** Storage: Convex tables (source of truth, free). Algorithms: **graphology** (MIT) — build the user's graph in-memory inside a Convex action. Visualization: d3-force + react-native-svg (Me tab). Supermemory: **demo-only** derived index for "who is most relevant to this wish" retrieval; fallback to Convex (keyword/vector) when `SUPERMEMORY_API_KEY` is missing or errors. No Neo4j / other graph DB.

## Goals / non-goals / anti-goals
- Goals: reason-per-pass captured as edges; ego-graph API; AI coach API grounded in the user's own graph; Supermemory ingest/forget; seed data so the demo graph is rich.
- Non-goals today: contacts import, manual "add friend" form, global graph / friend-of-friend visibility, AI auto-forwarding, Keiki/Whop/Candle integrations.
- Anti-goals: AI writing messages that pretend to come from a friend (NGL/FTC lesson) — AI only drafts, a human confirms; any API returning other users' edges; blocking UI on AI/Supermemory latency.

## API surface (Convex) — implement first
Names are proposals; align with existing modules in PR #9.

| Function | Kind | Purpose |
|---|---|---|
| `hops.passTo` (extend) | mutation | Accept `recipients: [{name, contact?, reason, tags?}]` (max 3). `reason` required for `wish.type` serious, optional otherwise (length-capped). Writes hop + `edges` row(s) with `reason`, `tags`, `source: "pick"`; schedules `memory.ingest` per edge. |
| `edges` schema (extend) | — | add `reason: v.optional(v.string())`; keep `tag`/`tags`, `source`. Index `by_owner`. |
| `graph.myNetwork` | query | Ego graph for the signed-in user: `{ me, nodes:[{personKey,name,tags[],edgeCount}], links:[{edgeId, personKey, tag, reason, source, createdAt}] }`. Owner-scoped only. Feeds Me tab viz. |
| `graph.coachReady` | query | `{ ready: boolean, edgeCount, threshold }` — UI decides whether to show the AI coach. |
| `graph.rankForWish` | internal action | Load owner's edges (via internal query), build a graphology graph, compute candidates (direct connections; optionally 2nd-hop via people who forwarded to the user), score by relevance to wish text: Supermemory `search` similarity when key present, else keyword/tag overlap (or Convex vector search if embeddings exist). Return top N with evidence (matching tags/reasons). |
| `ai.coach` | action | Input `wishId` (+ optional conversation turns). If not `coachReady` → return `{ready:false}`. Else call `graph.rankForWish`, then OpenAI to produce one guiding message + up to 3 suggested people with "why" grounded only in returned evidence. Never sends; returns suggestions. Rate-limited (existing `@convex-dev/rate-limiter`), input length caps. Can supersede/extend `ai.askTheWell`. |
| `memory.ingest` | internal action | If `SUPERMEMORY_API_KEY` set: `add` edge reason+tags to namespace `ww_net_{ownerId}` with idempotent `id = edgeId`. No-op otherwise. |
| `memory.forget` | internal action | Delete Supermemory doc by `edgeId`; called from `edges.forget`. |
| `memory.backfill` | internal action | Re-ingest all edges (for seed / key added later). |
| `seed` (extend) | mutation | Rich demo graph for Darren (~10–15 people, varied tags/reasons) + a fresh account with < threshold edges to show the "no AI yet" state. |

Implementation notes:
- Supermemory via `fetch`/SDK v5 inside actions only (avoid deprecated `/v3` + `containerTag`). Convex stays source of truth.
- Long work async: mutation → `ctx.scheduler.runAfter(0, ...)`; UI reads progress via `useQuery`.
- Add `graphology` (+ `graphology-traversal` if needed) with `npx expo install` / npm; use in actions only.
- Tests: convex-test for passTo reason validation, owner scoping of `graph.myNetwork`, forget → memory.forget scheduled, coach threshold.

## Left to the builder (PM)
Exact field names vs PR #9, threshold value, scoring weights, whether 2nd-hop candidates are included in the demo, coach conversation shape (single turn vs multi-turn), UI after the API review.

## Process
1. PM implements the API above on top of #6/#9 (subagent-driven, reviewed per task).
2. PM sends the API summary back to Hackthon-Discord → Darren reviews → posted to the team Discord for Katie & Louise to review/sync.
3. Then UI: pass-on with reason, AI coach panel, Me-tab ego graph viz.
