// A completed wish's route as stops on the globe, and the "fly the route" camera: pure math, no React.
// Same orthographic frame as the World globe (globeLayout.ts): north up, longitude 0 facing you.
import { cityOf } from "../threads/threadData";

import { cameraFacing, fromLatLng, PITCH_LIMIT, type Camera, type Vec3 } from "./globeLayout";

export type PathStop = { name: string; city: string; lat: number; lng: number };

/** Unit vector for a latitude/longitude, in the globe's frame. */
export const vecOf = fromLatLng;

/**
 * Ordered stops from the wish's holders (wisher first, finder last), falling back to the bare
 * route of cities. People in a city the table doesn't know are skipped, never guessed.
 */
export function wishPathStops(
  holders: { name: string; city: string | null }[] | undefined,
  route: (string | null)[] = [],
): PathStop[] {
  const people = holders?.length ? holders : route.map((city) => ({ name: "", city }));
  const stops: PathStop[] = [];
  for (const p of people) {
    const c = cityOf(p.city);
    if (!c || !p.city) continue;
    stops.push({ name: p.name, city: p.city.trim(), lat: c.lat, lng: c.lng });
  }
  return stops;
}

/** Spherical interpolation between two unit vectors (what d3's geoInterpolate does in lat/lng). */
export function slerp(a: Vec3, b: Vec3, t: number): Vec3 {
  const dot = Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z));
  const omega = Math.acos(dot);
  const sin = Math.sin(omega);
  if (sin < 1e-6) return a;
  const wa = Math.sin((1 - t) * omega) / sin;
  const wb = Math.sin(t * omega) / sin;
  return { x: a.x * wa + b.x * wb, y: a.y * wa + b.y * wb, z: a.z * wa + b.z * wb };
}

/** Lifted great-circle arc from a to b, cut at fraction `upTo` (0..1) so it can be drawn growing. */
export function partialArc(a: Vec3, b: Vec3, upTo = 1): Vec3[] {
  const dot = Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z));
  const omega = Math.acos(dot);
  const steps = Math.max(8, Math.ceil(omega * 24));
  const height = 0.03 + 0.2 * (omega / Math.PI);
  const end = Math.max(0, Math.min(1, upTo));
  const points: Vec3[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * end;
    const p = slerp(a, b, t);
    const h = 1 + height * Math.sin(Math.PI * t);
    points.push({ x: p.x * h, y: p.y * h, z: p.z * h });
  }
  return points;
}

/** Camera looking at the middle of the whole route, a little from below so the arcs bow upward. */
export function routeCamera(stops: PathStop[]): Camera {
  if (!stops.length) return { yaw: 0, pitch: -0.3 };
  const sum = stops.map((s) => vecOf(s.lat, s.lng)).reduce((m, v) => ({ x: m.x + v.x, y: m.y + v.y, z: m.z + v.z }), { x: 0, y: 0, z: 0 });
  const len = Math.hypot(sum.x, sum.y, sum.z);
  const mid = len < 1e-6 ? vecOf(stops[0]!.lat, stops[0]!.lng) : { x: sum.x / len, y: sum.y / len, z: sum.z / len };
  const c = cameraFacing(mid);
  return { yaw: c.yaw, pitch: clampPitch(c.pitch - 0.35) };
}

export function clampPitch(p: number) {
  return Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, p));
}

/**
 * One frame of the fly-through. `progress` runs 0..legs (legs = stops - 1): the integer part is
 * the leg being drawn, the fraction how far along it the glowing head is. The camera follows the head.
 */
export function flyFrame(stops: PathStop[], progress: number) {
  const legs = Math.max(0, stops.length - 1);
  const p = Math.max(0, Math.min(legs, progress));
  const leg = Math.min(Math.floor(p), Math.max(0, legs - 1));
  const frac = legs === 0 ? 0 : p - leg;
  const vs = stops.map((s) => vecOf(s.lat, s.lng));
  const head = legs === 0 ? vs[0] ?? { x: 0, y: 0, z: 1 } : slerp(vs[leg]!, vs[leg + 1]!, frac);
  const c = cameraFacing(head);
  return { leg, frac, head, camera: { yaw: c.yaw, pitch: clampPitch(c.pitch - 0.35) } as Camera, reached: legs === 0 ? 1 : leg + (frac >= 1 ? 2 : 1) };
}
