import { MEALS, NUTRIENT_KEYS, type DailyTargets, type Meal, type Nutrients } from "./types";

export type FullNutrients = Required<Nutrients>;
export interface TargetProgress {
  key: keyof DailyTargets; label: string; total: number; target: number;
  kind: "aim" | "limit"; remaining: number; overBy: number;
}
export interface DayTotals { totals: FullNutrients; byMeal: Record<Meal, FullNutrients>; progress: TargetProgress[] }

const zero = (): FullNutrients => Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, 0])) as FullNutrients;
const r = (n: number) => Math.round(n * 10) / 10;

export function sumNutrients(list: Nutrients[]): FullNutrients {
  const out = zero();
  for (const n of list) for (const k of NUTRIENT_KEYS) out[k] = r(out[k] + (n[k] ?? 0));
  return out;
}

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
    return { key, label, total, target, kind, remaining: r(Math.max(0, target - total)), overBy: r(Math.max(0, total - target)) };
  });
  return { totals, byMeal, progress };
}
