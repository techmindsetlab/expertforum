import { NAME_MAX } from "./config";

/** Small ID + EN blocklist; operators can still hide anything from /admin. */
const BLOCKED = [
  "anjing", "anjg", "bangsat", "bajingan", "kontol", "memek", "ngentot", "ngewe", "jancok", "jancuk",
  "goblok", "tolol", "babi", "asu", "pepek", "titit", "peler", "lonte", "perek", "pelacur",
  "fuck", "shit", "bitch", "dick", "pussy", "cunt", "nigger", "nigga", "whore", "slut", "porn", "sex",
];

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s" };

export function normalizeName(raw: string) {
  return raw.replace(/\s+/g, " ").trim().slice(0, NAME_MAX);
}

export function isNameAllowed(name: string) {
  const flat = name
    .toLowerCase()
    .split("")
    .map((c) => LEET[c] ?? c)
    .join("")
    .replace(/[^a-z]/g, "");
  return !BLOCKED.some((w) => flat.includes(w));
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

export function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  if (!domain) return email;
  const keep = user.slice(0, Math.min(3, Math.max(1, user.length - 2)));
  return `${keep}${"•".repeat(Math.max(2, user.length - keep.length))}@${domain}`;
}
