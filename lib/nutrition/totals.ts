import { MEALS, NUTRIENT_KEYS, type DailyTargets, type Meal, type NutrientKey, type Nutrients } from "./types";

/** Every macro-set nutrient, known or summed to 0 (micros are never totalled: see MICRO_KEYS). */
export type FullNutrients = Required<Pick<Nutrients, NutrientKey>>;
export interface TargetProgress {
  key: keyof DailyTargets; label: string; total: number; target: number;
  kind: "aim" | "limit"; remaining: number; overBy: number;
  /**
   * Entries whose snapshot has no value for this nutrient (a missing key is unknown: dropped as
   * implausible, or never given). `total` then covers the known entries only, so it is a floor.
   */
  unknown: number;
}
export interface DayTotals { totals: FullNutrients; byMeal: Record<Meal, FullNutrients>; progress: TargetProgress[] }

const zero = (): FullNutrients => Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, 0])) as FullNutrients;
const r = (n: number) => Math.round(n * 10) / 10;

/** Sums of the known values (a missing one adds nothing), rounded to 0.1 once at the end, as Progress does. */
export function sumNutrients(list: Nutrients[]): FullNutrients {
  const out = zero();
  for (const n of list) for (const k of NUTRIENT_KEYS) out[k] += n[k] ?? 0;
  for (const k of NUTRIENT_KEYS) out[k] = r(out[k]);
  return out;
}

/** How many of `list` have no value for `key`. */
export const unknownCount = (list: Nutrients[], key: keyof Nutrients) => list.filter((n) => typeof n[key] !== "number").length;

const SPEC: { key: keyof DailyTargets; label: string; from: keyof FullNutrients; kind: "aim" | "limit" }[] = [
  { key: "energyKcal", label: "Calories", from: "energyKcal", kind: "aim" },
  { key: "protein", label: "Protein", from: "protein", kind: "aim" },
  { key: "carbs", label: "Carbs", from: "carbs", kind: "aim" },
  { key: "fat", label: "Fat", from: "fat", kind: "aim" },
  { key: "fibre", label: "Fibre", from: "fibre", kind: "aim" },
  { key: "sugarsMax", label: "Sugar", from: "sugars", kind: "limit" },
  { key: "sodiumMgMax", label: "Sodium", from: "sodiumMg", kind: "limit" },
  { key: "satFatMax", label: "Saturated fat", from: "satFat", kind: "limit" },
];

export function dayTotals(entries: { meal: Meal; nutrients: Nutrients }[], targets: DailyTargets): DayTotals {
  const totals = sumNutrients(entries.map((e) => e.nutrients));
  const byMeal = Object.fromEntries(MEALS.map((m) => [m, sumNutrients(entries.filter((e) => e.meal === m).map((e) => e.nutrients))])) as Record<Meal, FullNutrients>;
  const progress = SPEC.map(({ key, label, from, kind }) => {
    const total = totals[from];
    const target = targets[key];
    const unknown = unknownCount(entries.map((e) => e.nutrients), from);
    return { key, label, total, target, kind, remaining: r(Math.max(0, target - total)), overBy: r(Math.max(0, total - target)), unknown };
  });
  return { totals, byMeal, progress };
}
