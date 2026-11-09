import "server-only";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export type DB = NeonHttpDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __db?: Promise<DB> };

/**
 * Production → Neon over HTTP (serverless friendly).
 * Local dev without DATABASE_URL → embedded PGlite persisted in ./.data/pglite,
 * migrated automatically, so the whole flow runs offline with zero setup.
 */
async function create(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  if (url) return drizzleNeon({ client: neon(url), schema });

  if (process.env.VERCEL) throw new Error("DATABASE_URL is not set");

  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dir = path.join(process.cwd(), ".data", "pglite");
  // A fresh checkout has no .data yet and PGlite only creates the last folder.
  (await import("node:fs")).mkdirSync(path.dirname(dir), { recursive: true });
  const client = new PGlite(dir);
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  // Both drivers expose the same query builder surface that we use.
  return db as unknown as DB;
}

export function getDb(): Promise<DB> {
  globalForDb.__db ??= create().catch((err) => {
    globalForDb.__db = undefined;
    throw err;
  });
  return globalForDb.__db;
}

export { schema };
