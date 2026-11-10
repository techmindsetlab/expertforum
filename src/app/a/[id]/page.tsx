import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicArtwork, toPublic } from "@/lib/artworks";
import { EVENT } from "@/lib/config";
import { publicOrigin, shareUrl } from "@/lib/http";
import { ShareView } from "./ShareView";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: PageProps<"/a/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const art = await getPublicArtwork(id);
  if (!art) return { title: "print your mark" };
  const title = `${art.name} · #${String(art.number).padStart(3, "0")} — print your mark`;
  return {
    title,
    description: `Sketsa tangan yang dilukis ulang oleh AI di booth Astragraphia & AGIT, ${EVENT.short}.`,
    // Branded preview (public/og.jpg); absolute via metadataBase, so it loads wherever the page is proxied.
    openGraph: { title, type: "website", images: [{ url: "/og.jpg", width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, images: ["/og.jpg"] },
  };
}

export default async function SharePage(props: PageProps<"/a/[id]">) {
  const { id } = await props.params;
  const art = await getPublicArtwork(id);
  if (!art) notFound();
  return <ShareView art={toPublic(art)} link={shareUrl(art.id, publicOrigin())} />;
}
