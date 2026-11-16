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
  oakland: { lat: 37.8, lng: -122.27, country: "USA" },
  berkeley: { lat: 37.87, lng: -122.27, country: "USA" },
  "palo alto": { lat: 37.44, lng: -122.14, country: "USA" },
  "mountain view": { lat: 37.39, lng: -122.08, country: "USA" },
  sunnyvale: { lat: 37.37, lng: -122.04, country: "USA" },
  "san jose": { lat: 37.34, lng: -121.89, country: "USA" },
  fremont: { lat: 37.55, lng: -121.99, country: "USA" },
  "san mateo": { lat: 37.56, lng: -122.32, country: "USA" },
  "redwood city": { lat: 37.49, lng: -122.24, country: "USA" },
  "san francisco bay area": { lat: 37.77, lng: -122.42, country: "USA" },
  "bay area": { lat: 37.77, lng: -122.42, country: "USA" },
  california: { lat: 37.77, lng: -122.42, country: "USA" },
  soma: { lat: 37.78, lng: -122.4, country: "USA" },
  mission: { lat: 37.76, lng: -122.42, country: "USA" },
  "mission district": { lat: 37.76, lng: -122.42, country: "USA" },
  sunset: { lat: 37.75, lng: -122.49, country: "USA" },
  "south san francisco": { lat: 37.65, lng: -122.41, country: "USA" },
  "daly city": { lat: 37.69, lng: -122.47, country: "USA" },
  "east palo alto": { lat: 37.47, lng: -122.14, country: "USA" },
  "menlo park": { lat: 37.45, lng: -122.18, country: "USA" },
  stanford: { lat: 37.43, lng: -122.17, country: "USA" },
  "los altos": { lat: 37.39, lng: -122.11, country: "USA" },
  cupertino: { lat: 37.32, lng: -122.03, country: "USA" },
  "santa clara": { lat: 37.35, lng: -121.95, country: "USA" },
  milpitas: { lat: 37.43, lng: -121.9, country: "USA" },
  burlingame: { lat: 37.58, lng: -122.35, country: "USA" },
  millbrae: { lat: 37.6, lng: -122.39, country: "USA" },
  "foster city": { lat: 37.56, lng: -122.27, country: "USA" },
  "half moon bay": { lat: 37.46, lng: -122.43, country: "USA" },
  alameda: { lat: 37.77, lng: -122.24, country: "USA" },
  emeryville: { lat: 37.83, lng: -122.29, country: "USA" },
  richmond: { lat: 37.94, lng: -122.35, country: "USA" },
  hayward: { lat: 37.67, lng: -122.08, country: "USA" },
  "walnut creek": { lat: 37.91, lng: -122.07, country: "USA" },
  "san rafael": { lat: 37.97, lng: -122.53, country: "USA" },
  sausalito: { lat: 37.86, lng: -122.49, country: "USA" },
  "santa cruz": { lat: 36.97, lng: -122.03, country: "USA" },
  sacramento: { lat: 38.58, lng: -121.49, country: "USA" },
  "san diego": { lat: 32.72, lng: -117.16, country: "USA" },
  portland: { lat: 45.52, lng: -122.68, country: "USA" },
  "new york city": { lat: 40.71, lng: -74.0, country: "USA" },
  la: { lat: 34.05, lng: -118.24, country: "USA" },
  "new york": { lat: 40.71, lng: -74.0, country: "USA" },
  nyc: { lat: 40.71, lng: -74.0, country: "USA" },
  "los angeles": { lat: 34.05, lng: -118.24, country: "USA" },
  seattle: { lat: 47.61, lng: -122.33, country: "USA" },
  boston: { lat: 42.36, lng: -71.06, country: "USA" },
  austin: { lat: 30.27, lng: -97.74, country: "USA" },
  chicago: { lat: 41.88, lng: -87.63, country: "USA" },
  toronto: { lat: 43.65, lng: -79.38, country: "Canada" },
  "mexico city": { lat: 19.43, lng: -99.13, country: "Mexico" },
  "sao paulo": { lat: -23.55, lng: -46.63, country: "Brazil" },
  london: { lat: 51.5, lng: -0.12, country: "UK" },
  paris: { lat: 48.86, lng: 2.35, country: "France" },
  berlin: { lat: 52.52, lng: 13.4, country: "Germany" },
  amsterdam: { lat: 52.37, lng: 4.9, country: "Netherlands" },
  lisbon: { lat: 38.72, lng: -9.14, country: "Portugal" },
  madrid: { lat: 40.42, lng: -3.7, country: "Spain" },
  lagos: { lat: 6.52, lng: 3.38, country: "Nigeria" },
  nairobi: { lat: -1.29, lng: 36.82, country: "Kenya" },
  dubai: { lat: 25.2, lng: 55.27, country: "UAE" },
  mumbai: { lat: 19.08, lng: 72.88, country: "India" },
  bangalore: { lat: 12.97, lng: 77.59, country: "India" },
  bengaluru: { lat: 12.97, lng: 77.59, country: "India" },
  singapore: { lat: 1.35, lng: 103.82, country: "Singapore" },
  "hong kong": { lat: 22.32, lng: 114.17, country: "China" },
  shanghai: { lat: 31.23, lng: 121.47, country: "China" },
  beijing: { lat: 39.9, lng: 116.4, country: "China" },
  taipei: { lat: 25.03, lng: 121.57, country: "Taiwan" },
  seoul: { lat: 37.57, lng: 126.98, country: "Korea" },
  tokyo: { lat: 35.68, lng: 139.69, country: "Japan" },
  osaka: { lat: 34.69, lng: 135.5, country: "Japan" },
  kyoto: { lat: 35.01, lng: 135.77, country: "Japan" },
  sydney: { lat: -33.87, lng: 151.21, country: "Australia" },
};
const FALLBACK: LatLng = CITIES["san francisco"]!;

/** Lowercase, accents and punctuation dropped, whitespace collapsed, a leading "the" removed. */
function cityKey(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9, ]+/g, " ").replace(/\s+/g, " ").trim().replace(/^the /, "");
}

/**
 * A typed city to coordinates, forgiving about case, spacing, accents and suffixes: "mountain view, CA",
 * "San Francisco, California, USA" and "SoMa, SF" all resolve (whole text first, then each comma part).
 */
export function cityOf(city: string | null | undefined): LatLng | null {
  if (!city) return null;
  const key = cityKey(city);
  if (!key) return null;
  const whole = CITIES[key.replace(/,/g, "").replace(/\s+/g, " ")];
  if (whole) return whole;
  for (const part of key.split(",")) {
    const name = part.trim().replace(/^the /, "");
    const hit = CITIES[name] ?? CITIES[name.replace(/ (ca|calif|california|usa|us)$/, "")];
    if (hit) return hit;
  }
  return null;
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
  traveling: "Drifting",
  found: "Landed",
  granted: "Granted",
  faded: "Faded",
};

export const TIER_LABEL: Record<NonNullable<WishCard["tier"]>, string> = {
  gold: "Gold wish",
  silver: "Silver wish",
  bronze: "Bronze wish",
  red: "Red wish",
};

export function actionLabel(h: Holder) {
  if (h.depth === 0) return "Coin";
  if (h.acted === "its_me") return "That's me";
  if (h.acted === "group") return `Hop ${h.depth} · via group chat`;
  return `Hop ${h.depth}`;
}
