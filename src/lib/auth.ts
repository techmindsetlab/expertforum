/**
 * Minimal operator auth for /admin and /print: one shared password,
 * stored as an HMAC token in an httpOnly cookie. Works in Proxy and Node.
 */
export const ADMIN_COOKIE = "ag_admin";

async function hmac(secret: string, message: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function adminConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD);
}

/** In dev without a password the operator pages stay open for convenience. */
export function adminOpen() {
  return !process.env.ADMIN_PASSWORD && process.env.NODE_ENV !== "production";
}

export async function adminToken() {
  return hmac(process.env.ADMIN_PASSWORD ?? "", "astragraphia-admin-v1");
}

export async function isAdminToken(token: string | undefined) {
  if (adminOpen()) return true;
  if (!process.env.ADMIN_PASSWORD || !token) return false;
  return token === (await adminToken());
}
