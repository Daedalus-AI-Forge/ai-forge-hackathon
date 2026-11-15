import { describe, expect, it } from "vitest";

import { fallbackShareMessage, ogShareUrl, withTimeout } from "./shareCopy";
import { cleanError, isSixDigitCode } from "../claim/errors";

describe("fallbackShareMessage", () => {
  it("describes only the vouch and wish", () => {
    const m = fallbackShareMessage("Ben", "he fixes every bike on the block", "Find a tandem partner");
    expect(m).toBe("Ben, I thought of you: he fixes every bike on the block — Find a tandem partner");
    expect(m.toLowerCase()).not.toContain("forward");
    expect(m.toLowerCase()).not.toContain("unlock");
  });
  it("drops the wish part when wish text is missing", () => {
    expect(fallbackShareMessage("Ben", "kind", "")).toBe("Ben, I thought of you: kind");
  });
});

describe("ogShareUrl", () => {
  it("uses the Convex site URL og route", () => {
    expect(ogShareUrl("h1", "https://x.convex.site/", null)).toBe("https://x.convex.site/og/w/h1");
  });
  it("falls back to /l on the web origin", () => {
    expect(ogShareUrl("h1", undefined, "https://app.example")).toBe("https://app.example/l/h1");
  });
  it("falls back to a relative path with nothing configured", () => {
    expect(ogShareUrl("h1", "", null)).toBe("/l/h1");
  });
});

describe("withTimeout", () => {
  it("resolves the value when fast", async () => {
    await expect(withTimeout(Promise.resolve("a"), 50)).resolves.toBe("a");
  });
  it("rejects when slow", async () => {
    await expect(withTimeout(new Promise(() => {}), 10)).rejects.toThrow("timeout");
  });
});

describe("cleanError", () => {
  it("strips Convex wrapping", () => {
    const e = new Error("[CONVEX M(link:pushOne)] [Request ID: abc] Server Error\nUncaught Error: Pick someone else — this boat already passed through them\n    at handler (../convex/link.ts:40:11)\n\n  Called by client");
    expect(cleanError(e)).toBe("Pick someone else — this boat already passed through them");
  });
  it("reads ConvexError data", () => {
    expect(cleanError({ data: "Verify your phone first", message: "x" })).toBe("Verify your phone first");
  });
  it("falls back for unknown values", () => {
    expect(cleanError(null)).toBe("Something went wrong. Try again.");
  });
});

describe("isSixDigitCode", () => {
  it("accepts exactly six digits", () => {
    expect(isSixDigitCode("123456")).toBe(true);
    expect(isSixDigitCode("12345")).toBe(false);
    expect(isSixDigitCode("12a456")).toBe(false);
  });
});
