# Sponsor and tool usage

## Convex (backend, required)
The entire backend runs on Convex; there is no other server.
- **Database + realtime:** `convex/schema.ts` (wishes, hops, vouches, edges, linkEvents, ...). Pool ripples and boat state update live through `useQuery`.
- **Auth:** Convex Auth (`convex/auth.ts`) with phone OTP (`convex/phoneProvider.ts`, PR #10), Google, native Apple and anonymous upgrade (PR #8).
- **File storage:** claim proof photos (`ctx.storage.generateUploadUrl` / `getUrl` in `convex/link.ts`).
- **Scheduler + cron:** SMS notifications and 24h draft reminders via `ctx.scheduler.runAfter` (`convex/link.ts`, `convex/notify.ts`); Supermemory indexing in the background (`convex/memory.ts`); daily wish cron (`convex/crons.ts`).
- **Static hosting:** `@convex-dev/static-hosting` serves the Expo web build (the no-app link page) from `<deployment>.convex.site` (`convex/convex.config.ts`, `scripts/deploy-web.sh`). HTTP routes serve OG share previews (`convex/http.ts`, PR #23/#24).
- **Rate limiter:** `@convex-dev/rate-limiter` for per-phone OTP send/verify limits (`convex/phoneLimits.ts`, PR #26) and AI call limits per device (`convex/aiLimits.ts`).
- **Actions:** all OpenAI and Twilio calls run in Convex actions, so API keys never reach the client.

## Capy (agents, required)
- Capy agents opened and built the `capy/*` PRs: scaffold (#1), step 1 pass-on page + toss + well (#6), auth (#8, #10, #11), relation graph + AI coach API (#13), paper boat UX (#19, #28).
- Workflow in `AGENTS.md`: brainstorm → plan → subagent-driven build. Implementer subagents run on a low-cost model on fresh machines, and the parent thread reviews each task (PR #7).
- Capy has standing permission to squash-merge clean `capy/*` PRs (PR #4). Human PRs and PRs that touch secrets still need a person to merge.

## Revyl (device testing, required)
- `.revyl/config.yaml`: iOS + Android dev/preview build profiles against the dev deployment.
- `.revyl/tests/well-smoke-ios.yaml`: device smoke test of the Pool / toss flow.
- `modules/revyl-launch-config` + `src/app/revyl-auth.tsx`: a native launch-config module that signs a Revyl device session in without SMS. Stable `testID`s on key elements.

## Also used
- **OpenAI** (Responses API, `gpt-5-mini`, from Convex actions: `convex/openai.ts`, `convex/ai.ts`, `convex/linkAi.ts`). It polishes wishes, drafts vouches and pass-on messages, and powers the coach (`ai.coach`). Every AI button falls back to a template if the API fails.
- **Twilio Verify** sends and checks the phone OTP (`convex/sms.ts`, `convex/phoneProvider.ts`). Twilio SMS sends notifications (`convex/notify.ts`). PR #27 reports a clear error for numbers a trial account can't text.
- **Supermemory** indexes relation-graph edges (who you know + why) for semantic recall in the coach (`convex/memory.ts`, `convex/graphRank.ts`, PR #13). Forgetting an edge also deletes it from Supermemory.
