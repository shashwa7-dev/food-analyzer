// What the A–E grades mean, in one place (History's chips and its "About grades" sheet; reusable elsewhere).
import type { Grade } from "@/lib/nutrition/types";
import { VERDICT } from "@/lib/scans/result-display";

export const GRADES: readonly Grade[] = ["A", "B", "C", "D", "E"];

/** One word per grade for filter chips ("A · Great"), matching the result screen's verdicts. */
export const GRADE_SHORT: Record<Grade, string> = { A: "Great", B: "Good", C: "Okay", D: "Sometimes", E: "Rarely" };

export const GRADE_BASIS =
  "Grades rate a food per 100 g on calories, sugar, salt and saturated fat against fibre and protein, like Nutri-Score.";

export const GRADE_UNAVAILABLE_NOTE = "A key value on the label wasn't plausible, so it isn't graded.";

/** The legend rows: letter, the result screen's verdict, and the chip word. */
export function gradeLegend(): { grade: Grade; verdict: string; short: string }[] {
  return GRADES.map((grade) => ({ grade, verdict: VERDICT[grade], short: GRADE_SHORT[grade] }));
}
