import { and, eq, ne } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { db } from "@/lib/db/client";
import { food } from "@/lib/db/schema";
import { wweiaOf } from "@/lib/foods/seed-map";
import { classify } from "@/lib/nutrition/classify";
import { gradeFood, GRADE_VERSION } from "@/lib/nutrition/grade";

/**
 * Foods due for re-grading: stored `grade_version` behind the current `GRADE_VERSION`, excluding any
 * row with `grade_frozen` (foods saved from a scan, Task 9 — their grade is a snapshot of the scan
 * result, which carries no additives/NOVA/OFF-categories, so recomputing it here would silently
 * replace it with a different, coarser grade than the one the user already saw on the scan).
 */
export function staleFoodsQuery(ex: Db, limit = 500) {
  return ex
    .select({
      id: food.id,
      source: food.source,
      name: food.name,
      categories: food.categories,
      gradeCategory: food.gradeCategory,
      per100: food.per100,
      gradePortionGrams: food.gradePortionGrams,
      additives: food.additives,
      nova: food.nova,
    })
    .from(food)
    .where(and(ne(food.gradeVersion, GRADE_VERSION), eq(food.gradeFrozen, false)))
    .limit(limit);
}

// Re-scores every food whose stored grade_version is stale, in batches of 500. Each batch re-selects
// rows still behind the current GRADE_VERSION, so updated rows (now current) naturally drop out of the
// next batch's selection — no offset bookkeeping needed.
async function main() {
  let total = 0;
  for (;;) {
    const rows = await staleFoodsQuery(db);
    if (rows.length === 0) break;
    for (const row of rows) {
      // Fruit/vegetable credit is derived from the FNDDS WWEIA category, kept in categories by the seed.
      const fvlPercent = row.source === "fndds" ? classify({ source: "fndds", name: row.name, wweia: wweiaOf(row.categories), per100: row.per100 }).fvlPercent : undefined;
      const g = gradeFood({
        fvlPercent,
        gradeCategory: row.gradeCategory,
        per100: row.per100,
        gradePortionGrams: row.gradePortionGrams,
        additives: row.additives,
        nova: row.nova,
      });
      await db
        .update(food)
        .set({ grade: g.grade, gradeValue: g.value, gradeComponents: g.components, gradeVersion: GRADE_VERSION, updatedAt: new Date() })
        .where(eq(food.id, row.id));
    }
    total += rows.length;
    console.log(`regraded ${total} foods so far`);
  }
  console.log(`regrade complete: ${total} foods updated`);
  process.exit(0);
}
if (process.argv[1]?.endsWith("regrade.ts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
