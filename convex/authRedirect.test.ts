import { describe, expect, test } from "vitest";

import { sha256Hex } from "./appleProvider";
import { allowedRedirect } from "./authRedirect";

const SITE = "http://localhost:8081";

describe("allowedRedirect", () => {
  test("accepts the app scheme", () => {
    expect(allowedRedirect("wishwell://", SITE)).toBe("wishwell://");
  });
  test("accepts SITE_URL and paths under it", () => {
    expect(allowedRedirect("http://localhost:8081", SITE)).toBe("http://localhost:8081");
    expect(allowedRedirect("http://localhost:8081/", SITE + "/")).toBe("http://localhost:8081/");
    expect(allowedRedirect("/me", SITE)).toBe("http://localhost:8081/me");
  });
  test("rejects lookalike hosts and other origins", () => {
    expect(() => allowedRedirect("http://localhost:8081.evil.com/", SITE)).toThrow(/Invalid/);
    expect(() => allowedRedirect("https://evil.example/", SITE)).toThrow(/Invalid/);
    expect(() => allowedRedirect("exp://10.0.0.1:8081", SITE)).toThrow(/Invalid/);
  });
});

describe("Apple nonce hashing", () => {
  test("matches expo-crypto's lowercase hex SHA-256", async () => {
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
