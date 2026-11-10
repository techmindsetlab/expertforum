import localFont from "next/font/local";

// Handwriting on the poster and label (signature, date, "your"): Astoria, the
// same script as the wall and kiosk. "block" so a print never goes out with
// the fallback face. One weight, declared for 400 and 700 (no faux bold).
export const sign = localFont({
  src: [
    { path: "../../../assets/fonts/Astoria.otf", weight: "400", style: "normal" },
    { path: "../../../assets/fonts/Astoria.otf", weight: "700", style: "normal" },
  ],
  variable: "--font-sign",
  display: "block",
});
