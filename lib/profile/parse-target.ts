import { parseAmount } from "@/lib/parse-amount";

/** A typed target as a number (see parseAmount: "1,800" is 1800, "1,5" is 1.5); "" is "use the preset"; anything else is NaN. */
export function parseTarget(raw: string): number | null {
  return parseAmount(raw);
}
