import type { food } from "@/lib/db/schema";
import type { FoodIconKey } from "@/lib/foods/icon";

export interface FoodHit {
  id: string; name: string; brand: string | null; kind: string; grade: string | null; source: string;
  /**
   * `index` (into the food's portions, for one-tap quick add), `unit` (g or ml) and `iconKey` were
   * added for the C1 search rows; they're optional because hits stored inside older scan results
   * (`alternatives`) don't carry them.
   */
  defaultPortion: { label: string; grams: number | null; kcal: number | null; index?: number; unit?: "g" | "ml" };
  iconKey?: FoodIconKey;
}

// Type-only import of `food` above — erased at compile time, so this does not pull `lib/db`
// (and its `drizzle-orm`/`next` dependents) into any bundle that only imports types from here.
export type FoodRow = typeof food.$inferSelect;
