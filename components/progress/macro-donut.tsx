import type { CSSProperties } from "react";
import { Drumstick } from "lucide-react";
import type { ProgressSummary } from "@/lib/progress/aggregate";
import { grouped } from "@/lib/progress/copy";
import { ChartCard, LegendList } from "./chart-card";
import { Donut } from "./charts";
import { token } from "./chart-theme";

const MACROS = [
  { key: "protein", label: "Protein", color: token("protein") },
  { key: "carbs", label: "Carbs", color: token("carbs") },
  { key: "fat", label: "Fat", color: token("fat") },
] as const;

/** Macro split (spec §6.12): % of kcal from protein×4, carbs×4, fat×9, donut with avg kcal in the middle. */
export function MacroSplitCard({ split, avgKcal, className }: { split: ProgressSummary["macroSplit"]; avgKcal: number; className?: string }) {
  const label = `Macro split: ${MACROS.map((m) => `${m.label.toLowerCase()} ${split[m.key]}%`).join(", ")} of calories.`;
  return (
    <ChartCard icon={Drumstick} title="Macro split" className={className}>
      <div className="flex items-center gap-5" style={{ "--donut": "120px" } as CSSProperties}>
        <div role="img" aria-label={label}>
          <Donut size={120} thickness={18} center={grouped(avgKcal)} slices={MACROS.map((m) => ({ name: m.key, value: split[m.key], color: m.color }))} />
        </div>
        <LegendList items={MACROS.map((m) => ({ key: m.key, label: m.label, value: `${split[m.key]}%`, swatch: m.color }))} />
      </div>
    </ChartCard>
  );
}
