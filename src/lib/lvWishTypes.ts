// UI wish types ↔ backend wish types.
export type LvWishType = "activity" | "guide" | "been" | "same";
export type ApiWishType = "do_together" | "local" | "been_there" | "same_boat";

export const toApiType: Record<LvWishType, ApiWishType> = {
  activity: "do_together",
  guide: "local",
  been: "been_there",
  same: "same_boat",
};
export const fromApiType: Record<ApiWishType, LvWishType> = {
  do_together: "activity",
  local: "guide",
  been_there: "been",
  same_boat: "same",
};
export const LV_WISH_TYPES: { id: LvWishType; label: string; emoji: string; example: string }[] = [
  { id: "activity", label: "Activity partner", emoji: "🥁", example: "find someone to play drums with" },
  { id: "guide", label: "Local guide", emoji: "🏮", example: "find a Tokyo local to show me izakayas" },
  { id: "been", label: "Been there", emoji: "🧭", example: "find someone who has been to Antarctica" },
  { id: "same", label: "Same boat", emoji: "🚲", example: "find someone who also just moved to SF" },
];
