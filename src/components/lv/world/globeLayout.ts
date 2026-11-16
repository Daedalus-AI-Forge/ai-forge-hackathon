// The wish network as a little planet: the viewer faces you, each step away sits farther round
// the sphere, and people not yet connected wait on the far side. Placement is by relationship
// distance, never geography. Pure math, no React.
import type { CommunityNetwork, CommunityNode } from "@/lib/graphApi.types";
import { networkDistances } from "../me/communityLayout";

export type Vec3 = { x: number; y: number; z: number };
export type GlobeNode = CommunityNode & { distance: number | null; v: Vec3 };
export type Camera = { yaw: number; pitch: number };
export type Projected = { x: number; y: number; z: number; front: boolean };

export const PITCH_LIMIT = 1.25;

function hash(key: string) {
  return [...key].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 7);
}

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

/** Polar angle from the viewer (radians): 1 step on the near ring, the wider network round the back. */
export function polarFor(distance: number | null) {
  if (distance === null) return 2.6;
  if (distance <= 0) return 0;
  if (distance === 1) return 0.62;
  if (distance === 2) return 1.08;
  return Math.min(1.45 + (distance - 3) * 0.28, 2.05);
}

function fromPolar(theta: number, phi: number): Vec3 {
  return { x: Math.sin(theta) * Math.cos(phi), y: Math.sin(theta) * Math.sin(phi), z: Math.cos(theta) };
}

function normalize(v: Vec3): Vec3 {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

/** Deterministic sphere positions. The viewer is pinned at +z (facing the camera at yaw = pitch = 0). */
export function layoutGlobe(graph: CommunityNetwork) {
  const { adjacency, distances, parents } = networkDistances(graph);
  const sorted = [...graph.nodes].sort((a, b) => a.key.localeCompare(b.key));
  const phi = new Map<string, number>();
  const theta = new Map<string, number>();

  // Near ring, evenly spaced from the top; a crowded ring alternates two radii so dots don't touch.
  const direct = sorted.filter((node) => distances.get(node.key) === 1);
  direct.forEach((node, i) => {
    phi.set(node.key, Math.PI / 2 + (i * Math.PI * 2) / direct.length);
    theta.set(node.key, direct.length > 14 ? polarFor(1) + (i % 2 ? 0.16 : -0.08) : polarFor(1));
  });

  // Everyone farther out fans around the person who leads back to you.
  const children = new Map<string, string[]>();
  for (const [key, parent] of parents) children.set(parent, [...(children.get(parent) ?? []), key]);
  for (const [key] of [...distances].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))) {
    const kids = (children.get(key) ?? []).sort();
    const spread = Math.min(0.42, 1.5 / Math.max(1, kids.length));
    kids.forEach((kid, i) => {
      if (distances.get(kid)! < 2) return;
      phi.set(kid, (phi.get(key) ?? 0) + (i - (kids.length - 1) / 2) * spread);
      theta.set(kid, polarFor(distances.get(kid)!) + ((hash(kid) % 7) - 3) * 0.02);
    });
  }

  // Unconnected groups gather on the far side, each around its own anchor (golden-angle spiral).
  let group = 0;
  for (const node of sorted) {
    if (distances.has(node.key) || phi.has(node.key)) continue;
    const members: string[] = [];
    const queue = [node.key];
    const seen = new Set(queue);
    for (let i = 0; i < queue.length; i++) {
      members.push(queue[i]!);
      for (const next of adjacency.get(queue[i]!) ?? []) {
        if (!seen.has(next)) { seen.add(next); queue.push(next); }
      }
    }
    const anchorTheta = 2.2 + ((group * 0.618) % 1) * 0.8;
    const anchorPhi = group * 2.39996;
    group++;
    members.forEach((key, i) => {
      const ring = i === 0 ? 0 : 0.1 + Math.sqrt(i) * 0.06;
      const around = i * 2.39996;
      theta.set(key, anchorTheta + Math.sin(around) * ring);
      phi.set(key, anchorPhi + (Math.cos(around) * ring) / Math.max(0.3, Math.sin(anchorTheta)));
    });
  }

  const nodes: GlobeNode[] = sorted.map((node) => {
    const distance = distances.get(node.key) ?? null;
    return {
      ...node,
      distance,
      v: node.key === graph.meKey ? { x: 0, y: 0, z: 1 } : fromPolar(theta.get(node.key) ?? polarFor(distance), phi.get(node.key) ?? hash(node.key) * 0.01),
    };
  });

  // A few rounds of gentle repulsion on the sphere so nobody sits on top of anybody else.
  const moving = nodes.filter((node) => node.key !== graph.meKey);
  const minGap = (n: GlobeNode) => (n.distance !== null && n.distance <= 1 ? 0.2 : n.distance === null ? 0.07 : 0.12);
  if (moving.length <= 600) {
    for (let round = 0; round < 24; round++) {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i]!;
          const b = nodes[j]!;
          const gap = Math.max(minGap(a), minGap(b));
          const dx = a.v.x - b.v.x;
          const dy = a.v.y - b.v.y;
          const dz = a.v.z - b.v.z;
          const d = Math.hypot(dx, dy, dz);
          if (d >= gap) continue;
          const push = ((gap - d) / 2) * 0.6;
          const ux = d > 1e-6 ? dx / d : 0.01 * (hash(a.key) % 3 - 1);
          const uy = d > 1e-6 ? dy / d : 0.01;
          const uz = d > 1e-6 ? dz / d : 0;
          if (a.key !== graph.meKey) a.v = normalize({ x: a.v.x + ux * push, y: a.v.y + uy * push, z: a.v.z + uz * push });
          if (b.key !== graph.meKey) b.v = normalize({ x: b.v.x - ux * push, y: b.v.y - uy * push, z: b.v.z - uz * push });
        }
      }
    }
  }

  return { nodes, byKey: new Map(nodes.map((n) => [n.key, n])), distances, parents };
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
