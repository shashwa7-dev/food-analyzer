import { implausibleKeys, implausibleMicroKeys, MICRO_MAX, outOfRangeKeys, PER100_MAX } from "@/lib/nutrition/plausible";
import { MICRONUTRIENTS } from "@/lib/nutrition/nutrient-display";
import type { MicroKey, NutrientKey, Nutrients } from "@/lib/nutrition/types";

/** A custom food's numbers as typed: per 100 g/ml, or per serving (with the serving's weight when known). */
export interface CustomNutrientsEntry {
  per: { amount: number; unit: "g" | "ml" | "serving" };
  servingGrams?: number | null;
  nutrients: Nutrients;
}

export interface FieldIssue { field: NutrientKey | MicroKey; message: string }

const NAME: Record<NutrientKey, string> = {
  energyKcal: "Calories", protein: "Protein", carbs: "Carbs", fat: "Fat", fibre: "Fibre", sugars: "Sugars",
  addedSugars: "Added sugars", satFat: "Saturated fat", transFat: "Trans fat", sodiumMg: "Sodium",
};
const UNIT: Record<NutrientKey, string> = { energyKcal: "kcal", sodiumMg: "mg", protein: "g", carbs: "g", fat: "g", fibre: "g", sugars: "g", addedSugars: "g", satFat: "g", transFat: "g" };
const MICRO_META = new Map(MICRONUTRIENTS.map((m) => [m.key, m]));
/** The whole a part is checked against, for the message (lib/nutrition/plausible.ts PART_OF). */
const WHOLE: Partial<Record<NutrientKey, string>> = { sugars: "carbs", addedSugars: "sugars or carbs", satFat: "fat", transFat: "fat" };

/**
 * Plausibility of a custom food's numbers, field by field, with the sentence shown under the field.
 * The same bounds as every other per-100 value (lib/nutrition/plausible.ts), micros included: a custom
 * food is rejected here rather than silently losing a value later. Used by the form (before saving)
 * and by CustomFoodSchema (the API's backstop).
 *
 * A serving of unknown weight is stored as if it were 100 g (lib/foods/service.ts customDraft), so its
 * values are checked against the per-100 bounds too, with a message asking for the serving's weight:
 * a value past them would otherwise be accepted here and dropped on read.
 */
export function customNutrientIssues(entry: CustomNutrientsEntry): FieldIssue[] {
  const perServing = entry.per.unit === "serving";
  const grams = perServing ? entry.servingGrams ?? null : entry.per.amount;
  const factor = grams && grams > 0 ? 100 / grams : 1;
  const per100 = Object.fromEntries(Object.entries(entry.nutrients).map(([k, v]) => [k, typeof v === "number" ? v * factor : v])) as Nutrients;
  const basis = entry.per.unit === "ml" ? "100 ml" : "100 g";
  const range = new Set(outOfRangeKeys(per100));
  const tooMuch = (label: string, limit: string): string =>
    perServing && grams ? `${label} works out to more than ${limit} per ${basis}. Check the serving size.`
      : perServing ? `${label} can't be more than ${limit} per serving without its weight. Add the serving size.`
        : `${label} can't be more than ${limit} per ${basis}.`;
  const macros = implausibleKeys(per100).map((k): FieldIssue => (range.has(k)
    ? { field: k, message: tooMuch(NAME[k], `${PER100_MAX[k].toLocaleString("en-IN")} ${UNIT[k]}`) }
    : { field: k, message: `${NAME[k]} can't be more than ${WHOLE[k]}.` }));
  const micros = implausibleMicroKeys(per100).map((k): FieldIssue => {
    const m = MICRO_META.get(k)!;
    return { field: k, message: tooMuch(m.label, `${MICRO_MAX[k].toLocaleString("en-IN")} ${m.unit}`) };
  });
  return [...macros, ...micros];
}
