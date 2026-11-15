// Link page contract (docs/superpowers/plans/2026-11-15-link-page.md). Shared by all link-page tasks.
export type LinkEvent = "open" | "wish_written" | "skip_wish" | "claim" | "push" | "contact" | "download_click";

export type FirstScreenState = "open" | "claimed" | "expired" | "handled" | "forwarded" | "missing";

export type FirstScreen = {
  state: FirstScreenState;
  hopId: string;
  wishId: string;
  /** Who pushed this boat to the visitor, and their vouch about the visitor (shown at the top). */
  senderName: string;
  vouchForMe: string | null;
  /** The intended holder's name (for "this boat was pushed to Ben" when forwarded). */
  holderName: string;
  boat: { text: string; kind: "daily" | "real"; creatorName: string; mode: "serious" | "fun" };
  chain: { name: string; city: string | null; vouch: string | null }[];
  ripples: number;
  expiresAt: number;
  /** False when this device's contact already used its free wish. */
  freeWishAvailable: boolean;
  /** Set when state === "handled": what this visitor did and where the boat is now. */
  handled: { action: "claim" | "push"; nowRipples: number; lastCity: string | null } | null;
};

export type FinishResult = {
  freeWishUsed: boolean; // true when this contact had already used its free wish
  wishId: string | null; // the free wish that set sail, if any
  boatProgress: number; // 0..4 toward the next coin
  boatsPerCoin: number; // 5
  wishesLeft: number;
};

export type EndingView = {
  status: "traveling" | "found" | "granted" | "faded";
  wishText: string;
  photoUrl: string | null;
  story: string;
  route: string[]; // cities in hop order
  ripples: number;
};
