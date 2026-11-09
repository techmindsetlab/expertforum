import { z } from "zod";
import { createArtwork } from "@/lib/artworks";
import { assertKiosk, HttpError, jsonError } from "@/lib/http";
import { EMAIL_RE, isNameAllowed, normalizeName } from "@/lib/names";

const Body = z.object({
  name: z.string().min(1).max(40),
  email: z.string().trim().max(120).default(""), // optional: "" when the visitor skips it
  marketingOptIn: z.boolean().default(false),
  locale: z.enum(["id", "en"]).default("id"),
  kioskId: z.string().max(40).optional(),
  sketch: z.string().startsWith("data:image/png;base64,"),
  strokes: z.object({ v: z.literal(1), strokes: z.array(z.any()).max(2000) }),
});

export async function POST(req: Request) {
  try {
    assertKiosk(req);
    const body = Body.safeParse(await req.json());
    if (!body.success) throw new HttpError(400, "Invalid request");
    const name = normalizeName(body.data.name);
    if (!name || !isNameAllowed(name)) throw new HttpError(422, "Name not allowed", "name");
    if (body.data.email && !EMAIL_RE.test(body.data.email)) throw new HttpError(422, "Email invalid", "email");

    const id = await createArtwork({ ...body.data, name, marketingOptIn: body.data.marketingOptIn && Boolean(body.data.email) });
    return Response.json({ id });
  } catch (err) {
    return jsonError(err);
  }
}
