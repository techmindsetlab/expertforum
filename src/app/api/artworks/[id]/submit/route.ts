import { after } from "next/server";
import { z } from "zod";
import { submitArtwork } from "@/lib/artworks";
import { sendArtworkEmail } from "@/lib/email";
import { assertKiosk, HttpError, jsonError, publicOrigin } from "@/lib/http";

export const maxDuration = 60;

const Body = z.object({ generationId: z.string().min(4).max(40) });

export async function POST(req: Request, ctx: RouteContext<"/api/artworks/[id]/submit">) {
  try {
    assertKiosk(req);
    const { id } = await ctx.params;
    const body = Body.safeParse(await req.json());
    if (!body.success) throw new HttpError(400, "Invalid request");

    const result = await submitArtwork(id, body.data.generationId);
    if (!result.already) {
      const origin = publicOrigin(req);
      after(() => sendArtworkEmail(id, origin));
    }
    return Response.json({ number: result.number });
  } catch (err) {
    return jsonError(err);
  }
}
