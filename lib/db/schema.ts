import { sql } from "drizzle-orm";
import {
  check, customType, date, index, integer, jsonb, pgEnum, pgTable, primaryKey, smallint, text, timestamp, uniqueIndex, uuid,
} from "drizzle-orm/pg-core";
import type { DailyTargets, Nutrients, Portion, Provenance, NutrientKey, ScoreComponent } from "@/lib/nutrition/types";
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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [check("credits_non_negative", sql`${t.credits} >= 0`)]);

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
  additives: text("additives").array().notNull().default(sql`'{}'::text[]`),
  categories: text("categories").array().notNull().default(sql`'{}'::text[]`),
  countries: text("countries").array().notNull().default(sql`'{}'::text[]`),
  nutriscoreSource: text("nutriscore_source"),
  nova: smallint("nova"),
  grade: text("grade"),
  gradeValue: smallint("grade_value"),
  gradeComponents: jsonb("grade_components").$type<ScoreComponent[]>().notNull().default(sql`'[]'::jsonb`),
  gradeVersion: text("grade_version").notNull(),
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

export const foodLog = pgTable("food_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  meal: mealEnum("meal").notNull(),
  foodId: uuid("food_id").references(() => food.id, { onDelete: "set null" }),
  scanId: uuid("scan_id"),
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
