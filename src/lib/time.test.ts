import { describe, expect, test } from "vitest";

import { countdown, nextUtcMidnight } from "./time";

describe("nextUtcMidnight", () => {
  test("is the start of the next UTC day, when today's boat (keyed by UTC date) rolls over", () => {
    const now = Date.UTC(2026, 10, 15, 23, 30, 0);
    expect(nextUtcMidnight(now)).toBe(Date.UTC(2026, 10, 16));
    expect(countdown(nextUtcMidnight(now), now)).toBe("00:30:00");
  });

  test("exactly at midnight it counts a full day", () => {
    const now = Date.UTC(2026, 11, 31);
    expect(nextUtcMidnight(now)).toBe(Date.UTC(2027, 0, 1));
  });
});
