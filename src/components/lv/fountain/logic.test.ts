import { describe, expect, test } from "vitest";

import { DIVE_MS, MOTES, SPARKLES, diveMemory, wishLine } from "./logic";

describe("fountain sparkle layout", () => {
  test("is deterministic and stays on screen", () => {
    expect(SPARKLES).toHaveLength(28);
    expect(MOTES).toHaveLength(14);
    for (const s of SPARKLES) {
      expect(s.left).toBeGreaterThanOrEqual(0);
      expect(s.left).toBeLessThanOrEqual(100);
      expect(s.top).toBeGreaterThanOrEqual(8);
      expect(s.top).toBeLessThanOrEqual(88);
      expect(s.size).toBeGreaterThanOrEqual(2);
      expect(s.size).toBeLessThanOrEqual(6);
    }
  });
});

describe("diveMemory", () => {
  test("starts on the fountain and remembers a dive for the rest of the session", () => {
    diveMemory.reset();
    expect(diveMemory.dived()).toBe(false);
    diveMemory.dive();
    expect(diveMemory.dived()).toBe(true);
    diveMemory.surface();
    expect(diveMemory.dived()).toBe(false);
  });
  test("the dive matches the prototype's 750 ms", () => {
    expect(DIVE_MS).toBe(750);
  });
});

describe("wishLine", () => {
  const now = Date.UTC(2026, 10, 15, 12, 0, 0);
  const wish = (
    over: Partial<{
      text: string;
      status: string;
      ripples: number;
      expiresAt: number;
    }>,
  ) => ({
    text: "find a Tokyo local",
    status: "traveling",
    ripples: 2,
    expiresAt: now + 20 * 3600 * 1000 - 4000,
    ...over,
  });

  test("shows the newest traveling wish with its ripple and time left", () => {
    expect(wishLine([wish({})], now)).toEqual({
      text: "find a Tokyo local",
      meta: "Ripple 2 · 19:59:56 left",
    });
  });
  test("a wish with no ripples yet is still in the well", () => {
    expect(wishLine([wish({ ripples: 0 })], now)?.meta).toBe("In the well · 19:59:56 left");
  });
  test("skips wishes that are no longer traveling, and returns null when none are", () => {
    expect(wishLine([wish({ status: "expired" }), wish({ text: "second" })], now)?.text).toBe("second");
    expect(wishLine([wish({ status: "granted" })], now)).toBeNull();
    expect(wishLine(undefined, now)).toBeNull();
  });
});
