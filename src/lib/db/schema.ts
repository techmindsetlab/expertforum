import { boolean, index, integer, pgSequence, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** Public, contiguous number shown on the wall ("#12"). Assigned on submit. */
export const artworkNumberSeq = pgSequence("artwork_number_seq", { startWith: 1 });

const ts = (name: string) => timestamp(name, { withTimezone: true });

export const artworks = pgTable(
  "artworks",
  {
    id: text("id").primaryKey(),
    number: integer("number").unique(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    marketingOptIn: boolean("marketing_opt_in").notNull().default(false),
    locale: text("locale").notNull().default("id"),
    kioskId: text("kiosk_id"),
    /** draft → submitted */
    status: text("status").notNull().default("draft"),
    hidden: boolean("hidden").notNull().default(false),
    sketchUrl: text("sketch_url"),
    strokesUrl: text("strokes_url"),
    /** Selected generation, copied here on submit */
    generationId: text("generation_id"),
    artUrl: text("art_url"),
    artMdUrl: text("art_md_url"),
    artSmUrl: text("art_sm_url"),
    attempts: integer("attempts").notNull().default(0),
    emailedAt: ts("emailed_at"),
    emailError: text("email_error"),
    printCount: integer("print_count").notNull().default(0),
    printedAt: ts("printed_at"),
    /** 95 × 110 mm labels from the second printer */
    labelCount: integer("label_count").notNull().default(0),
    createdAt: ts("created_at").notNull().defaultNow(),
    submittedAt: ts("submitted_at"),
  },
  (t) => [index("artworks_status_idx").on(t.status, t.hidden)],
);

export const generations = pgTable(
  "generations",
  {
    id: text("id").primaryKey(),
    artworkId: text("artwork_id")
      .notNull()
      .references(() => artworks.id, { onDelete: "cascade" }),
    attempt: integer("attempt").notNull(),
    model: text("model").notNull(),
    /** Kiosk style the visitor picked (lib/styles.ts) */
    style: text("style"),
    /** ok | fallback | blocked | error */
    status: text("status").notNull(),
    imageUrl: text("image_url"),
    mdUrl: text("md_url"),
    smUrl: text("sm_url"),
    latencyMs: integer("latency_ms"),
    error: text("error"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("generations_artwork_idx").on(t.artworkId)],
);

export type Artwork = typeof artworks.$inferSelect;
export type Generation = typeof generations.$inferSelect;
