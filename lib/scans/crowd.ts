// Scans → shared `crowd` foods (spec §3 "How scans become foods"). The engine only emits a
// CrowdCandidate for a high-confidence, validated label scan with a product name, so there is no
// confidence comparison here: a newer high-confidence label simply refreshes an existing crowd row.
import { sql } from "drizzle-orm";
import type { Tx } from "@/lib/db/client";
import { food } from "@/lib/db/schema";
import type { CrowdCandidate } from "@/lib/engine";
import { buildSearchFields } from "@/lib/foods/normalise";
import { defaultPortionIndex, type FoodDraft } from "@/lib/foods/seed-map";
import { classify } from "@/lib/nutrition/classify";
import { gradeFood, GRADE_VERSION } from "@/lib/nutrition/grade";
import { NUTRIENT_KEYS, type NutrientKey, type Provenance } from "@/lib/nutrition/types";

export function crowdDraft(c: CrowdCandidate, country: string): FoodDraft {
  const { kind, gradeCategory } = classify({ source: "crowd", name: c.name, categories: c.categories, per100: c.per100 });
  const g = gradeFood({ gradeCategory, per100: c.per100, gradePortionGrams: null, additives: c.additives });
  const provenance: Partial<Record<NutrientKey, Provenance>> = Object.fromEntries(
    NUTRIENT_KEYS.filter((k) => c.per100[k] !== undefined).map((k) => [k, "label" as const]),
  );
  return {
    source: "crowd", sourceRef: null, ownerId: null, kind, gradeCategory, name: c.name, brand: c.brand, aliases: [],
    barcode: c.barcode, basis: c.basis, per100: c.per100, provenance, portions: c.portions, defaultPortion: defaultPortionIndex(c.portions),
    gradePortionGrams: null, ingredients: c.ingredients, allergens: c.allergens, mayContain: c.mayContain, additives: c.additives,
    categories: c.categories, countries: [country], nutriscoreSource: null, nova: null,
    grade: g.grade, gradeValue: g.value, gradeComponents: g.components, gradeVersion: GRADE_VERSION, imageUrl: null, // never a user's photo
    ...buildSearchFields({ name: c.name, brand: c.brand }),
  };
}

// Columns a newer label refreshes. Never source/owner/barcode/popularity; countries are merged.
function crowdConflictSet() {
  return {
    name: sql`excluded.name`, brand: sql`excluded.brand`, kind: sql`excluded.kind`, gradeCategory: sql`excluded.grade_category`,
    basis: sql`excluded.basis`, per100: sql`excluded.per100`, provenance: sql`excluded.provenance`, portions: sql`excluded.portions`,
    defaultPortion: sql`excluded.default_portion`, ingredients: sql`excluded.ingredients`, allergens: sql`excluded.allergens`,
    mayContain: sql`excluded.may_contain`, additives: sql`excluded.additives`, categories: sql`excluded.categories`,
    grade: sql`excluded.grade`, gradeValue: sql`excluded.grade_value`, gradeComponents: sql`excluded.grade_components`,
    gradeVersion: sql`excluded.grade_version`, normName: sql`excluded.norm_name`, normBrand: sql`excluded.norm_brand`,
    searchName: sql`excluded.search_name`, searchText: sql`excluded.search_text`,
    countries: sql`ARRAY(SELECT DISTINCT unnest(${food.countries} || excluded.countries) ORDER BY 1)`,
    updatedAt: sql`now()`,
  };
}

/**
 * Upserts the crowd food and returns its id, or null when the barcode already belongs to a
 * non-crowd row (OFF/INDB/FNDDS rows are never overwritten by a scan; custom foods never carry a
 * shared barcode). With a barcode the conflict target is `food_barcode_uq`; without one it is the
 * partial crowd dedupe index (source, norm_name, norm_brand) WHERE barcode IS NULL AND source = 'crowd'.
 */
export async function upsertCrowdFood(tx: Tx, draft: FoodDraft): Promise<string | null> {
  const row = { ...draft, searchText: sql`to_tsvector('simple', ${draft.searchName})` as unknown as string };
  const rows = draft.barcode
    ? await tx.insert(food).values(row)
        .onConflictDoUpdate({ target: food.barcode, set: crowdConflictSet(), setWhere: sql`${food.source} = 'crowd'` })
        .returning({ id: food.id })
    : await tx.insert(food).values(row)
        .onConflictDoUpdate({
          target: [food.source, food.normName, food.normBrand],
          targetWhere: sql`${food.barcode} IS NULL AND ${food.source} = 'crowd'`,
          set: crowdConflictSet(),
        })
        .returning({ id: food.id });
  return rows[0]?.id ?? null;
}
