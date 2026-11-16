import { describe, expect, it } from "vitest";

import { MAX_RESTING_COINS, floorCoins, makeStars, pushStars, spawnTossedCoin, stepCoins } from "./pool-sim";

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

  it("a splash pushes nearby stars away from it", () => {
    const [s] = makeStars(1);
    const before = { x: s!.x, y: s!.y };
    pushStars([s!], before.x - 0.1, before.y, 0.35);
    expect(s!.vx).toBeGreaterThan(0);
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
