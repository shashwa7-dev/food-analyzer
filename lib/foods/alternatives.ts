// What makes one food a relevant "Better pick" for another (spec §7.4), as pure rules shared by the
// SQL in lib/foods/service.ts findAlternatives and its tests. The old rule, any one shared category,
// let "en:dairies" alone pair Paneer with a litre of milk. A pick now has to be the same kind of food:
// - it shares a specific category with the food (a top-level OFF tag such as en:dairies or en:snacks
//   is too broad to say so on its own),
// - it shares at least half of the food's categories (OFF tags run root to leaf, so this is how far
//   down the same branch both sit),
// - it comes in the same form: something you drink, a powder you make up, or something you eat.
// With no candidate passing, there is no pick: an irrelevant one is worse than none.
import type { Grade, GradeCategory } from "@/lib/nutrition/types";
import { nameFamily } from "./icon";

/**
 * Open Food Facts tags that group whole aisles (the most common top levels in the India set,
 * checked 2026-10-08). Sharing only these says nothing about two foods being alike.
 */
export const BROAD_CATEGORIES: ReadonlySet<string> = new Set([
  "en:plant-based-foods-and-beverages", "en:plant-based-foods", "en:plant-based-beverages", "en:snacks", "en:sweet-snacks",
  "en:cereals-and-potatoes", "en:cereals-and-their-products", "en:beverages", "en:beverages-and-beverages-preparations",
  "en:non-alcoholic-beverages", "en:sweetened-beverages", "en:unsweetened-beverages", "en:dairies", "en:fermented-foods",
  "en:fermented-milk-products", "en:biscuits-and-cakes", "en:condiments", "en:appetizers", "en:breakfasts", "en:desserts",
  "en:confectioneries", "en:legumes-and-their-products", "en:dietary-supplements", "en:fruits-and-vegetables-based-foods",
  "en:fruits-based-foods", "en:vegetables-based-foods", "en:dried-products", "en:dried-products-to-be-rehydrated", "en:frozen-foods",
  "en:canned-foods", "en:fats", "en:spreads", "en:meats-and-their-products", "en:seafood", "en:meals", "en:groceries",
  "en:farming-products",
]);

/** The food's categories that say what it is (not just its aisle). */
export const specificCategories = (categories: string[]): string[] => categories.filter((c) => !BROAD_CATEGORIES.has(c));

/** How many of a food's categories a pick must share: half, rounded up. */
export const minSharedCategories = (n: number): number => Math.ceil(n / 2);

const POWDER = new Set(["en:beverage-preparations", "en:milk-powders", "en:powdered-milks", "en:instant-beverages", "en:dehydrated-beverages"]);
const LIQUID = new Set(["en:beverages", "en:milks", "en:dairy-drinks", "en:plant-based-milk-alternatives", "en:waters", "en:juices", "en:fruit-juices"]);

export type FoodForm = "liquid" | "powder" | "solid";

export interface AlternativeSubject {
  name: string; categories: string[]; gradeCategory?: GradeCategory | string | null; basis?: "per_100g" | "per_100ml" | string | null;
}

/** The food an alternative is wanted for (lib/foods/service.ts findAlternatives, EngineDeps.alternatives). */
export interface AlternativeQuery extends AlternativeSubject {
  country: string; grade: Grade | null; excludeId?: string;
}

/** Drunk, made up from a powder, or eaten: a pick for one is no pick for another. */
export function foodForm(f: AlternativeSubject): FoodForm {
  if (f.categories.some((c) => POWDER.has(c))) return "powder";
  if (f.gradeCategory === "beverage" || f.gradeCategory === "water" || f.basis === "per_100ml") return "liquid";
  if (f.categories.some((c) => LIQUID.has(c)) || nameFamily(f.name) === "drink") return "liquid";
  return "solid";
}

const shared = (a: string[], b: string[]): string[] => {
  const set = new Set(b);
  return [...new Set(a)].filter((c) => set.has(c));
};

/** Whether `candidate` is the same kind of food as `food` (the grade is checked separately). */
export function isRelevantAlternative(food: AlternativeSubject, candidate: AlternativeSubject): boolean {
  const common = shared(food.categories, candidate.categories);
  if (specificCategories(common).length === 0) return false;
  if (common.length < minSharedCategories(new Set(food.categories).size)) return false;
  return foodForm(food) === foodForm(candidate);
}

/** Higher is closer: shared categories first, then the same grading category, then the same name family. */
export function closeness(food: AlternativeSubject, candidate: AlternativeSubject): number {
  const family = nameFamily(food.name);
  return shared(food.categories, candidate.categories).length * 4
    + (food.gradeCategory && food.gradeCategory === candidate.gradeCategory ? 2 : 0)
    + (family && family === nameFamily(candidate.name) ? 1 : 0);
}
