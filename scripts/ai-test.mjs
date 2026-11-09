// Quick check of the Gemini image pipeline outside the app.
//   npx tsx --env-file=.env.development.local scripts/ai-test.mjs [sketch.png] [out.png]
// Without a sketch argument a sample doodle (striped mug + smiley) is used.
import { writeFile, readFile } from "node:fs/promises";
import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import { buildPrompt } from "../src/lib/ai/prompt.ts";

const [, , input, output = ".data/ai-test.png"] = process.argv;
const model = process.env.GEMINI_IMAGE_MODEL || "gemini-3-pro-image";
const size = process.env.GEMINI_IMAGE_SIZE || "2K";
if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set");

const sample = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
  <rect width="100%" height="100%" fill="#fff"/>
  <g fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M250 330 L265 720 Q270 760 330 765 L520 765 Q570 760 575 720 L590 330" stroke="#1B1220" stroke-width="9"/>
    <path d="M245 330 Q420 300 595 330" stroke="#1B1220" stroke-width="9"/>
    <path d="M590 420 Q700 430 690 540 Q680 640 580 640" stroke="#1B1220" stroke-width="9"/>
    <path d="M270 450 Q420 420 580 455 M275 560 Q420 535 578 565 M280 660 Q420 640 575 668" stroke="#E5332A" stroke-width="22"/>
    <circle cx="370" cy="390" r="8" fill="#1B1220"/><circle cx="460" cy="392" r="8" fill="#1B1220"/>
    <path d="M370 418 Q415 450 462 420" stroke="#1B1220" stroke-width="7"/>
    <ellipse cx="760" cy="790" rx="120" ry="140" stroke="#E5332A" stroke-width="8"/>
    <path d="M720 760 l4 4 M800 760 l4 4 M720 840 Q760 880 805 838" stroke="#E5332A" stroke-width="8"/>
    <path d="M700 230 l40 60 l80 -140 M780 350 l35 50 l70 -110" stroke="#E5332A" stroke-width="8"/>
  </g></svg>`;

const sketch = input ? await readFile(input) : await sharp(Buffer.from(sample)).png().toBuffer();
await writeFile(".data/ai-test-sketch.png", sketch).catch(() => {});

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const t0 = Date.now();
const res = await ai.models.generateContent({
  model,
  contents: [{ role: "user", parts: [{ text: buildPrompt() }, { inlineData: { mimeType: "image/png", data: sketch.toString("base64") } }] }],
  config: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "1:1", imageSize: size } },
});
const ms = Date.now() - t0;
const cand = res.candidates?.[0];
const part = cand?.content?.parts?.find((p) => p.inlineData?.data);
if (!part) {
  console.error("No image. finish:", cand?.finishReason, "block:", res.promptFeedback?.blockReason);
  process.exit(1);
}
const buf = Buffer.from(part.inlineData.data, "base64");
await writeFile(output, buf);
const meta = await sharp(buf).metadata();
console.log(`model=${model} size=${size} → ${meta.width}x${meta.height} ${(buf.length / 1024).toFixed(0)}KB in ${(ms / 1000).toFixed(1)}s → ${output}`);
