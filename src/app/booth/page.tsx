import type { Metadata } from "next";
import BoothApp from "@/components/booth/BoothApp";

export const metadata: Metadata = {
  title: "Booth mockup — Pojok Kreasi Astragraphia",
  description: "Mockup 3D island booth 4 × 3,8 m untuk WCCE 2026.",
};

export default function BoothPage() {
  return <BoothApp />;
}
