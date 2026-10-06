import type { food } from "@/lib/db/schema";
import { classify } from "@/lib/nutrition/classify";
import { gradeFood, GRADE_VERSION } from "@/lib/nutrition/grade";
import { ensureBasePortion } from "@/lib/nutrition/portions";
import { NUTRIENT_KEYS, type Nutrients, type Portion, type Provenance } from "@/lib/nutrition/types";
import { aliasesFor, buildSearchFields, normalise, stapleAliasesFor } from "./normalise";

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

// Measures that are not a real eating portion: FNDDS "Guideline amount per …", tiny spoon/inch measures.
const NOT_A_PORTION = /guideline amount|fl oz|cubic inch|surface inch|tablespoon|teaspoon|tbsp|tsp/i;
const MIN_GRADE_GRAMS = 100;
// FNDDS has no category tags; its WWEIA category is kept in `categories` with this prefix so regrade can
// recompute the fruit/vegetable credit.
export const WWEIA_PREFIX = "wweia:";
export const wweiaOf = (categories: string[]): string | undefined =>
  categories.find((c) => c.startsWith(WWEIA_PREFIX))?.slice(WWEIA_PREFIX.length);

/** Index of the first real eating portion with a known weight (the 100 g/ml base always qualifies). */
export function representativePortion(portions: Portion[]): number {
  const i = portions.findIndex((p) => p.grams && !NOT_A_PORTION.test(p.label));
  return i >= 0 ? i : 0;
}

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function householdFor(name: string, rules: HouseholdRule[]): Portion[] {
  const n = normalise(name);
  const rule = rules.find((r) => r.keywords.some((k) => new RegExp(`\\b${escapeRegExp(k)}\\b`).test(n)));
  return rule ? [{ label: rule.label, amount: 1, unit: "household", grams: rule.grams }] : [];
}

export function toFoodDraft(rec: SourceRecord, rules: HouseholdRule[]): FoodDraft {
  const { kind, gradeCategory, fvlPercent } = classify({ source: rec.source, name: rec.name, categories: rec.categories, wweia: rec.wweia, per100: rec.per100 });
  const sourcePortions = rec.portions.filter((p) => !BARE_UNIT_LABEL.test(p.label));
  const portions = ensureBasePortion(rec.basis, [...sourcePortions, ...(rec.source === "indb" ? householdFor(rec.name, rules) : [])]);
  // Dishes are graded on one frozen reference portion: the first real portion, but never less than 100 g, so a
  // single small piece (one chikki, one roti) can't make a dense recipe look light. Search hits show the same portion.
  const defaultPortion = representativePortion(portions);
  const gradePortionGrams = gradeCategory === "dish" ? Math.max(portions[defaultPortion]?.grams ?? MIN_GRADE_GRAMS, MIN_GRADE_GRAMS) : null;
  const g = gradeFood({ gradeCategory, per100: rec.per100, gradePortionGrams, additives: rec.additives, nova: rec.nova, fvlPercent });
  const categories = rec.categories ?? (rec.wweia ? [`${WWEIA_PREFIX}${rec.wweia}`] : []);
  const prov: Provenance = rec.source === "off" ? "community" : "reference";
  const provenance = Object.fromEntries(NUTRIENT_KEYS.filter((k) => rec.per100[k] !== undefined).map((k) => [k, prov])) as FoodDraft["provenance"];
  // `aliases` holds only curated staple aliases (search ranks an exact alias hit like an exact name); the
  // per-word Hinglish expansions only feed the search text.
  const aliases = stapleAliasesFor(normalise(rec.name));
  const searchAliases = [...new Set([...aliases, ...aliasesFor(rec.name)])];
  return {
    source: rec.source, sourceRef: rec.sourceRef, ownerId: null, kind, gradeCategory, name: rec.name, brand: rec.brand ?? null,
    aliases, barcode: rec.barcode ?? null, basis: rec.basis, per100: rec.per100 as Nutrients, provenance, portions,
    defaultPortion, gradePortionGrams, ingredients: rec.ingredients ?? [], allergens: rec.allergens ?? [], additives: rec.additives ?? [],
    categories, countries: rec.countries, nutriscoreSource: rec.nutriscore ?? null, nova: rec.nova ?? null,
    grade: g.grade, gradeValue: g.value, gradeComponents: g.components, gradeVersion: GRADE_VERSION, imageUrl: rec.imageUrl ?? null,
    ...buildSearchFields({ name: rec.name, brand: rec.brand, aliases: searchAliases }),
  };
}
