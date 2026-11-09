// Runs Drizzle migrations against Neon. Called automatically before `next build`
// (so every Vercel deploy is migrated) and manually via `npm run db:migrate`.
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

const required = process.argv.includes("--required");
const url = process.env.DATABASE_URL;

if (!url) {
  if (required) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }
  console.log("[migrate] DATABASE_URL not set — skipping (local dev uses PGlite).");
  process.exit(0);
}

const db = drizzle({ client: neon(url) });
await migrate(db, { migrationsFolder: "./drizzle" });
console.log("[migrate] database is up to date");
