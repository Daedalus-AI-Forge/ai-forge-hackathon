# Wishwell relation graph + AI coach — API implementation plan

> **For agentic workers:** execute with subagent-driven development: one implementer subagent per task, then a reviewer subagent per task. Steps use `- [ ]`. Spec: `docs/superpowers/specs/2026-11-15-wishwell-agent-graph-design.md`.

**Branch / worktree:** `capy/wishwell-graph-api` at `.claude/worktrees/graph-api` (created from PR #9 `capy/wishwell-daily-wish`). PR base: `capy/wishwell-step1` (PR #6). API only — no new screens.

**Hard rules for every task**
- Read `AGENTS.md` and `convex/_generated/ai/guidelines.md` before touching `convex/`.
- Convex is source of truth. Every public function is owner-scoped: identity comes from `requireUser(ctx, deviceId)` / the auth session, never from an arg like `ownerUserId`. Never return another user's edges.
- Reuse PR #6 hardening: `clampText` / `LIMITS`, `requireDeviceId`, `aiAllowed` (rate limiter), `loadOpen`. Public AI/Supermemory work must be rate-limited and length-capped.
- No secrets in repo; never read `.env*`. Do not deploy (`npx convex dev`) except where a task says so.
- Done = `npx tsc --noEmit` clean + `npm test` green + task-specific convex-test tests added.
- Commits: conventional, small, **no Claude attribution** (no Co-Authored-By Claude, no "Generated with Claude Code").

## Builder decisions (from spec "left to the builder")
- `wishes.mode: "serious" | "fun"` (optional; missing = serious). Daily wish = fun. Reason required for serious passes, optional for fun.
- Coach threshold: `COACH_THRESHOLD = 5` distinct tagged edges owned by the user.
- Candidates: direct connections (owner's edges) + 2nd-hop only via people who passed a wish *to* the user (their names are known to the user). Never expose 2nd-hop people's own edges.
- Coach: single turn with optional `turns: [{role, text}]` (max 6, capped) passed back by the client.
- Scoring: Supermemory search score when `SUPERMEMORY_API_KEY` is set; else keyword/tag overlap (tokenize wish text, match against tags + reason words, weight tag match 2, reason word 1, recency tiebreak).

## Tasks

### Task 0 — Integrate #9 with latest #6 and harden #9 code
- [ ] `git merge origin/capy/wishwell-step1` into this branch; resolve conflicts keeping BOTH: #6's security fixes (no hopIds in `chain`/`holders`, `!hop.action` guards, `requireDeviceId`, `clampText`, `aiAllowed`, `DEMO_MODE` claimDemo, crypto device ids, phone auth #10, phone UI #11) and #9's features (daily wish, edges, askTheWell, stats, explainer UI).
- [ ] Apply #6's hardening to #9's new public functions: `ai.askTheWell` (deviceId + `aiAllowed` + caps), `daily.join`, `edges.mine`/`edges.forget` (owner-scoped via `requireUser`), `stats.summary` (bounded reads), tags/personName clamped on write in `hops.passTo` / `wishes.toss`.
- [ ] `npx tsc --noEmit`, `npm test` green; commit `chore: Merge step1 security fixes into daily-wish and harden its API`.

### Task 1 — Reasons on passes become edges
- [ ] Schema: `edges.reason: v.optional(v.string())`, `edges.tags: v.optional(v.array(v.string()))` (keep existing `tag`), `edges.contact: v.optional(v.string())`, `edges.createdAt` if missing; `wishes.mode` optional union. Keep `by_ownerUserId`; add `by_ownerUserId_personName` if useful.
- [ ] `hops.passTo`: accept `reason?: string` (+ optional `contact`, `tags` ≤5×30) per recipient; require non-empty `reason` when wish mode is serious (error "Add one line on why you picked them"), cap at 140 chars; write edge(s) with `reason`, `tags`, `source:"pick"`; schedule `internal.memory.ingest` per new edge (Task 3 creates it — until then, a no-op stub `convex/memory.ts` with the internal action signatures).
- [ ] `wishes.toss`: accept `mode` (default serious) and per-recipient `reason` with the same rule; write edges the same way.
- [ ] Tests: serious without reason rejected; fun without reason ok; reason capped; edge row has reason/tags; ingest scheduled.

### Task 2 — Ego graph queries
- [ ] `convex/graph.ts`: `myNetwork({deviceId})` query → `{ me:{name}, nodes:[{personKey,name,tags[],edgeCount}], links:[{edgeId, personKey, tag, reason, source, createdAt}] }` for the caller only; `personKey` = normalized name (lowercase, trimmed) unless contact present. Bounded read (`take(500)`).
- [ ] `coachReady({deviceId})` → `{ready, edgeCount, threshold}`.
- [ ] Tests: owner scoping (user B can't see user A's edges), aggregation, threshold boundary.

### Task 3 — Supermemory derived index
- [ ] `convex/memory.ts` internal actions: `ingest({edgeId})`, `forget({edgeId})`, `backfill({ownerUserId?})`. Use Supermemory REST v5 via `fetch` only: `POST https://api.supermemory.ai/ns/{namespace}/document` body `{ id: edgeId, content: "<person>: <reason> [tags]", metadata:{personKey, tag, source} }`; delete by id (check current docs at https://supermemory.ai/docs/ingestion/document-operations.md); namespace `ww_net_{ownerUserId}`. Read edge data via an internal query. If `SUPERMEMORY_API_KEY` unset → return `{skipped:true}`. Errors logged, never thrown to callers.
- [ ] `edges.forget` schedules `internal.memory.forget` for the deleted edge(s).
- [ ] Tests (mock `fetch`): no key → skipped; with key → correct URL/headers/body; forget scheduled on `edges.forget`.

### Task 4 — rankForWish (graphology)
- [ ] `npm install graphology` (and types if needed). `convex/graphRank.ts`: internal action `rankForWish({ownerUserId, wishText, limit=5})`: load owner's edges + "passed to me" senders via internal query; build a graphology `Graph` (me → person, edge attrs tags/reason); score candidates per builder decisions (Supermemory `POST /ns/{ns}/search {query, searchMode:"hybrid", limit}` when key set, mapped back via document id = edgeId; else keyword/tag overlap). Return `[{personKey, name, score, evidence:[{tag, reason}]}]`.
- [ ] Pure scoring helpers exported for unit tests. Tests: tag overlap ranks the right person first; evidence only from owner's edges; works with no key.

### Task 5 — ai.coach
- [ ] `ai.coach({deviceId, wishId? , wishText?, turns?})` action: `requireDeviceId`, `aiAllowed`, caps. If not coachReady → `{ready:false, edgeCount, threshold}`. Else `rankForWish` → OpenAI (reuse existing `respond` helper, `max_output_tokens`) with strict instruction to only use the given evidence → `{ready:true, message, suggestions:[{name, why}] (≤3)}`. Fallback template when OpenAI fails. Never sends/forwards anything. `askTheWell` delegates to the same ranking (keep its signature).
- [ ] Tests: below threshold → ready:false; suggestions only contain candidate names; rate-limited path returns gracefully.

### Task 6 — Seed + smoke + API summary
- [ ] Extend `seed.run`: Darren's demo user ("me") with 12 people / ~20 tagged edges with realistic reasons (music, Tokyo, climbing, design, food…), plus a fresh demo user with 2 edges (below threshold). Clear `edges` consistently.
- [ ] Deploy to dev (`npx convex dev --once` — linked to `gallant-seal-635`; configure with `--configure existing --team qi-chang --project ai-forge-hackthon --dev-deployment cloud` if the worktree isn't linked), run `seed:run`, then `npx convex run memory:backfill` if key set.
- [ ] `scripts/graph-smoke.mjs`: myNetwork, coachReady both states, passTo with/without reason, coach returns grounded suggestions, forget removes the edge. Run against dev; reset seed after.
- [ ] `docs/api/graph-coach.md`: API summary table for UI teammates.
