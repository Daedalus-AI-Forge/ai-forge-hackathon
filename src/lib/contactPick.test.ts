import { describe, expect, test } from "vitest";

import { choosePhone, phoneLabel, phoneTail, smsHref, toE164, toSuggestions } from "./contactPick";

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

describe("smsHref with a picked recipient (iOS format verified on device)", () => {
  test("iOS: recipient then &body=, body encoded including the newline before the link", () => {
    expect(smsHref("Hi Louise\nhttps://x.y/w/1", "+15555550100", "ios")).toBe("sms:+15555550100&body=Hi%20Louise%0Ahttps%3A%2F%2Fx.y%2Fw%2F1");
  });
  test("an E.164 number from toE164 goes in unchanged", () => {
    expect(smsHref("x", toE164("(555) 555-0100") ?? undefined, "ios")).toBe("sms:+15555550100&body=x");
  });
});

describe("choosePhone edge cases", () => {
  test("undefined / null lists are treated as empty", () => {
    expect(choosePhone(undefined)).toBeNull();
    expect(choosePhone(null)).toBeNull();
  });
});

describe("phoneLabel", () => {
  test("strips the iOS label wrapper and lowercases", () => {
    expect(phoneLabel("_$!<Mobile>!$_")).toBe("mobile");
    expect(phoneLabel("iPhone")).toBe("iphone");
  });
  test("missing label reads as phone", () => {
    expect(phoneLabel(undefined)).toBe("phone");
    expect(phoneLabel("")).toBe("phone");
  });
});

describe("toSuggestions", () => {
  const louise = { fullName: "Louise Chen", phones: [{ label: "home", number: "555 555 0101" }, { label: "_$!<Mobile>!$_", number: "(555) 555-0100" }] };
  test("one chip per contact with a usable phone, mobile preferred, E.164", () => {
    expect(toSuggestions([louise])).toEqual([{ key: "Louise Chen|+15555550100", name: "Louise Chen", phone: "+15555550100", label: "mobile" }]);
  });
  test("skips contacts with no name or no phone, dedupes, caps at max", () => {
    const list = [
      { fullName: "", phones: [{ number: "5555550102" }] },
      { fullName: "No Phone", phones: [] },
      louise,
      louise,
      { fullName: "Lou A", phones: [{ number: "5555550103" }] },
      { fullName: "Lou B", phones: [{ number: "5555550104" }] },
      { fullName: "Lou C", phones: [{ number: "5555550105" }] },
    ];
    expect(toSuggestions(list).map((s) => s.name)).toEqual(["Louise Chen", "Lou A", "Lou B"]);
    expect(toSuggestions(list, 1)).toHaveLength(1);
  });
});

describe("phoneTail", () => {
  test("last four digits only", () => {
    expect(phoneTail("+15555550100")).toBe("0100");
  });
});
