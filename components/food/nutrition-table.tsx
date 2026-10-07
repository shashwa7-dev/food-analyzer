import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { allNutrientRows, formatAmount } from "@/lib/nutrition/nutrient-display";
import type { AnyNutrientKey, NutrientKey, Nutrients, Provenance } from "@/lib/nutrition/types";

export const PROVENANCE_LABEL: Record<Provenance, string> = {
  reference: "Reference data", community: "Community data", label: "Read from label", estimate: "Estimated",
};
const PROVENANCE_DOT: Record<Provenance, string> = { reference: "bg-ok", community: "bg-ok", label: "bg-accent", estimate: "bg-warn" };

/** The provenance most nutrients share (ties → the first one seen); "reference" when none is recorded. */
export function dominantProvenance(provenance: Partial<Record<NutrientKey, Provenance>>): Provenance {
  const counts = new Map<Provenance, number>();
  for (const p of Object.values(provenance)) if (p) counts.set(p, (counts.get(p) ?? 0) + 1);
  let best: Provenance = "reference", n = 0;
  for (const [p, c] of counts) if (c > n) [best, n] = [p, c];
  return best;
}

function ProvenanceTag({ p }: { p: Provenance }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap text-subtle">
      <span className={`size-[7px] rounded-full ${PROVENANCE_DOT[p]}`} aria-hidden />{PROVENANCE_LABEL[p]}
    </span>
  );
}

const cell = (v: number | undefined, unit: string) => (v === undefined ? "–" : `${formatAmount(v)} ${unit}`);

/**
 * Every nutrient the food holds as a real table: per 100 g/ml and, when the default portion is
 * something else, per that portion. The cards above it show per-100 values at a glance; this is the
 * complete, screen-reader-friendly list, with the per-portion numbers the cards don't give. The
 * caption carries the provenance most values share; a row from somewhere else (an estimated sodium
 * on a label scan) is tagged itself. `per100` null: a per-serving label, so only the serving column.
 */
export function NutritionTable({ per100, portion, provenance, unit }: {
  per100: Nutrients | null;
  portion: { label: string; grams: number | null; nutrients: Nutrients } | null;
  provenance: Partial<Record<NutrientKey, Provenance>>; unit: "g" | "ml";
}) {
  const main = dominantProvenance(provenance);
  const rows = allNutrientRows({ ...portion?.nutrients, ...per100 });
  const portionHead = portion && <>{portion.label}{portion.grams !== null && !/^\d/.test(portion.label) && <> (<span className="num">{Math.round(portion.grams)} {unit}</span>)</>}</>;
  const th = "px-0 py-2 text-[12px] font-semibold whitespace-nowrap text-subtle";
  return (
    <table className="w-full text-sm">
      <caption className="pb-1 text-left"><ProvenanceTag p={main} /></caption>
      <thead>
        <tr className="border-b border-line">
          <th scope="col" className={cn(th, "text-left")}>Nutrient</th>
          {per100 && <th scope="col" className={cn(th, "text-right")}>Per 100 {unit}</th>}
          {portion && <th scope="col" className={cn(th, "max-w-[11ch] truncate pl-3 text-right")}>{portionHead}</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const own = provenance[r.key as NutrientKey];
          return (
            <tr key={r.key} className="border-b border-line last:border-b-0">
              <th scope="row" className="py-2 pr-2 text-left font-normal">
                {r.label}{own && own !== main && <span className="ml-2"><ProvenanceTag p={own} /></span>}
              </th>
              {per100 && <td className="num py-2 text-right whitespace-nowrap">{cell(per100[r.key as AnyNutrientKey], r.unit)}</td>}
              {portion && <td className="num py-2 pl-3 text-right whitespace-nowrap">{cell(portion.nutrients[r.key as AnyNutrientKey], r.unit)}</td>}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** The full table behind a native disclosure ("Full nutrition table"): closed by default, keyboard and screen-reader friendly. */
export function FullNutritionTable(props: Parameters<typeof NutritionTable>[0]) {
  return (
    <details className="group rounded-[16px] bg-sunken px-3.5">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-[14px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
        Full nutrition table
        <ChevronDown className="size-[18px] shrink-0 text-subtle transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="pb-2">
        <NutritionTable {...props} />
      </div>
    </details>
  );
}
