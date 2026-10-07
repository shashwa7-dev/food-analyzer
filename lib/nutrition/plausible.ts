import { MICRO_KEYS, NUTRIENT_KEYS, type MicroKey, type NutrientKey } from "./types";

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
 * Bounds for the micros (lib/nutrition/types.ts MICRO_KEYS), per 100 g/ml in each key's own unit. Each
 * sits a few times above the richest real food (the comment), so the values a food can hold pass while
 * the usual source error, a unit slip of 1,000× (OFF stores minerals and vitamins in grams; a label read
 * in mg typed as g, or µg as mg), lands far past it. Minerals never exceed half the food's weight
 * (50,000 mg); potassium and calcium allow salt substitutes and mineral powders.
 */
export const MICRO_MAX: Record<MicroKey, number> = {
  cholesterolMg: 5_000, // dried egg yolk ~2,300 mg
  potassiumMg: 50_000, // potassium-chloride salt substitute ~52 % K is the one real outlier: past half the weight is not food
  calciumMg: 40_000, // calcium carbonate is 40 % Ca
  ironMg: 2_000, // dried thyme ~124 mg; fortified premixes higher
  magnesiumMg: 20_000,
  zincMg: 2_000, // oysters ~90 mg
  phosphorusMg: 25_000,
  vitaminAUg: 50_000, // cod liver oil ~30,000 µg RAE
  vitaminCMg: 10_000, // Kakadu plum ~5,300 mg
  vitaminDUg: 1_000, // cod liver oil ~250 µg
  vitaminEMg: 1_000, // wheat germ oil ~150 mg
  vitaminKUg: 5_000, // dried basil ~1,700 µg
  thiaminMg: 100, // nutritional yeast ~40 mg
  riboflavinMg: 100,
  niacinMg: 500, // yeast extract ~130 mg
  vitaminB6Mg: 100,
  folateUg: 10_000, // yeast extract ~3,000 µg
  vitaminB12Ug: 1_000, // clams ~99 µg; fortified yeast spreads more
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

/** The micros of `per100` holding an implausible value: negative, non-finite, or past MICRO_MAX. */
export function implausibleMicroKeys(per100: Partial<Record<MicroKey, number | undefined>>): MicroKey[] {
  return MICRO_KEYS.filter((k) => {
    const v = per100[k];
    return v !== undefined && !(Number.isFinite(v) && v >= 0 && v <= MICRO_MAX[k]);
  });
}

export interface PlausibleNutrients<T> {
  /** `per100` with every implausible optional value removed (energy and macros are left as they are). */
  per100: T;
  /** Optional macro-set values that were removed (the ones a grade, a total or a provenance can depend on). */
  dropped: NutrientKey[];
  /** Micros that were removed: display data only, so dropping one never touches a grade. */
  droppedMicros: MicroKey[];
  /** Implausible energy/protein/carbs/fat: required, so not removable here. The caller rejects the record. */
  badCore: CoreKey[];
}

/** Drops implausible optional per-100 values (they become unknown) and reports implausible core ones. */
export function dropImplausible<T extends Partial<Record<NutrientKey | MicroKey, number | undefined>>>(per100: T): PlausibleNutrients<T> {
  const bad = implausibleKeys(per100);
  const droppedMicros = implausibleMicroKeys(per100);
  if (bad.length === 0 && droppedMicros.length === 0) return { per100, dropped: [], droppedMicros, badCore: [] };
  const out = { ...per100 };
  for (const k of droppedMicros) delete out[k];
  const dropped: NutrientKey[] = [];
  const badCore: CoreKey[] = [];
  for (const k of bad) {
    if (isCore(k)) badCore.push(k);
    else { delete out[k]; dropped.push(k); }
  }
  return { per100: out, dropped, droppedMicros, badCore };
}
