import { and, arrayOverlaps, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { food, userFoodStats } from "@/lib/db/schema";
import { visibleFoodWhere } from "@/lib/authz";
import { classify } from "@/lib/nutrition/classify";
import { explain } from "@/lib/nutrition/explain";
import { gradeFood, GRADE_VERSION } from "@/lib/nutrition/grade";
import { personalise } from "@/lib/nutrition/personalise";
import { ensureBasePortion, nutrientsFor, scaleNutrients } from "@/lib/nutrition/portions";
import { targetsFor } from "@/lib/nutrition/targets";
import { NUTRIENT_KEYS, type Flag, type Grade, type GradeResult, type Nutrients, type Portion, type Reason } from "@/lib/nutrition/types";
import { getProfile } from "@/lib/profile/service";
import { buildSearchFields, canonicalQuery, normalise } from "./normalise";
import type { FoodHit } from "./types";

export type { FoodHit };
export type FoodRow = typeof food.$inferSelect;

export function toHit(f: Pick<FoodRow, "id" | "name" | "brand" | "kind" | "grade" | "source" | "portions" | "defaultPortion" | "per100">): FoodHit {
  const p = f.portions[f.defaultPortion] ?? f.portions[0]!;
  return { id: f.id, name: f.name, brand: f.brand, kind: f.kind, grade: f.grade, source: f.source,
    defaultPortion: { label: p.label, grams: p.grams, kcal: p.grams ? Math.round((f.per100.energyKcal * p.grams) / 100) : null } };
}

const HIT_COLUMNS = { id: food.id, name: food.name, brand: food.brand, kind: food.kind, grade: food.grade, source: food.source, portions: food.portions, defaultPortion: food.defaultPortion, per100: food.per100 };

export async function searchFoods(userId: string, q: string, country: string, limit = 20): Promise<FoodHit[]> {
  const raw = normalise(q);
  const canon = canonicalQuery(q);
  if (raw.length < 2) return [];
  return db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL pg_trgm.word_similarity_threshold = 0.3`);
    const rows = await tx.select(HIT_COLUMNS).from(food)
      .leftJoin(userFoodStats, and(eq(userFoodStats.foodId, food.id), eq(userFoodStats.userId, userId)))
      .where(and(visibleFoodWhere(userId), sql`(${food.searchText} @@ websearch_to_tsquery('simple', ${raw})
          OR ${food.searchText} @@ websearch_to_tsquery('simple', ${canon})
          OR ${raw} <% ${food.searchName} OR ${canon} <% ${food.searchName})`))
      .orderBy(
        sql`(COALESCE(${food.ownerId} = ${userId}, false) OR ${userFoodStats.uses} IS NOT NULL) DESC`,
        sql`(${food.normName} IN (${raw}, ${canon}) OR ${food.normName} LIKE ${raw + "%"} OR ${food.normName} LIKE ${canon + "%"}) DESC`,
        sql`(${food.kind} <> 'ingredient') DESC`,
        sql`(${country} = ANY(${food.countries})) DESC`,
        sql`CASE ${food.source} WHEN 'custom' THEN 0 WHEN 'crowd' THEN 1 WHEN ${country === "IN" ? sql`'indb'` : sql`'fndds'`} THEN 2 WHEN 'off' THEN 3 ELSE 4 END`,
        desc(food.popularity),
        sql`GREATEST(word_similarity(${raw}, ${food.searchName}), word_similarity(${canon}, ${food.searchName})) DESC`,
        sql`length(${food.name})`,
      )
      .limit(limit);
    return rows.map(toHit);
  });
}

export async function recentFoods(userId: string, limit = 20): Promise<FoodHit[]> {
  const rows = await db.select(HIT_COLUMNS).from(userFoodStats)
    .innerJoin(food, eq(food.id, userFoodStats.foodId))
    .where(and(eq(userFoodStats.userId, userId), visibleFoodWhere(userId)))
    .orderBy(desc(userFoodStats.lastUsedAt), desc(userFoodStats.uses))
    .limit(limit);
  return rows.map(toHit);
}

export async function myFoods(userId: string): Promise<FoodHit[]> {
  const rows = await db.select(HIT_COLUMNS).from(food)
    .where(and(eq(food.ownerId, userId), eq(food.source, "custom"), sql`${food.deletedAt} IS NULL`))
    .orderBy(desc(food.createdAt)).limit(100);
  return rows.map(toHit);
}

export async function getFoodForUser(userId: string, id: string): Promise<FoodRow | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const [row] = await db.select().from(food).where(and(eq(food.id, id), visibleFoodWhere(userId)));
  return row ?? null;
}

export async function foodDetail(userId: string, id: string): Promise<{ food: FoodRow; reasons: Reason[]; flags: Flag[]; alternatives: FoodHit[] } | null> {
  const f = await getFoodForUser(userId, id);
  if (!f) return null;
  const prof = await getProfile(userId);
  const targets = targetsFor(prof.goal, prof.targets);
  const portion = f.portions[f.defaultPortion] ?? f.portions[0]!;
  const perPortion = portion.grams ? nutrientsFor(f.per100, portion.grams) : f.per100;
  const g: GradeResult = { grade: f.grade as Grade | null, value: f.gradeValue, components: f.gradeComponents };
  const reasons = explain({ grade: g, per100: f.per100, basis: f.basis, perPortion, portionLabel: portion.label, targets });
  const flags = personalise({ allergens: f.allergens, ingredients: f.ingredients, perPortion, portionLabel: portion.label,
    profile: { allergies: prof.allergies, diet: prof.diet, goal: prof.goal, targets } });
  const alternatives = f.kind === "packaged" && f.grade && f.grade > "B" && f.categories.length
    ? (await db.select(HIT_COLUMNS).from(food)
        .where(and(visibleFoodWhere(userId), arrayOverlaps(food.categories, f.categories), sql`${prof.country} = ANY(${food.countries})`, sql`${food.grade} < ${f.grade}`, sql`${food.id} <> ${f.id}`))
        .orderBy(food.grade, desc(food.popularity)).limit(5)).map(toHit)
    : [];
  return { food: f, reasons, flags, alternatives };
}

const NutrientsInput = z.object({
  energyKcal: z.number().min(0).max(5000), protein: z.number().min(0).max(500), carbs: z.number().min(0).max(500), fat: z.number().min(0).max(500),
  fibre: z.number().min(0).max(500).optional(), sugars: z.number().min(0).max(500).optional(), satFat: z.number().min(0).max(500).optional(),
  sodiumMg: z.number().min(0).max(20000).optional(),
});
export const CustomFoodSchema = z.object({
  name: z.string().trim().min(1).max(120), brand: z.string().trim().max(80).optional(),
  per: z.object({ amount: z.number().min(1).max(2000), unit: z.enum(["g", "ml", "serving"]) }),
  servingGrams: z.number().min(1).max(2000).optional(),
  nutrients: NutrientsInput,
});
export type CustomFoodInput = z.infer<typeof CustomFoodSchema>;

function customDraft(userId: string, input: CustomFoodInput) {
  const perServing = input.per.unit === "serving";
  const grams = perServing ? input.servingGrams ?? null : input.per.amount;
  // Without serving grams we store the serving as "100 g equivalent" so the food is still loggable by serving.
  const per100: Nutrients = grams ? scaleNutrients(input.nutrients, 100 / grams) : input.nutrients;
  const servingPortion: Portion[] = perServing ? [{ label: "1 serving", amount: 1, unit: "serving", grams: grams ?? 100 }] : [];
  const basis = input.per.unit === "ml" ? "per_100ml" as const : "per_100g" as const;
  const portions = ensureBasePortion(basis, servingPortion);
  const { kind, gradeCategory } = classify({ source: "custom", name: input.name, perServingEntry: perServing });
  const gradePortionGrams = gradeCategory === "dish" ? (grams ?? 100) : null;
  const g = gradeFood({ gradeCategory, per100, gradePortionGrams });
  const provenance = Object.fromEntries(NUTRIENT_KEYS.filter((k) => per100[k] !== undefined).map((k) => [k, "label"]));
  return {
    source: "custom" as const, sourceRef: null, ownerId: userId, kind, gradeCategory, name: input.name, brand: input.brand ?? null,
    basis, per100, provenance, portions, defaultPortion: 0, gradePortionGrams,
    grade: g.grade, gradeValue: g.value, gradeComponents: g.components, gradeVersion: GRADE_VERSION, countries: [] as string[],
    ...buildSearchFields({ name: input.name, brand: input.brand }),
  };
}

export async function createCustomFood(userId: string, input: CustomFoodInput): Promise<FoodRow> {
  const d = customDraft(userId, CustomFoodSchema.parse(input));
  const [row] = await db.insert(food).values({ ...d, searchText: sql`to_tsvector('simple', ${d.searchName})` as unknown as string }).returning();
  return row!;
}

export async function updateCustomFood(userId: string, id: string, input: CustomFoodInput): Promise<FoodRow | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const d = customDraft(userId, CustomFoodSchema.parse(input));
  const [row] = await db.update(food).set({ ...d, searchText: sql`to_tsvector('simple', ${d.searchName})` as unknown as string, updatedAt: new Date() })
    .where(and(eq(food.id, id), eq(food.ownerId, userId), eq(food.source, "custom"), sql`${food.deletedAt} IS NULL`)).returning();
  return row ?? null;
}

export async function deleteCustomFood(userId: string, id: string): Promise<boolean> {
  if (!z.uuid().safeParse(id).success) return false;
  const rows = await db.update(food).set({ deletedAt: new Date() })
    .where(and(eq(food.id, id), eq(food.ownerId, userId), eq(food.source, "custom"), sql`${food.deletedAt} IS NULL`)).returning({ id: food.id });
  return rows.length === 1;
}
