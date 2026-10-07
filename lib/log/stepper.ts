import type { PortionUnit } from "@/lib/nutrition/types";

/** The amount stepper's natural increment: half a katori/bowl/piece/serving/pack, or 10 g/ml. */
export function stepFor(unit: PortionUnit): number { return unit === "g" || unit === "ml" ? 10 : 0.5; }

/** One step up or down, snapped to the step grid (37 g → 40 g / 30 g), never below one step. */
export function stepAmount(amount: number, unit: PortionUnit, dir: 1 | -1): number {
  const s = stepFor(unit);
  const snapped = dir === 1 ? Math.floor(amount / s + 1e-9) * s + s : Math.ceil(amount / s - 1e-9) * s - s;
  return Math.max(s, Math.round(snapped * 100) / 100);
}

/** 1.5 → "1½", 0.5 → "½", 2 → "2"; anything else to at most two decimals. */
export function formatAmount(n: number): string {
  const whole = Math.floor(n), frac = Math.round((n - whole) * 100) / 100;
  if (frac === 0.5) return whole ? `${whole}½` : "½";
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

// Sizes read as adjectives ("1 large"), so they never take a plural.
const NOT_A_NOUN = new Set(["large", "small", "medium", "regular", "whole", "miniature", "individual", "big", "extra"]);

function plural(word: string): string {
  if (/(s|x|z|ch|sh)$/.test(word)) return `${word}es`;
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
  return `${word}s`;
}

/**
 * The unit under the stepper's number: "1 katori" × 1½ → "katori", "1 piece" × 2 → "pieces".
 * Only a single plain word is pluralised; phrases ("cup, cooked") stay as they are. A label that
 * isn't "1 …" ("4 cubes") is a multiplier: "× 4 cubes" once the amount isn't 1.
 */
export function unitWord(label: string, amount: number): string {
  const m = /^1 (.+)$/.exec(label.trim());
  if (!m) return amount === 1 ? label : `× ${label}`;
  const rest = m[1]!;
  if (amount >= 2 && /^[a-z]+$/.test(rest) && !NOT_A_NOUN.has(rest)) return plural(rest);
  return rest;
}

/** A unit chip: "1 katori" → "Katori"; labels that aren't "1 …" stay whole. */
export function unitChipLabel(label: string): string {
  const rest = /^1 (.+)$/.exec(label.trim())?.[1] ?? label;
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}
