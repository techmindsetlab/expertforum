import { z } from "zod";
import { markLabelPrinted, markPrinted, setHidden } from "@/lib/artworks";
import { sendArtworkEmail } from "@/lib/email";
import { HttpError, jsonError, publicOrigin } from "@/lib/http";

export const maxDuration = 60;

const Body = z.object({ action: z.enum(["hide", "unhide", "printed", "label", "email"]) });

export async function POST(req: Request, ctx: RouteContext<"/api/admin/artworks/[id]">) {
  try {
    const { id } = await ctx.params;
    const body = Body.safeParse(await req.json());
    if (!body.success) throw new HttpError(400, "Invalid action");
    switch (body.data.action) {
      case "hide":
        await setHidden(id, true);
        break;
      case "unhide":
        await setHidden(id, false);
        break;
      case "printed":
        await markPrinted(id);
        break;
      case "label":
        await markLabelPrinted(id);
        break;
      case "email":
        await sendArtworkEmail(id, publicOrigin(req));
        break;
    }
    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
