// Rasterises the booth backdrop final artwork (4000 × 2400 mm PDF from the
// designer) into the texture the 3D mockup prints on the backdrop face:
// public/booth/backdrop-fa.webp, 1 px = 1 mm.
//   npm run booth:backdrop -- [design/booth-backdrop-FA-4000x2400mm.pdf]
import { readFile, writeFile } from "node:fs/promises";
import { createCanvas } from "@napi-rs/canvas";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const src = process.argv[2] ?? "design/booth-backdrop-FA-4000x2400mm.pdf";
const out = "public/booth/backdrop-fa.webp";
const PX_PER_MM = 1;

const doc = await pdfjs.getDocument({ data: new Uint8Array(await readFile(src)), verbosity: 0 }).promise;
const page = await doc.getPage(1);
const pt = page.getViewport({ scale: 1 });
const mm = { w: (pt.width / 72) * 25.4, h: (pt.height / 72) * 25.4 };
const vp = page.getViewport({ scale: (Math.round(mm.w) * PX_PER_MM) / pt.width });
const canvas = createCanvas(Math.round(vp.width), Math.round(vp.height));
const ctx = canvas.getContext("2d");
ctx.fillStyle = "#fff";
ctx.fillRect(0, 0, canvas.width, canvas.height);
await page.render({ canvasContext: ctx, viewport: vp }).promise;
await writeFile(out, await canvas.encode("webp", 90));
console.log(`${src}: ${mm.w.toFixed(0)} × ${mm.h.toFixed(0)} mm → ${out} (${canvas.width} × ${canvas.height} px)`);
