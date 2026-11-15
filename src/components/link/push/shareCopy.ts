// Pure helpers for the push step's share copy and link (no React Native imports, unit-tested).

/** Template used when the AI draft fails or is slow. Describes only the vouch and the wish. */
export function fallbackShareMessage(name: string, vouch: string, wishText: string) {
  const head = `${name.trim()}, I thought of you: ${vouch.trim()}`;
  const wish = wishText.trim();
  return wish ? `${head} — ${wish}` : head;
}

/** The link to share: the OG preview route when the Convex site URL is known, else the web page. */
export function ogShareUrl(childHopId: string, siteUrl: string | undefined | null, webOrigin: string | null) {
  const site = siteUrl?.trim().replace(/\/$/, "");
  if (site) return `${site}/og/w/${childHopId}`;
  return `${webOrigin ? webOrigin.replace(/\/$/, "") : ""}/l/${childHopId}`;
}

/** Rejects with "timeout" if `p` does not settle within `ms`. */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}
