/**
 * A typed, non-negative amount as a number, for the number fields (daily targets, the custom food form).
 * Spaces are ignored. A comma is read by how many digits follow it:
 * - three: grouping, "1,800", "12,000", and lakh-style "1,00,000" / "1,80,000";
 * - one, as the only comma: a decimal point, "1,5" → 1.5;
 * - two ("1,40"): ambiguous (1.4? 140?), so it's NaN and amountError says to use a dot.
 * A leading or trailing point is fine (".5", "5."). "" (or only spaces) is null, meaning "not given";
 * anything else (letters, a sign, "1,8000", "1,800,00", ".") is NaN.
 */
export function parseAmount(raw: string): number | null {
  let t = raw.replace(/\s/g, "");
  if (t === "") return null;
  if (/^\d+,\d$/.test(t)) t = t.replace(",", ".");
  else if (/^(\d{1,3}(,\d{3})+|\d{1,2}(,\d{2})*,\d{3})(\.\d*)?$/.test(t)) t = t.replace(/,/g, "");
  return /^(\d+\.?\d*|\.\d+)$/.test(t) ? Number(t) : Number.NaN;
}

/** Shown under a field whose comma is followed by two digits: the one case we won't guess. */
export const DECIMAL_COMMA_MESSAGE = "Use a dot for decimals, e.g. 1.4";

/** Why `raw` doesn't parse, for the field's message: the two-digit-comma case, else "Enter a number". Null when it parses (or is empty). */
export function amountError(raw: string): string | null {
  const n = parseAmount(raw);
  if (n === null || !Number.isNaN(n)) return null;
  return /^\d+,\d{2}$/.test(raw.replace(/\s/g, "")) ? DECIMAL_COMMA_MESSAGE : "Enter a number";
}
