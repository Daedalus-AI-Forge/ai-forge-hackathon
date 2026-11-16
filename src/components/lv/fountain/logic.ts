import { countdown, hopCount } from "../../../lib/time";

/** Length of the dive from the fountain into the pool (the prototype's 750 ms). */
export const DIVE_MS = 750;

// Deterministic layout (integer hashing), ported from the prototype's FountainScene.
function rand(i: number, n: number) {
  let h = Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(n + 7, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h ^= h >>> 13;
  return ((h >>> 0) % 1000) / 1000;
}

export const SPARKLES = Array.from({ length: 28 }, (_, i) => ({
  left: Math.round(rand(i, 1) * 100),
  top: 8 + Math.round(rand(i, 2) * 80),
  size: 2 + Math.round(rand(i, 3) * 4),
  dur: 2 + Math.round(rand(i, 4) * 30) / 10,
  delay: Math.round(rand(i, 5) * 40) / 10,
}));

export const MOTES = Array.from({ length: 14 }, (_, i) => ({
  left: 10 + Math.round(rand(i, 11) * 80),
  top: 55 + Math.round(rand(i, 12) * 35),
  dur: 6 + Math.round(rand(i, 13) * 6),
  delay: Math.round(rand(i, 14) * 80) / 10,
}));

/**
 * Whether the person has dived into the pool this session. Module state on purpose: it survives tab
 * switches and remounts, and resets when the app restarts, so a fresh launch opens on the fountain.
 */
let dived = false;
export const diveMemory = {
  dived: () => dived,
  dive: () => {
    dived = true;
  },
  surface: () => {
    dived = false;
  },
  reset: () => {
    dived = false;
  },
};

export type WishLike = {
  text: string;
  status: string;
  ripples: number;
  expiresAt: number;
};

/** The fountain's "your wish" card: the newest traveling wish, how many hops it has made, and time left. */
export function wishLine(mine: readonly WishLike[] | undefined, now: number) {
  const w = mine?.find((x) => x.status === "traveling");
  if (!w) return null;
  return {
    text: w.text,
    meta: `${hopCount(w.ripples)} · ${countdown(w.expiresAt, now)} left`,
  };
}
