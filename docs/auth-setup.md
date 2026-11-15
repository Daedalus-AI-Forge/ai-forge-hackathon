# Sign-in setup (Convex Auth: Google, native Apple, phone, anonymous)

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
| Flag on, Google/Apple/phone | `signIn("google" \| "apple" \| "phone")`, then the app calls `users.linkDevice({ deviceId })`. That moves the device/anonymous user's wishes, hops (holder), vouches (about), network, stars (summed) and wishes left (max) onto the account and deletes the old row. |
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

## 3. Phone number (OTP)

Two steps. The API is in `convex/phoneAuth.ts` (step 1) and `convex/phoneProvider.ts` (step 2), and the
client helper is `src/lib/phoneAuth.ts`.

| Step | Call | Returns |
| --- | --- | --- |
| 1. Send code | `api.phoneAuth.sendCode({ phone })` (action) | `{ phone: "+15555550100", resendAfterMs: 30000 }`. `phone` is the normalized E.164 number. |
| 2. Verify | `signIn("phone", { phone, code })` (from `useAuthActions`) | A session. `AuthBridge` then runs `users.linkDevice`, so the anonymous user's wishes and stars move onto the phone account. |

Sending is a separate action and not `signIn("phone", { phone })`. In 0.0.98 a credentials provider can only
return a session or `null`, and `null` makes the client clear its current anonymous session.

The account id is the E.164 number, so the same number always signs in to the same user. The user row gets
`phone` and `phoneVerificationTime` (indexed by Convex Auth's required `phone` index). `users.account` now also
returns `phone`.

**Errors.** Both steps throw `ConvexError` with `data = { code, message, retryAfterMs? }`. The codes are
`INVALID_PHONE`, `INVALID_CODE`, `NOT_CONFIGURED`, `RATE_LIMITED`, `SEND_FAILED` and `VERIFY_FAILED`. `message`
is safe to show to users.

**Limits per number:** 1 send per minute and 5 per hour, and 10 verify attempts per hour (`convex/phoneLimits.ts`).

### For the UI

```ts
import { phoneAuthErrorMessage, phoneFromParts, RESEND_SECONDS, usePhoneAuth } from "@/lib/phoneAuth";

const { sendCode, verifyCode } = usePhoneAuth();
const { phone } = await sendCode(phoneFromParts(countryCode, number)); // e.g. "+1", "555 555 0100"
await verifyCode(phone, code);                                         // throws on a wrong code
// catch (e) { setError(phoneAuthErrorMessage(e)); }
```

- Inputs: a country code picker (default `+1`) and a national number field (`keyboardType="phone-pad"`).
- Code field: `keyboardType="number-pad"`, `textContentType="oneTimeCode"` (iOS SMS autofill) and
  `autoComplete="sms-otp"` (Android).
- Resend: disable it for `RESEND_SECONDS` (30s) after each send. On `RATE_LIMITED`, show the message, which
  includes the wait time.
- This needs `EXPO_PUBLIC_AUTH_ENABLED=true`. The pass-on page `/w/[hopId]` still needs no login.

### Demo mode (works today, no SMS)

Numbers in `DEMO_PHONE_NUMBERS` (comma-separated E.164) accept `DEMO_PHONE_CODE`, which defaults to `000000`,
and never send an SMS. Demo numbers win even when Twilio is configured. Set on dev (`gallant-seal-635`):
`DEMO_PHONE_NUMBERS=+15555550100,+15555550101,+15555550102` and `DEMO_PHONE_CODE=000000`.

### Real SMS (Twilio Verify)

1. In the Twilio console, create a **Verify Service** (Verify → Services → Create). Note its `VA...` SID.
2. Set these on the deployment (`--prod` for prod):
   ```sh
   npx convex env set TWILIO_ACCOUNT_SID "AC..."
   npx convex env set TWILIO_AUTH_TOKEN "<auth token>"
   npx convex env set TWILIO_VERIFY_SERVICE_SID "VA..."
   ```
3. Twilio generates, sends and stores the code. We store nothing secret. Calls use a 10s timeout. A failed
   send returns `SEND_FAILED`, and a Twilio outage while checking returns `VERIFY_FAILED`. An expired or used
   code returns `INVALID_CODE`. Trial accounts can only text verified numbers.

Numbers that are neither demo numbers nor covered by Twilio get `NOT_CONFIGURED` ("Phone sign-in isn't set up
for this number yet").

## 4. Turn it on

In `.env.local` (or the EAS build profile's `env`):
```sh
EXPO_PUBLIC_AUTH_ENABLED=true
```
Restart Metro with `-c`, since `EXPO_PUBLIC_*` values are inlined at build time. The Me tab then shows a
**Sign in** card that leads to `/sign-in`. To turn it off, remove the variable or set anything other than
`true`.

## Verify

```sh
npm test                    # convex-test: adoption, upgrade merge, redirect allow-list, nonce hash, phone OTP
npx tsc --noEmit
node scripts/auth-smoke.mjs https://gallant-seal-635.convex.cloud   # live anonymous round-trip
npx convex run authAdmin:deleteUser '{"userId":"<id printed by the smoke script>"}'   # clean up
node scripts/phone-smoke.mjs https://gallant-seal-635.convex.cloud   # live demo-number OTP round-trip (cleans up itself)
```

## Known limits

- Google and Apple are separate accounts. We don't link them by email, partly because Apple often returns a
  private relay address.
- The device id is still a bearer secret for anonymous users, the same trust model as before auth.
