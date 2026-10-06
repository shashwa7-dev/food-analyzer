export const NUTRIENT_KEYS = ["energyKcal", "protein", "carbs", "fat", "fibre", "sugars", "addedSugars", "satFat", "transFat", "sodiumMg"] as const;
export type NutrientKey = (typeof NUTRIENT_KEYS)[number];
export interface Nutrients {
  energyKcal: number; protein: number; carbs: number; fat: number;
  fibre?: number; sugars?: number; addedSugars?: number; satFat?: number; transFat?: number; sodiumMg?: number;
}
export type Provenance = "reference" | "community" | "label" | "estimate";
export type PortionUnit = "g" | "ml" | "serving" | "pack" | "household";
export interface Portion { label: string; amount: number; unit: PortionUnit; grams: number | null }
export type Grade = "A" | "B" | "C" | "D" | "E";
export type GradeCategory = "general" | "beverage" | "water" | "fat_oil" | "cheese" | "dish" | "none";
export interface ScoreComponent {
  key: string; label: string; points: number; maxPoints: number;
  direction: "negative" | "positive"; estimated: boolean; approximate?: boolean;
}
export interface GradeResult { grade: Grade | null; value: number | null; components: ScoreComponent[] }
export interface Reason { tone: "good" | "warn" | "bad"; text: string }
export interface Flag { type: "allergen" | "diet" | "goal"; key: string; severity: "contains" | "may_contain" | "note"; text: string }
export interface DailyTargets {
  energyKcal: number; protein: number; carbs: number; fat: number; fibre: number;
  sugarsMax: number; sodiumMgMax: number; satFatMax: number;
}
export const MEALS = ["breakfast", "lunch", "dinner", "snack"] as const;
export type Meal = (typeof MEALS)[number];
export type Goal = "general" | "weight_loss" | "muscle" | "low_sugar" | "low_sodium";
export type Diet = "none" | "vegetarian" | "eggetarian" | "vegan" | "jain";
