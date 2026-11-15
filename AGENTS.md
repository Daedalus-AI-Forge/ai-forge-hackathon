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
