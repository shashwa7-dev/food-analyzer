import type { Nutrients } from "@/lib/nutrition/types";
import type { Extraction } from "./schema";

export interface ConvertedFacts {
  per100: Nutrients;
  basis: "per_100g" | "per_100ml";
  servingGrams: number | null;
  energyKj?: number;
  saltG?: number;
  servingUnknown?: boolean;
}

/**
 * Converts printed facts (per-100 or per-serving) to a per-100 basis.
 *
 * Missing energyKcal, protein, carbs or fat makes the facts unusable (the engine treats
 * this as UNREADABLE_IMAGE unless a DB match supplies them) — returns null.
 *
 * A per_serving label with no printed serving size can't be scaled: the per-serving values
 * are returned as-is (servingGrams: null, servingUnknown: true). The engine then keeps them as
 * the result's `perServing` (per100 null): ungraded, logged by servings only, never by grams.
 *
 * Out-of-range per-100 values (past lib/nutrition/plausible.ts PER100_MAX) are NOT clamped here —
 * they're returned as computed; validateFacts flags them as "range", and the engine drops implausible
 * optional values from the result it shows.
 */
export function toPer100(facts: Extraction["facts"]): ConvertedFacts | null {
  if (!facts) return null;
  if (facts.energyKcal === undefined || facts.protein === undefined || facts.carbs === undefined || facts.fat === undefined) return null;

  let factor = 1;
  let basis: "per_100g" | "per_100ml";
  let servingGrams: number | null;
  let servingUnknown: boolean | undefined;

  if (facts.basis === "per_serving") {
    if (facts.servingSize && facts.servingSize.value > 0) {
      factor = 100 / facts.servingSize.value;
      basis = facts.servingSize.unit === "ml" ? "per_100ml" : "per_100g";
      servingGrams = facts.servingSize.value;
    } else {
      basis = "per_100g";
      servingGrams = null;
      servingUnknown = true;
    }
  } else {
    basis = facts.basis;
    servingGrams = facts.servingSize?.value ?? null;
  }

  const scale = (v: number | undefined): number | undefined => (v === undefined ? undefined : Math.round(v * factor * 1000) / 1000);

  const sodiumMgRaw = facts.sodiumMg !== undefined ? facts.sodiumMg : facts.saltG !== undefined ? facts.saltG * 400 : undefined;

  const per100: Nutrients = {
    energyKcal: scale(facts.energyKcal)!,
    protein: scale(facts.protein)!,
    carbs: scale(facts.carbs)!,
    fat: scale(facts.fat)!,
    ...(facts.sugars !== undefined && { sugars: scale(facts.sugars) }),
    ...(facts.addedSugars !== undefined && { addedSugars: scale(facts.addedSugars) }),
    ...(facts.satFat !== undefined && { satFat: scale(facts.satFat) }),
    ...(facts.transFat !== undefined && { transFat: scale(facts.transFat) }),
    ...(facts.fibre !== undefined && { fibre: scale(facts.fibre) }),
    ...(sodiumMgRaw !== undefined && { sodiumMg: scale(sodiumMgRaw) }),
  };

  return {
    per100,
    basis,
    servingGrams,
    ...(facts.energyKj !== undefined && { energyKj: scale(facts.energyKj) }),
    ...(facts.saltG !== undefined && { saltG: scale(facts.saltG) }),
    ...(servingUnknown && { servingUnknown }),
  };
}
