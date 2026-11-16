import { describe, expect, it } from "vitest";

import { flyFrame, partialArc, slerp, vecOf, wishPathStops } from "./wishPath";

describe("wishPathStops", () => {
  it("keeps holder order with names and skips unknown cities", () => {
    const stops = wishPathStops([
      { name: "Ana", city: "Tokyo" },
      { name: "Bo", city: "Atlantis" },
      { name: "Cy", city: "San Francisco" },
    ]);
    expect(stops.map((s) => `${s.name}·${s.city}`)).toEqual(["Ana·Tokyo", "Cy·San Francisco"]);
    expect(stops[0]!.lat).toBeCloseTo(35.68, 0);
  });

  it("falls back to the route of cities when there are no holders", () => {
    expect(wishPathStops(undefined, ["London", null, "Paris"]).map((s) => s.city)).toEqual(["London", "Paris"]);
  });
});

describe("slerp / partialArc", () => {
  it("stays on the unit sphere and hits both ends", () => {
    const a = vecOf(0, 0);
    const b = vecOf(0, 90);
    const m = slerp(a, b, 0.5);
    expect(Math.hypot(m.x, m.y, m.z)).toBeCloseTo(1);
    expect(m.x).toBeCloseTo(Math.SQRT1_2);
    const arc = partialArc(a, b, 1);
    expect(arc.at(-1)!.x).toBeCloseTo(1);
    const head = partialArc(a, b, 0.5).at(-1)!;
    // lifted off the surface mid-arc, but pointing at the halfway point
    expect(head.x / Math.hypot(head.x, head.y, head.z)).toBeCloseTo(Math.SQRT1_2);
  });
});

describe("flyFrame", () => {
  const stops = wishPathStops([
    { name: "A", city: "London" },
    { name: "B", city: "Paris" },
    { name: "C", city: "Tokyo" },
  ]);
  it("starts at the first stop and ends at the last", () => {
    const start = flyFrame(stops, 0);
    expect(start.leg).toBe(0);
    expect(start.head.x).toBeCloseTo(vecOf(stops[0]!.lat, stops[0]!.lng).x);
    const end = flyFrame(stops, 2);
    expect(end.leg).toBe(1);
    expect(end.frac).toBe(1);
    expect(end.reached).toBe(3);
    expect(end.head.z).toBeCloseTo(vecOf(stops[2]!.lat, stops[2]!.lng).z);
  });
  it("handles a single stop", () => {
    expect(flyFrame(stops.slice(0, 1), 0.7).reached).toBe(1);
  });
});
