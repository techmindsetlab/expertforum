import type { Metadata, Viewport } from "next";
import { Google_Sans } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const sans = Google_Sans({
  variable: "--font-sans",
  weight: ["400", "700"],
  subsets: ["latin", "latin-ext"],
  display: "swap",
  adjustFontFallback: false,
});

// Handwriting ("your", names on the wall and kiosk): Astoria. It has one
// weight; it is declared for 400 and 700 so bold styles never get a faux bold.
const hand = localFont({
  src: [
    { path: "../assets/fonts/Astoria.otf", weight: "400", style: "normal" },
    { path: "../assets/fonts/Astoria.otf", weight: "700", style: "normal" },
  ],
  variable: "--font-hand",
  display: "swap",
});

export const metadata: Metadata = {
  title: "print your mark — Expert Forum 2026",
  description: "Live Sketch → AI → Digital Wall. Gambar di tablet, AI melukis ulang, karyamu tampil di layar besar.",
  applicationName: "Expert Forum Live Sketch",
  icons: { icon: "/brand/astra70-logo.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0b1f3a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${sans.variable} ${hand.variable}`}>
      <body>{children}</body>
    </html>
  );
}
