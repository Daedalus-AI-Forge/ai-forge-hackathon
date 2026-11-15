# Agent instructions — Raincheck (YC Consumer Mobile Hack 2026-11-15)

- Required stack: Capy (agents), Revyl (device testing), Convex (backend).
- Merge permission: Capy may squash-merge its own `capy/*` PRs into `main` without asking when every
  check passes, there are no merge conflicts, and the latest Capy review has no high or medium findings.
  PRs from people, and PRs that add `.env*`, signing files or secrets, always need a human merge.
- Convex setup: follow `.agents/convex-agent-setup.md` (copy of https://www.convex.dev/agent-setup.md).
  After the Expo app exists, run `npx convex ai-files install` and check `convex/_generated/ai/guidelines.md`.
- Build log: use the `convex-hackathon-skill` (`.agents/skills/convex-hackathon-skill/SKILL.md`)
  to keep `hackathon.md` current after each meaningful change.
- Never commit secrets: keys go in `.env.local` or Convex dashboard env vars (`.gitignore` blocks `.env*`).
- Expo (SDK 58, expo-router): routes live in `src/app/`, non-route code in `src/`. Add packages with
  `npx expo install <pkg>`. Native modules need a dev build (`eas build --profile development`), not Expo Go.
  Never hand-edit `ios/` or `android/` (generated). Check with `npm run typecheck` and `npx expo-doctor`.

## Capy workflow (design → plan → subagent-driven build)

Product spec: `docs/wishwell-spec.md`. For every new feature or build-order step:

1. **Design — `$brainstorming`** (`.agents/skills/brainstorming`). Hackathon mode: the spec already answers
   most questions, so ask only what it doesn't, all in ONE message with a recommended default for each;
   if nobody answers, proceed with the defaults. Skip the visual companion server. Save the design to
   `docs/plans/<step>-design.md`.
2. **Plan — `$writing-plans`** (`.agents/skills/writing-plans`). Save to `docs/plans/<step>-plan.md`,
   tasks small enough for one subagent each.
3. **Build — `$subagent-driven-development`** (`.agents/skills/subagent-driven-development`):
   - Implementer subagents run on **`deepseek/deepseek-v4-flash-0731`** (cheapest model), on **fresh
     machines**, **stacked** when tasks touch overlapping files. Each subagent prompt must be self-contained
     (spec excerpt, file paths, Convex guidelines pointer, acceptance check).
   - The parent thread keeps the default model and does the per-task review; fix or re-brief on failure.
     If DeepSeek fails the same task twice, redo it on the parent model rather than burning time.
   - Every task ends with `npx tsc --noEmit` passing.
- These skills were copied from superpowers (MIT, see `LICENSE-superpowers`). They reference other
  `superpowers:*` skills that aren't in this repo: skip `using-git-worktrees` (Capy fresh machines already
  isolate work) and use the PR flow above instead of `finishing-a-development-branch` / `executing-plans`.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
