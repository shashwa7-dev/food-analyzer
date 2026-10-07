import type { AnyNutrientKey } from "./types";

/**
 * One reference set of Daily Values for the "% DV" beside a nutrient: the US FDA's Daily Values for
 * adults and children 4 years and over on a 2,000 kcal diet (21 CFR 101.9(c), the 2016 label rule),
 * chosen because every source we import (USDA FoodData Central, Open Food Facts, INDB) reports in the
 * units these are written in. ICMR-NIN's Indian RDAs (2020) could replace this table later: the keys
 * and units are the same, only the numbers would change.
 *
 * Units match lib/nutrition/types.ts: vitamin A in µg RAE, folate in µg DFE, niacin in mg (NE).
 * Nutrients the FDA gives no Daily Value for (total sugars, trans fat) are absent, so they get no %.
 */
export const DAILY_VALUES: Partial<Record<AnyNutrientKey, number>> = {
  fibre: 28, satFat: 20, addedSugars: 50, sodiumMg: 2_300,
  cholesterolMg: 300, potassiumMg: 4_700, calciumMg: 1_300, ironMg: 18, magnesiumMg: 420, zincMg: 11, phosphorusMg: 1_250,
  vitaminAUg: 900, vitaminCMg: 90, vitaminDUg: 20, vitaminEMg: 15, vitaminKUg: 120,
  thiaminMg: 1.2, riboflavinMg: 1.3, niacinMg: 16, vitaminB6Mg: 1.7, folateUg: 400, vitaminB12Ug: 2.4,
};

/** `amount` as a whole-number % of the key's Daily Value; null when the key has none or the amount isn't a number. */
export function percentDV(key: AnyNutrientKey, amount: number | undefined): number | null {
  const dv = DAILY_VALUES[key];
  if (dv === undefined || amount === undefined || !Number.isFinite(amount) || amount < 0) return null;
  return Math.round((amount / dv) * 100);
}
