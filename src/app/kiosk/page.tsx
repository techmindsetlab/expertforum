import type { Metadata } from "next";
import KioskApp from "@/components/kiosk/KioskApp";

export const metadata: Metadata = {
  title: "Kiosk — print your mark",
  manifest: "/manifest.webmanifest",
};

export default function KioskPage() {
  return <KioskApp />;
}
