CREATE TYPE "public"."intensity" AS ENUM('easy', 'moderate', 'hard');--> statement-breakpoint
CREATE TYPE "public"."workout_kind" AS ENUM('gym', 'activity');--> statement-breakpoint
CREATE TABLE "body_weight" (
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"kg" numeric(5, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "body_weight_user_date_pk" PRIMARY KEY("user_id","date")
);
--> statement-breakpoint
CREATE TABLE "workout" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"kind" "workout_kind" NOT NULL,
	"preset" text,
	"title" text NOT NULL,
	"activity" text,
	"intensity" "intensity" NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"duration_min" integer NOT NULL,
	"kcal_burned" integer NOT NULL,
	"kcal_basis" jsonb NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "workout_duration_range" CHECK ("workout"."duration_min" BETWEEN 0 AND 1440)
);
--> statement-breakpoint
CREATE TABLE "workout_exercise" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workout_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"exercise_key" text NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout_set" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exercise_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"weight_kg" numeric(6, 2),
	"reps" integer,
	"done" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "weekly_workout_goal" smallint DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "goal_weight_kg" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "body_weight" ADD CONSTRAINT "body_weight_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout" ADD CONSTRAINT "workout_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_exercise" ADD CONSTRAINT "workout_exercise_workout_id_workout_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workout"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_set" ADD CONSTRAINT "workout_set_exercise_id_workout_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."workout_exercise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workout_user_date_idx" ON "workout" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "workout_exercise_workout_idx" ON "workout_exercise" USING btree ("workout_id","position");--> statement-breakpoint
CREATE INDEX "workout_set_exercise_idx" ON "workout_set" USING btree ("exercise_id","position");--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "weekly_workout_goal_range" CHECK ("profile"."weekly_workout_goal" BETWEEN 1 AND 7);