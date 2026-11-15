# Sign-in setup (Convex Auth: Google, native Apple, anonymous)

Wishwell uses [Convex Auth](https://labs.convex.dev/auth) (`@convex-dev/auth` 0.0.x line, pinned to `0.0.98`).
Sign-in ships **off**: until `EXPO_PUBLIC_AUTH_ENABLED=true`, the app runs exactly as before on the
anonymous device identity, with no sign-in UI. The pass-on page `/w/[hopId]` never needs a login.

> Why not Convex Auth v2? v2.0.0 (released 2026-11-12) is a rewrite on Convex components that
> documents React SPAs and Next.js only, and ships Apple as a web OAuth flow. It has no Expo/React Native
> setup and no native Apple identity-token sign-in, so this PR stays on the maintained 0.0.x line.

## How identity works

| Mode | What happens |
| --- | --- |
| Flag off (default) | `ConvexProvider`, `users.ensure({ deviceId })`, the same as before. |
| Flag on, first launch | `signIn("anonymous", { deviceId })`. The server adopts the existing device user row, so the user keeps all data. They get an auth session without logging in. |
| Flag on, Google/Apple | `signIn("google" \| "apple")`, then the app calls `users.linkDevice({ deviceId })`. That moves the device/anonymous user's wishes, hops (holder), vouches (about), network, stars (summed) and wishes left (max) onto the account and deletes the old row. |
| Signed out | Back to a fresh anonymous user for this device. The old device id no longer reaches the account's data. |

Every existing `{ deviceId }` function resolves the auth user first (`convex/lib.ts` → `userByDevice`), so
no Capy screen needed changing.

## Already done on the dev deployment (`gallant-seal-635`)

`JWT_PRIVATE_KEY`, `JWKS` (generated headlessly with `jose`) and `SITE_URL=http://localhost:8081` are set.
Anonymous sign-in works end to end: `node scripts/auth-smoke.mjs https://gallant-seal-635.convex.cloud`.
For prod, generate a **new** key pair the same way (see `.claude/skills/convex-auth/SKILL.md`) and set it with
`npx convex env set --prod "NAME=$VALUE"`.

## 1. Google

1. Google Cloud console → APIs & Services → **OAuth consent screen**: set it up (External, app name
   Wishwell, your support email). Add test users while it's in Testing.
2. **Credentials → Create credentials → OAuth client ID → Web application** (a Web client, even for the
   mobile app, because Convex does the OAuth exchange on the server).
   - Authorized JavaScript origins: `http://localhost:8081` (and your web domain later).
   - Authorized redirect URI: `<CONVEX_SITE_URL>/api/auth/callback/google`, for dev:
     `https://gallant-seal-635.convex.site/api/auth/callback/google`
     (`.convex.site`, not `.convex.cloud`).
3. Set the client on Convex (dev; repeat with `--prod` for prod):
   ```sh
   npx convex env set AUTH_GOOGLE_ID "<client id>"
   npx convex env set AUTH_GOOGLE_SECRET "<client secret>"
   ```
The app opens Google in an auth session (`expo-web-browser`) and returns to `wishwell://`. On web it returns
to `SITE_URL`, so set `SITE_URL` to the deployed web origin in prod. The server only accepts `redirectTo`
values that start with `wishwell://` or `SITE_URL` (`convex/authRedirect.ts`).

## 2. Apple (native, iOS)

1. Apple Developer → Certificates, Identifiers & Profiles → Identifiers → `com.theaiforge.wishwell` →
   enable **Sign in with Apple** → Save. Regenerate or refresh the provisioning profiles; EAS does this on
   the next build.
2. No Services ID, key or client secret is needed for the native flow. `app.json` already has
   `ios.usesAppleSignIn: true` and the `expo-apple-authentication` plugin, so the entitlement goes into the
   next dev-client build: `eas build --profile development --platform ios`. It won't work in Expo Go.
3. Nothing to set in Convex. The server checks the identity token against
   `https://appleid.apple.com/auth/keys` with `iss=https://appleid.apple.com`, `aud=com.theaiforge.wishwell`
   and `nonce = SHA-256(raw nonce)`, and uses `sub` as the account id. To accept another audience as well
   (e.g. a second bundle id), set `AUTH_APPLE_AUDIENCES` (comma-separated).

The Apple button appears only on iOS when `AppleAuthentication.isAvailableAsync()` is true. If you cancel,
nothing happens. Apple sends the user's name only on the first authorization, and we keep it.

## 3. Turn it on

In `.env.local` (or the EAS build profile's `env`):
```sh
EXPO_PUBLIC_AUTH_ENABLED=true
```
Restart Metro with `-c`, since `EXPO_PUBLIC_*` values are inlined at build time. The Me tab then shows a
**Sign in** card that leads to `/sign-in`. To turn it off, remove the variable or set anything other than
`true`.

## Verify

```sh
npm test                    # convex-test: adoption, upgrade merge, redirect allow-list, nonce hash
npx tsc --noEmit
node scripts/auth-smoke.mjs https://gallant-seal-635.convex.cloud   # live anonymous round-trip
npx convex run authAdmin:deleteUser '{"userId":"<id printed by the smoke script>"}'   # clean up
```

## Known limits

- Google and Apple are separate accounts. We don't link them by email, partly because Apple often returns a
  private relay address.
- The device id is still a bearer secret for anonymous users, the same trust model as before auth.
