import "server-only";
import { and, asc, desc, eq, gt, sql } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { derivatives, reimagine } from "./ai/generate";
import { MAX_ATTEMPTS } from "./config";
import { getDb, schema } from "./db";
import type { Artwork } from "./db/schema";
import { HttpError } from "./http";
import { loadFile, saveFile } from "./storage";
import { DEFAULT_STYLE, type StyleId } from "./styles";

const { artworks, generations } = schema;
const newId = customAlphabet("23456789abcdefghijkmnpqrstuvwxyz", 12);

export type PublicArtwork = {
  id: string;
  number: number;
  name: string;
  locale: string;
  art: string; // 1080 jpeg
  artFull: string; // full png (print)
  thumb: string; // 480 jpeg
  sketch: string | null;
  strokes: string | null;
  submittedAt: string | null;
};

export function toPublic(a: Artwork): PublicArtwork {
  return {
    id: a.id,
    number: a.number ?? 0,
    name: a.name,
    locale: a.locale,
    art: a.artMdUrl ?? a.artUrl ?? "",
    artFull: a.artUrl ?? "",
    thumb: a.artSmUrl ?? a.artMdUrl ?? "",
    sketch: a.sketchUrl,
    strokes: a.strokesUrl,
    submittedAt: a.submittedAt?.toISOString() ?? null,
  };
}

function decodeDataUrl(dataUrl: string) {
  const m = /^data:image\/png;base64,(.+)$/.exec(dataUrl);
  if (!m) throw new HttpError(400, "Sketch must be a PNG data URL");
  const buf = Buffer.from(m[1], "base64");
  if (buf.length > 4_000_000) throw new HttpError(413, "Sketch too large");
  return buf;
}

async function saveSketch(id: string, sketchDataUrl: string, strokes: unknown) {
  const v = Date.now().toString(36);
  const [sketchUrl, strokesUrl] = await Promise.all([
    saveFile(`sketch/${id}-${v}.png`, decodeDataUrl(sketchDataUrl), "image/png"),
    saveFile(`strokes/${id}-${v}.json`, JSON.stringify(strokes), "application/json"),
  ]);
  return { sketchUrl, strokesUrl };
}

export async function createArtwork(input: {
  name: string;
  email: string;
  marketingOptIn: boolean;
  locale: string;
  kioskId?: string;
  sketch: string;
  strokes: unknown;
}) {
  const db = await getDb();
  const id = newId();
  const files = await saveSketch(id, input.sketch, input.strokes);
  await db.insert(artworks).values({
    id,
    name: input.name,
    email: input.email.toLowerCase(),
    marketingOptIn: input.marketingOptIn,
    locale: input.locale,
    kioskId: input.kioskId,
    ...files,
  });
  return id;
}

async function getArtwork(id: string) {
  const db = await getDb();
  const [row] = await db.select().from(artworks).where(eq(artworks.id, id)).limit(1);
  if (!row) throw new HttpError(404, "Artwork not found");
  return row;
}

export async function generateForArtwork(id: string, redraw?: { sketch: string; strokes: unknown }, origin?: string, style: StyleId = DEFAULT_STYLE) {
  const db = await getDb();
  let art = await getArtwork(id);
  if (art.status !== "draft") throw new HttpError(409, "Artwork already submitted");
  if (art.attempts >= MAX_ATTEMPTS) throw new HttpError(429, "No attempts left", "no_attempts");

  if (redraw) {
    const files = await saveSketch(id, redraw.sketch, redraw.strokes);
    await db.update(artworks).set(files).where(eq(artworks.id, id));
    art = { ...art, ...files };
  }

  // Reserve the attempt first so parallel taps cannot exceed the limit. Only a
  // paid AI image keeps it: a moderation block, the paper fallback or an error
  // hands it back, so the visitor can still try again.
  const attempt = art.attempts + 1;
  await db.update(artworks).set({ attempts: attempt }).where(eq(artworks.id, id));
  const refund = () =>
    db
      .update(artworks)
      .set({ attempts: sql`greatest(${artworks.attempts} - 1, 0)` })
      .where(eq(artworks.id, id));

  try {
    const sketch = await loadFile(art.sketchUrl!, origin);
    // Public sketch URL lets Higgsfield fetch it directly (no re-upload).
    const result = await reimagine(sketch, art.sketchUrl!.startsWith("http") ? art.sketchUrl! : undefined, style);
    const genId = newId();

    if (result.status === "blocked") {
      await db.insert(generations).values({
        id: genId,
        artworkId: id,
        attempt,
        model: result.model,
        style,
        status: "blocked",
        latencyMs: result.latencyMs,
        error: result.error,
      });
      await refund();
      return { id: genId, status: "blocked" as const, attemptsLeft: MAX_ATTEMPTS - attempt + 1 };
    }

    const { md, sm } = await derivatives(result.image);
    const base = `art/${id}/${genId}`;
    const [imageUrl, mdUrl, smUrl] = await Promise.all([
      saveFile(`${base}.png`, result.image, "image/png"),
      saveFile(`${base}-md.jpg`, md, "image/jpeg"),
      saveFile(`${base}-sm.jpg`, sm, "image/jpeg"),
    ]);
    await db.insert(generations).values({
      id: genId,
      artworkId: id,
      attempt,
      model: result.model,
      style,
      status: result.status,
      imageUrl,
      mdUrl,
      smUrl,
      latencyMs: result.latencyMs,
      error: result.error,
    });
    const paid = result.status === "ok";
    if (!paid) await refund();
    return {
      id: genId,
      status: result.status,
      image: mdUrl,
      attemptsLeft: MAX_ATTEMPTS - attempt + (paid ? 0 : 1),
    };
  } catch (err) {
    await refund().catch(() => {});
    throw err;
  }
}

export async function submitArtwork(id: string, generationId: string) {
  const db = await getDb();
  const art = await getArtwork(id);
  if (art.status === "submitted") return { number: art.number!, already: true };

  const [gen] = await db
    .select()
    .from(generations)
    .where(and(eq(generations.id, generationId), eq(generations.artworkId, id)))
    .limit(1);
  if (!gen || !gen.imageUrl) throw new HttpError(400, "Generation not usable");

  const [row] = await db
    .update(artworks)
    .set({
      status: "submitted",
      generationId,
      artUrl: gen.imageUrl,
      artMdUrl: gen.mdUrl,
      artSmUrl: gen.smUrl,
      number: sql`nextval('artwork_number_seq')`,
      submittedAt: new Date(),
    })
    .where(and(eq(artworks.id, id), eq(artworks.status, "draft")))
    .returning({ number: artworks.number });
  if (!row) return { number: (await getArtwork(id)).number!, already: true };
  return { number: row.number!, already: false };
}

export async function getPublicArtwork(id: string) {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(artworks)
    .where(and(eq(artworks.id, id), eq(artworks.status, "submitted"), eq(artworks.hidden, false)))
    .limit(1);
  return row ?? null;
}

/** Wall feed: newest `limit` on first load, then everything after `after`. */
export async function listWall(after: number | null, limit = 160) {
  const db = await getDb();
  const visible = and(eq(artworks.status, "submitted"), eq(artworks.hidden, false));
  if (after != null) {
    const rows = await db
      .select()
      .from(artworks)
      .where(and(visible, gt(artworks.number, after)))
      .orderBy(asc(artworks.number))
      .limit(50);
    return rows.map(toPublic);
  }
  const rows = await db.select().from(artworks).where(visible).orderBy(desc(artworks.number)).limit(limit);
  return rows.reverse().map(toPublic);
}

export async function wallStats() {
  const db = await getDb();
  const [row] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(artworks)
    .where(and(eq(artworks.status, "submitted"), eq(artworks.hidden, false)));
  return { total: row?.total ?? 0 };
}

export async function hiddenNumbers() {
  const db = await getDb();
  const rows = await db
    .select({ number: artworks.number })
    .from(artworks)
    .where(and(eq(artworks.status, "submitted"), eq(artworks.hidden, true)));
  return rows.map((r) => r.number!).filter(Boolean);
}

// ─── Operator ──────────────────────────────────────────────────────

export async function listForAdmin(limit = 500) {
  const db = await getDb();
  return db.select().from(artworks).where(eq(artworks.status, "submitted")).orderBy(desc(artworks.number)).limit(limit);
}

export async function adminStats() {
  const db = await getDb();
  const [row] = await db
    .select({
      submitted: sql<number>`count(*) filter (where ${artworks.status} = 'submitted')::int`,
      drafts: sql<number>`count(*) filter (where ${artworks.status} = 'draft')::int`,
      printed: sql<number>`count(*) filter (where ${artworks.printCount} > 0)::int`,
      labeled: sql<number>`count(*) filter (where ${artworks.labelCount} > 0)::int`,
      emailed: sql<number>`count(*) filter (where ${artworks.emailedAt} is not null)::int`,
      optIn: sql<number>`count(*) filter (where ${artworks.marketingOptIn} and ${artworks.status} = 'submitted')::int`,
      today: sql<number>`count(*) filter (where ${artworks.status} = 'submitted' and (${artworks.submittedAt} at time zone 'Asia/Jakarta')::date = (now() at time zone 'Asia/Jakarta')::date)::int`,
    })
    .from(artworks);
  const [gen] = await db
    .select({
      total: sql<number>`count(*)::int`,
      fallback: sql<number>`count(*) filter (where ${generations.status} = 'fallback')::int`,
      blocked: sql<number>`count(*) filter (where ${generations.status} = 'blocked')::int`,
      avgMs: sql<number>`coalesce(avg(${generations.latencyMs}) filter (where ${generations.status} = 'ok'), 0)::int`,
    })
    .from(generations);
  return { ...row, generations: gen };
}

export async function setHidden(id: string, hidden: boolean) {
  const db = await getDb();
  await db.update(artworks).set({ hidden }).where(eq(artworks.id, id));
}

export async function markPrinted(id: string) {
  const db = await getDb();
  await db
    .update(artworks)
    .set({ printCount: sql`${artworks.printCount} + 1`, printedAt: new Date() })
    .where(eq(artworks.id, id));
}

export async function markLabelPrinted(id: string) {
  const db = await getDb();
  await db
    .update(artworks)
    .set({ labelCount: sql`${artworks.labelCount} + 1` })
    .where(eq(artworks.id, id));
}

export async function markEmailed(id: string, error: string | null) {
  const db = await getDb();
  await db
    .update(artworks)
    .set(error ? { emailError: error.slice(0, 500) } : { emailedAt: new Date(), emailError: null })
    .where(eq(artworks.id, id));
}

export async function getArtworkForOperator(id: string) {
  return getArtwork(id);
}
