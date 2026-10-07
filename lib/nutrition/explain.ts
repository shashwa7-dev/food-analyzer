import type { DailyTargets, GradeResult, Nutrients, Reason } from "./types";

const fmt = (n: number) => (n >= 100 ? Math.round(n).toLocaleString("en-IN") : (Math.round(n * 10) / 10).toString());

// INDB recipes appear to omit (or barely count) salt added while cooking: savoury dishes have a median of
// ~125 mg sodium per 100 g. Warn rather than let a low sodium figure read as a strength.
const SAVOURY = /\b(dal|curry|sabzi|masala|pakora|samosa|pickle|chutney|rice|biryani|paratha|roti|dhokla|poha|upma)\b/i;
export const INDB_SODIUM_REASON = "Sodium may be understated — salt added while cooking may not be counted.";

export function explain(input: {
  source?: string; name?: string;
  grade: GradeResult; per100: Nutrients; basis: "per_100g" | "per_100ml"; perPortion?: Nutrients; portionLabel?: string; targets: DailyTargets;
}): Reason[] {
  if (input.grade.grade === null) return [{ tone: "warn", text: "Cooking ingredient — not graded on its own." }];
  const unit = input.basis === "per_100ml" ? "100 ml" : "100 g";
  const n = input.per100;
  const share = (v: number | undefined, max: number) =>
    input.perPortion && typeof v === "number" && input.portionLabel ? ` · ${input.portionLabel} is ${Math.round((v / max) * 100)}% of your daily limit` : "";
  const templates: Record<string, (c: { points: number }) => Reason | null> = {
    salt: () => ({ tone: "bad", text: `High salt: ${fmt(n.sodiumMg ?? 0)} mg sodium per ${unit}${share(input.perPortion?.sodiumMg, input.targets.sodiumMgMax)}` }),
    sodium: () => ({ tone: "bad", text: `High sodium: ${fmt(input.perPortion?.sodiumMg ?? 0)} mg per portion` }),
    satFat: () => ({ tone: "bad", text: `High saturated fat: ${fmt(n.satFat ?? 0)} g per ${unit}` }),
    sugars: () => ({ tone: "bad", text: `High sugar: ${fmt(n.sugars ?? 0)} g per ${unit}${share(input.perPortion?.sugars, input.targets.sugarsMax)}` }),
    energy: () => ({ tone: "warn", text: `Energy-dense: ${fmt(n.energyKcal)} kcal per ${unit}` }),
    sugarsDensity: () => ({ tone: "bad", text: `High sugar: ${fmt(n.sugars ?? 0)} g per ${unit}` }),
    energyDensity: () => ({ tone: "warn", text: `Energy-dense: ${fmt(n.energyKcal)} kcal per ${unit}` }),
    sodiumDensity: () => ({ tone: "bad", text: `High sodium: ${fmt(n.sodiumMg ?? 0)} mg per ${unit}` }),
    satFatDensity: () => ({ tone: "bad", text: `High saturated fat: ${fmt(n.satFat ?? 0)} g per ${unit}` }),
    fatDensity: () => ({ tone: "warn", text: `High fat: ${fmt(n.fat)} g per ${unit}` }),
    fvl: () => ({ tone: "good", text: "Fruit, vegetables or legumes" }),
    fatShare: () => ({ tone: "warn", text: "Most of its calories come from fat" }),
    sweeteners: () => ({ tone: "warn", text: "Contains artificial sweeteners" }),
    processing: () => ({ tone: "warn", text: "Ultra-processed: several additives" }),
    protein: () => ({ tone: "good", text: `Good protein: ${fmt(n.protein)} g per ${unit}` }),
    fibre: () => ({ tone: "good", text: `Good fibre: ${fmt(n.fibre ?? 0)} g per ${unit}` }),
  };
  const negatives = input.grade.components
    .filter((c) => c.direction === "negative" && c.points > 0 && c.points / c.maxPoints >= 0.3)
    .sort((a, b) => b.points - a.points);
  const positives = input.grade.components.filter((c) => c.direction === "positive" && c.points >= Math.ceil(c.maxPoints / 2));
  const out: Reason[] = [];
  for (const c of [...negatives, ...positives]) {
    const r = templates[c.key]?.(c);
    if (r && !out.some((o) => o.text === r.text)) out.push(r);
    if (out.length === 3) break;
  }
  if (out.length === 0) out.push({ tone: "good", text: "Nothing stands out as too high." });
  if (input.source === "indb" && (n.sodiumMg ?? 0) < 150 && SAVOURY.test(input.name ?? "")) out.push({ tone: "warn", text: INDB_SODIUM_REASON });
  return out;
}
