// The wish network on the real Earth: every person at their true latitude/longitude, threads as
// great-circle arcs between them. Pure math, no React.
import type { CommunityNetwork, CommunityNode } from "@/lib/graphApi.types";
import { cityOf } from "../threads/threadData";

import { networkDistances } from "../me/communityLayout";

export type Vec3 = { x: number; y: number; z: number };
export type GlobeNode = CommunityNode & { distance: number | null; v: Vec3 | null };
export type Camera = { yaw: number; pitch: number };
export type Projected = { x: number; y: number; z: number; front: boolean };

export const PITCH_LIMIT = 1.25;

export type ThreadKind = "near" | "mid" | "far" | "wide";

/** Which thread joins two people: by the farther one's steps from you; null = not connected to you. */
export function threadKind(a: number | null, b: number | null): ThreadKind {
  if (a === null || b === null) return "wide";
  const d = Math.max(a, b);
  return d <= 1 ? "near" : d === 2 ? "mid" : "far";
}

/** Closer threads are brighter and thicker; the wider world is a faint aqua haze. */
export const THREAD_LOOK: Record<ThreadKind, { tone: "gold" | "fg" | "aqua"; width: number; opacity: number }> = {
  near: { tone: "gold", width: 1.5, opacity: 0.85 },
  mid: { tone: "gold", width: 1.1, opacity: 0.45 },
  far: { tone: "fg", width: 0.9, opacity: 0.24 },
  wide: { tone: "aqua", width: 0.8, opacity: 0.22 },
};

function normalize(v: Vec3): Vec3 {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

/** Unit vector for a latitude/longitude, in the globe's frame (north up, longitude 0 facing you). */
export function fromLatLng(lat: number, lng: number): Vec3 {
  const a = (lat * Math.PI) / 180;
  const b = (lng * Math.PI) / 180;
  return { x: Math.cos(a) * Math.sin(b), y: Math.sin(a), z: Math.cos(a) * Math.cos(b) };
}

/** Where a person is on Earth: exact coordinates when we have them, else their city's. Unknown = null, never guessed. */
export function placeOf(node: Pick<CommunityNode, "city" | "lat" | "lng">): { lat: number; lng: number; label: string } | null {
  const label = node.city?.trim() || "";
  if (typeof node.lat === "number" && typeof node.lng === "number" && Number.isFinite(node.lat) && Number.isFinite(node.lng)) {
    return { lat: node.lat, lng: node.lng, label };
  }
  const city = cityOf(node.city);
  return city ? { lat: city.lat, lng: city.lng, label } : null;
}

const SF = { lat: 37.77, lng: -122.42 };

/** Where to put a viewer with no known place: the centroid of the people one step away, else everyone placed, else SF. */
export function viewerFallback(nodes: GlobeNode[]): { lat: number; lng: number } {
  const placed = nodes.filter((n) => n.v && n.distance !== 0);
  const circle = placed.filter((n) => n.distance === 1);
  const pool = circle.length ? circle : placed;
  if (!pool.length) return SF;
  const sum = pool.reduce((acc, n) => ({ x: acc.x + n.v!.x, y: acc.y + n.v!.y, z: acc.z + n.v!.z }), { x: 0, y: 0, z: 0 });
  const length = Math.hypot(sum.x, sum.y, sum.z);
  if (length < 1e-6) return SF;
  return {
    lat: (Math.asin(sum.y / length) * 180) / Math.PI,
    lng: (Math.atan2(sum.x / length, sum.z / length) * 180) / Math.PI,
  };
}

/** One dot on the globe: everyone at the same place shares it (shown with a count), never nudged apart. */
export type GlobeMarker = { id: string; place: string; v: Vec3; members: GlobeNode[] };

/**
 * Real geography: each person sits at their true latitude/longitude. People in the same city share
 * one marker; people whose location is unknown stay off the globe (they are still in the list).
 */
export function layoutGlobe(graph: CommunityNetwork) {
  const { distances, parents } = networkDistances(graph);
  const sorted = [...graph.nodes].sort((a, b) => a.key.localeCompare(b.key));
  const rank = (n: GlobeNode) => (n.key === graph.meKey ? -1 : n.distance ?? 99);
  const nodes: GlobeNode[] = [];
  const groups = new Map<string, GlobeMarker>();
  for (const node of sorted) {
    const distance = node.key === graph.meKey ? 0 : distances.get(node.key) ?? null;
    const place = placeOf(node);
    const v = place ? fromLatLng(place.lat, place.lng) : null;
    const globeNode: GlobeNode = { ...node, distance, v };
    nodes.push(globeNode);
    if (!place || !v) continue;
    const id = `${place.lat.toFixed(2)},${place.lng.toFixed(2)}`;
    const marker = groups.get(id) ?? { id, place: place.label, v, members: [] };
    marker.members.push(globeNode);
    if (!marker.place && place.label) marker.place = place.label;
    groups.set(id, marker);
  }
  // You are always on the globe: with no known place, you stand at the middle of your circle (or SF).
  const meNode = nodes.find((n) => n.key === graph.meKey);
  if (meNode && !meNode.v) {
    const fallback = viewerFallback(nodes);
    meNode.v = fromLatLng(fallback.lat, fallback.lng);
    const id = `${fallback.lat.toFixed(2)},${fallback.lng.toFixed(2)}`;
    const marker = groups.get(id) ?? { id, place: meNode.city?.trim() || "", v: meNode.v, members: [] };
    marker.members.push(meNode);
    groups.set(id, marker);
  }
  const markers = [...groups.values()];
  for (const m of markers) m.members.sort((a, b) => rank(a) - rank(b) || a.key.localeCompare(b.key));
  const markerOf = new Map<string, GlobeMarker>();
  for (const m of markers) for (const n of m.members) markerOf.set(n.key, m);
  return {
    nodes,
    markers,
    markerOf,
    byKey: new Map(nodes.map((n) => [n.key, n])),
    unplaced: nodes.filter((n) => !n.v).length,
    distances,
    parents,
  };
}

/** Rotate a layout vector into camera space: yaw about the vertical axis, then pitch about the horizontal. */
export function rotate(v: Vec3, { yaw, pitch }: Camera): Vec3 {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const x1 = v.x * cy + v.z * sy;
  const z1 = -v.x * sy + v.z * cy;
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  return { x: x1, y: v.y * cp - z1 * sp, z: v.y * sp + z1 * cp };
}

/** Orthographic projection onto a globe of `radius` centered at (cx, cy). Points behind the disc are hidden. */
export function project(v: Vec3, camera: Camera, cx: number, cy: number, radius: number): Projected {
  const r = rotate(v, camera);
  const behind = r.z < 0 && r.x * r.x + r.y * r.y < 1;
  return { x: cx + r.x * radius, y: cy - r.y * radius, z: r.z, front: !behind };
}

/** The camera that brings `v` to the front of the globe. */
export function cameraFacing(v: Vec3): Camera {
  const yaw = Math.atan2(-v.x, v.z);
  const z1 = Math.hypot(v.x, v.z);
  return { yaw, pitch: Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, Math.atan2(v.y, z1))) };
}

/** Shortest-way interpolation between two cameras (yaw wraps). */
export function lerpCamera(a: Camera, b: Camera, t: number): Camera {
  let dy = (b.yaw - a.yaw) % (Math.PI * 2);
  if (dy > Math.PI) dy -= Math.PI * 2;
  if (dy < -Math.PI) dy += Math.PI * 2;
  return { yaw: a.yaw + dy * t, pitch: a.pitch + (b.pitch - a.pitch) * t };
}

/**
 * A thread between two people: the great-circle arc lifted off the surface (higher for longer
 * arcs), sampled into points. Each point carries its own sphere position, so the caller can
 * rotate, project and split it into the parts in front of and behind the globe.
 */
export function arcPoints(a: Vec3, b: Vec3, lift = 1): Vec3[] {
  const dot = Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z));
  const omega = Math.acos(dot);
  const steps = Math.max(6, Math.ceil(omega * 10));
  const height = (0.03 + 0.2 * (omega / Math.PI)) * lift;
  const sin = Math.sin(omega);
  const points: Vec3[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let p: Vec3;
    if (sin < 1e-4) {
      p = normalize({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
    } else {
      const wa = Math.sin((1 - t) * omega) / sin;
      const wb = Math.sin(t * omega) / sin;
      p = { x: a.x * wa + b.x * wb, y: a.y * wa + b.y * wb, z: a.z * wa + b.z * wb };
    }
    const h = 1 + height * Math.sin(Math.PI * t);
    points.push({ x: p.x * h, y: p.y * h, z: p.z * h });
  }
  return points;
}

/** SVG path data for the visible (front) and hidden (back) runs of a projected polyline. */
export function splitPath(points: Projected[]) {
  let front = "";
  let back = "";
  for (let i = 1; i < points.length; i++) {
    const p = points[i - 1]!;
    const q = points[i]!;
    const seg = `M${p.x.toFixed(1)} ${p.y.toFixed(1)}L${q.x.toFixed(1)} ${q.y.toFixed(1)}`;
    if (p.front && q.front) front += seg;
    else back += seg;
  }
  return { front, back };
}

/** Lines of latitude and longitude, as front-only SVG path data, so the planet reads as a planet. */
export function graticule(camera: Camera, cx: number, cy: number, radius: number) {
  let d = "";
  const line = (points: Vec3[]) => {
    const projected = points.map((p) => project(p, camera, cx, cy, radius));
    for (let i = 1; i < projected.length; i++) {
      const p = projected[i - 1]!;
      const q = projected[i]!;
      if (p.z > 0 && q.z > 0) d += `M${p.x.toFixed(1)} ${p.y.toFixed(1)}L${q.x.toFixed(1)} ${q.y.toFixed(1)}`;
    }
  };
  for (let lat = -60; lat <= 60; lat += 30) {
    const t = (lat * Math.PI) / 180;
    line(Array.from({ length: 49 }, (_, i) => {
      const lng = (i / 48) * Math.PI * 2;
      return { x: Math.cos(t) * Math.sin(lng), y: Math.sin(t), z: Math.cos(t) * Math.cos(lng) };
    }));
  }
  for (let lng = 0; lng < 180; lng += 30) {
    const g = (lng * Math.PI) / 180;
    line(Array.from({ length: 49 }, (_, i) => {
      const t = (i / 48) * Math.PI * 2;
      return { x: Math.cos(t) * Math.sin(g), y: Math.sin(t), z: Math.cos(t) * Math.cos(g) };
    }));
  }
  return d;
}

/** The person nearest a tap on the visible face of the globe, if any is close enough. */
export function nearestAt<T extends { key: string; p: Projected }>(items: T[], x: number, y: number, maxDistance = 26) {
  let best: T | null = null;
  let bestD = maxDistance;
  for (const item of items) {
    if (!item.p.front || item.p.z < -0.05) continue;
    const d = Math.hypot(item.p.x - x, item.p.y - y);
    if (d < bestD) { best = item; bestD = d; }
  }
  return best;
}

/** How many steps it takes to reach everyone connected to you (the "six degrees" number). */
export function reach(distances: Map<string, number>) {
  let max = 0;
  for (const d of distances.values()) max = Math.max(max, d);
  return max;
}
