import { and, arrayOverlaps, desc, eq, getTableColumns, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { food, scan, userFoodStats } from "@/lib/db/schema";
import { visibleFoodWhere } from "@/lib/authz";
import type { ScanResult } from "@/lib/engine/result";
import { InvalidError, NotFoundError } from "@/lib/errors";
import { classify } from "@/lib/nutrition/classify";
import { explain } from "@/lib/nutrition/explain";
import { gradeFood, GRADE_VERSION } from "@/lib/nutrition/grade";
import { personalise } from "@/lib/nutrition/personalise";
import { ensureBasePortion, nutrientsFor, scaleNutrients } from "@/lib/nutrition/portions";
import { effectiveTargets } from "@/lib/profile/effective-targets";
import { MICRO_KEYS, NUTRIENT_KEYS, type Flag, type MicroKey, type Grade, type GradeResult, type Nutrients, type Portion, type Reason } from "@/lib/nutrition/types";
import { getProfile } from "@/lib/profile/service";
import { visibleScanWhere } from "@/lib/scans/service";
import { closeness, isRelevantAlternative, minSharedCategories, specificCategories, type AlternativeQuery } from "./alternatives";
import { foodIconKey } from "./icon";
import { customNutrientIssues } from "./custom-validate";
import { isUnknownWeightServing, plausibleCoreWhere, plausibleFood, type SaneFoodRow } from "./sane";
import { buildSearchFields, canonicalQuery, normalise } from "./normalise";
import type { FoodHit, FoodRow } from "./types";

export type { FoodHit, FoodRow };

type HitRow = Pick<FoodRow, "id" | "name" | "brand" | "kind" | "grade" | "source" | "portions" | "defaultPortion" | "per100" | "basis" | "barcode" | "gradeCategory" | "categories"
  | "gradePortionGrams" | "additives" | "nova" | "gradeFrozen">;

export function toHit(row: HitRow): FoodHit {
  const f = plausibleFood(row); // the grade badge matches the food page when a stored value is dropped
  const index = f.portions[f.defaultPortion] ? f.defaultPortion : 0;
  const p = f.portions[index]!;
  return { id: f.id, name: f.name, brand: f.brand, kind: f.kind, grade: f.grade, source: f.source,
    defaultPortion: { label: p.label, grams: p.grams, kcal: p.grams ? Math.round((f.per100.energyKcal * p.grams) / 100) : null, index, unit: f.basis === "per_100ml" ? "ml" : "g" },
    iconKey: foodIconKey(f) };
}

const HIT_COLUMNS = {
  id: food.id, name: food.name, brand: food.brand, kind: food.kind, grade: food.grade, source: food.source, portions: food.portions,
  defaultPortion: food.defaultPortion, per100: food.per100, basis: food.basis, barcode: food.barcode, gradeCategory: food.gradeCategory, categories: food.categories,
  // for plausibleFood's regrade when a stored value is implausible
  gradePortionGrams: food.gradePortionGrams, additives: food.additives, nova: food.nova, gradeFrozen: food.gradeFrozen,
};

const QUALIFIER = "(cooked|boiled|plain|nfs|raw)";
const GENERIC_QUALIFIERS = `^(${QUALIFIER} )+|( ${QUALIFIER})+$`;

function searchWhere(userId: string, raw: string, canon: string) {
  return and(visibleFoodWhere(userId), plausibleCoreWhere(), sql`(${food.searchText} @@ websearch_to_tsquery('simple', ${raw})
      OR ${food.searchText} @@ websearch_to_tsquery('simple', ${canon})
      OR ${raw} <% ${food.searchName} OR ${canon} <% ${food.searchName})`);
}

function searchOrder(userId: string, raw: string, canon: string, country: string) {
  return [
    sql`(COALESCE(${food.ownerId} = ${userId}, false) OR ${userFoodStats.uses} IS NOT NULL) DESC`,
    // 1. exact name; 2. exact after dropping a generic qualifier ("Rice, cooked, NFS", "Banana, raw",
    // "Plain dosa") or an exact curated staple alias ("Boiled rice (Uble chawal)" for "chawal"). Hits on
    // the words the user typed rank above hits on the canonical expansion ("chawal" → "rice").
    sql`CASE WHEN ${food.normName} = ${raw} THEN 0
      WHEN regexp_replace(${food.normName}, ${GENERIC_QUALIFIERS}, '', 'g') = ${raw} OR ${raw} = ANY(${food.aliases}) THEN 1
      WHEN ${food.normName} = ${canon} THEN 2
      WHEN regexp_replace(${food.normName}, ${GENERIC_QUALIFIERS}, '', 'g') = ${canon} OR ${canon} = ANY(${food.aliases}) THEN 3
      ELSE 4 END`,
    sql`(${food.kind} <> 'ingredient') DESC`,
    // 3. whole-name similarity, so "Rice upma" doesn't beat "Rice, white, cooked" on a shared prefix.
    sql`GREATEST(similarity(${food.normName}, ${raw}), similarity(${food.normName}, ${canon})) DESC`,
    sql`(${country} = ANY(${food.countries})) DESC`,
    sql`CASE ${food.source} WHEN 'custom' THEN 0 WHEN 'crowd' THEN 1 WHEN ${country === "IN" ? sql`'indb'` : sql`'fndds'`} THEN 2 WHEN 'off' THEN 3 ELSE 4 END`,
    desc(food.popularity),
    sql`length(${food.name})`,
    food.id, // total order, so equal-ranked hits come back in a stable order
  ];
}

export async function searchFoods(userId: string, q: string, country: string, limit = 20): Promise<FoodHit[]> {
  const raw = normalise(q);
  const canon = canonicalQuery(q);
  if (raw.length < 2) return [];
  return db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL pg_trgm.word_similarity_threshold = 0.3`);
    const rows = await tx.select(HIT_COLUMNS).from(food)
      .leftJoin(userFoodStats, and(eq(userFoodStats.foodId, food.id), eq(userFoodStats.userId, userId)))
      .where(searchWhere(userId, raw, canon))
      .orderBy(...searchOrder(userId, raw, canon, country))
      .limit(limit);
    return rows.map(toHit);
  });
}

/** searchFoods' ranking and visibility, returning full rows — the scan engine's name matching (EngineDeps.searchFoods). */
export async function searchFoodRows(userId: string, name: string, country: string, limit = 10): Promise<SaneFoodRow[]> {
  const raw = normalise(name);
  const canon = canonicalQuery(name);
  if (raw.length < 2) return [];
  return db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL pg_trgm.word_similarity_threshold = 0.3`);
    const rows = await tx.select(getTableColumns(food)).from(food)
      .leftJoin(userFoodStats, and(eq(userFoodStats.foodId, food.id), eq(userFoodStats.userId, userId)))
      .where(searchWhere(userId, raw, canon))
      .orderBy(...searchOrder(userId, raw, canon, country))
      .limit(limit);
    return rows.map(plausibleFood);
  });
}

export async function recentFoods(userId: string, limit = 20): Promise<FoodHit[]> {
  const rows = await db.select(HIT_COLUMNS).from(userFoodStats)
    .innerJoin(food, eq(food.id, userFoodStats.foodId))
    .where(and(eq(userFoodStats.userId, userId), visibleFoodWhere(userId), plausibleCoreWhere()))
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

export async function getFoodForUser(userId: string, id: string): Promise<SaneFoodRow | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const [row] = await db.select().from(food).where(and(eq(food.id, id), visibleFoodWhere(userId), plausibleCoreWhere()));
  return row ? plausibleFood(row) : null;
}

// Looks up a curated (OFF/INDB/FNDDS) food by barcode, for the barcode-scan path — not scoped by
// userId: custom foods are excluded (owner-private, not barcode-verified), and so are crowd foods: they
// come from one user's label photo, so they are never served as a free high-confidence barcode answer
// (a barcode scan of one goes to Open Food Facts, then the charged AI path).
export async function findFoodByBarcode(barcode: string): Promise<SaneFoodRow | null> {
  const [row] = await db.select().from(food).where(and(eq(food.barcode, barcode), isNull(food.deletedAt), sql`${food.source} NOT IN ('custom', 'crowd')`, plausibleCoreWhere()));
  return row ? plausibleFood(row) : null;
}

const GRADE_LETTERS: readonly string[] = ["A", "B", "C", "D", "E"];
/** Extra candidates fetched so the read-time checks below (relevance, effective grade) can still fill `limit`. */
const ALTERNATIVE_HEADROOM = 6;

const textArray = (xs: string[]) => sql`ARRAY[${sql.join(xs.map((x) => sql`${x}`), sql`, `)}]::text[]`;

/**
 * Better-graded visible foods of the same kind as the given food, in the given country (spec §7.4):
 * sharing a specific category and at least half of the food's categories, in the same form (drink,
 * powder or food), as lib/foods/alternatives.ts defines; closest first, then best grade. None when
 * nothing qualifies. Shared by the food detail page and the scan engine (EngineDeps.alternatives).
 *
 * The SQL filters on the stored grade; a row whose effective grade (lib/foods/sane.ts) differs is
 * checked again here: one with an unavailable grade ("?") is never a better pick, and a regraded one
 * must still beat `f.grade`.
 */
export async function findAlternatives(userId: string, f: AlternativeQuery, limit = 5): Promise<FoodHit[]> {
  const specific = specificCategories(f.categories);
  if (!f.grade || specific.length === 0) return [];
  const sharedCount = sql<number>`cardinality(ARRAY(SELECT unnest(${food.categories}) INTERSECT SELECT unnest(${textArray(f.categories)})))`;
  const rows = await db.select(HIT_COLUMNS).from(food)
    .where(and(visibleFoodWhere(userId), plausibleCoreWhere(), arrayOverlaps(food.categories, specific), sql`${f.country} = ANY(${food.countries})`,
      sql`${food.grade} < ${f.grade}`, sql`${sharedCount} >= ${minSharedCategories(new Set(f.categories).size)}`,
      f.excludeId ? sql`${food.id} <> ${f.excludeId}` : undefined))
    .orderBy(desc(sharedCount), sql`(${food.gradeCategory}::text = ${f.gradeCategory ?? ""}) DESC`, sql`(${food.kind} = 'packaged') DESC`,
      food.grade, desc(food.popularity), food.id)
    .limit(limit * ALTERNATIVE_HEADROOM);
  return rows
    .filter((r) => isRelevantAlternative(f, r))
    .map((r) => ({ r, close: closeness(f, r) }))
    .sort((a, b) => b.close - a.close) // stable: the SQL order breaks ties
    .map(({ r }) => toHit(r))
    .filter((h) => h.grade !== null && GRADE_LETTERS.includes(h.grade) && h.grade < f.grade!)
    .slice(0, limit);
}

export async function foodDetail(userId: string, id: string): Promise<{
  food: SaneFoodRow; reasons: Reason[]; flags: Flag[]; alternatives: FoodHit[]; ingredientsKnown: boolean;
  /** Set when the grade can't be shown (lib/nutrition/grade-unavailable.ts): the reason, also the only "why". */
  gradeUnavailable: string | null;
} | null> {
  const f = await getFoodForUser(userId, id);
  if (!f) return null;
  const prof = await getProfile(userId);
  const targets = effectiveTargets(prof);
  const portion = f.portions[f.defaultPortion] ?? f.portions[0]!;
  const perPortion = portion.grams ? nutrientsFor(f.per100, portion.grams) : f.per100;
  const g: GradeResult = { grade: f.grade as Grade | null, value: f.gradeValue, components: f.gradeComponents };
  const gradeUnavailable = f.gradeUnavailable ?? null;
  const reasons: Reason[] = gradeUnavailable
    ? [{ tone: "warn", text: gradeUnavailable }]
    : explain({ source: f.source, name: f.name, grade: g, per100: f.per100, basis: f.basis, perPortion, portionLabel: portion.label, targets });
  const flags = personalise({ name: f.name, allergens: f.allergens, mayContain: f.mayContain, ingredients: f.ingredients, perPortion, portionLabel: portion.label,
    profile: { allergies: prof.allergies, diet: prof.diet, goal: prof.goal, targets } });
  const alternatives = !gradeUnavailable && f.kind === "packaged" && f.grade && f.grade > "B" && f.categories.length
    ? await findAlternatives(userId, { name: f.name, categories: f.categories, gradeCategory: f.gradeCategory, basis: f.basis, country: prof.country, grade: f.grade as Grade, excludeId: f.id })
    : [];
  return { food: f, reasons, flags, alternatives, ingredientsKnown: f.ingredients.length > 0, gradeUnavailable };
}

const NutrientsInput = z.object({
  energyKcal: z.number().min(0).max(5000), protein: z.number().min(0).max(500), carbs: z.number().min(0).max(500), fat: z.number().min(0).max(500),
  fibre: z.number().min(0).max(500).optional(), sugars: z.number().min(0).max(500).optional(), satFat: z.number().min(0).max(500).optional(),
  sodiumMg: z.number().min(0).max(20000).optional(),
  // Not on the form, but kept: a food saved from a scan can carry them, and an edit mustn't drop them.
  addedSugars: z.number().min(0).max(500).optional(), transFat: z.number().min(0).max(500).optional(),
  // The micros, in their own units (the form's optional "Vitamins & minerals"; a food saved from a
  // scan carries them too). Their bounds are checked per 100 by customNutrientIssues below.
  ...(Object.fromEntries(MICRO_KEYS.map((k) => [k, z.number().min(0).optional()])) as Record<MicroKey, z.ZodOptional<z.ZodNumber>>),
});
export const CustomFoodSchema = z.object({
  name: z.string().trim().min(1).max(120), brand: z.string().trim().max(80).optional(),
  per: z.object({ amount: z.number().min(1).max(2000), unit: z.enum(["g", "ml", "serving"]) }),
  servingGrams: z.number().min(1).max(2000).optional(),
  nutrients: NutrientsInput,
}).superRefine((v, ctx) => {
  // The shared plausibility bounds, field by field (lib/foods/custom-validate.ts): rejected with a
  // message for that field, never stored and later dropped on read.
  for (const { field, message } of customNutrientIssues(v)) ctx.addIssue({ code: "custom", path: ["nutrients", field], message });
});

/** The first plausibility issue in a failed CustomFoodSchema parse, as the field and its message (for the form). */
export function customFoodFieldError(error: z.ZodError): { field: string; message: string } | null {
  const issue = error.issues.find((i) => i.code === "custom" && i.path[0] === "nutrients");
  return issue ? { field: String(issue.path[1]), message: issue.message } : null;
}
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

/**
 * "Save to my foods" from a scan (Task 9): a private custom food copying name/brand/per100/basis/
 * portions/provenance straight from the scan's own result — the owner-scoped, done scan with a
 * result (else 404, same as logging from it).
 *
 * The grade/value/components are copied verbatim from the result rather than recomputed through
 * `classify` + `gradeFood` (as `customDraft` does for a manually-entered food): `ScanResult` doesn't
 * carry the nova/OFF-categories the original grading used, so recomputing here would silently
 * produce a *different*, less accurate grade than the one the user already saw on the scan — exactly
 * the kind of drift the "grade snapshot" rule (Task 9 amendments) rules out. `gradeFrozen: true` makes
 * this permanent: `scripts/regrade.ts` skips frozen rows entirely, so a future GRADE_VERSION bump can
 * never silently replace this snapshot with a coarser recomputed grade.
 *
 * `kind`/`gradeCategory` are only a coarse best-effort mapping (packaged → packaged/general, dish or
 * meal → dish/dish — both are always graded as "dish" by the engine, see lib/engine/index.ts) used for
 * search ranking only, since `ScanResult` has no `gradeCategory` field to copy (checked `buildResult`'s
 * return type in lib/engine/result.ts: it's an input to grading, not part of the output). Being
 * grade-frozen, this mapping's coarseness can never affect the grade shown — it's display/ranking
 * metadata only.
 */
export async function createCustomFoodFromScan(userId: string, scanId: string): Promise<{ food: FoodRow; created: boolean }> {
  if (!z.uuid().safeParse(scanId).success) throw new NotFoundError();
  const [row] = await db.select({ status: scan.status, result: scan.result }).from(scan).where(and(eq(scan.id, scanId), visibleScanWhere(userId)));
  if (!row || row.status !== "done" || !row.result) throw new NotFoundError();
  const r: ScanResult = row.result;
  // Per-serving values of unknown weight have no per-100 figure to store; saving them as one would be wrong.
  if (!r.per100) throw new InvalidError("This label has no serving weight, so it can't be saved as a food. Log it by servings instead.");
  const per100 = r.per100;

  const kind = r.kind === "packaged" ? ("packaged" as const) : ("dish" as const);
  const gradeCategory = r.kind === "packaged" ? ("general" as const) : ("dish" as const);
  const gradePortionGrams = kind === "dish" ? (r.portions[r.defaultPortion]?.grams ?? 100) : null;

  const draft = {
    source: "custom" as const, sourceRef: scanId, ownerId: userId, kind, gradeCategory,
    name: r.name, brand: r.brand, basis: r.basis, per100, provenance: r.provenance,
    portions: r.portions, defaultPortion: r.defaultPortion, gradePortionGrams, ingredients: r.ingredients,
    // Personal flags on the saved food read these exactly as on curated foods (personalise).
    allergens: r.allergens ?? [], mayContain: r.mayContain ?? [], additives: r.additives ?? [],
    grade: r.grade, gradeValue: r.gradeValue, gradeComponents: r.components, gradeVersion: GRADE_VERSION,
    gradeFrozen: true, countries: [] as string[],
    ...buildSearchFields({ name: r.name, brand: r.brand }),
  };
  // Idempotent per scan via the existing unique index food_source_ref_uq (source, source_ref):
  // ('custom', scanId) can exist once, and a scan has exactly one owner. A repeat save returns the
  // existing food untouched; if the user had deleted it, the save restores it (deleted_at → NULL).
  // `xmax = 0` is true only for a freshly inserted row (an ON CONFLICT update sets xmax).
  const [saved] = await db.insert(food)
    .values({ ...draft, searchText: sql`to_tsvector('simple', ${draft.searchName})` as unknown as string })
    .onConflictDoUpdate({
      target: [food.source, food.sourceRef],
      set: {
        deletedAt: sql`NULL`,
        updatedAt: sql`CASE WHEN ${food.deletedAt} IS NULL THEN ${food.updatedAt} ELSE now() END`,
      },
      setWhere: eq(food.ownerId, userId),
    })
    .returning({ ...getTableColumns(food), created: sql<boolean>`(xmax = 0)` });
  if (!saved) throw new NotFoundError(); // conflict on another owner's row — impossible for an owner-scoped scan
  const { created, ...savedRow } = saved;
  return { food: savedRow, created };
}

export async function updateCustomFood(userId: string, id: string, input: CustomFoodInput): Promise<FoodRow | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const d = customDraft(userId, CustomFoodSchema.parse(input));
  // sourceRef: undefined → Drizzle leaves the column alone, so a saved-from-scan food keeps its scan
  // link after an edit (Save to my foods stays idempotent).
  // gradeFrozen: false — after an edit the grade is computed from the user's numbers, so regrade may refresh it.
  const [row] = await db.update(food).set({ ...d, sourceRef: undefined, gradeFrozen: false, searchText: sql`to_tsvector('simple', ${d.searchName})` as unknown as string, updatedAt: new Date() })
    .where(and(eq(food.id, id), eq(food.ownerId, userId), eq(food.source, "custom"), sql`${food.deletedAt} IS NULL`)).returning();
  return row ?? null;
}

/**
 * The owner's own custom food exactly as stored, for its edit form: no read guard (lib/foods/sane.ts),
 * because the form must show every stored value (an implausible one is then flagged under its field
 * and must be fixed) rather than silently drop it on the next save.
 */
export async function getOwnCustomFoodForEdit(userId: string, id: string): Promise<FoodRow | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const [row] = await db.select().from(food)
    .where(and(eq(food.id, id), eq(food.ownerId, userId), eq(food.source, "custom"), sql`${food.deletedAt} IS NULL`));
  return row ?? null;
}

/** The custom-food form's starting values for editing a stored food (components/food/custom-food-form.tsx). */
export interface CustomFoodFormInitial {
  id: string;
  name: string;
  brand: string;
  per: { amount: number; unit: "g" | "ml" | "serving" };
  servingGrams?: number;
  nutrients: Nutrients;
}

/**
 * A stored custom food as the edit form shows it: per serving (with its weight) when it has a serving
 * portion, else per 100 g/ml. A serving of unknown weight (Quick add's "Save to My foods",
 * lib/foods/sane.ts isUnknownWeightServing) loads with no serving size, so saving it unchanged is
 * checked as one serving again, not as a 100 g serving.
 */
export function customFoodFormInitial(row: FoodRow): CustomFoodFormInitial {
  const servingPortion = row.portions.find((p) => p.unit === "serving");
  const unknownWeight = isUnknownWeightServing(row);
  const servingGrams = !unknownWeight && servingPortion?.grams ? servingPortion.grams : undefined;
  return {
    id: row.id,
    name: row.name,
    brand: row.brand ?? "",
    per: servingPortion ? { amount: 1, unit: "serving" } : { amount: 100, unit: row.basis === "per_100ml" ? "ml" : "g" },
    ...(servingGrams !== undefined && { servingGrams }),
    nutrients: servingGrams ? nutrientsFor(row.per100, servingGrams) : row.per100,
  };
}

export async function deleteCustomFood(userId: string, id: string): Promise<boolean> {
  if (!z.uuid().safeParse(id).success) return false;
  const rows = await db.update(food).set({ deletedAt: new Date() })
    .where(and(eq(food.id, id), eq(food.ownerId, userId), eq(food.source, "custom"), sql`${food.deletedAt} IS NULL`)).returning({ id: food.id });
  return rows.length === 1;
}
