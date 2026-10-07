/**
 * "1 katori · 150 g" for a search row. A label that already is the weight ("100 g") isn't repeated,
 * and a portion with no known weight shows its label only.
 */
export function portionLine(p: { label: string; grams: number | null }, unit: "g" | "ml" = "g"): string {
  if (p.grams === null || /^\d+(\.\d+)?\s?(g|ml)$/i.test(p.label.trim())) return p.label;
  return `${p.label} · ${Math.round(p.grams * 10) / 10} ${unit}`;
}

const SOURCE: Record<string, string> = { indb: "INDB", fndds: "USDA", off: "Open Food Facts", crowd: "Community" };
const KIND: Record<string, string> = { generic: "Generic", packaged: "Packaged", ingredient: "Ingredient" };

/** The add sheet's source line: "Home-style · INDB", "Haldiram's · Open Food Facts", "My food". */
export function sourceLine(f: { source: string; kind: string; brand: string | null }): string {
  if (f.source === "custom") return "My food";
  const lead = f.brand ?? (f.kind === "dish" ? (f.source === "indb" ? "Home-style" : "Dish") : KIND[f.kind]);
  const src = SOURCE[f.source];
  return [lead, src].filter(Boolean).join(" · ");
}
