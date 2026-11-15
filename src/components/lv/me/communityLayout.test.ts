import { describe, expect, test } from "vitest";
import type { CommunityNetwork } from "@/lib/graphApi.types";
import { connectionAppearance, GRAPH_CENTER, GRAPH_HEIGHT, GRAPH_WIDTH, layoutCommunity, networkDistances, pathToViewer } from "./communityLayout";

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

  test("closer paths are darker; only unrelated edges are dashed", () => {
    const looks = [1, 2, 3, 4].map(connectionAppearance);
    expect(looks.every(look => !look.dashed)).toBe(true);
    expect(looks.map(look => look.opacity)).toEqual([...looks.map(look => look.opacity)].sort((a, b) => b - a));
    expect(connectionAppearance(null).dashed).toBe(true);
    expect(connectionAppearance(1).opacity).toBeGreaterThan(connectionAppearance(2).opacity);
  });

  test("positions every node once, pins the viewer and keeps isolated users on the map", () => {
    const graph = network();
    const { nodes, byKey } = layoutCommunity(graph);
    expect(nodes).toHaveLength(graph.nodes.length);
    expect(new Set(nodes.map(node => node.key)).size).toBe(nodes.length);
    expect(byKey.get("me")).toMatchObject(GRAPH_CENTER);
    expect(byKey.get("isolated")?.distance).toBeNull();
    for (const node of nodes) {
      expect(Number.isFinite(node.x) && Number.isFinite(node.y)).toBe(true);
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x).toBeLessThanOrEqual(GRAPH_WIDTH);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeLessThanOrEqual(GRAPH_HEIGHT);
    }
    expect(layoutCommunity(graph).nodes).toEqual(nodes);
  });

  test("identical display names remain different nodes and dangling edges cannot invent users", () => {
    const graph = network();
    graph.nodes.forEach(node => { node.name = "Alex"; });
    graph.links.push({ key: "missing", source: "me", target: "missing" });
    const { nodes, distances } = layoutCommunity(graph);
    expect(nodes).toHaveLength(7);
    expect(distances.has("missing")).toBe(false);
  });

  test("empty and single-person networks have valid layouts", () => {
    const graph = network();
    graph.nodes = []; graph.links = [];
    expect(layoutCommunity(graph).nodes).toEqual([]);
    graph.nodes = [{ key: "me", name: "You", kind: "user", personKeys: [], edgeIds: [] }];
    expect(layoutCommunity(graph).byKey.get("me")).toMatchObject({ ...GRAPH_CENTER, distance: 0 });
  });
});
