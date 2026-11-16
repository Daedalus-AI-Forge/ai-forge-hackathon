import { describe, expect, it } from "vitest";
import type { Id } from "./_generated/dataModel";
import { matchPhoto } from "./gallery";

const id = (s: string) => s as Id<"_storage">;
const rows = [
  { storageId: id("tea"), photoreal: true, tags: ["tea ceremony", "tea"] },
  { storageId: id("drums"), photoreal: true, tags: ["drum"] },
  { storageId: id("lisbon"), photoreal: true, tags: ["lisbon"] },
];

describe("matchPhoto", () => {
  it("picks the scene whose tags fit the wish", () => {
    expect(matchPhoto(rows, "Talk to someone who really practices the Japanese tea ceremony", "k")).toBe("tea");
    expect(matchPhoto(rows, "Someone to jam on drums with on my São Paulo trip", "k")).toBe("drums");
    expect(matchPhoto(rows, "A street photographer to shoot golden hour with on my Lisbon trip", "k")).toBe("lisbon");
  });
  it("falls back to a stable pick when nothing matches", () => {
    const a = matchPhoto(rows, "Someone who has been to Antarctica", "wish1");
    expect(rows.map((r) => r.storageId)).toContain(a);
    expect(matchPhoto(rows, "Someone who has been to Antarctica", "wish1")).toBe(a);
  });
});
