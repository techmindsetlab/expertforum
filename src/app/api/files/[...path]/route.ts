import { readLocalFile } from "@/lib/storage";

const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", json: "application/json" };

/** Serves locally stored files in dev (production uses Neon object storage / Blob URLs). */
export async function GET(_req: Request, ctx: RouteContext<"/api/files/[...path]">) {
  const { path } = await ctx.params;
  try {
    const rel = path.join("/");
    const data = await readLocalFile(rel);
    const ext = rel.split(".").pop() ?? "";
    return new Response(new Uint8Array(data), {
      headers: { "Content-Type": TYPES[ext] ?? "application/octet-stream", "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
