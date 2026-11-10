/**
 * AI styles a visitor can pick on the kiosk before generating. Safe to import
 * on the client; the prompts for each style live in lib/ai/prompt.ts.
 */
export const STYLE_IDS = ["fashion", "wpap"] as const;
export type StyleId = (typeof STYLE_IDS)[number];
export const DEFAULT_STYLE: StyleId = "fashion";

/** Sample images shown on the kiosk style cards. */
export const STYLE_THUMBS: Record<StyleId, string> = {
  fashion: "/kiosk/style-digital.webp", // "Digital Art"; id kept for older kiosk builds
  wpap: "/kiosk/style-3d.webp", // "3D Partikel"; id kept from the WPAP style it replaced
};
