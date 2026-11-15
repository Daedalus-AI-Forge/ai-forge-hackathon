import { describe, expect, it } from "vitest";
import { tierFor } from "./rules";
describe("thread tiers", () => {
  it("1 hop is gold", () => expect(tierFor(1)).toBe("gold"));
  it("2 hops is silver", () => expect(tierFor(2)).toBe("silver"));
  it("3 hops is bronze", () => expect(tierFor(3)).toBe("bronze"));
  it("4-6 hops is red", () => { expect(tierFor(4)).toBe("red"); expect(tierFor(6)).toBe("red"); });
  it("more than 6 hops breaks", () => expect(tierFor(7)).toBe("broken"));
});

import { forwardsNeeded } from "./rules";
describe("forwarding cost", () => {
  it("making a free wish costs 3 forwards", () => expect(forwardsNeeded(false)).toBe(3));
  it("helpers who skip the wish only need 1", () => expect(forwardsNeeded(true)).toBe(1));
});
