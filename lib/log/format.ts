import type { Portion } from "@/lib/nutrition/types";

// portion.amount is a multiplier of portion.label, except for free-grams entries (label exactly "g"/"ml"),
// where it is the weight itself. Anything measured in g/ml displays as its total weight.
export const isFreeGramsPortion = (p: Portion): boolean => p.label === "g" || p.label === "ml";

export function portionMeta(portion: Portion): string {
  if ((portion.unit === "g" || portion.unit === "ml") && portion.grams) return `${portion.grams} ${portion.unit}`;
  return portion.amount === 1 ? portion.label : `${portion.amount} × ${portion.label}`;
}
