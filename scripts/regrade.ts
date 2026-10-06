import { eq, ne } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { food } from "@/lib/db/schema";
import { gradeFood, GRADE_VERSION } from "@/lib/nutrition/grade";

// Re-scores every food whose stored grade_version is stale, in batches of 500. Each batch re-selects
// rows still behind the current GRADE_VERSION, so updated rows (now current) naturally drop out of the
// next batch's selection — no offset bookkeeping needed.
async function main() {
  let total = 0;
  for (;;) {
    const rows = await db
      .select({
        id: food.id,
        gradeCategory: food.gradeCategory,
        per100: food.per100,
        gradePortionGrams: food.gradePortionGrams,
        additives: food.additives,
        nova: food.nova,
      })
      .from(food)
      .where(ne(food.gradeVersion, GRADE_VERSION))
      .limit(500);
    if (rows.length === 0) break;
    for (const row of rows) {
      const g = gradeFood({
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
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
