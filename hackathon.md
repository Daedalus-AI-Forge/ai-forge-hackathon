# Hackathon log

- **Project:** Raincheck
- **Event:** YC Consumer Mobile Hack 2026-11-15
- **What it does:** Not documented yet
- **Live app:** not deployed
- **Repo:** private
- **Frontend:** not deployed
- **Convex deployment:** not deployed
- **Components:** none
- **Convex features:** schema
- **Auth:** none
- **AI models:** none
- **Started:** 2026-11-15T18:08:17Z
- **Last updated:** 2026-11-15T18:21:06Z

## Log

### 2026-11-15 - 49a442e
Created the repo and ignored env files, native folders, and signing material so
secrets stay out of Git (`README.md`, `.gitignore`).

### 2026-11-15 - working tree
Scaffolded the mobile app skeleton: Expo SDK 58 with TypeScript and expo-router,
expo-dev-client, and EAS development, simulator, preview, and production build
profiles for device testing (`app.json`, `eas.json`, `src/app/`). Wired Convex
through a `ConvexProvider` that reads `EXPO_PUBLIC_CONVEX_URL` and an empty
schema; the home screen shows the live Convex connection state. Convex features:
schema (`convex/schema.ts`, `src/lib/convex.ts`, `src/app/index.tsx`).
