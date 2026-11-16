import { describe, expect, test } from "vitest";

import type { CommunityNetwork } from "@/lib/graphApi.types";
import {
  arcPoints, cameraFacing, layoutGlobe, lerpCamera, nearestAt, polarFor, project, reach, rotate, splitPath, THREAD_LOOK, threadKind,
} from "./globeLayout";

function network(extra = 0): CommunityNetwork {
  const keys = ["me", "a", "b", "c", "d", "e", "isolated", ...Array.from({ length: extra }, (_, i) => `x${i}`)];
  return {
    meKey: "me",
    truncated: false,
    nodes: keys.map((key) => ({ key, name: key, kind: "user", personKeys: [], edgeIds: [] })),
    links: [["me", "a"], ["a", "b"], ["b", "c"], ["c", "a"], ["d", "e"], ...Array.from({ length: extra }, (_, i) => ["me", `x${i}`])]
      .map(([source, target]) => ({ key: `${source}-${target}`, source: source!, target: target! })),
  };
}

const angleFromViewer = (v: { z: number }) => Math.acos(Math.max(-1, Math.min(1, v.z)));
const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;

describe("globe layout", () => {
  test("pins the viewer in front and pushes each step farther round the planet", () => {
    const { byKey } = layoutGlobe(network());
    expect(byKey.get("me")!.v).toEqual({ x: 0, y: 0, z: 1 });
    const [a, b, d] = ["a", "b", "d"].map((key) => angleFromViewer(byKey.get(key)!.v));
    expect(a).toBeLessThan(b!);
    expect(b).toBeLessThan(d!);
    // Unconnected people wait on the far side.
    expect(byKey.get("d")!.v.z).toBeLessThan(0);
    expect(byKey.get("isolated")!.v.z).toBeLessThan(0);
  });

  test("keeps every node on the unit sphere, once, and deterministic", () => {
    const first = layoutGlobe(network(30));
    const second = layoutGlobe(network(30));
    expect(first.nodes).toHaveLength(37);
    for (const node of first.nodes) expect(Math.hypot(node.v.x, node.v.y, node.v.z)).toBeCloseTo(1, 6);
    expect(second.nodes.map((n) => n.v)).toEqual(first.nodes.map((n) => n.v));
  });

  test("a crowded near ring still keeps people apart", () => {
    const { nodes } = layoutGlobe(network(30));
    const ring = nodes.filter((n) => n.distance === 1);
    let nearest = Infinity;
    for (let i = 0; i < ring.length; i++) for (let j = i + 1; j < ring.length; j++) {
      const a = ring[i]!.v;
      const b = ring[j]!.v;
      nearest = Math.min(nearest, Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z));
    }
    expect(nearest).toBeGreaterThan(0.12);
  });

  test("identical display names remain different people and dangling edges cannot invent anyone", () => {
    const graph = network();
    graph.nodes.forEach((node) => { node.name = "Alex"; });
    graph.links.push({ key: "missing", source: "me", target: "missing" });
    const { nodes, distances } = layoutGlobe(graph);
    expect(nodes).toHaveLength(7);
    expect(new Set(nodes.map((n) => n.key)).size).toBe(7);
    expect(distances.has("missing")).toBe(false);
  });

  test("empty and single-person networks have valid layouts", () => {
    const graph = network();
    graph.nodes = [];
    graph.links = [];
    expect(layoutGlobe(graph).nodes).toEqual([]);
    graph.nodes = [{ key: "me", name: "You", kind: "user", personKeys: [], edgeIds: [] }];
    expect(layoutGlobe(graph).byKey.get("me")).toMatchObject({ distance: 0, v: { x: 0, y: 0, z: 1 } });
  });

  test("closer threads are brighter and thicker; only threads outside your reach are aqua", () => {
    const kinds = [threadKind(0, 1), threadKind(1, 2), threadKind(2, 3), threadKind(null, 1)];
    expect(kinds).toEqual(["near", "mid", "far", "wide"]);
    const looks = kinds.slice(0, 3).map((k) => THREAD_LOOK[k]);
    expect(looks.map((l) => l.opacity)).toEqual([...looks.map((l) => l.opacity)].sort((a, b) => b - a));
    expect(looks.map((l) => l.width)).toEqual([...looks.map((l) => l.width)].sort((a, b) => b - a));
    expect(looks.every((l) => l.tone !== "aqua")).toBe(true);
    expect(THREAD_LOOK.wide.tone).toBe("aqua");
  });

  test("polar distance grows with steps and stops before the back pole", () => {
    const angles = [0, 1, 2, 3, 4, 9].map(polarFor);
    expect(angles).toEqual([...angles].sort((x, y) => x - y));
    expect(polarFor(9)).toBeLessThan(polarFor(null));
  });
});

describe("globe camera", () => {
  test("cameraFacing brings a point to the front", () => {
    for (const v of [{ x: 0.6, y: 0.3, z: -0.74 }, { x: -0.2, y: -0.9, z: 0.39 }, { x: 0, y: 0, z: 1 }]) {
      const l = Math.hypot(v.x, v.y, v.z);
      const unit = { x: v.x / l, y: v.y / l, z: v.z / l };
      const r = rotate(unit, cameraFacing(unit));
      expect(r.z).toBeCloseTo(1, 6);
    }
  });

  test("projection hides only what is behind the disc", () => {
    const camera = { yaw: 0, pitch: 0 };
    expect(project({ x: 0, y: 0, z: 1 }, camera, 100, 100, 50)).toEqual({ x: 100, y: 100, z: 1, front: true });
    expect(project({ x: 0, y: 0, z: -1 }, camera, 100, 100, 50).front).toBe(false);
    // A lifted arc point beside the globe stays visible even though it is slightly behind.
    expect(project({ x: 1.1, y: 0, z: -0.1 }, camera, 100, 100, 50).front).toBe(true);
  });

  test("camera interpolation takes the short way round", () => {
    const mid = lerpCamera({ yaw: 3, pitch: 0 }, { yaw: -3, pitch: 0.4 }, 0.5);
    expect(Math.abs(Math.cos(mid.yaw) - Math.cos(Math.PI))).toBeLessThan(0.01);
    expect(close(mid.pitch, 0.2)).toBe(true);
  });
});

describe("threads and taps", () => {
  test("arcs start and end on the people they join and lift off the surface", () => {
    const a = { x: 0, y: 0, z: 1 };
    const b = { x: 1, y: 0, z: 0 };
    const points = arcPoints(a, b);
    expect(points[0]).toEqual(a);
    expect(points.at(-1)!.x).toBeCloseTo(1, 6);
    const mid = points[Math.floor(points.length / 2)]!;
    expect(Math.hypot(mid.x, mid.y, mid.z)).toBeGreaterThan(1.05);
  });

  test("splits a path into visible and hidden runs", () => {
    const p = (x: number, front: boolean) => ({ x, y: 0, z: front ? 1 : -1, front });
    const { front, back } = splitPath([p(0, true), p(1, true), p(2, false), p(3, false)]);
    expect(front).toBe("M0.0 0.0L1.0 0.0");
    expect(back).toBe("M1.0 0.0L2.0 0.0M2.0 0.0L3.0 0.0");
  });

  test("taps pick the nearest visible person within reach", () => {
    const items = [
      { key: "near", p: { x: 10, y: 10, z: 0.9, front: true } },
      { key: "hidden", p: { x: 11, y: 10, z: -0.9, front: false } },
      { key: "far", p: { x: 80, y: 80, z: 1, front: true } },
    ];
    expect(nearestAt(items, 12, 11)?.key).toBe("near");
    expect(nearestAt(items, 50, 50)).toBeNull();
  });

  test("reach is the farthest connected step", () => {
    expect(reach(layoutGlobe(network()).distances)).toBe(2);
  });
});
