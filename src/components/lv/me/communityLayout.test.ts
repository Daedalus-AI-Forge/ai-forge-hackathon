import { describe, expect, test } from "vitest";
import type { CommunityNetwork } from "@/lib/graphApi.types";
import { networkDistances, pathToViewer } from "./communityLayout";

function network(): CommunityNetwork {
  return {
    meKey: "me", truncated: false,
    nodes: ["me", "a", "b", "c", "d", "e", "isolated"].map(key => ({ key, name: key, kind: "user", personKeys: [], edgeIds: [] })),
    links: [["me", "a"], ["a", "b"], ["b", "c"], ["c", "a"], ["d", "e"]].map(([source, target]) => ({ key: `${source}-${target}`, source, target })),
  };
}

describe("community map semantics", () => {
  test("uses shortest hop distance across cycles and ignores disconnected components", () => {
    const { distances, parents } = networkDistances(network());
    expect(Object.fromEntries(distances)).toEqual({ me: 0, a: 1, b: 2, c: 2 });
    expect([...pathToViewer("c", parents)]).toEqual(["c", "a", "me"]);
    expect(distances.has("d")).toBe(false);
  });
});
