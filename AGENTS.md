# Agent instructions — Raincheck (YC Consumer Mobile Hack 2026-11-15)

- Required stack: Capy (agents), Revyl (device testing), Convex (backend).
- Convex setup: follow `.agents/convex-agent-setup.md` (copy of https://www.convex.dev/agent-setup.md).
  After the Expo app exists, run `npx convex ai-files install` and check `convex/_generated/ai/guidelines.md`.
- Build log: use the `convex-hackathon-skill` (`.agents/skills/convex-hackathon-skill/SKILL.md`)
  to keep `hackathon.md` current after each meaningful change.
- Never commit secrets: keys go in `.env.local` or Convex dashboard env vars (`.gitignore` blocks `.env*`).
- Expo (SDK 58, expo-router): routes live in `src/app/`, non-route code in `src/`. Add packages with
  `npx expo install <pkg>`. Native modules need a dev build (`eas build --profile development`), not Expo Go.
  Never hand-edit `ios/` or `android/` (generated). Check with `npm run typecheck` and `npx expo-doctor`.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
