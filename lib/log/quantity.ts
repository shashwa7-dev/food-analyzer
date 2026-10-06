export const MIN_QUANTITY = 0.25;
export const MAX_QUANTITY = 20;

// Stepper rule shared by AddToMeal and the diary entry sheet: halve/double below ½, half steps up to 1,
// whole steps above 1; clamped to 0.25–20.
export function stepQuantity(q: number, dir: 1 | -1): number {
  const next = q <= 0.5 ? (dir > 0 ? q * 2 : q / 2) : q < 1 || (q === 1 && dir < 0) ? q + dir * 0.5 : q + dir;
  return Math.max(MIN_QUANTITY, Math.min(MAX_QUANTITY, next));
}
