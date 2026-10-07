CREATE TABLE "credit_tombstone" (
	"email_hash" text PRIMARY KEY NOT NULL,
	"period" text NOT NULL,
	"used" integer NOT NULL,
	"day" date NOT NULL,
	"day_scans" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "carried_day" date;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "carried_day_scans" integer DEFAULT 0 NOT NULL;