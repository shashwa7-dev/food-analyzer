import { isPlainWater } from "../classify";
import { nutrientsFor } from "../portions";
import type { GradeCategory, GradeResult, Nutrients } from "../types";
import { dishScore } from "./dish";
import { nutriScore } from "./packaged";

export const GRADE_VERSION = "2026.10-2";
const DEFAULT_DISH_GRAMS = 250;

export function gradeFood(food: {
  gradeCategory: GradeCategory; per100: Nutrients; gradePortionGrams?: number | null;
  additives?: string[]; nova?: number | null; fvlPercent?: number;
}): GradeResult {
  if (food.gradeCategory === "none") return { grade: null, value: null, components: [] };
  if (food.gradeCategory === "dish") return dishScore(nutrientsFor(food.per100, food.gradePortionGrams || DEFAULT_DISH_GRAMS), food.per100);
  // Defensive: a stored "water" with sugar or calories (tonic, flavoured water) is graded as a beverage.
  const category = food.gradeCategory === "water" && !isPlainWater(food.per100) ? "beverage" : food.gradeCategory;
  return nutriScore({ per100: food.per100, category, additives: food.additives, nova: food.nova, fvlPercent: food.fvlPercent });
}
