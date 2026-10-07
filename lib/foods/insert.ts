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

/** A unique violation on `food_barcode_uq`, possibly wrapped (Drizzle puts the driver error in `cause`). */
export function isBarcodeUniqueViolation(err: unknown): boolean {
  for (let e: unknown = err; e && typeof e === "object"; e = (e as { cause?: unknown }).cause) {
    const { code, constraint } = e as { code?: unknown; constraint?: unknown };
    if (code === "23505" && constraint === "food_barcode_uq") return true;
  }
  return false;
}

/**
 * Runs `run` and, if it fails on `food_barcode_uq`, runs it once more (review N2). The race: another
 * transaction inserts a barcoded crowd row this one's release UPDATE can't see yet; our INSERT then
 * waits on that row's barcode-index entry (not the ON CONFLICT arbiter) and raises 23505 once it
 * commits. On the retry the committed row is visible, so it is released or dropped first.
 */
export async function retryOnBarcodeRace<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (!isBarcodeUniqueViolation(err)) throw err;
    return run();
  }
}

/**
 * Caches an OFF barcode hit. OFF's curated entry wins over a crowd food holding the same barcode (one
 * made from a label photo, possibly misread or faked): the crowd row gives the barcode up — or is
 * dropped when a barcode-less crowd twin already exists (the crowd dedupe index) — so a crowd row can
 * never shadow OFF's product for that code. A dropped row's users keep it: their recents/frequent stats
 * and diary entries are re-pointed at the twin first (review N3).
 */
export async function cacheOffFood(draft: FoodDraft): Promise<FoodRow> {
  return retryOnBarcodeRace(() => db.transaction(async (tx) => {
    if (draft.barcode) {
      // At most one row holds the barcode, and the crowd dedupe index allows at most one twin.
      const { rows } = await tx.execute(sql`
        SELECT f.id AS "oldId", t.id AS "twinId" FROM food f
        JOIN food t ON t.source = 'crowd' AND t.barcode IS NULL AND t.norm_name = f.norm_name AND t.norm_brand = f.norm_brand
        WHERE f.barcode = ${draft.barcode} AND f.source = 'crowd'
        FOR UPDATE OF f`);
      for (const { oldId, twinId } of rows as { oldId: string; twinId: string }[]) await mergeCrowdFoodInto(tx, oldId, twinId);
      await tx.update(food).set({ barcode: null, updatedAt: new Date() }).where(and(eq(food.barcode, draft.barcode), eq(food.source, "crowd")));
    }
    return upsertFood(draft, tx);
  }));
}

/**
 * Moves every user's stats (summing uses, latest last_used_at) and log entries from one crowd food to
 * its twin, adds its popularity to the twin's (search ranking), then deletes it.
 */
async function mergeCrowdFoodInto(tx: Tx, oldId: string, twinId: string): Promise<void> {
  await tx.execute(sql`
    INSERT INTO user_food_stats (user_id, food_id, uses, last_used_at)
    SELECT user_id, ${twinId}, uses, last_used_at FROM user_food_stats WHERE food_id = ${oldId}
    ON CONFLICT (user_id, food_id) DO UPDATE SET
      uses = user_food_stats.uses + excluded.uses,
      last_used_at = GREATEST(user_food_stats.last_used_at, excluded.last_used_at)`);
  await tx.execute(sql`DELETE FROM user_food_stats WHERE food_id = ${oldId}`);
  await tx.execute(sql`UPDATE food_log SET food_id = ${twinId}, updated_at = now() WHERE food_id = ${oldId}`);
  await tx.execute(sql`UPDATE food t SET popularity = t.popularity + o.popularity, updated_at = now() FROM food o WHERE t.id = ${twinId} AND o.id = ${oldId}`);
  await tx.execute(sql`DELETE FROM food WHERE id = ${oldId}`);
}
