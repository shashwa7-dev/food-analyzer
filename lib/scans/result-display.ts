// Pure helpers for the C1 scan result (spec §6.11): the grade hero's verdict and one-line reason,
// the calorie row's portion, the macro rings' share of calories and the sodium chip's level.
import type { Diet, Flag, Grade, Nutrients, Portion, Reason } from "@/lib/nutrition/types";

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

/** The hero's line for an A/B or D/E with no reason of the matching tone: neutral, never contradicting the verdict. */
export const NEUTRAL_REASON = { good: "Scores well on its overall nutrient balance.", bad: "Scores poorly on its overall nutrient balance." } as const;

/**
 * The hero's one line, next to the verdict, without its " · …" aside. It never argues with the
 * verdict: an A/B shows its first good reason (else a neutral line, never a warning such as
 * "Energy-dense" beside "Great choice"); a D/E its first bad, then warn, reason (else a neutral line,
 * never praise); a C, or an ungraded food, the first bad, then warn, then any reason.
 */
export function oneLineReason(reasons: Reason[], grade: Grade | null): string | null {
  const first = (...tones: Reason["tone"][]) => tones.map((t) => reasons.find((x) => x.tone === t)).find(Boolean);
  let r: Reason | undefined;
  if (grade === "A" || grade === "B") r = first("good") ?? { tone: "good", text: NEUTRAL_REASON.good };
  else if (grade === "D" || grade === "E") r = first("bad", "warn") ?? { tone: "bad", text: NEUTRAL_REASON.bad };
  else r = first("bad", "warn") ?? reasons[0];
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

/** Allergen and diet flags: their full sentences ("… Check the pack to confirm.") are shown and announced, not just the chips. */
export function warningFlags(flags: Flag[]): Flag[] {
  return flags.filter((f) => f.type === "allergen" || f.type === "diet");
}

/**
 * The diet chip: "Not Veg" when the diet check raised a flag; a positive "Veg" only when the check read
 * a real ingredient list (a name-only check can't vouch for the food); otherwise nothing.
 */
export function dietChip(diet: Diet, flags: Flag[], ingredientsKnown: boolean): { label: string; fits: boolean } | null {
  const flag = flags.find((f) => f.type === "diet");
  if (flag) return { label: `Not ${DIET_CHIP[flag.key as Exclude<Diet, "none">] ?? flag.key}`, fits: false };
  if (diet === "none" || !ingredientsKnown) return null;
  return { label: DIET_CHIP[diet], fits: true };
}
