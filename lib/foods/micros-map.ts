// How each source's vitamins, minerals and cholesterol become our MICRO_KEYS (lib/nutrition/types.ts),
// per 100 g/ml. Shared by scripts/fetch-sources.ts (INDB, FNDDS, the OFF bulk import) and the OFF
// mapper (lib/foods/off-map.ts, also used by the live barcode lookup).
import { DAILY_VALUES } from "@/lib/nutrition/daily-values";
import type { Micronutrients, MicroKey } from "@/lib/nutrition/types";

const num = (v: unknown): number | undefined => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
};
/** Three significant figures: 0.0024 mg and 2,400 µg both keep their precision. */
const sig3 = (n: number) => Number(n.toPrecision(3));

/**
 * Keeps the values a food actually holds: finite and above zero. A zero is dropped, not stored: the
 * sources use 0 for "not analysed" as often as for "none" (INDB lists 0 µg retinol and 0 mg
 * cholesterol for paneer curry), and a "0 mg" card would say nothing either way. Plausibility bounds
 * are applied later, where every per-100 value is checked (lib/nutrition/plausible.ts).
 */
export function cleanMicros(m: Partial<Record<MicroKey, number | undefined>>): Micronutrients {
  const out: Micronutrients = {};
  for (const [k, v] of Object.entries(m) as [MicroKey, number | undefined][]) {
    if (v === undefined || !Number.isFinite(v) || v <= 0) continue;
    const r = sig3(v);
    if (r > 0) out[k] = r;
  }
  return out;
}

const sum = (...vs: (number | undefined)[]): number | undefined => (vs.some((v) => v !== undefined) ? vs.reduce<number>((a, v) => a + (v ?? 0), 0) : undefined);

/**
 * The most vitamin E a food can hold for its fat, in mg: 0.6 mg per g of fat (almonds 0.51, sunflower
 * oil 0.41; only wheat germ oil is richer) plus 3 mg from the rest of the food (leafy greens ~2 mg).
 */
export const vitaminEMaxForFat = (fatG: number): number => 0.6 * fatG + 3;

/**
 * INDB columns (checked against INDB.xlsx's header, 2026-10-08). No vitamin B12 column.
 * - Vitamin A: INDB gives retinol (`vita_ug`) and total carotenoids separately; total carotenoids
 *   include ones with no vitamin A activity (lutein, lycopene), so they can't be turned into µg RAE
 *   honestly. Retinol is used only where carotenoids could add at most a tenth to it (at the β-carotene
 *   rate of 12:1), i.e. animal foods; a plant dish gets no vitamin A rather than a guess.
 * - Vitamin D: D3 only. INDB's D2 runs through plant dishes where it can't be (7 µg in matar paneer,
 *   31 µg in rajgira ladoo), so it is left out; with no D3 the food has no vitamin D.
 * - Vitamin E: INDB's figures run ~10x USDA's for like dishes (90th percentile 24.6 mg vs 2.3 mg),
 *   consistent with all tocopherols counted rather than alpha-tocopherol. A value past what the dish's
 *   fat could hold (vitaminEMaxForFat) is dropped; the rest is shown with a footnote saying so
 *   (components/food/result-parts.tsx INDB_VITAMIN_E_NOTE).
 * - Folate is food folate, equal to DFE for unfortified dishes. Vitamin K is K1 + K2.
 */
export function microsFromINDB(row: Record<string, unknown>): Micronutrients {
  const retinol = num(row.vita_ug);
  const carotenoids = num(row.carotenoids_ug) ?? 0;
  const vitaminAUg = retinol !== undefined && retinol > 0 && carotenoids / 12 <= retinol * 0.1 ? retinol + carotenoids / 12 : undefined;
  const vitE = num(row.vite_mg);
  const vitaminEMg = vitE !== undefined && vitE <= vitaminEMaxForFat(num(row.fat_g) ?? 0) ? vitE : undefined;
  return cleanMicros({
    cholesterolMg: num(row.cholesterol_mg), potassiumMg: num(row.potassium_mg), calciumMg: num(row.calcium_mg), ironMg: num(row.iron_mg),
    magnesiumMg: num(row.magnesium_mg), zincMg: num(row.zinc_mg), phosphorusMg: num(row.phosphorus_mg),
    vitaminAUg, vitaminCMg: num(row.vitc_mg), vitaminDUg: num(row.vitd3_ug), vitaminEMg,
    vitaminKUg: sum(num(row.vitk1_ug), num(row.vitk2_ug)),
    thiaminMg: num(row.vitb1_mg), riboflavinMg: num(row.vitb2_mg), niacinMg: num(row.vitb3_mg), vitaminB6Mg: num(row.vitb6_mg), folateUg: num(row.folate_ug),
  });
}

/**
 * FNDDS nutrient numbers (FoodData Central `nutrient.number`, checked in the 2024-10-31 survey JSON):
 * already in our units, vitamin A as RAE (320) and folate as DFE (435).
 */
export const FNDDS_MICRO_NUM: Record<string, MicroKey> = {
  "601": "cholesterolMg", "306": "potassiumMg", "301": "calciumMg", "303": "ironMg", "304": "magnesiumMg", "309": "zincMg", "305": "phosphorusMg",
  "320": "vitaminAUg", "401": "vitaminCMg", "328": "vitaminDUg", "323": "vitaminEMg", "430": "vitaminKUg",
  "404": "thiaminMg", "405": "riboflavinMg", "406": "niacinMg", "415": "vitaminB6Mg", "435": "folateUg", "418": "vitaminB12Ug",
};

/**
 * Open Food Facts nutriment names. OFF normalises every `<name>_100g` to grams, whatever unit the
 * label used, so each is scaled to mg or µg here. "vitamin-pp" is OFF's niacin; folate is
 * "vitamin-b9", or "folates" on some products.
 */
const OFF_MICRO: [MicroKey, string[], number][] = [
  ["cholesterolMg", ["cholesterol"], 1e3], ["potassiumMg", ["potassium"], 1e3], ["calciumMg", ["calcium"], 1e3], ["ironMg", ["iron"], 1e3],
  ["magnesiumMg", ["magnesium"], 1e3], ["zincMg", ["zinc"], 1e3], ["phosphorusMg", ["phosphorus"], 1e3],
  ["vitaminAUg", ["vitamin-a"], 1e6], ["vitaminCMg", ["vitamin-c"], 1e3], ["vitaminDUg", ["vitamin-d"], 1e6], ["vitaminEMg", ["vitamin-e"], 1e3],
  ["vitaminKUg", ["vitamin-k"], 1e6], ["thiaminMg", ["vitamin-b1"], 1e3], ["riboflavinMg", ["vitamin-b2"], 1e3], ["niacinMg", ["vitamin-pp", "vitamin-b3"], 1e3],
  ["vitaminB6Mg", ["vitamin-b6"], 1e3], ["folateUg", ["vitamin-b9", "folates"], 1e6], ["vitaminB12Ug", ["vitamin-b12"], 1e6],
];

/** Below this share of the Daily Value an OFF micro is dropped (OFF_NOISE_DV). */
export const OFF_NOISE_DV = 0.01;

/**
 * OFF micros, in our units. One under 1 % of its Daily Value is dropped as noise: community entries
 * carry rounding residue and unit-converted crumbs (2.4 mg cholesterol, 0.00004 µg vitamin D) that say
 * nothing a reader can use and are as likely a slip as a measurement.
 */
export function microsFromOFF(nutriments: Record<string, unknown>): Micronutrients {
  const m: Partial<Record<MicroKey, number>> = {};
  for (const [key, names, scale] of OFF_MICRO) {
    const g = names.map((n) => num(nutriments[`${n}_100g`])).find((v) => v !== undefined);
    if (g === undefined) continue;
    const v = g * scale;
    if (v >= DAILY_VALUES[key]! * OFF_NOISE_DV) m[key] = v;
  }
  return cleanMicros(m);
}
