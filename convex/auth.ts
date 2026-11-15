import Google from "@auth/core/providers/google";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { convexAuth } from "@convex-dev/auth/server";

import type { DataModel } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { AppleNative } from "./appleProvider";
import { allowedRedirect } from "./authRedirect";
import { cleanDeviceId, createOrUpdateUser, newUserFields } from "./authUsers";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    // Reads AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET from the deployment env.
    Google,
    AppleNative,
    // `signIn("anonymous", { deviceId })` gives the current no-login device
    // identity a real auth session (see createOrUpdateUser).
    Anonymous<DataModel>({
      profile: (params) => ({
        ...newUserFields("anonymous"),
        deviceId: cleanDeviceId(params.deviceId),
        isAnonymous: true,
      }),
    }),
  ],
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      return await createOrUpdateUser(ctx as unknown as MutationCtx, args);
    },
    // OAuth may only return to the app's own scheme or to SITE_URL (web).
    async redirect({ redirectTo }) {
      return allowedRedirect(redirectTo, process.env.SITE_URL);
    },
  },
});
