/**
 * A typed, non-negative amount as a number, for the number fields (daily targets, the custom food form).
 * Spaces are ignored. A comma is read the way people type in India and the UK:
 * - grouping when it's followed by exactly three digits: "1,800", "12,000", and lakh-style "1,80,000";
 * - a decimal point when it's the only comma and has one or two digits after it: "1,5" → 1.5, "12,25" → 12.25.
 * A leading or trailing point is fine (".5", "5."). "" (or only spaces) is null, meaning "not given";
 * anything else (letters, a sign, "1,8000", "1,800,00", ".") is NaN.
 */
export function parseAmount(raw: string): number | null {
  let t = raw.replace(/\s/g, "");
  if (t === "") return null;
  if (/^\d+,\d{1,2}$/.test(t)) t = t.replace(",", ".");
  else if (/^(\d{1,3}(,\d{3})+|\d{1,2}(,\d{2})*,\d{3})(\.\d*)?$/.test(t)) t = t.replace(/,/g, "");
  return /^(\d+\.?\d*|\.\d+)$/.test(t) ? Number(t) : Number.NaN;
}
