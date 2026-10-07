import { classify } from "@/lib/nutrition/classify";
import { gradeFood } from "@/lib/nutrition/grade";
import { dropImplausible } from "@/lib/nutrition/plausible";
import type { GradeResult, NutrientKey } from "@/lib/nutrition/types";
import { wweiaOf } from "./seed-map";
import type { FoodRow } from "./types";

/** A food row as read for display: implausible values removed, `dropped` naming them (lib/foods/sane.ts). */
export type SaneFoodRow = FoodRow & { dropped?: NutrientKey[] };

type GradeInputs = Pick<FoodRow, "source" | "name" | "categories" | "gradeCategory" | "per100" | "gradePortionGrams" | "additives" | "nova">;

/** A stored food's grade from its own columns (what scripts/regrade.ts writes). */
export function gradeStoredFood(f: GradeInputs): GradeResult {
  // Fruit/vegetable credit is derived from the FNDDS WWEIA category, kept in categories by the seed.
  const fvlPercent = f.source === "fndds" ? classify({ source: "fndds", name: f.name, wweia: wweiaOf(f.categories), per100: f.per100 }).fvlPercent : undefined;
  return gradeFood({ fvlPercent, gradeCategory: f.gradeCategory, per100: f.per100, gradePortionGrams: f.gradePortionGrams, additives: f.additives, nova: f.nova });
}

/**
 * Read-time guard for food rows (lib/nutrition/plausible.ts): an implausible per-100 value stored before
 * the bounds existed (e.g. an OFF unit error, sodium 350,428 mg/100 g) is shown as unknown, with its
 * provenance removed. The stored grade was computed with that value, so it is recomputed here on what
 * is shown, unless the grade is frozen (a scan snapshot). `dropped` lists what was removed (for the
 * regrade note in explain). Rows that pass are returned as they are.
 *
 * Nothing is written back: a re-seed (and `pnpm regrade`, which grades on these same values) cleans
 * the stored data.
 */
export function plausibleFood<T extends GradeInputs & Pick<FoodRow, "grade"> & Partial<Pick<FoodRow, "provenance" | "gradeValue" | "gradeComponents" | "gradeFrozen">>>(f: T): T & { dropped?: NutrientKey[] } {
  const { per100, dropped } = dropImplausible(f.per100);
  if (dropped.length === 0) return f;
  const out: T & { dropped?: NutrientKey[] } = { ...f, per100, dropped };
  if (f.provenance) {
    const provenance = { ...f.provenance };
    for (const k of dropped) delete provenance[k];
    out.provenance = provenance;
  }
  if (!f.gradeFrozen) {
    const g = gradeStoredFood(out);
    out.grade = g.grade;
    if ("gradeValue" in f) out.gradeValue = g.value;
    if ("gradeComponents" in f) out.gradeComponents = g.components;
  }
  return out;
}
