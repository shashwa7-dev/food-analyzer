import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { food } from "@/lib/db/schema";
import type { FoodDraft } from "./seed-map";

export async function upsertFoods(drafts: FoodDraft[]): Promise<number> {
  let n = 0;
  for (let i = 0; i < drafts.length; i += 500) {
    const chunk = drafts.slice(i, i + 500).map((d) => ({ ...d, searchText: sql`to_tsvector('simple', ${d.searchName})` as unknown as string }));
    await db.insert(food).values(chunk).onConflictDoUpdate({
      target: [food.source, food.sourceRef],
      set: {
        name: sql`excluded.name`, brand: sql`excluded.brand`, aliases: sql`excluded.aliases`, kind: sql`excluded.kind`,
        gradeCategory: sql`excluded.grade_category`, per100: sql`excluded.per100`, provenance: sql`excluded.provenance`,
        portions: sql`excluded.portions`, gradePortionGrams: sql`excluded.grade_portion_grams`, grade: sql`excluded.grade`,
        gradeValue: sql`excluded.grade_value`, gradeComponents: sql`excluded.grade_components`, gradeVersion: sql`excluded.grade_version`,
        ingredients: sql`excluded.ingredients`, allergens: sql`excluded.allergens`, additives: sql`excluded.additives`,
        categories: sql`excluded.categories`, nova: sql`excluded.nova`, normName: sql`excluded.norm_name`,
        countries: sql`excluded.countries`, basis: sql`excluded.basis`, imageUrl: sql`excluded.image_url`,
        nutriscoreSource: sql`excluded.nutriscore_source`, defaultPortion: sql`excluded.default_portion`,
        normBrand: sql`excluded.norm_brand`, searchName: sql`excluded.search_name`, searchText: sql`excluded.search_text`, updatedAt: sql`now()`,
      },
    });
    n += chunk.length;
  }
  return n;
}
