import { getPublicArtwork } from "@/lib/artworks";
import { loadFile } from "@/lib/storage";

/**
 * Same-origin copy of the 1080px artwork. WebGL textures need CORS and the
 * public bucket sends none, so the 3D booth mockup loads art through here.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/art/[id]/image">) {
  const { id } = await ctx.params;
  const art = await getPublicArtwork(id);
  const url = art?.artMdUrl ?? art?.artUrl;
  if (!url) return new Response("Not found", { status: 404 });
  try {
    const data = await loadFile(url, new URL(req.url).origin);
    return new Response(new Uint8Array(data), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
