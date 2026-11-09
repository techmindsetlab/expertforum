import { z } from "zod";
import { generateForArtwork } from "@/lib/artworks";
import { assertKiosk, HttpError, jsonError } from "@/lib/http";
import { STYLE_IDS } from "@/lib/styles";

// Higgsfield marketing-studio takes ~50 s (we wait up to 90 s); give the function room.
export const maxDuration = 120;

const Body = z
  .object({
    sketch: z.string().startsWith("data:image/png;base64,"),
    strokes: z.object({ v: z.literal(1), strokes: z.array(z.any()).max(2000) }),
    style: z.enum(STYLE_IDS),
  })
  .partial();

export async function POST(req: Request, ctx: RouteContext<"/api/artworks/[id]/generate">) {
  try {
    assertKiosk(req);
    const { id } = await ctx.params;
    const text = await req.text();
    const body = Body.safeParse(text ? JSON.parse(text) : {});
    if (!body.success) throw new HttpError(400, "Invalid request");
    const redraw = body.data.sketch && body.data.strokes ? { sketch: body.data.sketch, strokes: body.data.strokes } : undefined;
    const result = await generateForArtwork(id, redraw, new URL(req.url).origin, body.data.style);
    return Response.json(result);
  } catch (err) {
    return jsonError(err);
  }
}
