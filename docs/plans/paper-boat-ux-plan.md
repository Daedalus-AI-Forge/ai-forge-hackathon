# Paper boat UX — plan

Design: `docs/plans/paper-boat-ux-design.md`. Branch: `capy/paper-boat-ux`.

## Task 0 — backend (done by the parent, already on the branch)
- `convex/pool.ts`: `voyageLog({deviceId, date})`, `voyages({deviceId})`, `friendsSay({deviceId})`, `setShowInLogs({deviceId, value})`.
- `convex/schema.ts`: `users.boatProgress`, `users.showInLogs`, `hops.itsMePublic`.
- `convex/hops.ts`: `act` counts boats toward a coin; `itsMe` takes `showNameAndCity`.
- Tests: `convex/pool.test.ts`.

## Task 1 — shell, onboarding, Pool home
Files: `src/app/(tabs)/_layout.tsx`, `src/app/(tabs)/index.tsx`, delete `src/app/(tabs)/new.tsx`,
`src/app/_layout.tsx` (register `welcome`, `boat/[hopId]`), new `src/app/welcome.tsx`, new `src/components/lv/pool/*`.
Check: `npx tsc --noEmit`, `npx vitest run`.

## Task 2 — Voyages tab and boat detail
Files: new `src/app/(tabs)/voyages.tsx`, delete `src/app/(tabs)/wishes.tsx`, new `src/app/boat/[hopId].tsx`,
`src/app/threads/[id].tsx`, `src/components/lv/threads/threadData.ts` (labels), new `src/components/lv/voyages/*`.
Check: `npx tsc --noEmit`.

## Task 3 — boat flows, toss a coin, Me
Files: `src/app/w/[hopId].tsx`, `src/app/toss.tsx`, `src/app/(tabs)/me.tsx`, `src/components/lv/passon/*`,
`src/components/lv/toss/*`, `src/components/lv/me/*`.
Check: `npx tsc --noEmit`.

Tasks 1–3 touch disjoint files and run in parallel on fresh machines from this branch; the parent reviews each
diff and combines them into one PR.
