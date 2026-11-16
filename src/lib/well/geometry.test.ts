import { describe, expect, it } from "vitest";

import { OPEN_WATER, RIM, boatBounds, circleFrame, heroFrame, openWaterCentre, toPoolSpace } from "./geometry";

describe("heroFrame", () => {
  for (const width of [320, 390, 430, 680]) {
    it(`at ${width}px the top is all water and the rim shows only along the bottom`, () => {
      const f = heroFrame(width);
      // both top corners are inside the water: no rim anywhere along the top edge
      for (const x of [0, width]) expect(Math.hypot(...Object.values(toPoolSpace(f, x, 0)))).toBeLessThan(1);
      // the water reaches both side edges
      expect(f.R).toBeGreaterThan(width / 2);
      // the whole bottom of the rim fits, with a little garden below it
      const rimBottom = f.cy + f.R * (1 + RIM);
      expect(rimBottom).toBeLessThan(f.height);
      expect(f.height - rimBottom).toBeLessThan(width * 0.06);
    });
  }
});

describe("boatBounds", () => {
  it("keeps boats below the header line and inside the visible width", () => {
    const f = heroFrame(390);
    const b = boatBounds(f, 210);
    expect(b.minY).toBeCloseTo((210 - f.cy) / f.R);
    expect(b.maxX * f.R).toBeLessThan(f.width / 2);
  });

  it("the small round pool is open water everywhere", () => {
    expect(boatBounds(circleFrame(200))).toEqual({ ...OPEN_WATER, maxX: 0.96 });
  });

  it("a coin with no tapped spot lands in the open water, below the header", () => {
    const b = boatBounds(heroFrame(390), 210);
    const c = openWaterCentre(b);
    expect(c.y).toBeGreaterThan(b.minY);
    expect(c.y).toBeLessThan(b.maxR);
  });
});
