import { useAuthActions, useAuthToken, useConvexAuth as useConvexAuthTokens } from "@convex-dev/auth/react";
import { ConvexProviderWithAuth, type ConvexReactClient, useConvexAuth, useMutation } from "convex/react";
import { usePathname } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { type ReactNode, useCallback, useEffect, useMemo, useRef } from "react";
import { Platform } from "react-native";

import { api } from "@/convex/_generated/api";
import { useDeviceId } from "@/lib/device";

export { AUTH_ENABLED } from "@/lib/authFlag";

/** Native: tokens in the keychain/keystore. Web: Convex Auth's default (localStorage). */
export const authStorage =
  Platform.OS === "ios" || Platform.OS === "android"
    ? {
        getItem: SecureStore.getItemAsync,
        setItem: SecureStore.setItemAsync,
        removeItem: SecureStore.deleteItemAsync,
      }
    : undefined;

/** The `sub` claim ("userId|sessionId") of a Convex Auth JWT, or null. */
export function sessionOf(token: string | null): string | null {
  if (!token) return null;
  try {
    const part = token.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const sub = (JSON.parse(atob(part.padEnd(part.length + ((4 - (part.length % 4)) % 4), "="))) as { sub?: unknown }).sub;
    return typeof sub === "string" ? sub : token;
  } catch {
    return token;
  }
}

/**
 * Convex Auth's own ConvexProviderWithAuth only calls `client.setAuth` when
 * isAuthenticated flips false -> true. AuthBridge signs every device in
 * anonymously first, so a later Google/Apple/phone sign-in swaps one valid
 * token for another and the websocket keeps the anonymous identity until the
 * JWT expires (~1h) or the app restarts. This hook hands Convex a new
 * fetchAccessToken whenever the session (JWT `sub`) changes, which re-runs
 * setAuth; plain token refreshes keep the same session and do not re-auth.
 */
function useSessionAwareAuth() {
  const { isLoading, isAuthenticated, fetchAccessToken } = useConvexAuthTokens();
  const session = sessionOf(useAuthToken());
  const fetchForSession = useCallback((args: { forceRefreshToken: boolean }) => fetchAccessToken(args), [fetchAccessToken, session]);
  return useMemo(() => ({ isLoading, isAuthenticated, fetchAccessToken: fetchForSession }), [isLoading, isAuthenticated, fetchForSession]);
}

/** Place directly inside ConvexAuthProvider; re-authenticates the client on every new session. */
export function SessionAuth({ client, children }: { client: ConvexReactClient; children: ReactNode }) {
  return (
    <ConvexProviderWithAuth client={client} useAuth={useSessionAwareAuth}>
      {children}
    </ConvexProviderWithAuth>
  );
}

/**
 * Keeps the auth session and the device identity in step (auth on only):
 * - no session yet: sign in anonymously with this device's id, which adopts
 *   the existing device user, so nothing is lost and no login is needed;
 * - any new session token (e.g. after Google/Apple): `users.linkDevice`
 *   folds the device/anonymous user's data into the signed-in account.
 * The pass-on page (/w/...) stays session-free.
 */
export function AuthBridge() {
  const deviceId = useDeviceId();
  const pathname = usePathname();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();
  const token = useAuthToken();
  const ensure = useMutation(api.users.ensure);
  const linkDevice = useMutation(api.users.linkDevice);
  const tried = useRef(false);
  const onPassOn = pathname.startsWith("/w/");

  useEffect(() => {
    if (isAuthenticated) {
      tried.current = false;
      return;
    }
    if (isLoading || !deviceId || onPassOn || tried.current) return;
    tried.current = true;
    signIn("anonymous", { deviceId }).catch((e: unknown) => {
      // Auth misconfigured on the backend: fall back to the plain device user.
      console.warn("Anonymous sign-in failed, using device identity", e);
      void ensure({ deviceId });
    });
  }, [isAuthenticated, isLoading, deviceId, onPassOn, signIn, ensure]);

  useEffect(() => {
    if (!token || !deviceId) return;
    linkDevice({ deviceId }).catch((e: unknown) => console.warn("linkDevice failed", e));
  }, [token, deviceId, linkDevice]);

  return null;
}
