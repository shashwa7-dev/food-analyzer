import { Flame } from "lucide-react";
import type { ProgressSummary } from "@/lib/progress/aggregate";
import { calorieBars } from "@/lib/progress/chart-data";
import { grouped } from "@/lib/progress/copy";
import { ChartCard } from "./chart-card";
import { CaloriesChart } from "./charts";

/** Calories per day against the target (spec §6.12), with the mock's Under / Over key. */
export function CaloriesCard({ summary, today, className }: { summary: ProgressSummary; today: string; className?: string }) {
  const target = summary.targets.energyKcal;
  const bars = calorieBars(summary.days, target, today);
  const over = bars.filter((b) => b.over).length;
  const label = `Calories per day for the last ${bars.length} days against a ${grouped(target)} kcal target: ${over} of ${summary.kpis.daysLogged} logged days over.`;
  return (
    <ChartCard
      icon={Flame}
      title="Calories"
      className={className}
      aside={
        <span className="inline-flex items-center gap-[5px] whitespace-nowrap text-xs text-subtle" aria-hidden>
          <i className="ml-1.5 size-2.5 rounded-[3px] bg-brand" />Under
          <i className="ml-1.5 size-2.5 rounded-[3px] bg-[repeating-linear-gradient(45deg,var(--fat)_0_2px,var(--fat-soft)_2px_4px)]" />Over
        </span>
      }
    >
      <div role="img" aria-label={label}>
        <CaloriesChart bars={bars} target={target} />
      </div>
    </ChartCard>
  );
}
