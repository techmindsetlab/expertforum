import QRCode from "qrcode";
import { publicOrigin, shareUrl } from "@/lib/http";

/** QR PNG pointing at the public share page (used in email). */
export async function GET(req: Request, ctx: RouteContext<"/api/qr/[id]">) {
  const { id } = await ctx.params;
  if (!/^[a-z0-9]{6,20}$/.test(id)) return new Response("Not found", { status: 404 });
  const png = await QRCode.toBuffer(shareUrl(id, publicOrigin(req)), {
    width: 480,
    margin: 1,
    color: { dark: "#0b1f3a", light: "#FFFFFF" },
    errorCorrectionLevel: "M",
  });
  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" },
  });
}
