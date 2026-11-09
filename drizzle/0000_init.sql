CREATE SEQUENCE "public"."artwork_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "artworks" (
	"id" text PRIMARY KEY NOT NULL,
	"number" integer,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"marketing_opt_in" boolean DEFAULT false NOT NULL,
	"locale" text DEFAULT 'id' NOT NULL,
	"kiosk_id" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"sketch_url" text,
	"strokes_url" text,
	"generation_id" text,
	"art_url" text,
	"art_md_url" text,
	"art_sm_url" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"emailed_at" timestamp with time zone,
	"email_error" text,
	"print_count" integer DEFAULT 0 NOT NULL,
	"printed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	CONSTRAINT "artworks_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "generations" (
	"id" text PRIMARY KEY NOT NULL,
	"artwork_id" text NOT NULL,
	"attempt" integer NOT NULL,
	"model" text NOT NULL,
	"status" text NOT NULL,
	"image_url" text,
	"md_url" text,
	"sm_url" text,
	"latency_ms" integer,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generations" ADD CONSTRAINT "generations_artwork_id_artworks_id_fk" FOREIGN KEY ("artwork_id") REFERENCES "public"."artworks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "artworks_status_idx" ON "artworks" USING btree ("status","hidden");--> statement-breakpoint
CREATE INDEX "generations_artwork_idx" ON "generations" USING btree ("artwork_id");