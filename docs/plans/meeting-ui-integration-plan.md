# Meeting UI integration plan

Base: e173295. Spec: meeting-ui-integration-design.md plus original user journey.

## Global constraints
- Keep current night Pool/light glass visual language and three tabs.
- All main tabs expose a wish entry without covering the Pool composer or content.
- Use existing meetings APIs and MeetCard/GrantedCard, not a parallel UI system.
- Persist real user operations via Convex. No mock data in production code.
- Only confirmed participants upload/review; opposite participant approves current
  photo; deadline, privacy and once-only rewards remain server enforced.
- Full image must load before submission/approval; replacement preserves meeting mode
  and note after refresh; cancel/error remains recoverable.
- Preserve daily claim behavior; route real legacy /w claims through supported verified
  claim flow rather than accepting unsupported legacy claims.
- No cloud deployment or live-user messages during tests; local anonymous fixtures only.

## Task 1: integrate existing frontend
Read /tmp/meeting-ui-task-brief.md. Implement and typecheck; report to scratch workspace.

## Task 2: verify and review
Parent runs actual local Convex/Chromium flow, checks visual continuity and small widths.
Independent code review, scoped fixes and final review; update hackathon log.

## Task 3: deliver
Create and merge PR per user's standing request, with changed UI controls and tests
clearly described. Preserve unrelated worktrees and pending UI work.

## Validation completed

- Implemented in a46aa19; integrated latest main88691b8 in80c1b79 without replacing its water effect.
- Parent spec/quality review and independent whole-branch review approved, no findings.
- Full suite: 277 tests / 30 files; root and Convex TypeScript; Expo Doctor20/20; all-platform JS export passed.
- Local anonymous Convex + Chromium: 12 meeting journey checks, 5 verified-claim/navigation checks, and 3 layout/cancel/contact-copy checks; zero page/console errors.
- Database/Storage audit confirmed saved image, granted state, call mode and preserved note. Temporary fixtures are excluded from the branch.
- Existing 16 lint errors and 2 warnings in changed files match the base; no new diagnostics.
- Native device testing and cloud UI publication were not performed. ImageManipulator requires a rebuilt native development client.
