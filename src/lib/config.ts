/** Event + campaign copy used on the kiosk, wall, A4 print, share page and email. */
export const EVENT = {
  short: "WCCE 2026",
  fullName: "The 5th World Conference on Creative Economy",
  theme: "Inclusively Creative: Collective Continuity",
  dates: { id: "21–25 Oktober 2026", en: "21–25 October 2026" },
  venue: "MGP Space - SCBD Park",
  campaign: "print your mark",
} as const;

/** Paid AI images per visitor: the first one + 1 redo (regenerate or redraw). */
export const MAX_ATTEMPTS = 2;

export const NAME_MAX = 16;

export const BRAND = {
  plum: "#941F62",
  plumDeep: "#620E40",
  plumInk: "#3A0A26",
  magenta: "#C4197F",
  gold: "#F2B81E",
  indigo: "#21165A",
} as const;
