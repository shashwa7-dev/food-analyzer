ALTER TABLE "profile" ADD COLUMN "height_cm" smallint;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "fitness_onboarded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "height_cm_range" CHECK ("profile"."height_cm" IS NULL OR "profile"."height_cm" BETWEEN 100 AND 250);--> statement-breakpoint
UPDATE "profile" SET "fitness_onboarded_at" = now()
WHERE "fitness_onboarded_at" IS NULL
  AND (EXISTS (SELECT 1 FROM "workout" w WHERE w."user_id" = "profile"."user_id")
       OR EXISTS (SELECT 1 FROM "body_weight" b WHERE b."user_id" = "profile"."user_id"));