export const MIN_QUANTITY = 0.25;
export const MAX_QUANTITY = 20;

// Stepper rule shared by AddToMeal and the diary entry sheet: halve/double below ½, half steps up to 1,
// whole steps above 1; clamped to 0.25–20.
export function stepQuantity(q: number, dir: 1 | -1): number {
  const next = q <= 0.5 ? (dir > 0 ? q * 2 : q / 2) : q < 1 || (q === 1 && dir < 0) ? q + dir * 0.5 : q + dir;
  return Math.max(MIN_QUANTITY, Math.min(MAX_QUANTITY, next));
}

/** What a log is made from: a catalogue/custom food, or a scan's own result (portions from the scan). */
export type LogTarget = { kind: "food"; foodId: string } | { kind: "scan"; scanId: string };

export type LogChoice = { date: string; meal: string } & ({ grams: number } | { portionIndex: number; quantity: number });

/** The POST /api/v1/log body for a target + the user's portion choice (custom grams or portion × quantity). */
export function logEntryBody(target: LogTarget, choice: LogChoice): Record<string, unknown> {
  const { date, meal } = choice;
  const ref = target.kind === "food" ? { foodId: target.foodId } : { scanId: target.scanId };
  if ("grams" in choice) return { kind: target.kind === "food" ? "grams" : "scan_grams", date, meal, ...ref, grams: choice.grams };
  return { kind: target.kind, date, meal, ...ref, portionIndex: choice.portionIndex, quantity: choice.quantity };
}
