import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { put } from "@vercel/blob";

/**
 * File storage with three interchangeable backends, picked from env:
 *  1. Neon Object Storage (S3-compatible, public bucket)  ← production
 *  2. Vercel Blob                                          ← alternative
 *  3. Local disk under ./.data/files, served by /api/files ← dev only
 * Every backend returns a URL that can be used directly in <img>.
 */

const bucket = process.env.S3_BUCKET || "gallery";
const s3Endpoint = process.env.AWS_ENDPOINT_URL_S3;
const useS3 = Boolean(s3Endpoint && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
const useBlob = !useS3 && Boolean(process.env.BLOB_READ_WRITE_TOKEN);

let s3: S3Client | undefined;
function getS3() {
  s3 ??= new S3Client({
    region: process.env.AWS_REGION || "us-east-1",
    endpoint: s3Endpoint,
    forcePathStyle: true,
  });
  return s3;
}

const LOCAL_ROOT = path.join(process.cwd(), ".data", "files");

export const storageBackend = useS3 ? "neon-s3" : useBlob ? "vercel-blob" : "local";

export async function saveFile(key: string, body: Buffer | string, contentType: string): Promise<string> {
  const data = typeof body === "string" ? Buffer.from(body) : body;

  if (useS3) {
    await getS3().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    const base = (process.env.S3_PUBLIC_URL || `${s3Endpoint}/${bucket}`).replace(/\/$/, "");
    return `${base}/${key}`;
  }

  if (useBlob) {
    const res = await put(key, data, { access: "public", contentType, addRandomSuffix: false, allowOverwrite: true });
    return res.url;
  }

  if (process.env.VERCEL) throw new Error("No storage configured (set Neon object storage or Vercel Blob env)");
  const file = path.join(LOCAL_ROOT, key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, data);
  return `/api/files/${key}`;
}

/** Reads a file we stored earlier (works for all backends). */
export async function loadFile(url: string, origin?: string): Promise<Buffer> {
  if (url.startsWith("/api/files/")) {
    const rel = decodeURIComponent(url.slice("/api/files/".length));
    return readLocalFile(rel);
  }
  const abs = url.startsWith("http") ? url : new URL(url, origin).toString();
  const res = await fetch(abs);
  if (!res.ok) throw new Error(`fetch ${abs} → ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function readLocalFile(rel: string): Promise<Buffer> {
  const file = path.normalize(path.join(LOCAL_ROOT, rel));
  if (!file.startsWith(LOCAL_ROOT)) throw new Error("invalid path");
  return readFile(file);
}
