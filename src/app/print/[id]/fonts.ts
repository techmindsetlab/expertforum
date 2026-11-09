import { Momo_Signature } from "next/font/google";

// Handwriting on the poster and label (signature, date, "your"); "block" so a
// print never goes out with the fallback face.
export const sign = Momo_Signature({
  variable: "--font-sign",
  weight: "400",
  subsets: ["latin", "latin-ext"],
  display: "block",
});
