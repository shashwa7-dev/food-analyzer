ALTER TABLE "scan" ADD COLUMN "photo_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "scan" ADD COLUMN "photos_expire_at" timestamp with time zone;