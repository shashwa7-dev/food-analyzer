import { and, eq, ne } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { db } from "@/lib/db/client";
import { food } from "@/lib/db/schema";
import { gradeStoredFood } from "@/lib/foods/sane";
import { GRADE_VERSION } from "@/lib/nutrition/grade";
import { dropImplausible } from "@/lib/nutrition/plausible";

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
      // Graded on the plausible values only, the ones the app shows (lib/foods/sane.ts); per100 itself is
      // left as stored (a re-seed rewrites it).
      const g = gradeStoredFood({ ...row, per100: dropImplausible(row.per100).per100 });
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
