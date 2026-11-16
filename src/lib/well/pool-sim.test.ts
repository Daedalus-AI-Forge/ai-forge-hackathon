import { describe, expect, it } from "vitest";

import { boatBounds, heroFrame } from "./geometry";
import { MAX_RESTING_COINS, floorCoins, makeBoats, pushBoats, spawnTossedCoin, stepBoats, stepCoins } from "./pool-sim";

describe("pool-sim", () => {
  it("a tossed coin sinks to the floor and comes to rest", () => {
    let coins = [spawnTossedCoin(0.1, -0.2)];
    for (let i = 0; i < 400; i++) coins = stepCoins(coins, 1 / 60);
    expect(coins).toHaveLength(1);
    expect(coins[0]!.phase).toBe("resting");
    expect(coins[0]!.depth).toBe(1);
  });

  it("keeps at most MAX_RESTING_COINS resting, fading the oldest away", () => {
    let coins = Array.from({ length: MAX_RESTING_COINS + 3 }, () => spawnTossedCoin(0, 0));
    for (let i = 0; i < 60 * 10; i++) coins = stepCoins(coins, 1 / 60);
    expect(coins).toHaveLength(MAX_RESTING_COINS);
    expect(coins.every((c) => c.phase === "resting")).toBe(true);
  });

  it("a splash pushes nearby boats away from it", () => {
    const [b] = makeBoats(1);
    pushBoats([b!], b!.x - 0.1, b!.y, 0.35);
    expect(b!.vx).toBeGreaterThan(0);
  });

  it("boats on the hero pool stay in the open water below the header, upright, and apart", () => {
    const f = heroFrame(390);
    const bounds = boatBounds(f, 210);
    const boats = makeBoats(6, bounds);
    for (const b of boats) expect(b.y - b.size).toBeGreaterThan(bounds.minY);
    let t = 0;
    for (let i = 0; i < 60 * 90; i++) {
      t += 1 / 60;
      if (i % 600 === 0) pushBoats(boats, 0, bounds.minY + 0.3, 0.35); // splashes now and then
      stepBoats(boats, 1 / 60, t, bounds);
      for (const b of boats) {
        expect(Math.abs(b.rot)).toBeLessThanOrEqual(0.35);
        expect(Math.hypot(b.x, b.y)).toBeLessThan(bounds.maxR + 0.06);
        expect(Math.abs(b.x)).toBeLessThan(bounds.maxX + 0.02);
        expect(b.y).toBeGreaterThan(bounds.minY + b.size * 0.5);
      }
    }
    for (let i = 0; i < boats.length; i++) {
      for (let j = i + 1; j < boats.length; j++) {
        const a = boats[i]!;
        const c = boats[j]!;
        expect(Math.hypot(a.x - c.x, a.y - c.y)).toBeGreaterThan((a.size + c.size) * 0.9);
      }
    }
  });

  it("floorCoins places n deterministic resting coins inside the water", () => {
    const a = floorCoins(5);
    expect(a).toHaveLength(5);
    expect(floorCoins(5)).toEqual(a);
    for (const c of a) {
      expect(c.depth).toBe(1);
      expect(Math.hypot(c.x, c.y)).toBeLessThan(0.8);
    }
    expect(floorCoins(99).length).toBeLessThanOrEqual(8);
  });
});
