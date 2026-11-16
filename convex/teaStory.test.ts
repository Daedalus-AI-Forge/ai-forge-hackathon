import { describe, expect, test } from "vitest";
import { ageText, evidenceLabel, strongCandidates } from "./ai";
import { mergeScores, tokenize } from "./graphRank";
import { topicHint } from "./linkAi";

const DAY = 24 * 60 * 60 * 1000;

describe("tea-ceremony demo story", () => {
  test("Japanese in a wish matches a japan tag", () => {
    expect(tokenize("someone who really practices the Japanese tea ceremony")).toContain("japan");
  });
  test("evidence label names the daily boat and its age", () => {
    const now = 1_800_000_000_000;
    expect(
      evidenceLabel({ name: "Katie", evidence: [{ tag: "japan", reason: "Spent two years in Osaka", source: "daily", at: now - 21 * DAY }] }, now),
    ).toBe("Katie · Japan · from a daily boat 3 weeks ago");
    expect(ageText(now - 3 * DAY, now)).toBe("3 days ago");
  });
  test("keyword evidence wins over semantic-only hits", () => {
    const merged = mergeScores(new Map([["a", 2], ["b", 0]]), new Map([["b", 2.9], ["a", 0.3]]));
    expect(merged.get("a")).toBeCloseTo(2.3);
    expect(merged.get("b")).toBe(0);
    expect(mergeScores(new Map([["a", 0]]), new Map([["a", 1]])).get("a")).toBe(1);
  });
  test("one clear match stays one suggestion", () => {
    const c = (name: string, score: number) => ({ personKey: name, name, score, evidence: [] });
    expect(strongCandidates([c("katie", 2.4), c("x", 1)]).map((x) => x.name)).toEqual(["katie"]);
  });
  test("tea/Japan wishes get a grounded deterministic question and reasons", () => {
    const hint = topicHint("Talk to someone who really practices the Japanese tea ceremony", "Osaka");
    expect(hint?.question).toBe("Who do you know in Japan's traditional arts?");
    expect(hint?.reasons).toContain("Makes ceramics in Kyoto");
    expect(topicHint("jam on drums", "Oakland")).toBeNull();
  });
});
