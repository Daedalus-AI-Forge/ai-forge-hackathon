/**
 * Sign-in is off unless EXPO_PUBLIC_AUTH_ENABLED is exactly "true". Off means
 * the app behaves exactly as before: plain ConvexProvider, device identity,
 * no sign-in UI. Inlined at build time, so it never changes at runtime.
 */
export const AUTH_ENABLED = process.env.EXPO_PUBLIC_AUTH_ENABLED === "true";
