/** Event + campaign copy used on the kiosk, wall, A4 print, share page and email. */
export const EVENT = {
  short: "Expert Forum 2026",
  fullName: "Astra Expert Forum 2026",
  tagline: "15 Years of Astra Expert",
  subline: "Strengthen Value Creation for Business Impact",
  theme: "15 Years of Astra Expert: Strengthen Value Creation for Business Impact",
  dates: { id: "Rabu, 11 November 2026", en: "Wednesday, 11 November 2026" },
  day: "Wednesday",
  dateShort: "11.11.2026",
  time: "07:30 – 13:00 WIB",
  venue: "Catur Dharma Hall 5th Floor, Menara Astra",
  venueShort: "Menara Astra",
  campaign: "print your mark",
} as const;

/**
 * Path the participant download page is served under, here and on the Nada
 * Kreatif Pro website (which proxies everything below it to this app). The
 * page's own files (brand logos, API calls, Next.js assets) live below it too.
 */
export const SHARE_PATH = "/case/expertforum";

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
