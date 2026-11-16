/** Pure helpers for tossing a wish from the pool (RN-free so vitest can run them). */
import type { ApiWishType } from "./lvWishTypes";

/** The pool's toast after a coin lands (copy from Katie-Lan's prototype). */
export function tossToast(wish: string): string {
  const text = wish.trim();
  return text ? `“${text}” is in the water — ripple 1 has begun` : "A quiet wish, sinking slowly";
}

/** Best-guess wish type from the one line, so the pool composer needs no type picker. */
export function inferWishType(wish: string): ApiWishType {
  const t = wish.toLowerCase();
  if (/\b(been to|has been|have been|visited|lived in|went to)\b/.test(t)) return "been_there";
  if (/\b(also|same|too|just moved|going through|new to)\b/.test(t)) return "same_boat";
  if (/\b(local|show me|guide|around town|in (the )?city)\b/.test(t)) return "local";
  return "do_together";
}
