/** Event + campaign copy used on the kiosk, wall, A4 print, share page and email. */
export const EVENT = {
  short: "Expert Forum 2026",
  fullName: "Astra Expert Forum 2026",
  theme: "15 Years of Astra Expert: Strengthen Value Creation for Business Impact",
  dates: { id: "11 November 2026", en: "11 November 2026" },
  venue: "Menara Astra",
  campaign: "print your mark",
} as const;

/** Paid AI images per visitor: the first one + 1 redo (regenerate or redraw). */
export const MAX_ATTEMPTS = 2;

export const NAME_MAX = 16;

export const BRAND = {
  plum: "#2040da",
  plumDeep: "#102a4c",
  plumInk: "#0b1f3a",
  magenta: "#0380e1",
  gold: "#fba500",
  indigo: "#071a33",
} as const;
