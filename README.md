# Wishwell

**Wishes that travel friend to friend until they come true.** Built at the YC Consumer Mobile Hack, 2026-11-15.

Demo story: Louise wishes to try a Japanese tea ceremony. Her AI coach suggests Katie, "from a daily boat 3 weeks ago". Katie helps from the no-app link page and passes it to Darren, and Dazi says "That's me": California → Osaka → Kyoto in 3 passes. Every friend vouches for the last one; anyone helping from a link gets a free wish of their own. You meet, snap a photo, and the wish is GRANTED. The World tab is a real-geography globe where every completed wish can "Fly the route" in 3D, success stories carry meet-up photos, and AI bots keep wishes travelling across 18 countries. Toss lives on the Well tab, and the lantern paper boat is the app icon. A person always taps Send; the AI only drafts.

- Live link: https://gallant-seal-635.convex.site
- Demo ending (granted tea-ceremony wish): https://gallant-seal-635.convex.site/e/jn72jhcrt9geza5qs4vk47w5eh8jaae8
- Pitch, demo script and sponsor details: `docs/submission/`
- Spec: `docs/wishwell-spec.md`
- Team: Darren, Louise, Katie (design by Katie-Lan and Louise)

| Pool | Toss + AI coach | No-app link page |
| --- | --- | --- |
| ![Night-garden fountain Pool](docs/submission/screens/pool.png) | ![Night sheet with AI coach picks](docs/submission/screens/toss.png) | ![Link page in Safari](docs/submission/screens/link.png) |

## Sponsors
- **Convex**: the entire backend (realtime database, phone OTP auth, file storage, scheduler + crons, rate limiter, OpenAI/Twilio actions, static hosting for the link page).
- **Capy**: agents built the core PRs with a brainstorm → plan → subagent-driven build workflow (`AGENTS.md`).
- **Revyl**: iOS/Android device builds, a Pool/toss smoke test, and SMS-free device sign-in (`.revyl/`).

## Run the demo

```sh
npm install
npx convex dev                 # links the deployment, pushes functions, writes EXPO_PUBLIC_CONVEX_URL to .env.local
npx convex env set DEMO_MODE true   # enables the demo profile button (users.claimDemo); leave unset in prod
npx convex run seed:run        # resets demo data: 15 users, 3 wishes (granted / traveling / racing)
# team demo chain + worldwide network map: see docs/demo/team-chain.md (teamSeed:run, "global": true)
npx expo start --web           # pass-on pages + app on web (or: npm start for the dev client)
```

Then in the Well tab tap **Try it with demo wishes** (or Me → Use demo profile) to become Mia in SF:
her Tokyo izakaya wish is a coin on the pool floor (Voyages → Coins: 2 hops · 4 holding it · ~20h left)
and Oliver's Antarctica race wish (1h left) floats in as "Oliver's real wish". Tap **Push to someone**
to walk the full pass-on flow, or **Toss a coin** to make a new one.

AI drafting uses `OPENAI_API_KEY` from the Convex env (`npx convex env set OPENAI_API_KEY ...`);
without it every AI button falls back to a template so the demo never breaks.
Set `EXPO_PUBLIC_WEB_URL` (e.g. your hosted web export) so links shared from native point at the web pass-on page.
