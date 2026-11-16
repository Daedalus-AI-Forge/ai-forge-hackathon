import { describe, expect, it } from "vitest";
import { doneTitle, endingShareText, progressDots, pushMoreLine, routeChain, validateContact } from "./logic";

describe("validateContact", () => {
  it("requires a value", () => {
    expect(validateContact("phone", "  ")).toEqual({ ok: false, error: "Leave a phone number or email so we can tell you when your boat lands" });
  });
  it("accepts phone with spaces and plus", () => {
    expect(validateContact("phone", "+1 415 555 0100")).toEqual({ ok: true, value: "+14155550100" });
  });
  it("rejects too-short phone", () => {
    expect(validateContact("phone", "12345").ok).toBe(false);
  });
  it("accepts and trims email", () => {
    expect(validateContact("email", " Ben@Example.com ")).toEqual({ ok: true, value: "Ben@Example.com" });
  });
  it("rejects malformed email", () => {
    expect(validateContact("email", "ben@").ok).toBe(false);
    expect(validateContact("email", "ben.example.com").ok).toBe(false);
  });
});

describe("progress", () => {
  it("renders dots", () => {
    expect(progressDots(1, 5)).toBe("●○○○○");
    expect(progressDots(0, 5)).toBe("○○○○○");
    expect(progressDots(9, 5)).toBe("●●●●●");
  });
  it("push more line", () => {
    expect(pushMoreLine(1, 5)).toBe("Push 4 more boats to make another wish");
    expect(pushMoreLine(4, 5)).toBe("Push 1 more boat to make another wish");
  });
});

describe("doneTitle", () => {
  it("wish set sail only when a free wish was made", () => {
    expect(doneTitle("hi", { freeWishUsed: false, wishId: "w1" })).toBe("Your wish set sail");
    expect(doneTitle(null, { freeWishUsed: false, wishId: null })).toBe("Thanks for helping");
    expect(doneTitle("hi", { freeWishUsed: true, wishId: null })).toBe("Thanks for helping");
  });
});

describe("ending helpers", () => {
  it("route chain", () => {
    expect(routeChain(["SF", "Oakland", "NYC"])).toBe("SF → Oakland → NYC");
    expect(routeChain([])).toBe("");
  });
  it("share text", () => {
    const t = endingShareText({ wishText: "Meet a designer", story: "It drifted. It landed.", route: ["SF", "NYC"] }, "https://x/e/1");
    expect(t).toContain("Meet a designer");
    expect(t).toContain("SF → NYC");
    expect(t).toContain("https://x/e/1");
  });
});

describe("withFallback", () => {
  it("returns the value, or the fallback on error / timeout", async () => {
    const { withFallback } = await import("./logic");
    expect(await withFallback(Promise.resolve("a"), "f")).toBe("a");
    expect(await withFallback(Promise.reject(new Error("x")), "f")).toBe("f");
    expect(await withFallback(new Promise<string>(() => {}), "f", 10)).toBe("f");
  });
});
