// Plain-TS motion for tossed coins, floating stars and the rising challenge star. No React, no WebGL.
// Ported from Katie-Lan's web prototype (waterworks src/well/pool-sim.ts); floorCoins() is ours.
import type { RenderCoin, RenderRise, RenderStar } from "./water-renderer";

export type CoinPhase = "sinking" | "resting" | "fading";

export interface Coin extends RenderCoin {
  id: number;
  phase: CoinPhase;
  t: number;
  seed: number;
}

let nextId = 1;
// Matches the copper coins resting on the pool floor (pool units, at the floor).
export const COIN_SIZE = 0.04;
export const MAX_RESTING_COINS = 12;

export function spawnTossedCoin(x: number, y: number): Coin {
  return {
    id: nextId++, x, y, depth: 0, size: COIN_SIZE, tilt: 0.9, angle: Math.random() * 6.28,
    variant: Math.random() < 0.5 ? 0 : 1, alpha: 1, phase: "sinking", t: 0, seed: Math.random() * 10,
  };
}

export function stepCoins(coins: Coin[], dt: number): Coin[] {
  for (const c of coins) {
    c.t += dt;
    if (c.phase === "sinking") {
      c.depth = Math.min(1, c.depth + dt * 0.34);
      const free = 1 - c.depth;
      c.tilt = free * 1.25 * Math.sin(c.t * 6.5 + c.seed);
      c.angle += dt * free * 1.6;
      c.x += Math.sin(c.t * 2.2 + c.seed) * 0.05 * dt * free;
      c.y += Math.cos(c.t * 1.7 + c.seed) * 0.03 * dt * free;
      if (c.depth >= 1) c.phase = "resting";
    } else if (c.phase === "resting") {
      c.tilt *= Math.exp(-6 * dt);
    } else {
      c.alpha -= dt * 0.5;
    }
  }
  const resting = coins.filter((c) => c.phase === "resting");
  resting.slice(0, Math.max(0, resting.length - MAX_RESTING_COINS)).forEach((c) => (c.phase = "fading"));
  return coins.filter((c) => c.alpha > 0);
}

/** Deterministic hash in [0, 1): the same layout on every render and platform. */
function rand(i: number, n: number) {
  let h = Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(n + 7, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h ^= h >>> 13;
  return ((h >>> 0) % 1000) / 1000;
}

export const MAX_FLOOR_COINS = 8;

/** The user's coins already lying on the pool floor (capped), at stable spots. */
export function floorCoins(n: number): RenderCoin[] {
  return Array.from({ length: Math.max(0, Math.min(n, MAX_FLOOR_COINS)) }, (_, i) => {
    const a = rand(i, 21) * Math.PI * 2;
    const r = 0.12 + Math.sqrt(rand(i, 22)) * 0.6;
    return {
      x: Math.cos(a) * r, y: Math.sin(a) * r, depth: 1, size: COIN_SIZE, tilt: 0,
      angle: rand(i, 23) * 6.28, variant: i % 2, alpha: 1,
    };
  });
}

// ---- the daily challenge star: rises from the floor, opens at the surface ----
export type RisePhase = "rising" | "opening" | "open";

export interface RisingStar extends RenderRise {
  phase: RisePhase;
  t: number;
}

export function spawnChallengeStar(x: number, y: number): RisingStar {
  return { x, y, depth: 1, size: 0.075, rot: 0, glow: 0.3, alpha: 0, open: 0, phase: "rising", t: 0 };
}

export const RISE_SPEED = 0.3; // depth per second
export const OPEN_SECONDS = 0.9;

/** Returns true on the frame the star finishes opening. */
export function stepChallengeStar(s: RisingStar, dt: number): boolean {
  s.t += dt;
  if (s.phase === "rising") {
    s.alpha = Math.min(1, s.alpha + dt * 1.2);
    s.depth = Math.max(0, s.depth - dt * RISE_SPEED);
    s.glow = 0.35 + (1 - s.depth) * 0.85;
    s.rot += dt * (0.4 + (1 - s.depth) * 1.2);
    if (s.depth <= 0) {
      s.phase = "opening";
      s.t = 0;
    }
  } else if (s.phase === "opening") {
    s.open = Math.min(1, s.t / OPEN_SECONDS);
    s.rot += dt * 2.5 * (1 - s.open);
    if (s.open >= 1) {
      s.phase = "open";
      return true;
    }
  }
  return false;
}

export interface FloatStar extends RenderStar {
  vx: number;
  vy: number;
  spin: number;
}

export function makeStars(count: number): FloatStar[] {
  const out: FloatStar[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + 0.4;
    const rr = 0.35 + ((i * 37) % 10) / 20;
    out.push({
      x: Math.cos(a) * rr, y: Math.sin(a) * rr, rot: i * 1.3, size: 0.05 + (i % 3) * 0.012,
      vx: 0, vy: 0, spin: (i % 2 ? 1 : -1) * 0.05,
    });
  }
  return out;
}

/** Slow circulation, push-away from splashes, soft wall at the rim. */
export function stepStars(stars: FloatStar[], dt: number, time: number) {
  for (const s of stars) {
    const r = Math.hypot(s.x, s.y) || 1e-4;
    const swirl = 0.025;
    s.vx += (-s.y / r) * swirl * dt + Math.sin(time * 0.3 + s.rot) * 0.004 * dt;
    s.vy += (s.x / r) * swirl * dt + Math.cos(time * 0.27 + s.rot) * 0.004 * dt;
    if (r > 0.82) {
      s.vx -= (s.x / r) * (r - 0.82) * 2 * dt;
      s.vy -= (s.y / r) * (r - 0.82) * 2 * dt;
    }
    const damp = Math.exp(-0.9 * dt);
    s.vx *= damp;
    s.vy *= damp;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.rot += (s.spin + Math.hypot(s.vx, s.vy) * 2) * dt;
  }
}

export function pushStars(stars: FloatStar[], x: number, y: number, power: number) {
  for (const s of stars) {
    const dx = s.x - x;
    const dy = s.y - y;
    const d = Math.hypot(dx, dy);
    if (d < 0.4 && d > 1e-4) {
      const f = (power * (0.4 - d)) / 0.4 / d;
      s.vx += dx * f;
      s.vy += dy * f;
    }
  }
}
