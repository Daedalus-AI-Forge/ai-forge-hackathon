export type Place = { city: string; country: string; lat: number; lng: number };

const PLACES: Place[] = [
  { city: "San Francisco", country: "US", lat: 37.7749, lng: -122.4194 },
  { city: "New York", country: "US", lat: 40.7128, lng: -74.006 },
  { city: "Los Angeles", country: "US", lat: 34.0522, lng: -118.2437 },
  { city: "Seattle", country: "US", lat: 47.6062, lng: -122.3321 },
  { city: "Shanghai", country: "CN", lat: 31.2304, lng: 121.4737 },
  { city: "Beijing", country: "CN", lat: 39.9042, lng: 116.4074 },
  { city: "London", country: "GB", lat: 51.5074, lng: -0.1278 },
  { city: "Tokyo", country: "JP", lat: 35.6762, lng: 139.6503 },
  { city: "Paris", country: "FR", lat: 48.8566, lng: 2.3522 },
  { city: "Berlin", country: "DE", lat: 52.52, lng: 13.405 },
  { city: "Reykjavik", country: "IS", lat: 64.1466, lng: -21.9426 },
  { city: "Seoul", country: "KR", lat: 37.5665, lng: 126.978 },
  { city: "Singapore", country: "SG", lat: 1.3521, lng: 103.8198 },
];

const ALIASES: Record<string, string> = {
  sf: "San Francisco",
  "san fran": "San Francisco",
  nyc: "New York",
  "new york city": "New York",
  la: "Los Angeles",
  "reykjavík": "Reykjavik",
};

export function placeOf(city: string | undefined | null): Place | null {
  const key = (city ?? "").trim().toLowerCase();
  if (!key) return null;
  const name = ALIASES[key] ?? key;
  return PLACES.find((p) => p.city.toLowerCase() === name.toLowerCase()) ?? null;
}

/** Lat/lng for a hop that just acted in a known city; empty when the city is unknown. */
export function coordsFor(city: string | undefined) {
  const place = placeOf(city);
  return place ? { lat: place.lat, lng: place.lng } : {};
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
