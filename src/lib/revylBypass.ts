import { launchValue } from "../../modules/revyl-launch-config";

export const REVYL_BUILD = process.env.EXPO_PUBLIC_REVYL_BUILD === "true";

const ROLES = new Set(["new", "demo"]);

export type BypassRequest = { route: "/" | "/me" | `/w/${string}`; role: "new" | "demo" };

export function checkBypass(params: { token?: string; redirect?: string; role?: string }): BypassRequest | string {
  if (!REVYL_BUILD) return "Revyl auth bypass is not in this build";
  if (launchValue("REVYL_AUTH_BYPASS_ENABLED") !== "true") return "Revyl auth bypass is disabled";
  const expected = launchValue("REVYL_AUTH_BYPASS_TOKEN");
  if (!expected || params.token !== expected) return "Bad Revyl auth bypass token";
  const role = params.role ?? "new";
  if (!ROLES.has(role)) return "Role is not allowlisted";
  const redirect = params.redirect ?? "/";
  if (redirect === "/" || redirect === "/me" || /^\/w\/[a-z0-9]+$/.test(redirect)) {
    return { route: redirect as BypassRequest["route"], role: role as BypassRequest["role"] };
  }
  return "Redirect is not allowlisted";
}
