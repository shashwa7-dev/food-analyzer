import type { NutrientKey } from "./types";

/**
 * A provisional grade. When an implausible value was dropped (lib/nutrition/plausible.ts) from a
 * nutrient the grade scores, the grade would silently assume it's zero and look kinder than it should
 * (a salty dal graded B once its absurd sodium is gone). So no letter is shown at all: a neutral "?"
 * badge, "Grade unavailable" and this reason, and the A–E scale with nothing highlighted.
 *
 * GRADE_UNAVAILABLE is the value grade-carrying strings take in that case (FoodHit.grade, a food row
 * read for display, food_log.grade), so every GradeBadge renders it without extra plumbing.
 */
export const GRADE_UNAVAILABLE = "?";

/** Nutrients the grade scores as negatives (dropping one would flatter the grade), with their names. */
const GRADED: Partial<Record<NutrientKey, string>> = { energyKcal: "Energy", sodiumMg: "Sodium", sugars: "Sugar", satFat: "Saturated fat" };

/** Where the figure came from, for the sentence: a product label (OFF, a scan), a model estimate, or a reference table. */
export type FigureSource = "label" | "estimate" | "data";
const WHERE: Record<FigureSource, string> = { label: "on this label", estimate: "in this estimate", data: "in this food's data" };

/** The graded nutrients among `dropped`, in the order given. */
export function gradedDropped(dropped: readonly NutrientKey[] | undefined): NutrientKey[] {
  return (dropped ?? []).filter((k) => GRADED[k] !== undefined);
}

/**
 * The reason a grade is unavailable ("Sodium on this label isn't plausible, so we can't grade it."), or
 * null when nothing graded was dropped and the grade stands.
 */
export function gradeUnavailableReason(dropped: readonly NutrientKey[] | undefined, where: FigureSource): string | null {
  const names = gradedDropped(dropped).map((k, i) => (i === 0 ? GRADED[k]! : GRADED[k]!.toLowerCase()));
  if (names.length === 0) return null;
  const list = names.length === 1 ? names[0]! : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return `${list} ${WHERE[where]} ${names.length === 1 ? "isn't" : "aren't"} plausible, so we can't grade it.`;
}

/** A food row's source as a FigureSource: Open Food Facts, community and custom foods come from labels. */
export const figureSourceOf = (source: string): FigureSource => (source === "off" || source === "crowd" || source === "custom" ? "label" : "data");
