import QRCode from "qrcode";
import { publicOrigin } from "@/lib/http";

/** QR PNG pointing at the public share page (used in email). */
export async function GET(req: Request, ctx: RouteContext<"/api/qr/[id]">) {
  const { id } = await ctx.params;
  if (!/^[a-z0-9]{6,20}$/.test(id)) return new Response("Not found", { status: 404 });
  const png = await QRCode.toBuffer(`${publicOrigin(req)}/a/${id}`, {
    width: 480,
    margin: 1,
    color: { dark: "#2B0F20", light: "#FFFFFF" },
    errorCorrectionLevel: "M",
  });
  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" },
  });
}
