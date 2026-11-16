import { describe, expect, test } from "vitest";

import type { CommunityNetwork } from "@/lib/graphApi.types";
import {
  arcPoints, cameraFacing, fromLatLng, layoutGlobe, lerpCamera, nearestAt, project, reach, rotate, splitPath, THREAD_LOOK, threadKind,
} from "./globeLayout";
import { earthPaths, earthProjection } from "./earth";
import { cityOf } from "../threads/threadData";

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

const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;

const CITY: Record<string, string> = { me: "San Francisco", a: "Tokyo", b: "Tokyo", c: "London", d: "Lagos", e: "Nowhereville" };

function geoNetwork(): CommunityNetwork {
  const graph = network();
  graph.nodes = graph.nodes.map((n) => (CITY[n.key] ? { ...n, city: CITY[n.key] } : n));
  return graph;
}

describe("globe layout (real geography)", () => {
  test("places people at their city's true latitude/longitude, unmoved", () => {
    const { byKey } = layoutGlobe(geoNetwork());
    expect(byKey.get("me")!.v).toEqual(fromLatLng(37.77, -122.42));
    expect(byKey.get("c")!.v).toEqual(fromLatLng(51.5, -0.12));
    expect(byKey.get("d")!.v).toEqual(fromLatLng(6.52, 3.38));
    for (const n of layoutGlobe(geoNetwork()).nodes) if (n.v) expect(Math.hypot(n.v.x, n.v.y, n.v.z)).toBeCloseTo(1, 9);
  });

  test("exact hop coordinates win over the city table", () => {
    const graph = geoNetwork();
    graph.nodes[1] = { ...graph.nodes[1]!, city: "Tokyo", lat: 35.0, lng: 135.0 };
    expect(layoutGlobe(graph).byKey.get("a")!.v).toEqual(fromLatLng(35, 135));
  });

  test("people in the same city share one marker; unknown places stay off the globe", () => {
    const { markers, markerOf, unplaced, byKey } = layoutGlobe(geoNetwork());
    expect(markerOf.get("a")).toBe(markerOf.get("b"));
    expect(markerOf.get("a")!.members.map((n) => n.key)).toEqual(["a", "b"]);
    expect(markers).toHaveLength(4); // SF, Tokyo, London, Lagos
    expect(byKey.get("e")!.v).toBeNull();
    expect(byKey.get("isolated")!.v).toBeNull();
    expect(unplaced).toBe(2);
  });

  test("identical display names remain different people and dangling edges cannot invent anyone", () => {
    const graph = geoNetwork();
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
    graph.nodes = [{ key: "me", name: "You", kind: "user", personKeys: [], edgeIds: [], city: "Paris" }];
    expect(layoutGlobe(graph).byKey.get("me")).toMatchObject({ distance: 0, v: fromLatLng(48.86, 2.35) });
  });

  test("the d3 land projection agrees with the marker projection", () => {
    for (const camera of [{ yaw: 0, pitch: 0 }, { yaw: 2.1, pitch: 0.6 }, { yaw: -1.2, pitch: -0.4 }]) {
      const proj = earthProjection(camera, 100, 100, 80);
      for (const [lat, lng] of [[37.77, -122.42], [35.68, 139.69], [-33.87, 151.21], [51.5, -0.12]] as const) {
        const p = project(fromLatLng(lat, lng), camera, 100, 100, 80);
        if (p.z <= 0.05) continue;
        const q = proj([lng, lat])!;
        expect(q[0]).toBeCloseTo(p.x, 6);
        expect(q[1]).toBeCloseTo(p.y, 6);
      }
    }
    expect(earthPaths({ yaw: 0, pitch: 0 }, 100, 100, 80).land.length).toBeGreaterThan(500);
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

describe("the viewer is always on the globe", () => {
  test("city lookup forgives case, spacing, accents and state/neighborhood suffixes", () => {
    for (const c of ["Mountain View", "  mountain   VIEW ", "Mountain View, CA", "Palo Alto CA", "oakland, california, usa", "Berkeley"]) {
      expect(cityOf(c), c).not.toBeNull();
    }
    expect(cityOf("SoMa, SF")).not.toBeNull();
    expect(cityOf("the Mission, SF")).not.toBeNull();
    expect(cityOf("Sao Paulo")).toEqual(cityOf("São Paulo"));
    expect(cityOf("Nowhereville")).toBeNull();
    expect(cityOf("")).toBeNull();
  });

  test("a viewer with no known place stands at the middle of their circle, and gets a marker", () => {
    const graph = geoNetwork();
    graph.nodes = graph.nodes.map((n) => (n.key === "me" ? { ...n, city: "" } : n));
    const layout = layoutGlobe(graph);
    const me = layout.byKey.get("me")!;
    expect(me.v).not.toBeNull();
    // Only "a" (Tokyo) is one step away, so you land on Tokyo's marker.
    expect(layout.markerOf.get("me")).toBe(layout.markerOf.get("a"));
    const facing = project(me.v!, cameraFacing(me.v!), 0, 0, 1);
    expect(close(facing.x, 0) && close(facing.y, 0)).toBe(true);
  });

  test("with nobody placed, the viewer falls back to San Francisco", () => {
    const layout = layoutGlobe(network());
    const me = layout.byKey.get("me")!;
    const sf = fromLatLng(37.77, -122.42);
    expect(close(me.v!.x, sf.x) && close(me.v!.y, sf.y) && close(me.v!.z, sf.z)).toBe(true);
    expect(layout.markers).toHaveLength(1);
  });

  test("a typed 'Mountain View, CA' places the viewer by city", () => {
    const graph = geoNetwork();
    graph.nodes = graph.nodes.map((n) => (n.key === "me" ? { ...n, city: "Mountain View, CA" } : n));
    expect(layoutGlobe(graph).byKey.get("me")!.v).not.toBeNull();
  });
});
