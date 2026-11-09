import type { Metadata } from "next";
import SharePage, { generateMetadata as shareMetadata } from "@/app/a/[id]/page";

/**
 * The participant download page again, at the path the Nada Kreatif Pro
 * website proxies: www.nadakreatifpro.co.id/case/expertforum/<id> →
 * this app's /case/expertforum/<id>. Same path on both sides, so the Next.js
 * router sees the URL it rendered.
 */
export const dynamic = "force-dynamic";

export function generateMetadata(props: PageProps<"/case/expertforum/[id]">): Promise<Metadata> {
  return shareMetadata(props as unknown as PageProps<"/a/[id]">);
}

export default function CaseSharePage(props: PageProps<"/case/expertforum/[id]">) {
  return SharePage(props as unknown as PageProps<"/a/[id]">);
}
