CREATE TYPE "public"."basis" AS ENUM('per_100g', 'per_100ml');--> statement-breakpoint
CREATE TYPE "public"."diet" AS ENUM('none', 'vegetarian', 'eggetarian', 'vegan', 'jain');--> statement-breakpoint
CREATE TYPE "public"."food_kind" AS ENUM('dish', 'generic', 'packaged', 'ingredient');--> statement-breakpoint
CREATE TYPE "public"."food_source" AS ENUM('indb', 'fndds', 'off', 'crowd', 'custom');--> statement-breakpoint
CREATE TYPE "public"."goal" AS ENUM('general', 'weight_loss', 'muscle', 'low_sugar', 'low_sodium');--> statement-breakpoint
CREATE TYPE "public"."grade_category" AS ENUM('general', 'beverage', 'water', 'fat_oil', 'cheese', 'dish', 'none');--> statement-breakpoint
CREATE TYPE "public"."meal" AS ENUM('breakfast', 'lunch', 'dinner', 'snack');--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('basic', 'pro');--> statement-breakpoint
CREATE TABLE "food" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "food_source" NOT NULL,
	"source_ref" text,
	"owner_id" text,
	"kind" "food_kind" NOT NULL,
	"grade_category" "grade_category" NOT NULL,
	"name" text NOT NULL,
	"brand" text,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL,
	"barcode" text,
	"basis" "basis" DEFAULT 'per_100g' NOT NULL,
	"per100" jsonb NOT NULL,
	"provenance" jsonb NOT NULL,
	"portions" jsonb NOT NULL,
	"default_portion" smallint DEFAULT 0 NOT NULL,
	"grade_portion_grams" smallint,
	"ingredients" text[] DEFAULT '{}'::text[] NOT NULL,
	"allergens" text[] DEFAULT '{}'::text[] NOT NULL,
	"additives" text[] DEFAULT '{}'::text[] NOT NULL,
	"categories" text[] DEFAULT '{}'::text[] NOT NULL,
	"countries" text[] DEFAULT '{}'::text[] NOT NULL,
	"nutriscore_source" text,
	"nova" smallint,
	"grade" text,
	"grade_value" smallint,
	"grade_components" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"grade_version" text NOT NULL,
	"image_url" text,
	"popularity" integer DEFAULT 0 NOT NULL,
	"norm_name" text NOT NULL,
	"norm_brand" text DEFAULT '' NOT NULL,
	"search_name" text NOT NULL,
	"search_text" "tsvector" NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "food_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"meal" "meal" NOT NULL,
	"food_id" uuid,
	"scan_id" uuid,
	"name" text NOT NULL,
	"portion" jsonb NOT NULL,
	"nutrients" jsonb NOT NULL,
	"grade" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"country" text DEFAULT 'IN' NOT NULL,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"diet" "diet" DEFAULT 'none' NOT NULL,
	"allergies" text[] DEFAULT '{}'::text[] NOT NULL,
	"goal" "goal" DEFAULT 'general' NOT NULL,
	"targets" jsonb,
	"onboarded_at" timestamp with time zone,
	"plan" "plan" DEFAULT 'basic' NOT NULL,
	"credits" integer DEFAULT 0 NOT NULL,
	"allowance_period" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credits_non_negative" CHECK ("profile"."credits" >= 0)
);
--> statement-breakpoint
CREATE TABLE "user_food_stats" (
	"user_id" text NOT NULL,
	"food_id" uuid NOT NULL,
	"uses" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_food_stats_user_id_food_id_pk" PRIMARY KEY("user_id","food_id")
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "food" ADD CONSTRAINT "food_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_log" ADD CONSTRAINT "food_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_log" ADD CONSTRAINT "food_log_food_id_food_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."food"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_food_stats" ADD CONSTRAINT "user_food_stats_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_food_stats" ADD CONSTRAINT "user_food_stats_food_id_food_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."food"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "food_source_ref_uq" ON "food" USING btree ("source","source_ref");--> statement-breakpoint
CREATE UNIQUE INDEX "food_barcode_uq" ON "food" USING btree ("barcode");--> statement-breakpoint
CREATE UNIQUE INDEX "food_crowd_dedupe_uq" ON "food" USING btree ("source","norm_name","norm_brand") WHERE "food"."barcode" IS NULL AND "food"."source" = 'crowd';--> statement-breakpoint
CREATE INDEX "food_search_text_gin" ON "food" USING gin ("search_text");--> statement-breakpoint
CREATE INDEX "food_search_name_trgm" ON "food" USING gin ("search_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "food_owner_idx" ON "food" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "food_categories_gin" ON "food" USING gin ("categories");--> statement-breakpoint
CREATE INDEX "food_countries_gin" ON "food" USING gin ("countries");--> statement-breakpoint
CREATE INDEX "food_log_user_date_idx" ON "food_log" USING btree ("user_id","date");