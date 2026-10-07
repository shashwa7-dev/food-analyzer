// What the nutrient cards show (components/food/result-parts.tsx: "More nutrients" and "Vitamins &
// minerals" on a food page and a scan result) and the full table: each nutrient's name, unit and
// order, with the rules for what is left out. A missing value is never shown as 0: its card is left out.
import { percentDV } from "./daily-values";
import { isNotableNegative } from "./explain";
import type { AnyNutrientKey, MicroKey, NutrientKey, Nutrients, ScoreComponent } from "./types";

export type Level = "low" | "medium" | "high";

/**
 * The UK FSA front-of-pack bands, per 100 g (drinks per 100 ml, where the high line is halved):
 * low up to the first number, high over the second.
 * Sugars 5 / 22.5 g (drinks 2.5 / 11.25), saturated fat 1.5 / 5 g (0.75 / 2.5), sodium 120 / 600 mg
 * (salt 0.3 / 1.5 g; drinks 120 / 300 mg).
 */
const BANDS: Record<"sugars" | "satFat" | "sodiumMg", { food: [number, number]; drink: [number, number] }> = {
  sugars: { food: [5, 22.5], drink: [2.5, 11.25] },
  satFat: { food: [1.5, 5], drink: [0.75, 2.5] },
  sodiumMg: { food: [120, 600], drink: [120, 300] },
};
export type LimitKey = keyof typeof BANDS;
export const LIMIT_KEYS = Object.keys(BANDS) as LimitKey[];

/** The grade components (lib/nutrition/grade) that score each limit nutrient, packaged and dish. */
const LIMIT_COMPONENTS: Record<LimitKey, string[]> = {
  sugars: ["sugars", "sugarsDensity"],
  satFat: ["satFat", "satFatDensity"],
  sodiumMg: ["salt", "sodium", "sodiumDensity"],
};

/**
 * A limit nutrient's band on a graded food, one threshold set with the grade's reasons: "high" exactly
 * when a component scoring it is notable enough for a "High …" reason (lib/nutrition/explain.ts
 * isNotableNegative); otherwise the FSA band, capped at "medium" (a food the grade doesn't call high in
 * sugar never shows High sugar). With no component for it (ungraded, or not scored), the FSA band alone.
 */
export function gradedLimitLevel(key: LimitKey, per100: number, basis: "per_100g" | "per_100ml", components: ScoreComponent[]): Level {
  const scored = components.filter((c) => LIMIT_COMPONENTS[key].includes(c.key));
  const fsa = limitLevel(key, per100, basis);
  if (scored.length === 0) return fsa;
  if (scored.some(isNotableNegative)) return "high";
  return fsa === "high" ? "medium" : fsa;
}

/** A limit nutrient's band from its per-100 value (never a portion's: bands are per 100 g/ml). */
export function limitLevel(key: LimitKey, per100: number, basis: "per_100g" | "per_100ml" = "per_100g"): Level {
  const [low, high] = BANDS[key][basis === "per_100ml" ? "drink" : "food"];
  return per100 > high ? "high" : per100 > low ? "medium" : "low";
}

export type NutrientUnit = "kcal" | "g" | "mg" | "µg";
export interface NutrientMeta { key: AnyNutrientKey; label: string; unit: NutrientUnit }

/** Everything besides energy and the three macros that a food page lists, limits first. */
export const MORE_NUTRIENTS: NutrientMeta[] = [
  { key: "fibre", label: "Fibre", unit: "g" },
  { key: "sugars", label: "Sugars", unit: "g" },
  { key: "addedSugars", label: "Added sugars", unit: "g" },
  { key: "satFat", label: "Saturated fat", unit: "g" },
  { key: "transFat", label: "Trans fat", unit: "g" },
  { key: "sodiumMg", label: "Sodium", unit: "mg" },
  { key: "cholesterolMg", label: "Cholesterol", unit: "mg" },
  { key: "potassiumMg", label: "Potassium", unit: "mg" },
];

/** Vitamins and minerals (cholesterol and potassium sit with "More nutrients"). */
export const VITAMINS_MINERALS: (NutrientMeta & { key: MicroKey })[] = [
  { key: "calciumMg", label: "Calcium", unit: "mg" },
  { key: "ironMg", label: "Iron", unit: "mg" },
  { key: "magnesiumMg", label: "Magnesium", unit: "mg" },
  { key: "zincMg", label: "Zinc", unit: "mg" },
  { key: "phosphorusMg", label: "Phosphorus", unit: "mg" },
  { key: "vitaminAUg", label: "Vitamin A", unit: "µg" },
  { key: "vitaminCMg", label: "Vitamin C", unit: "mg" },
  { key: "vitaminDUg", label: "Vitamin D", unit: "µg" },
  { key: "vitaminEMg", label: "Vitamin E", unit: "mg" },
  { key: "vitaminKUg", label: "Vitamin K", unit: "µg" },
  { key: "thiaminMg", label: "Thiamin (B1)", unit: "mg" },
  { key: "riboflavinMg", label: "Riboflavin (B2)", unit: "mg" },
  { key: "niacinMg", label: "Niacin (B3)", unit: "mg" },
  { key: "vitaminB6Mg", label: "Vitamin B6", unit: "mg" },
  { key: "folateUg", label: "Folate", unit: "µg" },
  { key: "vitaminB12Ug", label: "Vitamin B12", unit: "µg" },
];

/** Energy and the macros, for the full table. */
export const CORE_NUTRIENTS: (NutrientMeta & { key: NutrientKey })[] = [
  { key: "energyKcal", label: "Calories", unit: "kcal" },
  { key: "protein", label: "Protein", unit: "g" },
  { key: "carbs", label: "Carbs", unit: "g" },
  { key: "fat", label: "Fat", unit: "g" },
];

/**
 * An amount as people read it: whole numbers from 10 up ("289", "1,250"), one decimal from 1 ("2.4"),
 * two significant figures below that ("0.45", "0.032"). A trace never rounds to "0": it reads "<0.01".
 */
export function formatAmount(v: number): string {
  if (v >= 10) return Math.round(v).toLocaleString("en-IN");
  if (v >= 1) return String(Math.round(v * 10) / 10);
  if (v === 0) return "0";
  if (v < 0.01) return "<0.01";
  return String(Number(v.toPrecision(2)));
}

export interface NutrientRow extends NutrientMeta {
  value: number;
  /** Whole % of the Daily Value (lib/nutrition/daily-values.ts), null without one. */
  dv: number | null;
  /** A limit nutrient's band from its per-100 value; undefined for the rest, or when there is no per-100 value. */
  level?: Level;
}

/**
 * The "More nutrients" cards for `n` (the values shown: per 100, or a meal's whole plate), in list
 * order, the ones `n` holds only. `per100` bands sugars, saturated fat and sodium (with the grade's
 * `components`, so the band agrees with its reasons: gradedLimitLevel); pass null when there is no
 * per-100 figure (a per-serving label), and they get no band.
 */
export function moreNutrientRows(n: Nutrients, per100: Nutrients | null, basis: "per_100g" | "per_100ml", components: ScoreComponent[] = []): NutrientRow[] {
  return MORE_NUTRIENTS.flatMap((m) => {
    const value = n[m.key];
    if (value === undefined) return [];
    const p = per100?.[m.key];
    const level = (LIMIT_KEYS as string[]).includes(m.key) && p !== undefined ? gradedLimitLevel(m.key as LimitKey, p, basis, components) : undefined;
    return [{ ...m, value, dv: percentDV(m.key, value), ...(level && { level }) }];
  });
}

/** The vitamins and minerals `n` holds, the largest share of its Daily Value first (ties in list order). */
export function vitaminMineralRows(n: Nutrients): NutrientRow[] {
  return VITAMINS_MINERALS
    .flatMap((m) => (n[m.key] === undefined ? [] : [{ ...m, value: n[m.key]!, dv: percentDV(m.key, n[m.key]) }]))
    .sort((a, b) => (b.dv ?? -1) - (a.dv ?? -1));
}

/** Every nutrient `n` holds, for the full table: energy and macros, more nutrients, then vitamins and minerals in list order. */
export function allNutrientRows(n: Partial<Nutrients>): NutrientRow[] {
  return [...CORE_NUTRIENTS, ...MORE_NUTRIENTS, ...VITAMINS_MINERALS].flatMap((m) => {
    const value = n[m.key];
    return value === undefined ? [] : [{ ...m, value, dv: percentDV(m.key, value) }];
  });
}
