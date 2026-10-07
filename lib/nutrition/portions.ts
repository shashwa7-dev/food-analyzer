import { ALL_NUTRIENT_KEYS, type Nutrients, type Portion } from "./types";

/** Every value present (macros and micros) times `factor`; a missing value stays missing. */
export function scaleNutrients(n: Nutrients, factor: number): Nutrients {
  const out: Partial<Nutrients> = {};
  for (const key of ALL_NUTRIENT_KEYS) {
    const v = n[key];
    if (typeof v === "number") out[key] = Math.round(v * factor * 1000) / 1000;
  }
  return out as Nutrients;
}

export function nutrientsFor(per100: Nutrients, grams: number): Nutrients {
  if (!(grams > 0)) throw new Error("grams must be positive");
  return scaleNutrients(per100, grams / 100);
}

export function ensureBasePortion(basis: "per_100g" | "per_100ml", portions: Portion[]): Portion[] {
  const seen = new Set<string>();
  const out: Portion[] = [];
  for (const p of portions) {
    if (seen.has(p.label)) continue;
    seen.add(p.label);
    out.push(p);
  }
  const base: Portion = basis === "per_100ml"
    ? { label: "100 ml", amount: 100, unit: "ml", grams: 100 }
    : { label: "100 g", amount: 100, unit: "g", grams: 100 };
  if (!seen.has(base.label)) out.push(base);
  return out;
}

export function rescaleEntry(old: { portion: Portion; nutrients: Nutrients }, next: Portion): Nutrients | null {
  if (old.portion.grams && next.grams) return scaleNutrients(old.nutrients, next.grams / old.portion.grams);
  if (old.portion.unit === next.unit && old.portion.label === next.label && old.portion.amount > 0) {
    return scaleNutrients(old.nutrients, next.amount / old.portion.amount);
  }
  return null;
}
