import { describe, expect, it } from "vitest";

import { inferWishType, tossToast } from "./tossWish";

describe("tossToast", () => {
  it("quotes the wish in Katie's copy", () => {
    expect(tossToast("  find a drummer ")).toBe("“find a drummer” is in the water — ripple 1 has begun");
  });
  it("is quiet for an empty wish", () => {
    expect(tossToast("   ")).toBe("A quiet wish, sinking slowly");
  });
});

describe("inferWishType", () => {
  it("reads a local guide wish", () => {
    expect(inferWishType("find a Tokyo local to show me izakayas")).toBe("local");
  });
  it("reads a been-there wish", () => {
    expect(inferWishType("someone who has been to Antarctica")).toBe("been_there");
  });
  it("reads a same-boat wish", () => {
    expect(inferWishType("someone who also just moved to SF")).toBe("same_boat");
  });
  it("defaults to doing something together", () => {
    expect(inferWishType("play drums with me")).toBe("do_together");
  });
});
