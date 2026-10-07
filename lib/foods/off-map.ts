import { dropImplausible } from "@/lib/nutrition/plausible";
import type { Nutrients, Portion } from "@/lib/nutrition/types";
import type { SourceRecord } from "./seed-map";

const num = (v: unknown): number | undefined => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
};
const r3 = (n: number) => Math.round(n * 1000) / 1000;
function clean(n: Partial<Nutrients>): Nutrients {
  const out: Partial<Nutrients> = {};
  for (const [k, v] of Object.entries(n)) if (typeof v === "number" && Number.isFinite(v) && v >= 0) out[k as keyof Nutrients] = r3(v);
  return out as Nutrients;
}

export interface OffRow {
  code: string; product_name?: string; brands?: string; categories_tags?: string[]; nutriments?: Record<string, unknown>;
  serving_quantity?: unknown; product_quantity?: unknown; nova_group?: unknown; additives_tags?: string[]; allergens_tags?: string[];
  traces_tags?: string[]; ingredients_text?: string; nutrition_grades?: string; image_front_url?: string;
  countries_tags?: string[];
}

// Plan-review amendment: countries are derived from countries_tags at mapping time (not hardcoded), so the
// same mapper works for both the runtime barcode lookup (lib/engine/off.ts, real countries_tags from the
// API) and the bulk India import (scripts/fetch-sources.ts, which synthesizes countries_tags: ["en:india"]
// on every row since its Parquet query already filters to en:india). Tags with no entry here are ignored;
// no match at all yields [].
const COUNTRY_TAG: Record<string, string> = {
  "en:india": "IN", "en:united-states": "US", "en:united-kingdom": "GB", "en:united-arab-emirates": "AE",
  "en:canada": "CA", "en:australia": "AU", "en:singapore": "SG",
};

export function countriesFromTags(tags: string[] | undefined): string[] {
  const out = new Set<string>();
  for (const t of tags ?? []) {
    const iso = COUNTRY_TAG[t];
    if (iso) out.add(iso);
  }
  return [...out];
}

export function toSourceRecordOFF(p: OffRow): SourceRecord | null {
  const nm = p.nutriments ?? {};
  const kcal = num(nm["energy-kcal_100g"]) ?? (num(nm["energy_100g"]) !== undefined ? num(nm["energy_100g"])! / 4.184 : undefined);
  const protein = num(nm.proteins_100g), carbs = num(nm.carbohydrates_100g), fat = num(nm.fat_100g);
  const name = (p.product_name ?? "").trim();
  if (!name || kcal === undefined || protein === undefined || carbs === undefined || fat === undefined) return null;
  const sodiumG = num(nm.sodium_100g) ?? (num(nm.salt_100g) !== undefined ? num(nm.salt_100g)! / 2.5 : undefined);
  // Implausible values (unit errors in OFF's data) become unknown; implausible energy or macros reject the product.
  const { per100, badCore } = dropImplausible(clean({ energyKcal: kcal, protein, carbs, fat, sugars: num(nm.sugars_100g), satFat: num(nm["saturated-fat_100g"]), fibre: num(nm.fiber_100g), sodiumMg: sodiumG !== undefined ? sodiumG * 1000 : undefined }));
  if (badCore.length > 0) return null;
  const portions: Portion[] = [];
  const serving = num(p.serving_quantity), pack = num(p.product_quantity);
  if (serving && serving > 0 && serving < 5000) portions.push({ label: "1 serving", amount: 1, unit: "serving", grams: Math.round(serving) });
  if (pack && pack > 0 && pack < 10000) portions.push({ label: "1 pack", amount: 1, unit: "pack", grams: Math.round(pack) });
  const cats = p.categories_tags ?? [];
  return {
    source: "off", sourceRef: p.code, barcode: p.code, name, brand: p.brands?.split(",")[0]?.trim() || undefined,
    basis: cats.includes("en:beverages") ? "per_100ml" : "per_100g", per100, portions, categories: cats,
    ingredients: p.ingredients_text ? p.ingredients_text.split(/,\s*/).map((s) => s.trim()).filter(Boolean).slice(0, 80) : [],
    allergens: [...(p.allergens_tags ?? [])], additives: p.additives_tags ?? [], mayContain: p.traces_tags ?? [],
    nova: num(p.nova_group) ?? null, nutriscore: p.nutrition_grades ?? null, imageUrl: p.image_front_url,
    countries: countriesFromTags(p.countries_tags),
  };
}
