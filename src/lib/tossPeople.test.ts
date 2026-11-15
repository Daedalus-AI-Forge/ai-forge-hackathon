import { describe, expect, it } from "vitest";

import { prefillPeople, textAllLabel } from "./tossPeople";

const blank = () => ({ name: "", reason: "", contact: "", tags: [] as string[] });

describe("prefillPeople", () => {
  it("fills the empty starting slot and adds slots up to the max", () => {
    const out = prefillPeople([blank()], [
      { name: "Ana", why: "a" },
      { name: "Bo", why: "b" },
      { name: "Cy", why: "c" },
      { name: "Di", why: "d" },
    ], 3, blank);
    expect(out.map((p) => [p.name, p.reason])).toEqual([["Ana", "a"], ["Bo", "b"], ["Cy", "c"]]);
  });

  it("never overwrites a typed name and skips duplicates", () => {
    const typed = { ...blank(), name: "bo", reason: "mine" };
    const out = prefillPeople([typed, blank()], [
      { name: "Bo", why: "b" },
      { name: "Ana", why: "a" },
    ], 3, blank);
    expect(out.map((p) => [p.name, p.reason])).toEqual([["bo", "mine"], ["Ana", "a"]]);
  });

  it("keeps a typed reason on a blank-name slot", () => {
    const out = prefillPeople([{ ...blank(), reason: "keep" }], [{ name: "Ana", why: "a" }], 3, blank);
    expect(out[0]).toMatchObject({ name: "Ana", reason: "keep" });
  });

  it("returns the same array when nothing changes", () => {
    const full = [{ ...blank(), name: "A" }, { ...blank(), name: "B" }, { ...blank(), name: "C" }];
    expect(prefillPeople(full, [{ name: "D", why: "d" }], 3, blank)).toBe(full);
  });
});

describe("textAllLabel", () => {
  const names = ["Ana", "Bo", "Cy"];
  it("starts with Text all N", () => expect(textAllLabel(names, 0)).toBe("Text all 3"));
  it("names the next person", () => expect(textAllLabel(names, 1)).toBe("Next: text Bo"));
  it("is done after the last", () => expect(textAllLabel(names, 3)).toBeNull());
  it("single person reads naturally", () => expect(textAllLabel(["Ana"], 0)).toBe("Text Ana"));
});
