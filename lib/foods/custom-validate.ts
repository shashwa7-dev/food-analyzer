import { implausibleKeys, outOfRangeKeys, PER100_MAX } from "@/lib/nutrition/plausible";
import type { NutrientKey, Nutrients } from "@/lib/nutrition/types";

/** A custom food's numbers as typed: per 100 g/ml, or per serving (with the serving's weight when known). */
export interface CustomNutrientsEntry {
  per: { amount: number; unit: "g" | "ml" | "serving" };
  servingGrams?: number | null;
  nutrients: Nutrients;
}

export interface FieldIssue { field: NutrientKey; message: string }

const NAME: Record<NutrientKey, string> = {
  energyKcal: "Calories", protein: "Protein", carbs: "Carbs", fat: "Fat", fibre: "Fibre", sugars: "Sugars",
  addedSugars: "Added sugars", satFat: "Saturated fat", transFat: "Trans fat", sodiumMg: "Sodium",
};
const UNIT: Record<NutrientKey, string> = { energyKcal: "kcal", sodiumMg: "mg", protein: "g", carbs: "g", fat: "g", fibre: "g", sugars: "g", addedSugars: "g", satFat: "g", transFat: "g" };
/** The whole a part is checked against, for the message (lib/nutrition/plausible.ts PART_OF). */
const WHOLE: Partial<Record<NutrientKey, string>> = { sugars: "carbs", addedSugars: "sugars or carbs", satFat: "fat", transFat: "fat" };

/**
 * Plausibility of a custom food's numbers, field by field, with the sentence shown under the field.
 * The same bounds as every other per-100 value (lib/nutrition/plausible.ts): a custom food is rejected
 * here rather than silently losing a value later. Used by the form (before saving) and by
 * CustomFoodSchema (the API's backstop).
 */
export function customNutrientIssues(entry: CustomNutrientsEntry): FieldIssue[] {
  const perServing = entry.per.unit === "serving";
  const grams = perServing ? entry.servingGrams ?? null : entry.per.amount;
  const factor = grams && grams > 0 ? 100 / grams : 1;
  const per100 = Object.fromEntries(Object.entries(entry.nutrients).map(([k, v]) => [k, typeof v === "number" ? v * factor : v])) as Nutrients;
  const basis = entry.per.unit === "ml" ? "100 ml" : "100 g";
  const range = new Set(outOfRangeKeys(per100));
  // A serving of unknown weight has no per-100 figure, so only the scale-free checks (a part within its whole) apply.
  const issues = implausibleKeys(per100).filter((k) => !(perServing && !grams && range.has(k)));
  return issues.map((k) => {
    if (!range.has(k)) return { field: k, message: `${NAME[k]} can't be more than ${WHOLE[k]}.` };
    const limit = `${PER100_MAX[k].toLocaleString("en-IN")} ${UNIT[k]}`;
    return perServing && grams
      ? { field: k, message: `${NAME[k]} works out to more than ${limit} per ${basis}. Check the serving size.` }
      : { field: k, message: `${NAME[k]} can't be more than ${limit} per ${basis}.` };
  });
}
