import type { Metadata, Viewport } from "next";
import { Caveat, Google_Sans } from "next/font/google";
import "./globals.css";

const sans = Google_Sans({
  variable: "--font-sans",
  weight: ["400", "700"],
  subsets: ["latin", "latin-ext"],
  display: "swap",
  adjustFontFallback: false,
});

const hand = Caveat({
  variable: "--font-hand",
  weight: ["700"],
  subsets: ["latin", "latin-ext"],
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
