import type { Metadata } from "next";
import WallApp from "@/components/wall/WallApp";

export const metadata: Metadata = { title: "Wall — print your mark" };

export default function WallPage() {
  return <WallApp />;
}
