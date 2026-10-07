import { NUTRIENT_KEYS, type Nutrients, type NutrientKey, type Provenance } from "@/lib/nutrition/types";

const REQUIRED_KEYS: NutrientKey[] = ["energyKcal", "protein", "carbs", "fat"];

export function mergeFacts(
  label: Partial<Nutrients> | null,
  db: { per100: Nutrients; provenance: Partial<Record<NutrientKey, Provenance>> } | null,
): { per100: Nutrients; provenance: Partial<Record<NutrientKey, Provenance>> } | null {
  if (!label && !db) return null;

  const per100: Partial<Nutrients> = {};
  const provenance: Partial<Record<NutrientKey, Provenance>> = {};

  for (const key of NUTRIENT_KEYS) {
    const labelValue = label?.[key];
    if (typeof labelValue === "number") {
      per100[key] = labelValue;
      provenance[key] = "label";
      continue;
    }
    const dbValue = db?.per100[key];
    if (typeof dbValue === "number") {
      per100[key] = dbValue;
      provenance[key] = db?.provenance[key] ?? "reference";
    }
  }

  if (REQUIRED_KEYS.some((key) => typeof per100[key] !== "number")) return null;
  return { per100: per100 as Nutrients, provenance };
}
