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
- **Last updated:** 2026-11-15T21:10:00Z

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
