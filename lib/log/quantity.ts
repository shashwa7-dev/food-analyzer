/** The log API's largest portion multiplier (AddEntrySchema); the steppers stop here. */
export const MAX_QUANTITY = 20;

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
