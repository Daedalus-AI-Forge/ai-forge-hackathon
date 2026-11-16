# Hackathon log

- **Project:** Wishwell
- **Event:** YC Consumer Mobile Hack 2026-11-15
- **What it does:** Toss a wish into the well; friends pass it on with vouches, ripple by ripple, until it reaches the right person
- **Live app:** not deployed
- **Repo:** private
- **Frontend:** not deployed
- **Convex deployment:** not deployed
- **Components:** @convex-dev/rate-limiter
- **Convex features:** schema, indexes, queries, mutations, actions, scheduler, crons, realtime useQuery, Convex Auth, HTTP actions
- **Auth:** Convex Auth (Google, native Apple, phone OTP, anonymous), off by default via EXPO_PUBLIC_AUTH_ENABLED; pass-on links work without an account
- **AI models:** OpenAI gpt-5-mini via Responses API from Convex actions
- **Started:** 2026-11-15T18:08:17Z
- **Last updated:** 2026-11-16T00:54:16Z

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

### 2026-11-15 - 936ff9d
Renamed Raincheck to Wishwell (app name, slug, scheme `wishwell`, bundle id and Android package
`com.theaiforge.wishwell`, docs) after the product pivot in `docs/wishwell-spec.md`.

### 2026-11-15 - c115da9
Added the Convex backend: `users`, `wishes`, `hops`, `vouches`, `network` tables with indexes;
toss/pass-on/it's-me mutations; a 48h fade via `ctx.scheduler`; AI actions to polish a wish, draft a
vouch and draft the pass-on message (OpenAI Responses API, template fallback); and an internal
`seed:run` with the spec's demo data (`convex/`).

### 2026-11-15 - working tree
Built the app: The Well home (animated pool with live holder avatars per ripple ring), Toss a wish,
the no-login pass-on page `/w/[hopId]` with trust chain, 3-tap vouch, per-person links and share
sheet/SMS/copy, and placeholder My wishes and Me tabs (`src/`). Verified end to end on web against a
local Convex backend.

### 2026-11-15 - capy/wishwell-auth
Added sign-in with Convex Auth behind `EXPO_PUBLIC_AUTH_ENABLED`, which is off by
default. It supports Google OAuth, native Sign in with Apple (the identity token
is verified with `jose` against Apple's JWKS, with a nonce check), and anonymous
sessions that adopt the existing device user. When someone signs in,
`users.linkDevice` moves their device data (wishes, hops, vouches, network,
stars) onto the account. The auth tables are merged into the schema, and the
users table is extended with the Convex Auth profile fields. Auth routes are
served over HTTP actions. Covered by convex-test unit tests and a live anonymous
sign-in smoke script. Google and Apple haven't been tested yet because the
credentials don't exist (`convex/auth.ts`, `convex/authUsers.ts`,
`convex/appleProvider.ts`, `src/app/sign-in.tsx`, `src/lib/auth.tsx`,
`docs/auth-setup.md`).

### 2026-11-15 - capy/wishwell-phone-auth
Added phone number sign-in (API only). `phoneAuth.sendCode({ phone })` normalizes
the number to E.164 with `libphonenumber-js` and sends a code, then
`signIn("phone", { phone, code })` verifies it through a `ConvexCredentials`
provider and finds or creates the account keyed by that number. Codes go
through one module (`convex/sms.ts`): demo numbers from `DEMO_PHONE_NUMBERS`
accept a fixed code and never send SMS, and Twilio Verify is used when its env
vars are set. Sends (1/min, 5/hour) and verify attempts (10/hour) are limited
per number with the `@convex-dev/rate-limiter` component. Covered by convex-test
unit tests (Twilio only with a mocked `fetch`) and a live demo-number smoke
script against the dev deployment. Twilio hasn't been tested against the live
service (`convex/phoneProvider.ts`, `convex/phoneAuth.ts`, `convex/sms.ts`,
`convex/phoneLimits.ts`, `src/lib/phoneAuth.ts`).

### 2026-11-15 - working tree
Added the well's daily wish and the wish network. The well lines up the five
kinds of friend it has mapped least, writes an absurd portrait of the person at
the end and one clue per pass, and sends it through six people. Each pass
records a tagged link the owner can see and delete under Me. The
pass-on page explains what is remembered, shows how it works with live counts,
and invites helpers to install and toss their own wish. Ask the well now reads
the network to suggest who to send a wish to first. Convex features: crons,
internal action, nested-field index (`convex/daily.ts`, `convex/edges.ts`,
`convex/stats.ts`, `convex/crons.ts`, `src/components/NetworkMap.tsx`,
`docs/daily-wish-design.md`).

### 2026-11-15 - capy/wishwell-graph-api
Merged the step1 security fixes into the daily wish and hardened its API the
same way. Ask the well now checks the device id, caps the wish text and the
network it sends to OpenAI, and falls back to the tag match once the rate
limit is hit. Edges clamp names and tags on write, forgetting a person needs a
name, and the daily wish looks up a player's hop with a (wish, holder) index
(`convex/ai.ts`, `convex/daily.ts`, `convex/edges.ts`, `convex/lib.ts`,
`convex/security.test.ts`).

Seeded a demo ego graph for the coach: Mia has 12 people and 23 tagged edges
with one-line reasons, and a second demo user (device id `dev_demo_fresh`) has
2 edges, below the coach threshold. A live smoke script checks the graph, the
reason rule on serious wishes, grounded coach suggestions and forgetting an
edge against the dev deployment, then reseeds (`convex/seed.ts`,
`convex/seed.test.ts`, `scripts/graph-smoke.mjs`, `docs/api/graph-coach.md`).

### 2026-11-15 - capy/paper-boat-ux
Reworked the app around one loop: push a paper boat a day, see who it met the
next morning. Three tabs (Pool, Voyages, Me) replace the old four. The Pool
shows the voyage log, friends' boats ahead of Today's boat, coins on the pool
floor, five progress dots and one primary button. Every five boats pushed earn
a coin. A first-open screen explains the loop. Voyages lists boats and coins
with a city route and status, and each boat has a detail page with its vouch
chain and ending. Finders of Today's boat choose whether their name and city
show, and Me has a privacy switch and "how friends see you" (`convex/pool.ts`,
`convex/hops.ts`, `convex/pool.test.ts`, `src/app/(tabs)/*`, `src/app/welcome.tsx`,
`src/app/boat/[hopId].tsx`, `src/app/w/[hopId].tsx`, `docs/plans/paper-boat-ux-*.md`).

### 2026-11-15 - feat/team-seed
Team demo data: `teamSeed:run` takes the four team members' phone numbers at
run time and binds each number to a user through the same Convex Auth phone
account that sign-in looks up. Each member gets 20 generated close friends
(job, habits, Bay Area city, one-line reason) and the chain Darren → Louise →
Katie → Dazi, tuned so the coach ranks the next person first for "someone to
jam on drums with in the Bay Area". Re-runs replace only the seed's own rows.
A rehearsal script tosses and passes the wish as each member and checks the
coach at every hop (`convex/teamSeed.ts`, `convex/teamSeed.test.ts`,
`scripts/team-chain.mjs`, `docs/demo/team-chain.md`).

### 2026-11-15 - feat/confirm-claim
The wisher confirms a claim from the app, and the first text goes from their
own phone. Voyages shows a "Someone says it's them" card for each verified
claim (`link.pendingClaims`, which never returns a phone). "Yes, it's you"
calls `link.confirmClaim`, which now returns the claimer's verified phone to
the wish creator only. `linkAi.introMessage` drafts a short intro (3s budget,
template fallback), and "Text {name} from my phone" opens the wisher's own
Messages app prefilled with it. The wisher taps Send, so no Twilio number is
needed and the claimer gets the wisher's real number. The automatic notices
no longer mention numbers (`convex/link.ts`, `convex/linkAi.ts`,
`src/components/lv/voyages/ClaimCard.tsx`, `src/app/(tabs)/voyages.tsx`).

**Pick the recipient from Contacts.** A "Pick from contacts" button
(`src/components/ContactPickButton.tsx`, native only; web renders nothing) opens
the system contact picker via `expo-contacts` `Contact.presentPicker()` and
returns only the picked name and one phone (mobile/iPhone label first,
normalized to E.164 in `src/lib/contactPick.ts`). It sits next to the name field
on Toss, Pass-on and the PushStep. The phone stays in component state and is
never sent to Convex; it only pre-fills the recipient when "SMS" / "Open in
Messages" opens the user's own Messages (`sms:<to>&body=` on iOS,
`sms:<to>?body=` on Android). The user still taps Send. Needs a native rebuild
(new native module + `NSContactsUsageDescription`).

### 2026-11-15 - working tree — network presentation
Refined My wish network within the existing warm palette: curved red threads,
concentric ripples, connection badges, tag previews, selection highlighting,
and six-person pages that can locate anyone selected in the full list. Added
live friend/connection/tag totals and source/date context to existing details
(`src/components/lv/me/EgoGraph.tsx`, `src/components/lv/me/MeNetwork.tsx`).
Typecheck, targeted ESLint and all 20 Expo Doctor checks passed. Browser checks
with isolated fixture data covered 320/390/430px widths, selection, pagination,
forgetting tags/people, last-page removal, and empty/loading/single-person states.
No backend changes, new dependencies, deployment or native-device verification.

### 2026-11-15 - working tree — community network perspective
Replaced the personal ring with a community map centered on the viewer: solid
paths fade by graph distance, unrelated components use dashed lines, and people
can be selected, searched, zoomed and panned. The bounded Convex projection uses
verified user IDs and wish hops, respects visibility, excludes the platform well,
and keeps saved aliases and identity-specific evidence private to their owner
(`convex/graph.ts`, `src/components/lv/me/`, `src/lib/graphApi.types.ts`).
Validated 22 scoped tests, full TypeScript, targeted ESLint, 20 Expo Doctor checks,
Web/iOS/Android JS exports, and a push to the isolated local-anonymous backend.
Browser fixtures verified paths, pan/zoom/recenter, search expansion, same-name
identities, aliases, deletion transitions and 320/390px layouts. Added SVG rendering
and the missing expo-font peer for the existing symbols package. No cloud deploy,
push, native development-build rebuild or physical-device verification.

### 2026-11-15 - working tree — iOS glass design system
Restyled every screen in the iOS idiom with frosted glass: an ambient gradient
backdrop, real UIKit blur materials (expo-blur) with Liquid Glass for the floating
tab bar and round back buttons on iOS 26 (expo-glass-effect), CSS backdrop-filter on
web, SF Symbols (expo-symbols), the iOS type ramp, continuous corners and one page
grid (20-pt margins; caps section headers inset to card content). New primitives live
in `src/components/ios/` (Glass, Screen, NavBar/BackButton, LargeTitle, SectionHeader,
Segmented, GlassTabBar, Icon); `passon/kit`, `toss/parts` and `ui.tsx` now share one
control set. Fixed the pass-on screen sitting under the status bar, fields collapsing
in web cards, and the well coin drifting below the pool. Native effects are gated on
the module being present, so an older dev client falls back to translucent views.
Typecheck, 30 src tests, ESLint (no new errors) and 20 Expo Doctor checks pass;
web screens verified in iPhone-sized Chrome. Real blur and SF Symbols need a new
dev build; not yet verified on a device or simulator.

### 2026-11-15 - claude/glass-network — network map in the glass style
Brought the Me-tab wish network onto the iOS glass system without touching its
logic: glass section cards, an iOS search field with grouped results, an inset map
canvas with glass recenter/zoom controls (SF Symbols), round close buttons, tag
capsules, a route drawn as red-thread steps, and an inset-separator list of saved
connections. SVG labels use the system font on web (they fell back to serif).
All testIDs kept (`src/components/lv/me/MeNetwork.tsx`, `EgoGraph.tsx`).
Typecheck, 227 tests and ESLint (no new errors) pass; verified in iPhone-sized
Chrome with sample network data, including a selected connection.

### 2026-11-15 - claude/night-pool-polish — one night scene on the Pool
After #36 (iOS glass) and #37 (night-garden pool) met on the Pool tab, the voyage log,
friends' wish cards and the tab bar were still in the light style inside the night
scene. Following #37's style and interactions while keeping #36's UX: those cards now
use #37's dark glass, serif wish titles and gold actions; the floating tab bar turns
dark with a gold active tab while the Pool is focused (a small chrome-tone store the
Pool sets on focus, next to its status-bar switch); the status-bar scroll strip and
the loading screen are night too. Other tabs keep the light glass. Typecheck, 229
tests and ESLint (no new errors) pass; checked in iPhone-sized Chrome, including
switching tabs back and forth.

### 2026-11-15 - bda7705 — backend meeting completion
Added participant-scoped meeting queries, revision-bound image upload tickets,
photo submission and other-person approval/rejection. Verified claim confirmation
starts a single seven-day window; the server enforces expiry and atomically awards
completion rewards once. Pending outcome data stays private; granted endings expose
the photo, thank-you, winning route and tier, with an optional two-sentence story.
Existing no-device hop calls and verified-phone claim response contracts remain
compatible. Convex features: indexed queries, mutations, HTTP actions, file storage
and scheduled cleanup (`convex/meetings.ts`, `convex/meetingUploadHttp.ts`,
`convex/link.ts`, `convex/schema.ts`).
Per the user's final scope, all UI, assets, app configuration and dependencies remain
unchanged from main. New upload/review controls are not part of this PR and need a
separate UI integration. Historical unbound verified claims retain their old behavior
without guessing a participant identity. Full tests passed (252 tests / 27 files),
as did root/Convex TypeScript. Validation used in-memory Convex tests; no deployment
or live-user messages were performed.

### 2026-11-15 - claude/clearer-home — say whose wish is whose on the Pool
The fountain's wish card was unlabeled, so it was unclear whether it was your wish or
someone else's. It now carries a gold "Your wish" label ("Your wish · 1 of N" when
several are in flight, newest shown); today's boat on the fountain adds "Everyone gets
this boat today"; friends' wish cards in the pool read "✦ Oliver's real wish · pushed to
you" (the header wraps instead of truncating); and the header counters read
"1 coin · 2 boats to next coin". Copy follows the shared vocabulary (boat / push /
Today's boat). Typecheck, 258 tests and ESLint pass; checked in iPhone-sized Chrome.

### 2026-11-16 - a46aa19 — meeting journey connected to existing screens
Kept the night fountain, glass styling and three tabs; added a permanent Toss action
and compact links from Pool, Voyages, claims, wish details and helper boats into the
existing ending page. Real legacy-link claims now use the verified phone flow.
Participants preview and explicitly submit a complete photo, reject or replace it,
and confirm the current image before the public photo, note, story, route and tier
unlock. Contact, meeting mode and thank-you survive refresh through existing Convex
queries/mutations and Storage; native photos are normalized to JPEG.
After merging current main, all 277 tests across 30 files, root/Convex TypeScript,
20 Expo Doctor checks, and Web/iOS/Android JS exports passed. Local Convex browser
checks exercised the claim-to-grant journey, invalid photos, cancellation, revisions,
privacy, expiry, both helper branches and 320–1024px layouts; a storage audit confirmed
the saved photo and granted state. Independent review approved the implementation.
No cloud deployment or live-user messages. Native photo/Message-app behavior still
needs device verification after rebuilding the development client.
