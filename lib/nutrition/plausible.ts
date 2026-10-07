import { NUTRIENT_KEYS, type NutrientKey } from "./types";

/**
 * Plausibility bounds for per-100 g/ml values: the one place that says what a real food can hold.
 * Source data has unit errors (an Open Food Facts product with 350,428 mg sodium per 100 g, sodium
 * keyed in as mg where g was meant); a value past these bounds is treated as unknown, never clamped to
 * the bound, because a wrong number is worse than a missing one.
 *
 * Applied where per-100 data enters (the OFF mapping on seed and live lookup, the seed draft, the scan
 * engine's label/front facts) and where stored rows are read for display (lib/foods/sane.ts).
 */
export const PER100_MAX: Record<NutrientKey, number> = {
  // Pure fat is 900 kcal at 9 kcal/g; food-specific Atwater factors go a touch higher (FNDDS lard: 902).
  energyKcal: 910,
  protein: 100, carbs: 100, fat: 100, fibre: 100,
  sugars: 100, addedSugars: 100, satFat: 100, transFat: 100,
  sodiumMg: 40_000, // pure salt is ~39,300 mg sodium per 100 g
};

/**
 * Slack for a part-of-whole check: 1 g or 5 % of the whole, whichever is larger. Reference tables
 * measure sugars and carbs separately, so a part can exceed its whole by analytical noise (FNDDS butter:
 * sugars 0.58 g, carbs 0.06 g; paneer: 23.3 g vs 22.5 g); a unit or field error is far larger
 * (OFF "Melody": sugars 53.8 g, carbs 0 g).
 */
const partSlack = (whole: number): number => Math.max(1, whole * 0.05);

/** A part can't exceed its wholes: sugars within carbs, added sugars within sugars and carbs, sat/trans fat within fat. */
const PART_OF: Partial<Record<NutrientKey, NutrientKey[]>> = { sugars: ["carbs"], addedSugars: ["sugars", "carbs"], satFat: ["fat"], transFat: ["fat"] };

export const CORE_KEYS = ["energyKcal", "protein", "carbs", "fat"] as const satisfies readonly NutrientKey[];
export type CoreKey = (typeof CORE_KEYS)[number];
const isCore = (k: NutrientKey): k is CoreKey => (CORE_KEYS as readonly string[]).includes(k);

const inRange = (k: NutrientKey, v: number): boolean => Number.isFinite(v) && v >= 0 && v <= PER100_MAX[k];

/** The keys of `per100` outside their range: negative, non-finite, or past PER100_MAX. */
export function outOfRangeKeys(per100: Partial<Record<NutrientKey, number | undefined>>): NutrientKey[] {
  return NUTRIENT_KEYS.filter((k) => per100[k] !== undefined && !inRange(k, per100[k]));
}

/**
 * The keys of `per100` holding an implausible value: out of its range (negative, non-finite, past
 * PER100_MAX), or a part larger than its whole by more than PART_SLACK. A part is only compared with a
 * whole that is itself in range (an absurd whole is reported on its own).
 */
export function implausibleKeys(per100: Partial<Record<NutrientKey, number | undefined>>): NutrientKey[] {
  const out: NutrientKey[] = [];
  for (const k of NUTRIENT_KEYS) {
    const v = per100[k];
    if (v === undefined) continue;
    if (!inRange(k, v)) { out.push(k); continue; }
    const exceeds = (PART_OF[k] ?? []).some((w) => {
      const whole = per100[w];
      return whole !== undefined && !out.includes(w) && inRange(w, whole) && v > whole + partSlack(whole);
    });
    if (exceeds) out.push(k);
  }
  return out;
}

export interface PlausibleNutrients<T> {
  /** `per100` with every implausible optional value removed (energy and macros are left as they are). */
  per100: T;
  /** Optional values that were removed. */
  dropped: NutrientKey[];
  /** Implausible energy/protein/carbs/fat: required, so not removable here. The caller rejects the record. */
  badCore: CoreKey[];
}

/** Drops implausible optional per-100 values (they become unknown) and reports implausible core ones. */
export function dropImplausible<T extends Partial<Record<NutrientKey, number | undefined>>>(per100: T): PlausibleNutrients<T> {
  const bad = implausibleKeys(per100);
  if (bad.length === 0) return { per100, dropped: [], badCore: [] };
  const out = { ...per100 };
  const dropped: NutrientKey[] = [];
  const badCore: CoreKey[] = [];
  for (const k of bad) {
    if (isCore(k)) badCore.push(k);
    else { delete out[k]; dropped.push(k); }
  }
  return { per100: out, dropped, badCore };
}
