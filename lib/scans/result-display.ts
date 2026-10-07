// Pure helpers for the C1 scan result (spec §6.11): the grade hero's verdict and one-line reason,
// the calorie row's portion, the macro rings' share of calories and the sodium chip's level.
import type { Diet, Grade, Nutrients, Portion, Reason } from "@/lib/nutrition/types";

export const VERDICT: Record<Grade, string> = {
  A: "Great choice",
  B: "Good choice",
  C: "Fine in moderation",
  D: "Eat now and then",
  E: "Best kept rare",
};

export function verdict(grade: Grade | null): string {
  return grade ? VERDICT[grade] : "Not graded";
}

/** The hero's one line: the first bad reason (else the first one), without its " · …" aside. */
export function oneLineReason(reasons: Reason[]): string | null {
  const r = reasons.find((x) => x.tone === "bad") ?? reasons[0];
  return r ? r.text.split(" · ")[0]! : null;
}

/** % of calories from protein, carbs and fat (4/4/9 kcal per g), rounded; zeros when there's nothing. */
export function macroShare(n: Pick<Nutrients, "protein" | "carbs" | "fat">): { protein: number; carbs: number; fat: number } {
  const kcal = { protein: n.protein * 4, carbs: n.carbs * 4, fat: n.fat * 9 };
  const total = kcal.protein + kcal.carbs + kcal.fat;
  if (!(total > 0)) return { protein: 0, carbs: 0, fat: 0 };
  return {
    protein: Math.round((kcal.protein / total) * 100),
    carbs: Math.round((kcal.carbs / total) * 100),
    fat: Math.round((kcal.fat / total) * 100),
  };
}

/** Sodium per 100 g: low up to 120 mg, high over 600 mg (0.3 g and 1.5 g salt, the UK FSA bands). */
export function sodiumLevel(mgPer100: number): "low" | "medium" | "high" {
  return mgPer100 > 600 ? "high" : mgPer100 > 120 ? "medium" : "low";
}

/** The calorie row's "typical portion": the default portion when it has a weight and isn't the bare 100 g. */
export function typicalPortion(portions: Portion[], defaultPortion: number): Portion | null {
  const p = portions[defaultPortion] ?? portions[0];
  return p && p.grams && p.unit !== "g" && p.unit !== "ml" ? p : null;
}

/** A pack portion with a weight: the "150 g pack" tag chip. */
export function packSize(portions: Portion[], unit: "g" | "ml"): string | null {
  const p = portions.find((x) => x.unit === "pack" && x.grams);
  return p ? `${Math.round(p.grams!)} ${unit} pack` : null;
}

/** The diet chip when the scan raised no diet flag (diet "none": no chip). */
export const DIET_CHIP: Record<Exclude<Diet, "none">, string> = {
  vegetarian: "Veg",
  eggetarian: "Eggetarian",
  vegan: "Vegan",
  jain: "Jain",
};
