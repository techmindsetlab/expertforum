import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { getPublicArtwork } from "@/lib/artworks";
import { EVENT } from "@/lib/config";
import { absolute } from "@/lib/http";

// Static, scoped paths so file tracing only ships these assets.
const fontsP = Promise.all([
  readFile(path.join(process.cwd(), "src", "assets", "fonts", "GoogleSans-Regular.ttf")),
  readFile(path.join(process.cwd(), "src", "assets", "fonts", "GoogleSans-Bold.ttf")),
  readFile(path.join(process.cwd(), "src", "assets", "fonts", "Caveat-Bold.ttf")),
]);
const logosP = Promise.all([
  readFile(path.join(process.cwd(), "public", "brand", "astragraphia-logo.png")),
  readFile(path.join(process.cwd(), "public", "brand", "wcce-mark-black.png")),
]).then(([a, w]) => [
  `data:image/png;base64,${a.toString("base64")}`,
  `data:image/png;base64,${w.toString("base64")}`,
]);

/** Signed share card (1080×1350): artwork + signature + name + event footer. */
export async function GET(req: Request, ctx: RouteContext<"/api/art/[id]/card">) {
  const { id } = await ctx.params;
  const art = await getPublicArtwork(id);
  if (!art) return new Response("Not found", { status: 404 });

  const origin = new URL(req.url).origin;
  const [[regular, bold, hand], [agLogo, wcce]] = await Promise.all([fontsP, logosP]);
  const no = `#${String(art.number).padStart(3, "0")}`;
  const en = art.locale === "en";
  const download = new URL(req.url).searchParams.has("download");

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#ffffff", padding: 40, fontFamily: "Google Sans", color: "#2B0F20" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", height: 56 }}>
          <div style={{ display: "flex", alignItems: "baseline", fontSize: 38, fontWeight: 700, letterSpacing: -1.5 }}>
            print
            <span style={{ fontFamily: "Caveat", color: "#C4197F", fontSize: 46, margin: "0 10px" }}>your</span>
            mark
          </div>
          <div style={{ fontSize: 44, fontWeight: 700, color: "#941F62", letterSpacing: -1 }}>{no}</div>
        </div>
        <div style={{ position: "relative", display: "flex", width: 1000, height: 1000, borderRadius: 18, overflow: "hidden", background: "#FBF8F3" }}>
          <img src={absolute(art.artMdUrl ?? art.artUrl ?? "", origin)} width={1000} height={1000} style={{ objectFit: "cover" }} />
          <div style={{ position: "absolute", right: 40, bottom: 26, fontFamily: "Caveat", fontSize: 92, color: "#2B0F20", transform: "rotate(-4deg)" }}>{art.name}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, paddingTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 50, fontWeight: 700, letterSpacing: -1.5 }}>{art.name}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <img src={agLogo} width={258} height={31} />
              <img src={wcce} width={50} height={45} />
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 22, color: "#7A5D6D", marginTop: 6 }}>
            {`${EVENT.short} · ${EVENT.dates[en ? "en" : "id"]} · ${EVENT.venue}`}
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1350,
      fonts: [
        { name: "Google Sans", data: regular, weight: 400, style: "normal" },
        { name: "Google Sans", data: bold, weight: 700, style: "normal" },
        { name: "Caveat", data: hand, weight: 700, style: "normal" },
      ],
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
        ...(download ? { "Content-Disposition": `attachment; filename="print-your-mark-${art.number}.png"` } : {}),
      },
    },
  );
}
