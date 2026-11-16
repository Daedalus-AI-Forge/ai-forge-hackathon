import type { FunctionReturnType } from "convex/server";

import type { api } from "@/convex/_generated/api";

export type Chain = FunctionReturnType<typeof api.chains.mine>[number];

/** Names along the chain, with the viewer as "You": "Kenji → Yui → You → Jasmine". */
export function routeLine(chain: Pick<Chain, "people">) {
  return chain.people.map((p) => (p.me ? "You" : p.name)).join(" → ");
}

/** Who stands in the final photo: the wisher and the person who said "it's me". */
export function photoNames(chain: Pick<Chain, "people">) {
  const ends = chain.people.length > 1 ? [chain.people[0]!, chain.people.at(-1)!] : chain.people;
  return ends.map((p) => (p.me ? "You" : p.name));
}

export const ROLE_LINE: Record<Chain["role"], string> = {
  wisher: "Your wish came true",
  passer: "You passed it on",
  finder: "You were the one",
};
