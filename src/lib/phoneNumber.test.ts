import { describe, expect, test } from "vitest";

import { normalizePhone } from "../../convex/sms";
import { phoneFromParts } from "./phoneNumber";

const DEMO_ENV = { DEMO_PHONE_NUMBERS: "+15555550100" };

describe("phoneFromParts", () => {
  test("joins a country code and a national number", () => {
    expect(phoneFromParts("1", "555 555 0100")).toBe("+15555550100");
    expect(phoneFromParts("+44", "20 7946 0958")).toBe("+442079460958");
  });

  test("a full international number (iOS AutoFill / paste) is used as is", () => {
    expect(phoneFromParts("1", "+1 (555) 555-0100")).toBe("+15555550100");
    expect(phoneFromParts("1", "+44 20 7946 0958")).toBe("+442079460958");
    expect(phoneFromParts("44", " +44 20 7946 0958")).toBe("+442079460958");
  });

  test("the demo number typed in the sign-in form reaches the server as the demo number", () => {
    for (const [cc, number] of [
      ["1", "5555550100"],
      ["1", "555 555 0100"],
      ["1", "+1 555 555 0100"],
    ] as const) {
      expect(normalizePhone(phoneFromParts(cc, number), DEMO_ENV)).toBe("+15555550100");
    }
  });
});
