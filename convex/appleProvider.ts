import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { createAccount } from "@convex-dev/auth/server";
import { createRemoteJWKSet, jwtVerify } from "jose";

import type { DataModel, Doc } from "./_generated/dataModel";

type AuthProfile = Omit<Doc<"users">, "_id" | "_creationTime">;

export const APPLE_ISSUER = "https://appleid.apple.com";
export const APPLE_BUNDLE_ID = "com.theaiforge.wishwell";
const APPLE_JWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

/** Audiences we accept: the iOS bundle id, plus any extra (comma-separated) in AUTH_APPLE_AUDIENCES. */
function appleAudiences() {
  const extra = String(process.env.AUTH_APPLE_AUDIENCES ?? "")
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean);
  return [APPLE_BUNDLE_ID, ...extra];
}

export async function sha256Hex(input: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Native "Sign in with Apple" (iOS): the app gets an identity token from
 * `expo-apple-authentication` and calls `signIn("apple", { idToken, nonce, name })`.
 * We verify the token against Apple's JWKS (signature, iss, aud, exp) and
 * the nonce: the app passes SHA-256(nonce) to Apple and the raw nonce to us.
 * Apple's `sub` is the stable account id. No Services ID / client secret is
 * needed for the native flow.
 */
export const AppleNative = ConvexCredentials<DataModel>({
  id: "apple",
  authorize: async (params, ctx) => {
    const idToken = params.idToken;
    const nonce = params.nonce;
    if (typeof idToken !== "string" || idToken.length === 0) {
      throw new Error("Missing Apple identity token");
    }
    if (typeof nonce !== "string" || nonce.length < 16) {
      throw new Error("Missing Apple sign-in nonce");
    }
    const { payload } = await jwtVerify(idToken, APPLE_JWKS, {
      issuer: APPLE_ISSUER,
      audience: appleAudiences(),
    });
    if (payload.nonce !== (await sha256Hex(nonce))) {
      throw new Error("Apple sign-in nonce mismatch");
    }
    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      throw new Error("Apple identity token has no subject");
    }
    const email = typeof payload.email === "string" ? payload.email : undefined;
    const emailVerified = payload.email_verified === true || payload.email_verified === "true";
    // Apple only sends the name on the very first authorization, via the
    // client (not inside the token), so treat it as display-only user input.
    const name = typeof params.name === "string" ? params.name.trim().slice(0, 80) : undefined;
    const { user } = await createAccount(ctx, {
      provider: "apple",
      account: { id: payload.sub },
      // createAccount types `profile` as a full users row, but our
      // createOrUpdateUser callback (convex/authUsers.ts) builds the row.
      profile: { email, emailVerified, name } as unknown as AuthProfile,
    });
    return { userId: user._id };
  },
});
