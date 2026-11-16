// Shared constants/helpers for the relation graph + AI coach (docs/api/wishwell-graph-api.md).
// Owned by the skeleton commit: parallel tasks import from here and must not change shapes.
import { v } from "convex/values";

export const COACH_THRESHOLD = 5;
export const REASON_MAX = 140;
export const CONTACT_MAX = 80;
export const WISH_TEXT_MAX = 300;
export const COACH_TURNS_MAX = 6;

export const wishMode = v.union(v.literal("serious"), v.literal("fun"));
export type WishMode = "serious" | "fun";

/** Stable key for a person in one owner's ego graph: normalized name. */
export function personKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Supermemory namespace for one owner's edges. */
export function memoryNamespace(ownerUserId: string): string {
  return `ww_net_${ownerUserId}`;
}

/** Optional provenance of one evidence edge: where it came from and when (ms). */
export const evidenceMeta = {
  source: v.optional(v.union(v.literal("pick"), v.literal("daily"))),
  at: v.optional(v.number()),
};

/** One ranked candidate, produced by graphRank.rankForWish, consumed by ai.coach. */
export const candidateValidator = v.object({
  personKey: v.string(),
  name: v.string(),
  score: v.number(),
  evidence: v.array(v.object({ tag: v.string(), reason: v.union(v.string(), v.null()), ...evidenceMeta })),
});
export type Candidate = {
  personKey: string;
  name: string;
  score: number;
  evidence: { tag: string; reason: string | null; source?: "pick" | "daily"; at?: number }[];
};
