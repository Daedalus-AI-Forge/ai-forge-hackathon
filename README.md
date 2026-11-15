# Wishwell — YC Consumer Mobile Hack 2026-11-15

Toss a wish into the well. Your friends pass it on, ripple by ripple, until it reaches the one person who can make it come true.
Spec: `docs/wishwell-spec.md`. Built with Capy, Revyl and Convex.

## Run the demo

```sh
npm install
npx convex dev                 # links the deployment, pushes functions, writes EXPO_PUBLIC_CONVEX_URL to .env.local
npx convex env set DEMO_MODE true   # enables the demo profile button (users.claimDemo); leave unset in prod
npx convex run seed:run        # resets demo data: 15 users, 3 wishes (granted / traveling / racing)
npx expo start --web           # pass-on pages + app on web (or: npm start for the dev client)
```

Then on the Well tab tap **Try it with demo wishes** (or Me → Use demo profile) to become Mia in SF:
her Tokyo izakaya wish shows in the pool (2nd ripple · 4 holding it · ~20h left) and Oliver's
Antarctica race wish (1h left) appears under "Friends' wishes you can help". Tap **I know someone**
to walk the full pass-on flow, or **Toss a wish** to make a new one.

AI drafting uses `OPENAI_API_KEY` from the Convex env (`npx convex env set OPENAI_API_KEY ...`);
without it every AI button falls back to a template so the demo never breaks.
Set `EXPO_PUBLIC_WEB_URL` (e.g. your hosted web export) so links shared from native point at the web pass-on page.
