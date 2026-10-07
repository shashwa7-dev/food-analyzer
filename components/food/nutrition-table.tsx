import type { NutrientKey, Nutrients, Provenance } from "@/lib/nutrition/types";

export const PROVENANCE_LABEL: Record<Provenance, string> = {
  reference: "Reference data", community: "Community data", label: "Read from label", estimate: "Estimated",
};
const PROVENANCE_DOT: Record<Provenance, string> = { reference: "bg-ok", community: "bg-ok", label: "bg-accent", estimate: "bg-warn" };

const ROWS: [label: string, key: NutrientKey, unit: "kcal" | "g" | "mg"][] = [
  ["Calories", "energyKcal", "kcal"], ["Protein", "protein", "g"], ["Carbs", "carbs", "g"], ["Sugars", "sugars", "g"],
  ["Fat", "fat", "g"], ["Saturated fat", "satFat", "g"], ["Fibre", "fibre", "g"], ["Sodium", "sodiumMg", "mg"],
];

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
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-subtle">
      <span className={`size-[7px] rounded-full ${PROVENANCE_DOT[p]}`} aria-hidden />{PROVENANCE_LABEL[p]}
    </span>
  );
}

/**
 * Nutrition card body for one portion: the heading carries the provenance most values share; a row
 * whose value came from somewhere else (e.g. an estimated sodium on a label scan) is tagged itself.
 */
export function NutritionTable({ nutrients, provenance, portionLabel, grams, unit }: {
  nutrients: Nutrients; provenance: Partial<Record<NutrientKey, Provenance>>;
  portionLabel: string; grams: number | null; unit: "g" | "ml";
}) {
  const main = dominantProvenance(provenance);
  return (
    <>
      <div className="flex items-center justify-between"><h2 className="section-title">Nutrition</h2><ProvenanceTag p={main} /></div>
      <div className="mb-1.5 mt-1 text-sm text-subtle">For {portionLabel}{grams && <> (<span className="num">{grams} {unit}</span>)</>}</div>
      <table className="w-full text-sm"><tbody>
        {ROWS.filter(([, k]) => nutrients[k] !== undefined).map(([l, k, u]) => {
          const v = nutrients[k]!;
          const own = provenance[k];
          return (
            <tr key={k} className="border-b border-line">
              <td className="py-2.5">{l}{own && own !== main && <span className="ml-2"><ProvenanceTag p={own} /></span>}</td>
              <td className="num py-2.5 text-right">{u === "g" ? Math.round(v * 10) / 10 : Math.round(v)} {u}</td>
            </tr>
          );
        })}
      </tbody></table>
    </>
  );
}
