import type { food } from "@/lib/db/schema";

export interface FoodHit {
  id: string; name: string; brand: string | null; kind: string; grade: string | null; source: string;
  defaultPortion: { label: string; grams: number | null; kcal: number | null };
}

// Type-only import of `food` above — erased at compile time, so this does not pull `lib/db`
// (and its `drizzle-orm`/`next` dependents) into any bundle that only imports types from here.
export type FoodRow = typeof food.$inferSelect;
