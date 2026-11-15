// Pure helpers for the "My wishes" screens: derive map points, distance, badges
// and labels from a real `wishes.mine` card.
import type { FunctionReturnType } from "convex/server";

import { api } from "@/convex/_generated/api";

export type WishCard = FunctionReturnType<typeof api.wishes.mine>[number];
export type Holder = WishCard["holders"][number];

type LatLng = { lat: number; lng: number; country: string };

const CITIES: Record<string, LatLng> = {
  "san francisco": { lat: 37.77, lng: -122.42, country: "USA" },
  sf: { lat: 37.77, lng: -122.42, country: "USA" },
  "new york": { lat: 40.71, lng: -74.0, country: "USA" },
  nyc: { lat: 40.71, lng: -74.0, country: "USA" },
  "los angeles": { lat: 34.05, lng: -118.24, country: "USA" },
  seattle: { lat: 47.61, lng: -122.33, country: "USA" },
  boston: { lat: 42.36, lng: -71.06, country: "USA" },
  austin: { lat: 30.27, lng: -97.74, country: "USA" },
  chicago: { lat: 41.88, lng: -87.63, country: "USA" },
  toronto: { lat: 43.65, lng: -79.38, country: "Canada" },
  "mexico city": { lat: 19.43, lng: -99.13, country: "Mexico" },
  "são paulo": { lat: -23.55, lng: -46.63, country: "Brazil" },
  london: { lat: 51.5, lng: -0.12, country: "UK" },
  paris: { lat: 48.86, lng: 2.35, country: "France" },
  berlin: { lat: 52.52, lng: 13.4, country: "Germany" },
  amsterdam: { lat: 52.37, lng: 4.9, country: "Netherlands" },
  madrid: { lat: 40.42, lng: -3.7, country: "Spain" },
  lagos: { lat: 6.52, lng: 3.38, country: "Nigeria" },
  nairobi: { lat: -1.29, lng: 36.82, country: "Kenya" },
  dubai: { lat: 25.2, lng: 55.27, country: "UAE" },
  mumbai: { lat: 19.08, lng: 72.88, country: "India" },
  bangalore: { lat: 12.97, lng: 77.59, country: "India" },
  singapore: { lat: 1.35, lng: 103.82, country: "Singapore" },
  "hong kong": { lat: 22.32, lng: 114.17, country: "China" },
  shanghai: { lat: 31.23, lng: 121.47, country: "China" },
  beijing: { lat: 39.9, lng: 116.4, country: "China" },
  seoul: { lat: 37.57, lng: 126.98, country: "Korea" },
  tokyo: { lat: 35.68, lng: 139.69, country: "Japan" },
  sydney: { lat: -33.87, lng: 151.21, country: "Australia" },
};
const FALLBACK: LatLng = CITIES["san francisco"]!;

export function cityOf(city: string | null | undefined): LatLng | null {
  if (!city) return null;
  return CITIES[city.trim().toLowerCase()] ?? null;
}

/** The ordered path drawn on the map: one representative holder per depth (the wish travels outward). */
export function pathHolders(holders: Holder[]): Holder[] {
  const byDepth = new Map<number, Holder>();
  for (const h of holders) {
    const prev = byDepth.get(h.depth);
    // Prefer a holder who acted (passed it on / it's me) so the path follows the live branch.
    if (!prev || (!prev.acted && h.acted)) byDepth.set(h.depth, h);
  }
  return [...byDepth.entries()].sort((a, b) => a[0] - b[0]).map(([, h]) => h);
}

/** Map projection onto a 1000×500 equirectangular world image. */
export function project(city: string | null | undefined) {
  const c = cityOf(city) ?? FALLBACK;
  return { x: ((c.lng + 180) / 360) * 1000, y: ((90 - c.lat) / 180) * 500 };
}

function haversineKm(a: LatLng, b: LatLng) {
  const R = 6371;
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Distance along the drawn path; legs with an unknown city are skipped (not guessed). */
export function totalKm(holders: Holder[]) {
  const pts = pathHolders(holders).map((h) => cityOf(h.city));
  let km = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (a && b) km += haversineKm(a, b);
  }
  return km;
}

export function badgesFor(w: WishCard) {
  const b: string[] = [];
  if (w.ripples <= 1) b.push("Lucky shot");
  if (w.branches >= 3) b.push("Wide net");
  const countries = new Set(w.holders.map((h) => cityOf(h.city)?.country).filter(Boolean));
  if (countries.size >= 3) b.push("Around the World");
  if (w.holders.some((h) => h.acted === "group")) b.push("Group chat hero");
  return b;
}

export const STATUS_LABEL: Record<WishCard["status"], string> = {
  traveling: "Live",
  found: "Waiting to meet",
  granted: "Completed",
  faded: "Faded",
};

export const TIER_LABEL: Record<NonNullable<WishCard["tier"]>, string> = {
  gold: "Gold wish",
  silver: "Silver wish",
  bronze: "Bronze wish",
  red: "Red wish",
};

export function actionLabel(h: Holder) {
  if (h.depth === 0) return "Wish";
  if (h.acted === "its_me") return "It's me";
  if (h.acted === "group") return `Ripple ${h.depth} · via group chat`;
  return `Ripple ${h.depth}`;
}
