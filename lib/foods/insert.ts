import { and, eq, sql } from "drizzle-orm";
import { db, type Db, type Tx } from "@/lib/db/client";
import { food } from "@/lib/db/schema";
import type { FoodDraft } from "./seed-map";
import type { FoodRow } from "./types";

// Shared between the bulk seed upsert (many rows) and upsertFood (a single OFF-cache hit) so both paths
// update exactly the same columns on conflict.
function conflictSet() {
  return {
    name: sql`excluded.name`, brand: sql`excluded.brand`, aliases: sql`excluded.aliases`, kind: sql`excluded.kind`,
    barcode: sql`excluded.barcode`,
    gradeCategory: sql`excluded.grade_category`, per100: sql`excluded.per100`, provenance: sql`excluded.provenance`,
    portions: sql`excluded.portions`, gradePortionGrams: sql`excluded.grade_portion_grams`, grade: sql`excluded.grade`,
    gradeValue: sql`excluded.grade_value`, gradeComponents: sql`excluded.grade_components`, gradeVersion: sql`excluded.grade_version`,
    ingredients: sql`excluded.ingredients`, allergens: sql`excluded.allergens`, additives: sql`excluded.additives`,
    mayContain: sql`excluded.may_contain`,
    categories: sql`excluded.categories`, nova: sql`excluded.nova`, normName: sql`excluded.norm_name`,
    countries: sql`excluded.countries`, basis: sql`excluded.basis`, imageUrl: sql`excluded.image_url`,
    nutriscoreSource: sql`excluded.nutriscore_source`, defaultPortion: sql`excluded.default_portion`,
    normBrand: sql`excluded.norm_brand`, searchName: sql`excluded.search_name`, searchText: sql`excluded.search_text`, updatedAt: sql`now()`,
  };
}

export async function upsertFoods(drafts: FoodDraft[]): Promise<number> {
  let n = 0;
  for (let i = 0; i < drafts.length; i += 500) {
    const chunk = drafts.slice(i, i + 500).map((d) => ({ ...d, searchText: sql`to_tsvector('simple', ${d.searchName})` as unknown as string }));
    await db.insert(food).values(chunk).onConflictDoUpdate({ target: [food.source, food.sourceRef], set: conflictSet() });
    n += chunk.length;
  }
  return n;
}

// Single-food upsert used to cache an OFF barcode-lookup hit (lib/engine/off.ts via the scan route):
// one row in, the stored row back out (so the caller has its id).
export async function upsertFood(draft: FoodDraft, ex: Db | Tx = db): Promise<FoodRow> {
  const row = { ...draft, searchText: sql`to_tsvector('simple', ${draft.searchName})` as unknown as string };
  const [result] = await ex.insert(food).values(row).onConflictDoUpdate({ target: [food.source, food.sourceRef], set: conflictSet() }).returning();
  return result!;
}

/**
 * Caches an OFF barcode hit. OFF's curated entry wins over a crowd food holding the same barcode (one
 * made from a label photo, possibly misread or faked): the crowd row gives the barcode up — or is
 * dropped when a barcode-less crowd twin already exists (the crowd dedupe index) — so a crowd row can
 * never shadow OFF's product for that code.
 */
export async function cacheOffFood(draft: FoodDraft): Promise<FoodRow> {
  return db.transaction(async (tx) => {
    if (draft.barcode) {
      await tx.execute(sql`DELETE FROM food f WHERE f.barcode = ${draft.barcode} AND f.source = 'crowd' AND EXISTS (
        SELECT 1 FROM food t WHERE t.source = 'crowd' AND t.barcode IS NULL AND t.norm_name = f.norm_name AND t.norm_brand = f.norm_brand)`);
      await tx.update(food).set({ barcode: null, updatedAt: new Date() }).where(and(eq(food.barcode, draft.barcode), eq(food.source, "crowd")));
    }
    return upsertFood(draft, tx);
  });
}
