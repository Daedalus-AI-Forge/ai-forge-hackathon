// Contract types for the relation graph + AI coach API (docs/api/wishwell-graph-api.md).
// UI can build against these and the mocks in the doc before the Convex functions land.
import type { Id } from "../../convex/_generated/dataModel";

export type WishMode = "serious" | "fun";

export type PassRecipient = { name: string; reason?: string; contact?: string; tags: string[] };

export type NetworkNode = { personKey: string; name: string; tags: string[]; edgeCount: number };

export type NetworkLink = {
  edgeId: Id<"edges">;
  personKey: string;
  tag: string;
  reason: string | null;
  source: "pick" | "daily";
  createdAt: number;
};

export type MyNetwork = { me: { name: string }; nodes: NetworkNode[]; links: NetworkLink[] };

export type CommunityNode = {
  key: string;
  name: string;
  personKeys: string[];
  edgeIds: Id<"edges">[];
  kind: "user" | "contact";
  city?: string;
  lat?: number;
  lng?: number;
};
export type CommunityLink = { key: string; source: string; target: string };
export type CommunityNetwork = {
  meKey: string;
  nodes: CommunityNode[];
  links: CommunityLink[];
  truncated: boolean;
};

export type CoachReady = { ready: boolean; edgeCount: number; threshold: number };

export type CoachTurn = { role: "user" | "coach"; text: string };

export type CoachSuggestion = {
  name: string;
  personKey: string;
  why: string;
  evidence: { tag: string; reason: string | null; source?: "pick" | "daily"; at?: number }[];
  /** e.g. "Katie · Japan · from a daily boat 3 weeks ago" */
  label?: string;
};

export type CoachResult =
  | { ready: false; edgeCount: number; threshold: number }
  | { ready: true; message: string; suggestions: CoachSuggestion[] };
