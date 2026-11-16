import { toE164 } from "../../../lib/contactPick";

// Pure helpers for the link page's contact, done, and ending screens (no React Native imports).

export type ContactKind = "phone" | "email";

export const CONTACT_REQUIRED = "Leave a phone number or email so we can tell you when your boat lands";

/** Basic client-side format check; the server normalizes and dedupes. */
export function validateContact(kind: ContactKind, raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const text = raw.trim();
  if (!text) return { ok: false, error: CONTACT_REQUIRED };
  if (kind === "phone") {
    const digits = text.replace(/\D/g, "");
    if (!/^\+?[\d\s().-]+$/.test(text) || digits.length < 7 || digits.length > 15) {
      return { ok: false, error: "That phone number doesn't look right" };
    }
    // No "+" means a US/Canada number (+1 default); the server re-normalizes and dedupes.
    return { ok: true, value: toE164(text) ?? `+${digits}` };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return { ok: false, error: "That email doesn't look right" };
  return { ok: true, value: text };
}

export function progressDots(progress: number, perCoin: number): string {
  const n = Math.max(1, perCoin);
  const filled = Math.min(n, Math.max(0, Math.floor(progress)));
  return "●".repeat(filled) + "○".repeat(n - filled);
}

export function pushMoreLine(progress: number, perCoin: number): string {
  const left = Math.max(1, perCoin - Math.max(0, progress));
  return `Push ${left} more boat${left === 1 ? "" : "s"} to make another wish`;
}

export function doneTitle(wishText: string | null, r: { freeWishUsed: boolean; wishId: string | null }): string {
  return wishText && !r.freeWishUsed && r.wishId ? "Your wish set sail" : "Thanks for helping";
}

export function routeChain(route: string[]): string {
  return route.filter((c) => c && c.trim()).join(" → ");
}

/** Polaroid-style share copy: describes only the wish and its journey. */
export function endingShareText(v: { wishText: string; story: string; route: string[] }, url: string): string {
  const route = routeChain(v.route);
  return [`⛵ "${v.wishText}"`, v.story, route ? `Route: ${route}` : null, url].filter(Boolean).join("\n");
}

export const PROPHECY_FALLBACK = "Someone two friends away is already closer than you think.";

/** Resolve with the action's result, or the fallback after `ms` or on error. */
export async function withFallback<T>(p: Promise<T>, fallback: T, ms = 3000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  try {
    return await Promise.race([p.catch(() => fallback), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
