export type Tier = "gold" | "silver" | "bronze" | "red" | "broken";
/** hops = number of relays it took to reach the target */
export function tierFor(hops: number): Tier {
  if (hops <= 1) return "gold";
  if (hops === 2) return "silver";
  if (hops === 3) return "bronze";
  if (hops <= 6) return "red";
  return "broken";
}
export const TIER_LABEL: Record<Tier, string> = {
  gold: "Gold wish", silver: "Silver wish", bronze: "Bronze wish", red: "Red wish", broken: "Faded",
};
export const MAX_HOPS = 6;
export const CHAIN_HOURS = 48;
export const RESCUE_HOURS = 24;
export const STARS_PER_WISH = 2;

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
/** Submitting a free wish from a link costs forwarding to this many friends; helpers who skip need 1. */
export const FORWARDS_TO_WISH = 3;
export const forwardsNeeded = (skippedWish: boolean) => (skippedWish ? 1 : FORWARDS_TO_WISH);
