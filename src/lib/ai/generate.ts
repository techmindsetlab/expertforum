import "server-only";
import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import { DEFAULT_STYLE, type StyleId } from "../styles";
import { higgsfieldKey, higgsfieldReimagine } from "./higgsfield";
import { buildPrompt } from "./prompt";

export type GenResult =
  | { status: "ok" | "fallback"; image: Buffer; model: string; latencyMs: number; error?: string }
  | { status: "blocked"; model: string; latencyMs: number; error: string };

/** Comma-separated; later models are tried when one is rate-limited or down. */
const MODELS = (process.env.GEMINI_IMAGE_MODEL || "gemini-3-pro-image,gemini-3.1-flash-image")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);
const MODEL = MODELS[0];
const SIZE = process.env.GEMINI_IMAGE_SIZE || "2K";
const TIMEOUT = Number(process.env.GEMINI_TIMEOUT_MS || 80_000);
/** Provider order; the generate route allows 120 s in total. Gemini only when listed. */
const PROVIDERS = (process.env.AI_PROVIDERS || "higgsfield").split(",").map((p) => p.trim());
const TOTAL_BUDGET = Number(process.env.AI_TOTAL_TIMEOUT_MS || 105_000);
// marketing-studio takes ~48 s (max seen 59 s); a job cut off mid-render may still be billed.
const HF_TIMEOUT = Number(process.env.HF_TIMEOUT_MS || 90_000);

const BLOCK_REASONS = new Set([
  "SAFETY",
  "PROHIBITED_CONTENT",
  "IMAGE_SAFETY",
  "IMAGE_PROHIBITED_CONTENT",
  "BLOCKLIST",
  "SPII",
]);

let client: GoogleGenAI | undefined;

/**
 * Sketch PNG → illustrated PNG. Providers in `AI_PROVIDERS` order
 * (default Higgsfield only; "higgsfield,gemini" adds a Gemini backup), all
 * within one time budget.
 * - A moderation block returns `blocked` so the kiosk asks for a new drawing
 *   (we never put a refused sketch on the wall).
 * - When every provider fails or times out, a `fallback` paper rendering of
 *   the sketch keeps the visitor's flow from dead-ending at the booth.
 */
export async function reimagine(sketchPng: Buffer, sketchUrl?: string, style: StyleId = DEFAULT_STYLE): Promise<GenResult> {
  const started = Date.now();
  const hasHf = Boolean(higgsfieldKey());
  const hasGemini = Boolean(process.env.GEMINI_API_KEY);

  if (!hasHf && !hasGemini) {
    // Demo mode: no AI keys → simulate latency and return the paper fallback.
    await new Promise((r) => setTimeout(r, 2200));
    return { status: "fallback", image: await paperFallback(sketchPng), model: "demo", latencyMs: Date.now() - started };
  }

  const errors: string[] = [];
  let lastModel = MODEL;
  for (const provider of PROVIDERS) {
    const remaining = TOTAL_BUDGET - (Date.now() - started);
    if (remaining < 5_000) break;

    if (provider === "higgsfield" && hasHf) {
      const out = await higgsfieldReimagine(sketchPng, sketchUrl, style, AbortSignal.timeout(Math.min(HF_TIMEOUT, remaining)));
      const model = `higgsfield:${out.model}`;
      lastModel = model;
      if (out.status === "ok") return { status: "ok", image: out.image, model, latencyMs: Date.now() - started };
      if (out.status === "blocked") return { status: "blocked", model, latencyMs: Date.now() - started, error: out.error };
      errors.push(`${model}: ${out.error}`);
      console.warn(`[ai] higgsfield failed (${out.error}), trying next provider`);
    }

    if (provider === "gemini" && hasGemini) {
      const out = await geminiReimagine(sketchPng, style, Math.min(TIMEOUT, remaining));
      lastModel = out.model;
      if (out.status !== "error") return { ...out, latencyMs: Date.now() - started };
      errors.push(`${out.model}: ${out.error}`);
    }
  }

  const error = errors.join(" | ") || "no provider available";
  console.error("[ai] generation failed:", error);
  return {
    status: "fallback",
    image: await paperFallback(sketchPng),
    model: lastModel,
    latencyMs: Date.now() - started,
    error: error.slice(0, 500),
  };
}

type GeminiOutcome =
  | { status: "ok"; image: Buffer; model: string }
  | { status: "blocked"; model: string; error: string }
  | { status: "error"; model: string; error: string };

/** Gemini image models in `GEMINI_IMAGE_MODEL` order. */
async function geminiReimagine(sketchPng: Buffer, style: StyleId, timeoutMs: number): Promise<GeminiOutcome> {
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);

  let lastError: unknown;
  let lastModel = MODEL;
  try {
    for (const model of MODELS) {
      lastModel = model;
      try {
        const res = await client.models.generateContent({
          model,
          contents: [
            {
              role: "user",
              parts: [{ text: buildPrompt(style) }, { inlineData: { mimeType: "image/png", data: sketchPng.toString("base64") } }],
            },
          ],
          config: {
            responseModalities: ["IMAGE"],
            imageConfig: { aspectRatio: "1:1", imageSize: SIZE },
            abortSignal: abort.signal,
          },
        });

        const blockReason = res.promptFeedback?.blockReason;
        const cand = res.candidates?.[0];
        const finish = cand?.finishReason as string | undefined;
        if (blockReason || (finish && BLOCK_REASONS.has(finish))) {
          return { status: "blocked", model, error: String(blockReason || finish) };
        }

        const part = cand?.content?.parts?.find((p) => p.inlineData?.data);
        if (!part?.inlineData?.data) throw new Error(`no image in response (finish=${finish ?? "?"})`);

        const raw = Buffer.from(part.inlineData.data, "base64");
        const image = await sharp(raw).png({ compressionLevel: 6 }).toBuffer();
        return { status: "ok", image, model };
      } catch (err) {
        lastError = err;
        const status = (err as { status?: number }).status ?? 0;
        // Quota / not found / server errors → try the next model; anything else stops.
        if (abort.signal.aborted || !(status === 429 || status === 404 || status >= 500)) break;
        console.warn(`[ai] ${model} failed with ${status}, trying next model`);
      }
    }
    throw lastError ?? new Error("no model available");
  } catch (err) {
    const message = abort.signal.aborted ? `timeout after ${timeoutMs}ms` : (err as Error).message;
    return { status: "error", model: lastModel, error: message.slice(0, 300) };
  } finally {
    clearTimeout(timer);
  }
}

/** The visitor's own sketch, upscaled onto warm paper with a soft ink feel. */
async function paperFallback(sketchPng: Buffer): Promise<Buffer> {
  const size = 2048;
  const ink = await sharp(sketchPng).resize(size, size, { kernel: "lanczos3" }).blur(0.6).modulate({ saturation: 1.15 }).toBuffer();
  // Small noise tile repeated across the sheet — rendering turbulence at full
  // size is slow in librsvg.
  const grain = await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">
      <filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>
      <feColorMatrix values="0 0 0 0 0.45  0 0 0 0 0.38  0 0 0 0 0.32  0 0 0 0.10 0"/></filter>
      <rect width="100%" height="100%" filter="url(#n)"/></svg>`,
    ),
  )
    .png()
    .toBuffer();
  return sharp({ create: { width: size, height: size, channels: 3, background: "#FBF8F2" } })
    .composite([
      { input: ink, blend: "multiply" },
      { input: grain, blend: "over", tile: true },
    ])
    .png({ compressionLevel: 6 })
    .toBuffer();
}

/** Display + thumbnail versions (JPEG: works in email clients and OG renderer). */
export async function derivatives(png: Buffer) {
  const [md, sm] = await Promise.all([
    sharp(png).resize(1080, 1080).jpeg({ quality: 86, mozjpeg: true }).toBuffer(),
    sharp(png).resize(480, 480).jpeg({ quality: 80, mozjpeg: true }).toBuffer(),
  ]);
  return { md, sm };
}
