import type { food } from "@/lib/db/schema";
import { classify } from "@/lib/nutrition/classify";
import { gradeFood, GRADE_VERSION } from "@/lib/nutrition/grade";
import { ensureBasePortion } from "@/lib/nutrition/portions";
import { NUTRIENT_KEYS, type Nutrients, type Portion, type Provenance } from "@/lib/nutrition/types";
import { aliasesFor, buildSearchFields, normalise } from "./normalise";

export interface SourceRecord {
  source: "indb" | "fndds" | "off";
  sourceRef: string; // INDB food_code, FNDDS fdcId, OFF barcode
  name: string;
  brand?: string;
  barcode?: string;
  basis: "per_100g" | "per_100ml";
  per100: Nutrients;
  portions: Portion[]; // as given by the source (no 100 g base yet)
  wweia?: string; // FNDDS only
  categories?: string[]; // OFF only
  ingredients?: string[];
  allergens?: string[];
  mayContain?: string[]; // OFF traces_tags
  additives?: string[];
  nova?: number | null;
  nutriscore?: string | null;
  imageUrl?: string;
  countries: string[]; // ISO alpha-2
}

export type FoodDraft = Omit<typeof food.$inferInsert, "id" | "searchText" | "popularity" | "createdAt" | "updatedAt">;
export interface HouseholdRule { keywords: string[]; label: string; grams: number }

// INDB has a couple of raw-import artifacts — serving labels that are just a bare gram/ml unit ("1 ml", "1 gm") —
// which are not meaningful household portions. Drop them before computing the 100 g/ml base portion.
const BARE_UNIT_LABEL = /^1 (ml|g|gm|gram|grams)$/i;

export function parseHouseholdCsv(text: string): HouseholdRule[] {
  return text.trim().split("\n").slice(1).map((line) => {
    const [kw, label, grams] = line.split(",");
    return { keywords: kw!.split("|").map((k) => k.trim()), label: label!.trim(), grams: Number(grams) };
  });
}

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function householdFor(name: string, rules: HouseholdRule[]): Portion[] {
  const n = normalise(name);
  const rule = rules.find((r) => r.keywords.some((k) => new RegExp(`\\b${escapeRegExp(k)}\\b`).test(n)));
  return rule ? [{ label: rule.label, amount: 1, unit: "household", grams: rule.grams }] : [];
}

export function toFoodDraft(rec: SourceRecord, rules: HouseholdRule[]): FoodDraft {
  const { kind, gradeCategory } = classify({ source: rec.source, name: rec.name, categories: rec.categories, wweia: rec.wweia });
  const sourcePortions = rec.portions.filter((p) => !BARE_UNIT_LABEL.test(p.label));
  const portions = ensureBasePortion(rec.basis, [...sourcePortions, ...(rec.source === "indb" ? householdFor(rec.name, rules) : [])]);
  const gradePortionGrams = gradeCategory === "dish" ? (portions.find((p) => p.grams && p.unit !== "g" && p.unit !== "ml")?.grams ?? 250) : null;
  const g = gradeFood({ gradeCategory, per100: rec.per100, gradePortionGrams, additives: rec.additives, nova: rec.nova });
  const prov: Provenance = rec.source === "off" ? "community" : "reference";
  const provenance = Object.fromEntries(NUTRIENT_KEYS.filter((k) => rec.per100[k] !== undefined).map((k) => [k, prov])) as FoodDraft["provenance"];
  const aliases = aliasesFor(rec.name);
  return {
    source: rec.source, sourceRef: rec.sourceRef, ownerId: null, kind, gradeCategory, name: rec.name, brand: rec.brand ?? null,
    aliases, barcode: rec.barcode ?? null, basis: rec.basis, per100: rec.per100 as Nutrients, provenance, portions,
    defaultPortion: 0, gradePortionGrams, ingredients: rec.ingredients ?? [], allergens: rec.allergens ?? [], additives: rec.additives ?? [],
    categories: rec.categories ?? [], countries: rec.countries, nutriscoreSource: rec.nutriscore ?? null, nova: rec.nova ?? null,
    grade: g.grade, gradeValue: g.value, gradeComponents: g.components, gradeVersion: GRADE_VERSION, imageUrl: rec.imageUrl ?? null,
    ...buildSearchFields({ name: rec.name, brand: rec.brand, aliases }),
  };
}
