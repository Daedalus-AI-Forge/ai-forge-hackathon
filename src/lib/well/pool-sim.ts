// Plain-TS motion for tossed coins, floating paper boats and the rising challenge star. No React, no WebGL.
// Ported from Katie-Lan's web prototype (waterworks src/well/pool-sim.ts); floorCoins() and the boats are ours.
import { OPEN_WATER, type BoatBounds } from "./geometry";
import type { RenderBoat, RenderCoin, RenderRise } from "./water-renderer";

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

// ---- paper boats drifting on the surface (they took the prototype's floating stars' place) ----

export interface FloatBoat extends RenderBoat {
  vx: number;
  vy: number;
  seed: number;
}

/** Boats spread across the open water, at stable spots. `size` is a boat's half-width in pool units. */
export function makeBoats(count: number, bounds: BoatBounds = OPEN_WATER): FloatBoat[] {
  const out: FloatBoat[] = [];
  const top = Math.max(bounds.minY + 0.16, -bounds.maxR * 0.8);
  const bottom = bounds.maxR * 0.78;
  for (let i = 0; i < count; i++) {
    const size = 0.085 + rand(i, 33) * 0.03;
    const y = top + (bottom - top) * (count === 1 ? 0.5 : (i % 2 ? 0.25 : 0.7) + (rand(i, 31) - 0.5) * 0.3);
    const chord = Math.sqrt(Math.max(0, bounds.maxR ** 2 - y ** 2));
    const half = Math.max(0, Math.min(chord, bounds.maxX) - size);
    const x = (((i + 0.5) / count) * 2 - 1) * half;
    out.push({ x, y, rot: 0, size, vx: 0, vy: 0, seed: rand(i, 34) * 10 });
  }
  return out;
}

/** A slow wander, soft walls (the rim, the visible width, the top of the open water), no overlaps, and a rock. */
export function stepBoats(boats: FloatBoat[], dt: number, time: number, bounds: BoatBounds = OPEN_WATER) {
  for (const b of boats) {
    b.vx += Math.sin(time * 0.23 + b.seed) * 0.012 * dt;
    b.vy += Math.cos(time * 0.19 + b.seed * 1.7) * 0.008 * dt;
    const r = Math.hypot(b.x, b.y) || 1e-4;
    if (r > bounds.maxR) {
      b.vx -= (b.x / r) * (r - bounds.maxR) * 2 * dt;
      b.vy -= (b.y / r) * (r - bounds.maxR) * 2 * dt;
    }
    const side = bounds.maxX - b.size;
    if (Math.abs(b.x) > side) b.vx -= Math.sign(b.x) * (Math.abs(b.x) - side) * 2 * dt;
    // the sail tip rises 0.72 half-widths above the boat's centre: keep it under the line
    const top = bounds.minY + b.size;
    if (b.y < top) b.vy += (top - b.y) * 2 * dt;
  }
  for (let i = 0; i < boats.length; i++) {
    for (let j = i + 1; j < boats.length; j++) {
      const a = boats[i]!;
      const c = boats[j]!;
      const dx = c.x - a.x;
      const dy = c.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = (a.size + c.size) * 1.2;
      if (d < min && d > 1e-4) {
        const f = ((min - d) * 0.8 * dt) / d;
        a.vx -= dx * f;
        a.vy -= dy * f;
        c.vx += dx * f;
        c.vy += dy * f;
      }
    }
  }
  const damp = Math.exp(-0.9 * dt);
  for (const b of boats) {
    b.vx *= damp;
    b.vy *= damp;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    // rock on the swell and lean into the drift; a boat never capsizes
    b.rot = 0.1 * Math.sin(time * 1.15 + b.seed * 2) + Math.max(-0.25, Math.min(0.25, b.vx * 3));
  }
}

export function pushBoats(boats: FloatBoat[], x: number, y: number, power: number) {
  for (const b of boats) {
    const dx = b.x - x;
    const dy = b.y - y;
    const d = Math.hypot(dx, dy);
    if (d < 0.4 && d > 1e-4) {
      const f = (power * (0.4 - d)) / 0.4 / d;
      b.vx += dx * f;
      b.vy += dy * f;
    }
  }
}
