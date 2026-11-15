// Shared types for the Voyages tab: a boat card from pool.voyages and the
// page payload from hops.page that powers the boat detail.
import type { FunctionReturnType } from "convex/server";

import { api } from "@/convex/_generated/api";

export type VoyageCard = FunctionReturnType<typeof api.pool.voyages>[number];
export type HopPage = FunctionReturnType<typeof api.hops.page>;

export const VOYAGE_STATUS: Record<VoyageCard["status"], string> = {
  drifting: "Drifting",
  landed: "Landed",
  granted: "Granted",
  faded: "Faded",
};