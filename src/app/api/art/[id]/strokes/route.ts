import { getPublicArtwork } from "@/lib/artworks";
import { loadFile } from "@/lib/storage";

/**
 * Stroke JSON for the wall/share replay. Proxied because the public bucket
 * does not send CORS headers, so the browser cannot fetch it directly.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/art/[id]/strokes">) {
  const { id } = await ctx.params;
  const art = await getPublicArtwork(id);
  if (!art?.strokesUrl) return new Response("Not found", { status: 404 });
  try {
    const data = await loadFile(art.strokesUrl, new URL(req.url).origin);
    return new Response(new Uint8Array(data), {
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
