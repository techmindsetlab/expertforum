import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicArtwork, toPublic } from "@/lib/artworks";
import { EVENT } from "@/lib/config";
import { ShareView } from "./ShareView";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: PageProps<"/a/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const art = await getPublicArtwork(id);
  if (!art) return { title: "print your mark" };
  const title = `${art.name} · #${String(art.number).padStart(3, "0")} — print your mark`;
  return {
    title,
    description: `Sketsa tangan yang dilukis ulang oleh AI di booth Astragraphia, ${EVENT.short}.`,
    openGraph: { title, images: [{ url: `/api/art/${art.id}/card`, width: 1080, height: 1350 }] },
  };
}

export default async function SharePage(props: PageProps<"/a/[id]">) {
  const { id } = await props.params;
  const art = await getPublicArtwork(id);
  if (!art) notFound();
  return <ShareView art={toPublic(art)} />;
}
