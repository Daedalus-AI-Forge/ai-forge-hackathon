/** Native deep link the Expo app registers (app.json `scheme`). */
export const APP_SCHEME = "wishwell://";

/**
 * Where OAuth may send the browser back to: the app's own scheme (native)
 * or SITE_URL (web). Anything else is an open redirect and is rejected.
 */
export function allowedRedirect(redirectTo: string, siteUrl: string | undefined) {
  const site = (siteUrl ?? "").replace(/\/$/, "");
  if (redirectTo.startsWith(APP_SCHEME)) return redirectTo;
  if (redirectTo.startsWith("/") || redirectTo.startsWith("?")) return `${site}${redirectTo}`;
  const rest = redirectTo.slice(site.length);
  if (site && redirectTo.startsWith(site) && (rest === "" || "/?#".includes(rest[0]))) {
    return redirectTo;
  }
  throw new Error(`Invalid redirectTo ${redirectTo}`);
}
