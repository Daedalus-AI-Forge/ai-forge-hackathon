import { useAuthActions, useAuthToken } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation } from "convex/react";
import { usePathname } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useRef } from "react";
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
