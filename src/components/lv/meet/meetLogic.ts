// Pure helpers for the meet-up card and the granted reveal (no React, so vitest can run them).

export type MeetStage = "upload" | "waiting" | "review" | "granted" | "expired";
export type MeetRole = "creator" | "match";

export type EndingHolder = {
  key: string;
  name: string;
  city: string | null;
  depth: number;
  avatar: string;
  acted: string | null;
};

export type GrantedStop = EndingHolder & { star: boolean };

/**
 * The winning route, wisher first and match last. `meetings.confirmPhoto` gives +1 star to every
 * helper strictly between the two participants, so only the middle stops carry a star.
 */
export function grantedStops(holders: EndingHolder[] | undefined): GrantedStop[] {
  const list = holders ?? [];
  return list.map((h, i) => ({ ...h, star: i > 0 && i < list.length - 1 }));
}

export function otherName(v: { role: MeetRole; creatorName: string; matchName: string }) {
  return v.role === "creator" ? v.matchName : v.creatorName;
}

export function meetCopy(v: { stage: MeetStage; role: MeetRole; creatorName: string; matchName: string }) {
  const other = otherName(v);
  switch (v.stage) {
    case "upload":
      return { title: "Waiting for you to meet…", sub: `Meet ${other} in person or on a call, then add one photo of you two.` };
    case "waiting":
      return { title: `Waiting for ${other} to confirm`, sub: "Once they say it's you two, the wish is granted for everyone." };
    case "review":
      return { title: "Is this you two?", sub: `${other} added your meet-up photo. Confirm it to grant the wish.` };
    case "expired":
      return { title: "The week to meet has passed", sub: "This wish stays found, but it can't be granted any more." };
    case "granted":
      return { title: "Wish granted", sub: "" };
  }
}
