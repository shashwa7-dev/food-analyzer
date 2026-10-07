import { ALLERGEN_KEYS, type AllergenKey } from "@/lib/nutrition/personalise";
import type { Diet, Goal } from "@/lib/nutrition/types";

export const GOALS: [Goal, string, string][] = [
  ["general", "Eat better", "Balanced targets, honest grades"],
  ["weight_loss", "Lose weight", "Lower calorie target"],
  ["muscle", "Build muscle", "Higher protein target"],
  ["low_sugar", "Cut sugar", "Sugar limit 25 g"],
  ["low_sodium", "Cut salt", "Sodium limit 1,500 mg"],
];
export const GOAL_LABEL: Record<Goal, string> = Object.fromEntries(GOALS.map(([k, l]) => [k, l])) as Record<Goal, string>;

export const DIETS: [Diet, string][] = [
  ["none", "No restriction"],
  ["vegetarian", "Vegetarian"],
  ["eggetarian", "Eggetarian"],
  ["vegan", "Vegan"],
  ["jain", "Jain"],
];
export const DIET_LABEL: Record<Diet, string> = Object.fromEntries(DIETS.map(([k, l]) => [k, l])) as Record<Diet, string>;

export const ALLERGEN_LABELS: Record<AllergenKey, string> = {
  peanut: "Peanut", tree_nut: "Tree nuts", milk: "Milk", egg: "Egg", gluten: "Gluten",
  soy: "Soy", sesame: "Sesame", fish: "Fish", shellfish: "Shellfish", mustard: "Mustard",
};

export { ALLERGEN_KEYS };
