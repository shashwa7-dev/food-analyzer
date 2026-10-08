import { sql } from "drizzle-orm";
import {
  boolean, check, customType, date, index, integer, jsonb, numeric, pgEnum, pgTable, primaryKey, smallint, text, timestamp, uniqueIndex, uuid,
} from "drizzle-orm/pg-core";
import type { DailyTargets, Nutrients, Portion, Provenance, NutrientKey, ScoreComponent } from "@/lib/nutrition/types";
import type { Activity, KcalBasis, Preset } from "@/lib/fitness/types";
import { user } from "./auth-schema";

const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });

export const dietEnum = pgEnum("diet", ["none", "vegetarian", "eggetarian", "vegan", "jain"]);
export const goalEnum = pgEnum("goal", ["general", "weight_loss", "muscle", "low_sugar", "low_sodium"]);
export const planEnum = pgEnum("plan", ["basic", "pro"]);
export const foodSourceEnum = pgEnum("food_source", ["indb", "fndds", "off", "crowd", "custom"]);
export const foodKindEnum = pgEnum("food_kind", ["dish", "generic", "packaged", "ingredient"]);
export const gradeCategoryEnum = pgEnum("grade_category", ["general", "beverage", "water", "fat_oil", "cheese", "dish", "none"]);
export const basisEnum = pgEnum("basis", ["per_100g", "per_100ml"]);
export const mealEnum = pgEnum("meal", ["breakfast", "lunch", "dinner", "snack"]);
export const scanStatusEnum = pgEnum("scan_status", ["queued", "processing", "done", "failed"]);
export const scanInputKindEnum = pgEnum("scan_input_kind", ["barcode", "label", "front", "meal"]);
export const creditTxnTypeEnum = pgEnum("credit_txn_type", ["grant", "debit", "refund", "expire", "purchase"]);
export const confidenceEnum = pgEnum("confidence", ["high", "medium", "low"]);
export const workoutKindEnum = pgEnum("workout_kind", ["gym", "activity"]);
export const intensityEnum = pgEnum("intensity", ["easy", "moderate", "hard"]);

/** Dismissed one-time notices, keyed by notice. */
export type ProfileNotices = { targetsReset?: boolean };

export const profile = pgTable("profile", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  country: text("country").notNull().default("IN"),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  diet: dietEnum("diet").notNull().default("none"),
  allergies: text("allergies").array().notNull().default(sql`'{}'::text[]`),
  goal: goalEnum("goal").notNull().default("general"),
  targets: jsonb("targets").$type<Partial<DailyTargets>>(),
  onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
  plan: planEnum("plan").notNull().default("basic"),
  credits: integer("credits").notNull().default(0),
  allowancePeriod: text("allowance_period"),
  /** Charged scans carried over from a deleted account with this email (credit_tombstone), counting toward this UTC day's cap. */
  carriedDay: date("carried_day"),
  carriedDayScans: integer("carried_day_scans").notNull().default(0),
  /** One-time notices the user has dismissed (spec §B): `targetsReset` for "Custom targets are now part of Pro". */
  notices: jsonb("notices").$type<ProfileNotices>().notNull().default({}),
  /** Days a week the user aims to train (spec §C), 1–7. */
  weeklyWorkoutGoal: smallint("weekly_workout_goal").notNull().default(3),
  goalWeightKg: numeric("goal_weight_kg", { precision: 5, scale: 2, mode: "number" }),
  /** Optional, from the Workouts setup or Me → Fitness (spec "First-visit setup"); stored only for now. */
  heightCm: smallint("height_cm"),
  /** Set when the Workouts setup is finished or skipped; null shows the setup on /workouts. */
  fitnessOnboardedAt: timestamp("fitness_onboarded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check("credits_non_negative", sql`${t.credits} >= 0`),
  check("weekly_workout_goal_range", sql`${t.weeklyWorkoutGoal} BETWEEN 1 AND 7`),
  check("height_cm_range", sql`${t.heightCm} IS NULL OR ${t.heightCm} BETWEEN 100 AND 250`),
]);

export const food = pgTable("food", {
  id: uuid("id").primaryKey().defaultRandom(),
  source: foodSourceEnum("source").notNull(),
  sourceRef: text("source_ref"),
  ownerId: text("owner_id").references(() => user.id, { onDelete: "cascade" }),
  kind: foodKindEnum("kind").notNull(),
  gradeCategory: gradeCategoryEnum("grade_category").notNull(),
  name: text("name").notNull(),
  brand: text("brand"),
  aliases: text("aliases").array().notNull().default(sql`'{}'::text[]`),
  barcode: text("barcode"),
  basis: basisEnum("basis").notNull().default("per_100g"),
  per100: jsonb("per100").$type<Nutrients>().notNull(),
  provenance: jsonb("provenance").$type<Partial<Record<NutrientKey, Provenance>>>().notNull(),
  portions: jsonb("portions").$type<Portion[]>().notNull(),
  defaultPortion: smallint("default_portion").notNull().default(0),
  gradePortionGrams: smallint("grade_portion_grams"),
  ingredients: text("ingredients").array().notNull().default(sql`'{}'::text[]`),
  allergens: text("allergens").array().notNull().default(sql`'{}'::text[]`),
  mayContain: text("may_contain").array().notNull().default(sql`'{}'::text[]`),
  additives: text("additives").array().notNull().default(sql`'{}'::text[]`),
  categories: text("categories").array().notNull().default(sql`'{}'::text[]`),
  countries: text("countries").array().notNull().default(sql`'{}'::text[]`),
  nutriscoreSource: text("nutriscore_source"),
  nova: smallint("nova"),
  grade: text("grade"),
  gradeValue: smallint("grade_value"),
  gradeComponents: jsonb("grade_components").$type<ScoreComponent[]>().notNull().default(sql`'[]'::jsonb`),
  gradeVersion: text("grade_version").notNull(),
  /** Set on foods saved from a scan (Task 9): the grade is a snapshot of the scan result (ScanResult
   * carries no additives/NOVA/OFF-categories), so `scripts/regrade.ts` must never recompute it on a
   * GRADE_VERSION bump — it would silently produce a different, less accurate grade. */
  gradeFrozen: boolean("grade_frozen").notNull().default(false),
  imageUrl: text("image_url"),
  popularity: integer("popularity").notNull().default(0),
  normName: text("norm_name").notNull(),
  normBrand: text("norm_brand").notNull().default(""),
  searchName: text("search_name").notNull(),
  searchText: tsvector("search_text").notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("food_source_ref_uq").on(t.source, t.sourceRef),
  uniqueIndex("food_barcode_uq").on(t.barcode),
  uniqueIndex("food_crowd_dedupe_uq").on(t.source, t.normName, t.normBrand).where(sql`${t.barcode} IS NULL AND ${t.source} = 'crowd'`),
  index("food_search_text_gin").using("gin", t.searchText),
  index("food_search_name_trgm").using("gin", t.searchName.op("gin_trgm_ops")),
  index("food_owner_idx").on(t.ownerId),
  index("food_categories_gin").using("gin", t.categories),
  index("food_countries_gin").using("gin", t.countries),
]);

export const scan = pgTable("scan", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  status: scanStatusEnum("status").notNull(),
  inputKind: scanInputKindEnum("input_kind"),
  barcode: text("barcode"),
  imageCount: smallint("image_count").notNull().default(0),
  foodId: uuid("food_id").references(() => food.id, { onDelete: "set null" }),
  result: jsonb("result").$type<import("@/lib/engine/result").ScanResult>(),
  confidence: confidenceEnum("confidence"),
  errorCode: text("error_code"),
  /** The engine's own user-safe sentence when more specific than the code's fixed message (lib/scans/messages.ts). */
  errorMessage: text("error_message"),
  /** R2 key of the 320 px thumbnail (lib/storage/keys.ts); kept until the scan is deleted. */
  thumbnailKey: text("thumbnail_key"),
  /** Display copies stored on R2 (display/u/{userId}/{scanId}/{1..n}.webp); 0 when none were stored. */
  photoCount: integer("photo_count").notNull().default(0),
  /** When the display copies expire (the bucket's 30-day `display/` lifecycle rule); null when none. */
  photosExpireAt: timestamp("photos_expire_at", { withTimezone: true }),
  engineVersion: text("engine_version").notNull(),
  modelId: text("model_id"),
  tokensIn: integer("tokens_in"),
  tokensOut: integer("tokens_out"),
  costMicros: integer("cost_micros"),
  charged: boolean("charged").notNull().default(false),
  clientRequestId: text("client_request_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  doneAt: timestamp("done_at", { withTimezone: true }),
  /** Soft delete: hidden from the user, but still counted by rate limits, daily caps and daily_ai_cost. */
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => [
  index("scan_user_created_idx").on(t.userId, t.createdAt),
  index("scan_created_idx").on(t.createdAt),
  uniqueIndex("scan_user_client_request_uq").on(t.userId, t.clientRequestId),
]);

export const creditTxn = pgTable("credit_txn", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  type: creditTxnTypeEnum("type").notNull(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  balanceAfter: integer("balance_after").notNull(),
  scanId: uuid("scan_id").references(() => scan.id, { onDelete: "set null" }),
  meta: jsonb("meta").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("credit_txn_user_created_idx").on(t.userId, t.createdAt)]);

/**
 * Survives account deletion (no FK to user): deleting the account and signing up again with the same
 * email must not reset this month's AI scans or today's daily cap. No plain PII — the key is an HMAC of
 * the normalised email (lib/credits/tombstone.ts).
 */
export const creditTombstone = pgTable("credit_tombstone", {
  emailHash: text("email_hash").primaryKey(),
  /** "YYYY-MM": the allowance period `used` belongs to. */
  period: text("period").notNull(),
  used: integer("used").notNull(),
  /** UTC day `dayScans` (charged scans, refunded ones included) belongs to. */
  day: date("day").notNull(),
  dayScans: integer("day_scans").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const waitlist = pgTable("waitlist", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const foodLog = pgTable("food_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  meal: mealEnum("meal").notNull(),
  foodId: uuid("food_id").references(() => food.id, { onDelete: "set null" }),
  scanId: uuid("scan_id").references(() => scan.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  portion: jsonb("portion").$type<Portion>().notNull(),
  nutrients: jsonb("nutrients").$type<Nutrients>().notNull(),
  grade: text("grade"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("food_log_user_date_idx").on(t.userId, t.date)]);

export const userFoodStats = pgTable("user_food_stats", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  foodId: uuid("food_id").notNull().references(() => food.id, { onDelete: "cascade" }),
  uses: integer("uses").notNull().default(0),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.userId, t.foodId] })]);

/**
 * A gym session or an activity (spec §C). `date` is the user's local day. `kcal_burned` is computed on
 * the server from `kcal_basis` (MET, the weight used, whether that weight was the 70 kg estimate).
 * Soft delete: `deleted_at` hides the workout everywhere (lists, PRs, previous values, exports).
 */
export const workout = pgTable("workout", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  kind: workoutKindEnum("kind").notNull(),
  preset: text("preset").$type<Preset>(),
  title: text("title").notNull(),
  activity: text("activity").$type<Activity>(),
  intensity: intensityEnum("intensity").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  durationMin: integer("duration_min").notNull(),
  kcalBurned: integer("kcal_burned").notNull(),
  kcalBasis: jsonb("kcal_basis").$type<KcalBasis>().notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => [
  index("workout_user_date_idx").on(t.userId, t.date),
  check("workout_duration_range", sql`${t.durationMin} BETWEEN 0 AND 1440`),
]);

export const workoutExercise = pgTable("workout_exercise", {
  id: uuid("id").primaryKey().defaultRandom(),
  workoutId: uuid("workout_id").notNull().references(() => workout.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  /** A catalogue key (lib/fitness/catalogue.ts) or `custom:<slug>` for one added by name. */
  exerciseKey: text("exercise_key").notNull(),
  name: text("name").notNull(),
}, (t) => [index("workout_exercise_workout_idx").on(t.workoutId, t.position)]);

export const workoutSet = pgTable("workout_set", {
  id: uuid("id").primaryKey().defaultRandom(),
  exerciseId: uuid("exercise_id").notNull().references(() => workoutExercise.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  weightKg: numeric("weight_kg", { precision: 6, scale: 2, mode: "number" }),
  reps: integer("reps"),
  /** Only done sets count toward volume and PRs. */
  done: boolean("done").notNull().default(false),
}, (t) => [index("workout_set_exercise_idx").on(t.exerciseId, t.position)]);

/** One weigh-in per user per local day; logging again that day replaces it. */
export const bodyWeight = pgTable("body_weight", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  kg: numeric("kg", { precision: 5, scale: 2, mode: "number" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ name: "body_weight_user_date_pk", columns: [t.userId, t.date] })]);
