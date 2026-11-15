import { describe, expect, test } from "vitest";

import { choosePhone, smsHref, toE164 } from "./contactPick";

describe("choosePhone", () => {
  test("prefers a mobile / iPhone label over others", () => {
    expect(
      choosePhone([
        { label: "home", number: "555 000 1111" },
        { label: "_$!<Mobile>!$_", number: "555 000 2222" },
      ]),
    ).toBe("555 000 2222");
    expect(choosePhone([{ label: "work", number: "1" + "5550003333" }, { label: "iPhone", number: "5550004444" }])).toBe("5550004444");
  });

  test("falls back to the first number with digits", () => {
    expect(choosePhone([{ label: "home", number: "" }, { label: "work", number: "555 000 5555" }])).toBe("555 000 5555");
  });

  test("no usable number gives null", () => {
    expect(choosePhone([])).toBeNull();
    expect(choosePhone([{ label: "mobile" }])).toBeNull();
  });
});

describe("toE164", () => {
  test("national number gets the default +1", () => {
    expect(toE164("(555) 000-1234")).toBe("+15550001234");
  });
  test("an international number is kept", () => {
    expect(toE164("+44 20 7946 0958")).toBe("+442079460958");
    expect(toE164("0044 20 7946 0958")).toBe("+442079460958");
  });
  test("an 11-digit US number with leading 1 is not double-prefixed", () => {
    expect(toE164("1 555 000 1234")).toBe("+15550001234");
  });
  test("too short is null", () => {
    expect(toE164("123")).toBeNull();
  });
});

describe("smsHref", () => {
  test("iOS uses & before body, Android uses ?", () => {
    expect(smsHref("hi there", undefined, "ios")).toBe("sms:&body=hi%20there");
    expect(smsHref("hi", undefined, "android")).toBe("sms:?body=hi");
  });
  test("recipient is pre-filled when given", () => {
    expect(smsHref("hi", "+15550001234", "ios")).toBe("sms:+15550001234&body=hi");
    expect(smsHref("hi", "+15550001234", "android")).toBe("sms:+15550001234?body=hi");
  });
  test("a blank recipient is ignored", () => {
    expect(smsHref("hi", "  ", "ios")).toBe("sms:&body=hi");
  });
});
