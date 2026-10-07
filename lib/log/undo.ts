import { isFreeGramsPortion } from "@/lib/log/format";
import { logEntryBody, type LogTarget } from "@/lib/log/quantity";
import type { Meal, Nutrients, Portion } from "@/lib/nutrition/types";

/** The parts of a deleted diary entry needed to log it again (a subset of the food_log row). */
export type DeletedEntry = {
  date: string; meal: Meal; name: string; foodId: string | null; scanId: string | null;
  portion: Portion; nutrients: Nutrients;
};

/** What the entry was logged from: its scan first (a scan-logged entry may also carry a foodId), then its food. */
export function undoTarget(e: DeletedEntry): LogTarget | null {
  if (e.scanId) return { kind: "scan", scanId: e.scanId };
  if (e.foodId) return { kind: "food", foodId: e.foodId };
  return null;
}

/** Labelled portions need the source's portion list to find the index; free grams don't. */
export function undoNeedsPortions(e: DeletedEntry): boolean {
  return undoTarget(e) !== null && !isFreeGramsPortion(e.portion);
}

const clamp = (n: number | undefined, max: number) => (n === undefined ? undefined : Math.min(Math.max(n, 0), max));

/**
 * The POST /api/v1/log body that re-adds a deleted entry (the "Undo" on the delete toast).
 * Free grams re-log by weight; a labelled portion re-logs as the same portion × amount when the
 * source (`portions`, from the food or scan) still has it. Anything else — a quick add, or a source
 * that has gone or changed — falls back to a quick add with the entry's own name and nutrients,
 * so the day's totals come back exactly.
 */
export function undoBody(e: DeletedEntry, portions: Portion[] | null): Record<string, unknown> {
  const target = undoTarget(e);
  const choice = { date: e.date, meal: e.meal };
  if (target && isFreeGramsPortion(e.portion) && e.portion.grams) return logEntryBody(target, { ...choice, grams: e.portion.grams });
  if (target && portions) {
    const portionIndex = portions.findIndex((p) => p.label === e.portion.label && p.unit === e.portion.unit);
    if (portionIndex >= 0) return logEntryBody(target, { ...choice, portionIndex, quantity: e.portion.amount });
  }
  const n = e.nutrients;
  const nutrients = Object.fromEntries(Object.entries({
    energyKcal: clamp(n.energyKcal, 5000), protein: clamp(n.protein, 500), carbs: clamp(n.carbs, 500), fat: clamp(n.fat, 500),
    fibre: clamp(n.fibre, 500), sugars: clamp(n.sugars, 500), satFat: clamp(n.satFat, 500), sodiumMg: clamp(n.sodiumMg, 20000),
  }).filter(([, v]) => v !== undefined));
  return { kind: "quick", ...choice, name: e.name.slice(0, 120), nutrients };
}
