import { hiddenNumbers, listWall, wallStats } from "@/lib/artworks";
import { jsonError } from "@/lib/http";

/**
 * GET /api/wall            → newest artworks (initial load) + hidden list
 * GET /api/wall?after=42   → artworks submitted after #42 (polling)
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const afterParam = url.searchParams.get("after");
    const after = afterParam != null ? Number(afterParam) : null;
    const withMeta = after == null || url.searchParams.has("meta");
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 160, 1), 300);
    const [items, stats, hidden] = await Promise.all([
      listWall(Number.isFinite(after) ? after : null, limit),
      withMeta ? wallStats() : null,
      withMeta ? hiddenNumbers() : null,
    ]);
    return Response.json({ items, total: stats?.total, hidden }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return jsonError(err);
  }
}
