import { sql, type SQL } from "drizzle-orm";
import { food } from "@/lib/db/schema";
import { classify } from "@/lib/nutrition/classify";
import { gradeFood } from "@/lib/nutrition/grade";
import { figureSourceOf, GRADE_UNAVAILABLE, gradeUnavailableReason } from "@/lib/nutrition/grade-unavailable";
import { CORE_KEYS, dropImplausible, PER100_BOUNDS, PER100_MAX, SERVING_BOUNDS, type PlausibleBounds } from "@/lib/nutrition/plausible";
import type { GradeResult, NutrientKey, Portion } from "@/lib/nutrition/types";
import { saneDefaultPortion, wweiaOf } from "./seed-map";
import type { FoodRow } from "./types";

/** What plausibleFood adds to a row: the values it dropped, and why the grade is unavailable (if it is). */
export interface Plausibility { dropped?: NutrientKey[]; gradeUnavailable?: string }
/** A food row as read for display (lib/foods/sane.ts plausibleFood). */
export type SaneFoodRow = FoodRow & Plausibility;

type GradeInputs = Pick<FoodRow, "source" | "name" | "categories" | "gradeCategory" | "per100" | "gradePortionGrams" | "additives" | "nova">;

/** A stored food's grade from its own columns (what scripts/regrade.ts writes). */
export function gradeStoredFood(f: GradeInputs): GradeResult {
  // Fruit/vegetable credit is derived from the FNDDS WWEIA category, kept in categories by the seed.
  const fvlPercent = f.source === "fndds" ? classify({ source: "fndds", name: f.name, wweia: wweiaOf(f.categories), per100: f.per100 }).fvlPercent : undefined;
  return gradeFood({ fvlPercent, gradeCategory: f.gradeCategory, per100: f.per100, gradePortionGrams: f.gradePortionGrams, additives: f.additives, nova: f.nova });
}

/**
 * True for a custom food entered per serving with no weight (Quick add's "Save to My foods" always is
 * one): lib/foods/service.ts customDraft stores it as a "1 serving" portion of 100 g with the serving's
 * values as its per-100, so they are checked as one serving (SERVING_BOUNDS), never as per 100 g. A
 * custom food weighed at exactly 100 g a serving looks the same and gets the looser bounds too; its
 * values were checked per 100 g when it was saved.
 */
export function isUnknownWeightServing(f: { source: string; portions?: Portion[] }): boolean {
  return f.source === "custom" && (f.portions ?? []).some((p) => p.unit === "serving" && p.label === "1 serving" && p.grams === 100);
}

/** The bounds a stored food's per100 is checked against (lib/nutrition/plausible.ts). */
export function boundsFor(f: { source: string; portions?: Portion[] }): PlausibleBounds {
  return isUnknownWeightServing(f) ? SERVING_BOUNDS : PER100_BOUNDS;
}

/**
 * Read-time guard for food rows (lib/nutrition/plausible.ts): an implausible per-100 value stored before
 * the bounds existed (e.g. an OFF unit error, sodium 350,428 mg/100 g) is shown as unknown, with its
 * provenance removed. The stored grade was computed with that value, so it isn't shown:
 * - a dropped nutrient the grade scores (sodium, sugars, sat fat, energy): the grade is unavailable
 *   (lib/nutrition/grade-unavailable.ts): grade "?", no value or components, `gradeUnavailable` the reason;
 * - anything else dropped (fibre, added sugars, trans fat): the grade is recomputed on what is shown;
 * - a micro (a vitamin or mineral) dropped: only the value goes; the grade never reads one.
 * A frozen grade (a scan snapshot) is kept as it is either way. Rows that pass are returned as they are.
 *
 * Nothing is written back: a re-seed (and `pnpm regrade`, which grades on these same values) cleans
 * the stored data.
 */
export function plausibleFood<T extends GradeInputs & Pick<FoodRow, "grade"> & Partial<Pick<FoodRow, "provenance" | "gradeValue" | "gradeComponents" | "gradeFrozen" | "portions" | "defaultPortion">>>(f: T): T & Plausibility {
  const { per100, dropped, droppedMicros } = dropImplausible(f.per100, boundsFor(f));
  // A default portion stored before the pack rule (lib/foods/seed-map.ts) is corrected on read too.
  const defaultPortion = f.portions && f.defaultPortion !== undefined ? saneDefaultPortion(f.portions, f.defaultPortion) : f.defaultPortion;
  if (dropped.length === 0 && droppedMicros.length === 0) return defaultPortion === f.defaultPortion ? f : { ...f, defaultPortion };
  // Only micros dropped: they carry no provenance and no grade reads them, so nothing else changes.
  if (dropped.length === 0) return { ...f, per100, defaultPortion };
  const out: T & Plausibility = { ...f, per100, dropped, defaultPortion };
  if (f.provenance) {
    const provenance = { ...f.provenance };
    for (const k of dropped) delete provenance[k];
    out.provenance = provenance;
  }
  if (f.gradeFrozen) return out;
  const unavailable = gradeUnavailableReason(dropped, figureSourceOf(f.source));
  if (unavailable) {
    out.grade = GRADE_UNAVAILABLE;
    out.gradeUnavailable = unavailable;
    if ("gradeValue" in f) out.gradeValue = null;
    if ("gradeComponents" in f) out.gradeComponents = [];
  } else {
    const g = gradeStoredFood(out);
    out.grade = g.grade;
    if ("gradeValue" in f) out.gradeValue = g.value;
    if ("gradeComponents" in f) out.gradeComponents = g.components;
  }
  return out;
}

/**
 * SQL guard for reads that list or open foods (search, the food page, barcode lookup, alternatives):
 * a stored row whose energy or a macro is implausible (an OFF unit error such as fat 3,227 g per 100 g)
 * can't be shown honestly, because those values are required, so the row is left out as if it didn't
 * exist. Same bounds as lib/nutrition/plausible.ts, checked on the per100 JSON in SQL so it costs a
 * filter, not a fetch. Custom foods are the owner's own entry and are never hidden.
 */
export function plausibleCoreWhere(): SQL {
  const checks = CORE_KEYS.map((k) => sql`COALESCE((${food.per100}->>${k})::float8, 0) BETWEEN 0 AND ${PER100_MAX[k]}`);
  return sql`(${food.source} = 'custom' OR (${sql.join(checks, sql` AND `)}))`;
}
