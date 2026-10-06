import type { Portion } from "@/lib/nutrition/types";

export function portionMeta(portion: Portion): string {
  if (portion.unit === "g" || portion.unit === "ml") return `${portion.amount} ${portion.unit}`;
  return portion.amount === 1 ? portion.label : `${portion.amount} × ${portion.label}`;
}
