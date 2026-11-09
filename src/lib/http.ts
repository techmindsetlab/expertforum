import "server-only";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export function jsonError(err: unknown) {
  if (err instanceof HttpError) {
    return Response.json({ error: err.message, code: err.code }, { status: err.status });
  }
  console.error(err);
  return Response.json({ error: "Internal error" }, { status: 500 });
}

/** Public base URL used in emails, QR codes and OG cards. */
export function publicOrigin(req?: Request) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (req) return new URL(req.url).origin;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export function absolute(url: string, origin: string) {
  return url.startsWith("http") ? url : `${origin}${url}`;
}

/** Kiosk endpoints are protected by a shared key stored on each tablet. */
export function assertKiosk(req: Request) {
  const expected = process.env.KIOSK_KEY;
  if (!expected) return;
  if (req.headers.get("x-kiosk-key") !== expected) throw new HttpError(401, "Kiosk key invalid", "kiosk_key");
}
