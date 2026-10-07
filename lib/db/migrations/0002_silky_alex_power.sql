CREATE TYPE "public"."confidence" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."credit_txn_type" AS ENUM('grant', 'debit', 'refund', 'expire', 'purchase');--> statement-breakpoint
CREATE TYPE "public"."scan_input_kind" AS ENUM('barcode', 'label', 'front', 'meal');--> statement-breakpoint
CREATE TYPE "public"."scan_status" AS ENUM('queued', 'processing', 'done', 'failed');--> statement-breakpoint
CREATE TABLE "credit_txn" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"amount" integer NOT NULL,
	"type" "credit_txn_type" NOT NULL,
	"idempotency_key" text NOT NULL,
	"balance_after" integer NOT NULL,
	"scan_id" uuid,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_txn_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "scan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"status" "scan_status" NOT NULL,
	"input_kind" "scan_input_kind",
	"barcode" text,
	"image_count" smallint DEFAULT 0 NOT NULL,
	"food_id" uuid,
	"result" jsonb,
	"confidence" "confidence",
	"error_code" text,
	"thumbnail_key" text,
	"engine_version" text NOT NULL,
	"model_id" text,
	"tokens_in" integer,
	"tokens_out" integer,
	"cost_micros" integer,
	"charged" boolean DEFAULT false NOT NULL,
	"client_request_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"done_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "waitlist" (
	"user_id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "food" ADD COLUMN "may_contain" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "credit_txn" ADD CONSTRAINT "credit_txn_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_txn" ADD CONSTRAINT "credit_txn_scan_id_scan_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scan"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan" ADD CONSTRAINT "scan_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan" ADD CONSTRAINT "scan_food_id_food_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."food"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist" ADD CONSTRAINT "waitlist_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credit_txn_user_created_idx" ON "credit_txn" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "scan_user_created_idx" ON "scan" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "scan_created_idx" ON "scan" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "scan_user_client_request_uq" ON "scan" USING btree ("user_id","client_request_id");--> statement-breakpoint
ALTER TABLE "food_log" ADD CONSTRAINT "food_log_scan_id_scan_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scan"("id") ON DELETE set null ON UPDATE no action;