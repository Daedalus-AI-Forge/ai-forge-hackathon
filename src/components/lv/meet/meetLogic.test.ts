import { describe, expect, it } from "vitest";

import { grantedStops, meetCopy, otherName } from "./meetLogic";

const holders = [
  { key: "creator", name: "Mia", city: "Austin", depth: 0, avatar: "#111", acted: null },
  { key: "0", name: "Ben", city: "Dallas", depth: 1, avatar: "#222", acted: "pass" as const },
  { key: "1", name: "Ana", city: null, depth: 2, avatar: "#333", acted: "its_me" as const },
];

describe("grantedStops", () => {
  it("gives +1 star only to the helpers between the wisher and the match", () => {
    expect(grantedStops(holders).map((s) => [s.name, s.star])).toEqual([
      ["Mia", false],
      ["Ben", true],
      ["Ana", false],
    ]);
  });
  it("handles a direct match and a missing list", () => {
    expect(grantedStops(holders.slice(0, 1).concat(holders[2])).some((s) => s.star)).toBe(false);
    expect(grantedStops(undefined)).toEqual([]);
  });
});

describe("meetCopy", () => {
  const base = { role: "creator" as const, creatorName: "Mia", matchName: "Ana" };
  it("names the other side", () => {
    expect(otherName(base)).toBe("Ana");
    expect(otherName({ ...base, role: "match" })).toBe("Mia");
  });
  it("words every stage", () => {
    expect(meetCopy({ ...base, stage: "upload" }).title).toBe("Waiting for you to meet…");
    expect(meetCopy({ ...base, stage: "waiting" }).title).toContain("Ana");
    expect(meetCopy({ ...base, stage: "review" }).title).toContain("Is this you two");
    expect(meetCopy({ ...base, stage: "expired" }).title).toContain("passed");
    expect(meetCopy({ ...base, stage: "granted" }).title).toBe("Wish granted");
  });
});
