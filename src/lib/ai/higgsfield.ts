import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { StyleId } from "../styles";
import { buildCompactPrompt, buildPrompt } from "./prompt";

/**
 * Sketch → illustration through the Higgsfield API (https://docs.higgsfield.ai).
 * Async: submit to `POST /{model}` → poll the returned `status_url` until a
 * terminal status → download `images[0].url` (kept ≥ 7 days by Higgsfield, so
 * the caller stores its own copy).
 *
 * Models are tried in order (`HF_MODELS`, default marketing-studio only);
 * each needs an image-input body:
 *  - marketing-studio/image — edit mode via `image_urls`
 *  - ideogram/v4.0          — remix via `image_url` + `image_weight` (prompt ≤ 2048)
 */

const API = (process.env.HF_API_BASE || "https://api.higgsfield.ai").replace(/\/$/, ""); // override only for tests
const MODELS = (process.env.HF_MODELS || "marketing-studio/image")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);
const QUALITY = process.env.HF_QUALITY || "medium"; // marketing-studio: low | medium | high
const RESOLUTION = process.env.HF_RESOLUTION || "2k"; // marketing-studio: 1k | 2k | 4k
const IMAGE_WEIGHT = Number(process.env.HF_IMAGE_WEIGHT || 60); // ideogram: 1–100
const POLL_MS = 1500;

export type HfOutcome =
  | { status: "ok"; image: Buffer; model: string }
  | { status: "blocked"; model: string; error: string }
  | { status: "error"; model: string; error: string };

/** `HF_KEY=id:secret`, or `HF_API_KEY` + `HF_API_SECRET`. */
export function higgsfieldKey() {
  if (process.env.HF_KEY) return process.env.HF_KEY;
  if (process.env.HF_API_KEY && process.env.HF_API_SECRET) return `${process.env.HF_API_KEY}:${process.env.HF_API_SECRET}`;
  return null;
}

function bodyFor(model: string, imageUrl: string, style: StyleId): Record<string, unknown> {
  if (model.startsWith("ideogram/")) {
    return { prompt: buildCompactPrompt(style), image_url: imageUrl, image_weight: IMAGE_WEIGHT, aspect_ratio: "1:1", rendering_speed: "DEFAULT" };
  }
  if (model.startsWith("marketing-studio/")) {
    return {
      prompt: buildPrompt(style),
      image_urls: [imageUrl],
      quality: QUALITY,
      resolution: RESOLUTION,
      aspect_ratio: "1:1",
      moderation: "auto",
      enhance_prompt: false,
    };
  }
  // Unknown model: the common shape most Higgsfield image models accept.
  return { prompt: buildCompactPrompt(style), image_url: imageUrl, aspect_ratio: "1:1" };
}

class HfError extends Error {
  constructor(
    message: string,
    readonly httpStatus = 0,
  ) {
    super(message);
  }
}

async function hf(key: string, url: string, init: RequestInit & { signal: AbortSignal }) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json", ...init.headers },
  });
  const text = await res.text();
  if (!res.ok) throw new HfError(`${init.method ?? "GET"} ${url.replace(API, "")} → ${res.status} ${text.slice(0, 200)}`, res.status);
  return text ? (JSON.parse(text) as Record<string, unknown>) : {};
}

/** Public HTTPS URL for the sketch: reuse ours, or upload via a presigned URL. */
async function inputUrl(key: string, sketchPng: Buffer, sketchUrl: string | undefined, signal: AbortSignal) {
  if (sketchUrl?.startsWith("https://")) return sketchUrl;
  const up = (await hf(key, `${API}/files/generate-upload-url`, { method: "POST", body: JSON.stringify({ content_type: "image/png" }), signal })) as {
    public_url: string;
    upload_url: string;
    upload_headers?: Record<string, string>;
  };
  const put = await fetch(up.upload_url, { method: "PUT", body: new Uint8Array(sketchPng), headers: up.upload_headers ?? { "Content-Type": "image/png" }, signal });
  if (!put.ok) throw new HfError(`upload → ${put.status}`, put.status);
  return up.public_url;
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(t), reject(signal.reason)), { once: true });
  });

async function runModel(key: string, model: string, imageUrl: string, style: StyleId, signal: AbortSignal): Promise<HfOutcome> {
  const submitted = (await hf(key, `${API}/${model}`, {
    method: "POST",
    body: JSON.stringify(bodyFor(model, imageUrl, style)),
    headers: { "Idempotency-Key": randomUUID() },
    signal,
  })) as { request_id?: string; status_url?: string; cancel_url?: string };
  const statusUrl = submitted.status_url ?? `${API}/requests/${submitted.request_id}/status`;

  try {
    for (;;) {
      await sleep(POLL_MS, signal);
      const s = (await hf(key, statusUrl, { method: "GET", signal })) as { status?: string; images?: { url?: string }[]; error?: unknown };
      if (s.status === "completed") {
        const url = s.images?.[0]?.url;
        if (!url) return { status: "error", model, error: "completed without an image" };
        const res = await fetch(url, { signal });
        if (!res.ok) return { status: "error", model, error: `download → ${res.status}` };
        const image = await sharp(Buffer.from(await res.arrayBuffer())).png({ compressionLevel: 6 }).toBuffer();
        return { status: "ok", image, model };
      }
      if (s.status === "nsfw") return { status: "blocked", model, error: "nsfw" };
      if (s.status === "failed" || s.status === "canceled") {
        return { status: "error", model, error: `${s.status}${s.error ? `: ${JSON.stringify(s.error).slice(0, 200)}` : ""}` };
      }
      // queued | in_progress → keep polling
    }
  } catch (err) {
    // Timed out while queued: cancel so we are not charged for work we no longer wait for.
    if (signal.aborted && submitted.cancel_url) {
      void fetch(submitted.cancel_url, { method: "POST", headers: { Authorization: `Key ${key}` } }).catch(() => {});
    }
    throw err;
  }
}

/**
 * Tries each Higgsfield model in turn. Returns `blocked` on moderation, `ok`
 * with a PNG, or `error` when every model failed (caller falls back to Gemini).
 */
export async function higgsfieldReimagine(sketchPng: Buffer, sketchUrl: string | undefined, style: StyleId, signal: AbortSignal): Promise<HfOutcome> {
  const key = higgsfieldKey();
  if (!key) return { status: "error", model: "higgsfield", error: "HF_KEY not set" };

  let last: HfOutcome = { status: "error", model: "higgsfield", error: "no model configured" };
  try {
    const imageUrl = await inputUrl(key, sketchPng, sketchUrl, signal);
    for (const model of MODELS) {
      try {
        const out = await runModel(key, model, imageUrl, style, signal);
        if (out.status !== "error") return out;
        last = out;
      } catch (err) {
        if (signal.aborted) throw err;
        const status = (err as HfError).httpStatus;
        last = { status: "error", model, error: (err as Error).message };
        if (status === 401 || status === 403) break; // bad credentials: no point trying other models
      }
      console.warn(`[ai] higgsfield ${model} failed: ${last.error}`);
    }
  } catch (err) {
    last = { status: "error", model: last.model, error: signal.aborted ? "higgsfield timeout" : (err as Error).message };
  }
  return last;
}
